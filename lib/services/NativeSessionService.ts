import { onIdTokenChanged, type User } from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from '@/lib/firebaseConfig';
import { nativeFirebaseEmulatorService } from './NativeFirebaseEmulatorService';

export type NativeSessionStatus = 'idle' | 'bridging' | 'ready' | 'signed_out' | 'retryable_failure';
export type NativeSessionSnapshot = { uid: string | null; generation: number; status: NativeSessionStatus; error: string | null };
type NativeSessionListener = (snapshot: NativeSessionSnapshot) => void;

const NATIVE_FIREBASE_MISSING_MESSAGE = 'This version of the app is missing a required component. Install the latest Ourlime update.';

/** Bridges the existing JS session into native Firebase without persisting credentials. */
export class NativeSessionService {
  private static instance: NativeSessionService;
  private generation = 0;
  private controller: AbortController | null = null;
  private started = false;
  private queue: Promise<void> = Promise.resolve();
  private attempt: Promise<void> = Promise.resolve();
  private lastAttemptAt = 0;
  private previewRoute: string | null = null;
  private accountId: string | null = null;
  private snapshot: NativeSessionSnapshot = { uid: null, generation: 0, status: 'idle', error: null };
  private readonly listeners = new Set<NativeSessionListener>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private failureCount = 0;

  public static getInstance(): NativeSessionService {
    return this.instance ??= new NativeSessionService();
  }

  public start(): void {
    if (this.started || Platform.OS === 'web') return;
    this.started = true;
    onIdTokenChanged(auth, (user) => {
      if (this.accountId !== (user?.uid ?? null)) this.previewRoute = null;
      this.accountId = user?.uid ?? null;
      this.schedule(user);
    });
  }

  private schedule(user: User | null): void {
    this.clearRetry();
    this.lastAttemptAt = Date.now();
    const generation = ++this.generation;
    this.publish({ uid: user?.uid ?? null, generation, status: user ? 'bridging' : 'signed_out', error: null });
    this.controller?.abort();
    this.attempt = this.queue.then(() => this.bridge(user, generation));
    // Keep failures available to ensure(), but do not create an unhandled rejection.
    this.queue = this.attempt.then(() => {}, () => {});
  }

  private async bridge(user: User | null, generation: number): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    // An installed build without the native Firebase modules (an older dev client) can't bridge at all. Report it
    // instead of crashing the app with an uncaught "RNFBAppModule not found"; retrying won't help until it's rebuilt.
    let nativeFirebase: typeof import('@react-native-firebase/auth');
    let nativeAuth: ReturnType<typeof nativeFirebase.getAuth>;
    try {
      nativeFirebase = await import('@react-native-firebase/auth');
      nativeAuth = nativeFirebase.getAuth();
    } catch (error: unknown) {
      // Handled (the status explains it), so a warning rather than a red error overlay in development.
      console.warn('[NativeSessionService.bridge] Error: native Firebase unavailable:', error instanceof Error ? error.message : String(error));
      if (generation === this.generation) {
        this.publish({ uid: user?.uid ?? null, generation, status: user ? 'retryable_failure' : 'signed_out', error: NATIVE_FIREBASE_MISSING_MESSAGE });
      }
      return;
    }
    const { signOut, signInWithCustomToken } = nativeFirebase;
    const timeout = setTimeout(() => controller.abort(), 20000);
    // Native signOut() rejects with auth/no-current-user when nobody is signed in (every fresh install), which used to
    // leave the session stuck on 'bridging' forever. Only sign out a real user, and never fail the bridge over it.
    const signOutNative = async (): Promise<void> => {
      if (!nativeAuth.currentUser) return;
      try { await signOut(nativeAuth); } catch (error: unknown) {
        console.warn('[NativeSessionService.signOutNative] Error:', error instanceof Error ? error.message : 'sign-out failed');
      }
    };
    try {
      await nativeFirebaseEmulatorService.connect();
      if (generation !== this.generation) return;
      if (!user || !user.emailVerified) {
        await signOutNative();
        if (generation === this.generation) this.publish({ uid: null, generation, status: 'signed_out', error: null });
        return;
      }
      if (nativeAuth.currentUser && nativeAuth.currentUser.uid !== user.uid) await signOutNative();
      const token = await user.getIdToken();
      const projectId = auth.app.options.projectId;
      if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) throw new Error('Firebase project configuration is missing.');
      const response = await fetch(nativeFirebaseEmulatorService.nativeSessionUrl(projectId), {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, ...(this.previewRoute ? { 'X-Ourlime-Preview': this.previewRoute } : {}) }, signal: controller.signal,
      });
      if (!response.ok) throw new Error('Your native session could not be verified. Please retry.');
      const value: unknown = await response.json();
      const customToken = value && typeof value === 'object' && 'token' in value && typeof value.token === 'string' ? value.token : '';
      if (!customToken) throw new Error('Your native session could not be verified. Please retry.');
      if (generation !== this.generation || auth.currentUser?.uid !== user.uid) return;
      await signInWithCustomToken(nativeAuth, customToken);
      if (nativeAuth.currentUser?.uid !== user.uid) throw new Error('Your native session could not be verified. Please retry.');

      if (generation !== this.generation || auth.currentUser?.uid !== user.uid) {
        await signOutNative();
      } else {
        this.failureCount = 0;
        this.publish({ uid: user.uid, generation, status: 'ready', error: null });
      }
    } catch (error: unknown) {
      await signOutNative();
      if (generation === this.generation && user && auth.currentUser?.uid === user.uid) {
        this.publish({ uid: user.uid, generation, status: 'retryable_failure', error: this.message(error) });
        this.scheduleRetry(user.uid);
      }
      throw error;
    } finally { clearTimeout(timeout); }
  }

  /** Tries again on its own after a failure (2 s, 5 s, 15 s, then every 30 s) so features unlock without a manual retry. */
  private scheduleRetry(uid: string): void {
    this.clearRetry();
    const delays = [2000, 5000, 15000];
    const delay = delays[this.failureCount] ?? 30000;
    this.failureCount += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (auth.currentUser?.uid !== uid || this.snapshot.status !== 'retryable_failure') return;
      this.schedule(auth.currentUser);
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  public async ensure(ownerId: string): Promise<void> {
    if (Platform.OS === 'web') throw new Error('This workflow requires an Android or iOS development build.');
    this.start();
    if (!ownerId || auth.currentUser?.uid !== ownerId) throw new Error('Your account changed. Reopen this screen.');
    // If user is already verified and active, proceed immediately
    if (this.snapshot.status === 'ready' && this.snapshot.uid === ownerId) return;
    if (!this.generation) this.schedule(auth.currentUser);
    for (let i = 0; i < 5; i++) {
      this.assertOwner(ownerId);
      const generation = this.generation;
      try { await this.attempt; }
      catch {
        this.assertOwner(ownerId);
        if (generation !== this.generation) continue;
      }
      if (generation === this.generation || this.snapshot.status === 'ready') break;
    }
    if (auth.currentUser?.uid !== ownerId) throw new Error('Native sign-in is unavailable. Please retry.');
    if (this.snapshot.status !== 'ready' || this.snapshot.uid !== ownerId) throw new Error(this.snapshot.error ?? 'Your native session could not be verified. Please retry.');
  }

  public setPreview(route: string | null): void {
    if (Platform.OS === 'web') return;
    if (route === this.previewRoute) return;
    this.previewRoute = route;
    this.schedule(auth.currentUser);
  }

  public retry(): void { this.schedule(auth.currentUser); }

  public getSnapshot(): NativeSessionSnapshot { return this.snapshot; }

  public subscribe(listener: NativeSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => { this.listeners.delete(listener); };
  }

  public assertOwner(ownerId: string): void {
    if (!ownerId || auth.currentUser?.uid !== ownerId) throw new Error('Your account changed. Reopen this screen.');
  }

  private publish(snapshot: NativeSessionSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private message(error: unknown): string {
    if (error instanceof Error && error.name === 'AbortError') return 'Sign-in verification timed out. Please retry.';
    return error instanceof Error && error.message ? error.message : 'Native sign-in is unavailable. Please retry.';
  }
}

export const nativeSessionService = NativeSessionService.getInstance();
