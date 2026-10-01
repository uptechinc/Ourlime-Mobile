import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, collection, query, where, orderBy, documentId, startAfter, limit, getDocs } from 'firebase/firestore';
import { nativeSessionService } from './NativeSessionService';
import { durableWorkService } from './DurableWorkService';
import { reliabilityDecoder as decode } from './ReliabilityDecoderService';
import { contentDraftService } from './ContentDraftService';
import { pageAccessService } from './PageAccessService';
import { contentDateService } from './ContentDateService';
import type { SellerApplication, SellerFile, SellerFileKind, SellerReviewDecision } from '@/lib/types/reliability';

type PendingSellerUpload = { kind: SellerFileKind; uri: string; name: string; size: number; contentType: string; id: string | null; path: string | null; uploaded: boolean };
type SavedApplication = { application: SellerApplication; operationId: string };
export class SellerVerificationService {
  private static instance: SellerVerificationService;
  public static getInstance(): SellerVerificationService { return this.instance ??= new SellerVerificationService(); }
  private decodeFile = (value: unknown): SellerFile => {
    const file = decode.object(value);
    const kind = decode.string(file.kind);
    if (!['governmentId', 'proofOfAddress', 'businessRegistration', 'logo'].includes(kind)) throw new Error('Unknown file kind.');
    return { id: decode.string(file.id), kind: kind as SellerFileKind, name: decode.string(file.name), path: decode.string(file.path), contentType: decode.string(file.contentType), size: decode.integer(file.size) };
  };
  public decodeApplication = (value: unknown): SellerApplication => {
    const application = decode.object(value);
    const status = decode.string(application.status);
    if (!['draft', 'submitted', 'changes_requested', 'approved', 'rejected', 'suspended'].includes(status)) throw new Error('Unknown seller application status.');
    return { ownerId: decode.string(application.ownerId), revision: decode.integer(application.revision), status: status as SellerApplication['status'], name: decode.string(application.name), email: decode.string(application.email), phone: decode.string(application.phone), storeName: decode.string(application.storeName), description: decode.string(application.description),
      categories: decode.strings(application.categories), isBusiness: application.isBusiness === true, acceptedTerms: application.acceptedTerms === true, files: decode.list(application.files, this.decodeFile) };
  };
  private decodeSaved = (value: unknown): SavedApplication => {
    const saved = decode.object(value);
    return { application: this.decodeApplication(saved.application), operationId: decode.string(saved.operationId) };
  };
  public async load(ownerId: string): Promise<SellerApplication> {
    nativeSessionService.assertOwner(ownerId);
    const saved = await durableWorkService.read(ownerId, 'seller', 'application', this.decodeSaved);
    if (saved) return saved.value.application;
    return { ownerId, revision: 0, status: 'draft', name: '', email: '', phone: '', storeName: '', description: '', categories: [], isBusiness: false, acceptedTerms: false, files: [] };
  }
  public async save(application: SellerApplication): Promise<void> {
    nativeSessionService.assertOwner(application.ownerId);
    const stored = await durableWorkService.read(application.ownerId, 'seller', 'application', this.decodeSaved);
    await durableWorkService.write(application.ownerId, 'seller', 'application', { application, operationId: stored?.value.operationId ?? await contentDraftService.newId() }, stored?.revision ?? 0);
  }
  public async remote(ownerId: string): Promise<SellerApplication | null> {
    await nativeSessionService.ensure(ownerId);
    const snapshot = await getDoc(doc(db, 'sellerApplications', ownerId));
    nativeSessionService.assertOwner(ownerId);
    return snapshot.exists() ? this.decodeApplication(snapshot.data()) : null;
  }
  public shouldAdoptRemote(local: SellerApplication, remote: SellerApplication): boolean {
    if (local.ownerId !== remote.ownerId || remote.revision < local.revision) return false;
    if (remote.revision > local.revision) return true;
    // A revised local form deliberately shares the last reviewed revision until submission.
    return local.status !== 'draft' && remote.status !== 'draft';
  }
  private decodePending = (value: unknown): PendingSellerUpload => {
    const entry = decode.object(value);
    const kind = decode.string(entry.kind);
    if (!['governmentId', 'proofOfAddress', 'businessRegistration', 'logo'].includes(kind)) throw new Error('Invalid saved upload kind.');
    return { kind: kind as SellerFileKind, uri: decode.string(entry.uri), name: decode.string(entry.name), size: decode.integer(entry.size), contentType: decode.string(entry.contentType), id: entry.id === null ? null : decode.string(entry.id), path: entry.path === null ? null : decode.string(entry.path), uploaded: entry.uploaded === true };
  };
  public async pendingUploads(ownerId: string): Promise<PendingSellerUpload[]> {
    nativeSessionService.assertOwner(ownerId);
    const entries = [];
    for (const kind of ['governmentId', 'proofOfAddress', 'businessRegistration', 'logo'] as const) {
      const stored = await durableWorkService.read(ownerId, 'seller', `upload_${kind}`, this.decodePending);
      if (stored) entries.push(stored.value);
    }
    return entries;
  }
  public async discardUpload(ownerId: string, kind: SellerFileKind): Promise<void> {
    nativeSessionService.assertOwner(ownerId);
    const stored = await durableWorkService.read(ownerId, 'seller', `upload_${kind}`, this.decodePending);
    if (!stored) return;
    const files = await import('expo-file-system/legacy');
    await files.deleteAsync(stored.value.uri, { idempotent: true });
    await durableWorkService.remove(ownerId, 'seller', `upload_${kind}`, stored.revision);
  }
  public async upload(ownerId: string, kind: SellerFileKind, asset: { uri: string; name: string; size?: number; mimeType?: string }, onProgress: (percent: number) => void): Promise<SellerFile> {
    pageAccessService.assertMutation('/market');
    nativeSessionService.assertOwner(ownerId);
    if (!asset.size || asset.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'application/pdf'].includes(asset.mimeType ?? '') || (kind === 'logo' && asset.mimeType === 'application/pdf')) throw new Error('Select a JPEG, PNG, or PDF file up to 10 MB. Logos must be images.');
    const files = await import('expo-file-system/legacy');
    if (!files.documentDirectory) throw new Error('Private device storage is unavailable.');
    const directory = `${files.documentDirectory}seller-private/${ownerId}/`;
    await files.makeDirectoryAsync(directory, { intermediates: true });
    const uri = `${directory}${await contentDraftService.newId()}`;
    await files.copyAsync({ from: asset.uri, to: uri });
    const stored = await durableWorkService.read(ownerId, 'seller', `upload_${kind}`, this.decodePending);
    await durableWorkService.write(ownerId, 'seller', `upload_${kind}`, { kind, uri, name: asset.name, size: asset.size, contentType: asset.mimeType, id: null, path: null, uploaded: false }, stored?.revision ?? 0);
    if (stored) await files.deleteAsync(stored.value.uri, { idempotent: true });
    return this.retryUpload(ownerId, kind, onProgress);
  }
  public async retryUpload(ownerId: string, kind: SellerFileKind, onProgress: (percent: number) => void): Promise<SellerFile> {
    pageAccessService.assertMutation('/market');
    await nativeSessionService.ensure(ownerId);
    const stored = await durableWorkService.read(ownerId, 'seller', `upload_${kind}`, this.decodePending);
    if (!stored) throw new Error('Choose the file again.');
    let revision = stored.revision;
    const upload = stored.value;
    {
      const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
      const result = await httpsCallable(getFunctions(), 'createSellerUpload')({ kind, ...(upload.id ? { resumeId: upload.id } : {}) });
      const intent = decode.object(result.data);
      if (upload.id !== intent.id) upload.uploaded = false;
      upload.id = decode.string(intent.id); upload.path = decode.string(intent.path);
      nativeSessionService.assertOwner(ownerId);
      revision = await durableWorkService.write(ownerId, 'seller', `upload_${kind}`, upload, revision);
    }
    const registry = await getDoc(doc(db, 'sellerUploads', upload.id));
    if (registry.data()?.ready === true) upload.uploaded = true;
    if (!upload.uploaded) {
      const { getStorage, ref, putFile } = await import('@react-native-firebase/storage');
      const task = putFile(ref(getStorage(), upload.path), upload.uri, { contentType: upload.contentType });
      const unsubscribe = task.on('state_changed', (snapshot) => {
        try { nativeSessionService.assertOwner(ownerId); pageAccessService.assertMutation('/market'); onProgress(Math.round(snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes) * 100)); }
        catch { void task.cancel(); }
      });
      try { await task; nativeSessionService.assertOwner(ownerId); upload.uploaded = true; }
      finally { unsubscribe(); }
    }
    await durableWorkService.write(ownerId, 'seller', `upload_${kind}`, upload, revision);
    // Keep the private device copy until the backend has stripped bearer download tokens.
    let ready = registry.data()?.ready === true;
    for (let attempt = 0; !ready && attempt < 20; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      nativeSessionService.assertOwner(ownerId);
      pageAccessService.assertMutation('/market');
      const confirmation = await getDoc(doc(db, 'sellerUploads', upload.id));
      ready = confirmation.data()?.ready === true;
    }
    if (!ready) throw new Error('File is uploaded and awaiting private processing. Retry the saved upload shortly.');
    return { id: upload.id, path: upload.path, kind, name: upload.name, size: upload.size, contentType: upload.contentType };
  }
  public async submit(application: SellerApplication): Promise<SellerApplication> {
    pageAccessService.assertMutation('/market');
    await this.save(application);
    await nativeSessionService.ensure(application.ownerId);
    const saved = await durableWorkService.read(application.ownerId, 'seller', 'application', this.decodeSaved);
    if (!saved) throw new Error('Save the application before submitting.');
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    await httpsCallable(getFunctions(), 'submitSellerApplication')({ application, revision: application.revision, operationId: saved.value.operationId });
    nativeSessionService.assertOwner(application.ownerId);
    const remote = await this.remote(application.ownerId);
    if (!remote) throw new Error('Submission acknowledgement is pending. Retry safely.');
    await this.save(remote);
    return remote;
  }
  public async startRevision(ownerId: string, application: SellerApplication): Promise<SellerApplication> {
    if (!['changes_requested', 'rejected'].includes(application.status)) throw new Error('This application cannot be edited.');
    const saved = await durableWorkService.read(ownerId, 'seller', 'application', this.decodeSaved);
    const next = { ...application, status: 'draft' as const, files: [], acceptedTerms: false };
    await durableWorkService.write(ownerId, 'seller', 'application', { application: next, operationId: await contentDraftService.newId() }, saved?.revision ?? 0);
    return next;
  }
  public async queue(ownerId: string, status: SellerApplication['status'] = 'submitted', cursor: string | null = null): Promise<{ applications: SellerApplication[]; cursor: string | null }> {
    await nativeSessionService.ensure(ownerId);
    const reference = collection(db, 'sellerApplications');
    const snapshot = await getDocs(query(reference, where('status', '==', status), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(30)));
    nativeSessionService.assertOwner(ownerId);
    return { applications: snapshot.docs.map((document: { data: () => unknown }) => this.decodeApplication(document.data())), cursor: snapshot.size === 30 ? snapshot.docs[29].id : null };
  }
  public async history(viewerId: string, sellerId: string, cursor: string | null = null): Promise<{ decisions: SellerReviewDecision[]; cursor: string | null }> {
    await nativeSessionService.ensure(viewerId);
    const snapshot = await getDocs(query(collection(db, 'sellerApplications', sellerId, 'decisions'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(30)));
    nativeSessionService.assertOwner(viewerId);
    return { decisions: snapshot.docs.map((document: { id: string; data: () => unknown }) => {
      const record = decode.object(document.data());
      const status = decode.string(record.status);
      if (!['approved', 'rejected', 'changes_requested', 'suspended'].includes(status)) throw new Error('Invalid review history.');
      return { id: document.id, ownerId: decode.string(record.ownerId), applicationRevision: decode.integer(record.applicationRevision), reviewerId: decode.string(record.reviewerId), status: status as SellerReviewDecision['status'], reason: decode.string(record.reason), decidedAt: contentDateService.formatCommentDate(record.decidedAt) };
    }), cursor: snapshot.size === 30 ? snapshot.docs[29].id : null };
  }
  public async review(ownerId: string, application: SellerApplication, status: SellerReviewDecision['status'], reason: string): Promise<void> {
    await nativeSessionService.ensure(ownerId);
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    await httpsCallable(getFunctions(), 'reviewSellerApplication')({ ownerId: application.ownerId, revision: application.revision, status, reason });
  }
  public async view(ownerId: string, id: string): Promise<string> {
    await nativeSessionService.ensure(ownerId);
    const { getFunctions, httpsCallable } = await import('@react-native-firebase/functions');
    const result = await httpsCallable(getFunctions(), 'viewSellerDocument')({ id });
    nativeSessionService.assertOwner(ownerId);
    return decode.string(decode.object(result.data).url);
  }
}
export const sellerVerificationService = SellerVerificationService.getInstance();
