import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { AudioPlayer } from 'expo-audio';
import { NativeModules, Platform } from 'react-native';
import { validateNotificationSoundFile } from './notificationSoundRules';

export type NotificationSoundKind = 'call' | 'message';
export type NotificationSoundMode = 'system' | 'custom';
export type NotificationSoundPreference = {
  mode: NotificationSoundMode;
  fileName: string | null;
  fileUri: string | null;
};
export type NotificationSoundPreferences = {
  call: NotificationSoundPreference;
  message: NotificationSoundPreference;
};

const STORAGE_KEY = 'ourlime:notification-sound-preferences:v1';
const SYSTEM_SOUND: NotificationSoundPreference = { mode: 'system', fileName: null, fileUri: null };

type AndroidNotificationAudioPolicyModule = {
  canPlayNotificationAudio: () => Promise<boolean>;
};

const isPreference = (value: unknown): value is NotificationSoundPreference => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { mode?: unknown; fileName?: unknown; fileUri?: unknown };
  return (candidate.mode === 'system' || candidate.mode === 'custom')
    && (candidate.fileName === null || typeof candidate.fileName === 'string')
    && (candidate.fileUri === null || typeof candidate.fileUri === 'string');
};

export class NotificationSoundPreferenceService {
  private static instance: NotificationSoundPreferenceService;
  private readonly players = new Map<NotificationSoundKind, AudioPlayer>();

  private constructor() {}

  public static getInstance(): NotificationSoundPreferenceService {
    if (!NotificationSoundPreferenceService.instance) NotificationSoundPreferenceService.instance = new NotificationSoundPreferenceService();
    return NotificationSoundPreferenceService.instance;
  }

  public async getPreferences(): Promise<NotificationSoundPreferences> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { call: SYSTEM_SOUND, message: SYSTEM_SOUND };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { call: SYSTEM_SOUND, message: SYSTEM_SOUND };
      const candidate = parsed as { call?: unknown; message?: unknown };
      const storedCall = isPreference(candidate.call) ? candidate.call : SYSTEM_SOUND;
      const storedMessage = isPreference(candidate.message) ? candidate.message : SYSTEM_SOUND;
      const preferences = {
        call: await this.recoverMissingFile(storedCall),
        message: await this.recoverMissingFile(storedMessage),
      };
      if ((storedCall.mode === 'custom' && preferences.call.mode === 'system')
        || (storedMessage.mode === 'custom' && preferences.message.mode === 'system')) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      }
      return preferences;
    } catch {
      return { call: SYSTEM_SOUND, message: SYSTEM_SOUND };
    }
  }

  public async importMp3(kind: NotificationSoundKind): Promise<NotificationSoundPreference | null> {
    const selection = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp3'], copyToCacheDirectory: true, multiple: false });
    if (selection.canceled) return null;
    const asset = selection.assets[0];
    const fileName = asset.name.trim();
    const validationError = validateNotificationSoundFile({ fileName, mimeType: asset.mimeType, size: asset.size });
    if (validationError) throw new Error(validationError);
    const soundsDirectory = new Directory(Paths.document, 'notification-sounds');
    soundsDirectory.create({ intermediates: true, idempotent: true });
    const destination = new File(soundsDirectory, `${kind}-${Date.now()}.mp3`);
    await new File(asset.uri).copy(destination, { overwrite: true });
    const preference: NotificationSoundPreference = { mode: 'custom', fileName, fileUri: destination.uri };
    await this.replacePreference(kind, preference);
    return preference;
  }

  public async reset(kind: NotificationSoundKind): Promise<NotificationSoundPreference> {
    await this.replacePreference(kind, SYSTEM_SOUND);
    return SYSTEM_SOUND;
  }

  public async preview(kind: NotificationSoundKind): Promise<boolean> {
    return this.play(kind, false);
  }

  public async playIncomingCallSound(): Promise<boolean> {
    return this.play('call', true);
  }

  public async playMessageSound(): Promise<boolean> {
    return this.play('message', false);
  }

  public stop(kind?: NotificationSoundKind): void {
    const kinds: NotificationSoundKind[] = kind ? [kind] : ['call', 'message'];
    kinds.forEach((soundKind) => {
      const player = this.players.get(soundKind);
      if (!player) return;
      player.pause();
      player.remove();
      this.players.delete(soundKind);
    });
  }

  private async play(kind: NotificationSoundKind, loop: boolean): Promise<boolean> {
    if (Platform.OS === 'android') {
      const modules = NativeModules as { OurlimeIncomingCall?: AndroidNotificationAudioPolicyModule };
      const audioPolicyModule = modules.OurlimeIncomingCall;
      if (audioPolicyModule) {
        const canPlay = await audioPolicyModule.canPlayNotificationAudio().catch(() => false);
        if (!canPlay) return false;
      }
    }
    const preference = (await this.getPreferences())[kind];
    if (preference.mode !== 'custom' || !preference.fileUri) return false;
    const file = new File(preference.fileUri);
    if (!file.exists) {
      await this.reset(kind);
      return false;
    }
    this.stop(kind);
    const Audio = await import('expo-audio');
    await Audio.setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: kind === 'call' ? 'doNotMix' : 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    const player = Audio.createAudioPlayer({ uri: preference.fileUri });
    player.loop = loop;
    player.volume = 1;
    player.play();
    this.players.set(kind, player);
    return true;
  }

  private async replacePreference(kind: NotificationSoundKind, preference: NotificationSoundPreference): Promise<void> {
    this.stop(kind);
    const current = await this.getPreferences();
    const previous = current[kind];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [kind]: preference }));
    if (previous.mode === 'custom' && previous.fileUri && previous.fileUri !== preference.fileUri) {
      const previousFile = new File(previous.fileUri);
      if (previousFile.exists) previousFile.delete();
    }
  }

  private async recoverMissingFile(preference: NotificationSoundPreference): Promise<NotificationSoundPreference> {
    if (preference.mode !== 'custom' || !preference.fileUri) return SYSTEM_SOUND;
    return new File(preference.fileUri).exists ? preference : SYSTEM_SOUND;
  }
}

export const notificationSoundPreferenceService = NotificationSoundPreferenceService.getInstance();
