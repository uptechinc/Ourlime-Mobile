import { adminApiService, AdminApiError } from './AdminApiService';
import { AppServerError } from './AppServerService';

export type GameDifficulty = 'easy' | 'medium' | 'hard';
export const GAME_DIFFICULTIES: readonly GameDifficulty[] = ['easy', 'medium', 'hard'];

export type ManagedGeoLocation = {
  id: string;
  name: string;
  info: string;
  hint?: string;
  imageUrl: string;
  difficulty: GameDifficulty;
  coordinates: { lat: number; lng: number };
  storagePath?: string;
};

export type ManagedWordleWord = { id: string; word: string; definition: string; enabled: boolean };

export type GameContent = { locations: ManagedGeoLocation[]; words: ManagedWordleWord[] };

export type NewGeoLocationInput = {
  name: string;
  difficulty: GameDifficulty;
  info: string;
  hint: string;
  imageUrl: string;
  /** A picked image, uploaded by the server to game-content/trini-geoguesser/{adminId}/. */
  image: { base64: string; mimeType: 'image/jpeg' } | null;
  latitude: number;
  longitude: number;
};

const ROUTE = '/api/admin/game-content';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UNAVAILABLE_MESSAGE = 'Game content management is not available in the app yet. Use ourlime.com/profile/admin/game-content for now.';

/**
 * Trini GeoGuesser locations (locations_{difficulty}) and the Trini Wordle dictionary (triniWordleWords), managed
 * like the website's Game Content Studio. Those collections are closed to clients, so every call goes through the
 * app's adminApi function, which runs the website's /api/admin/game-content handler.
 */
export class AdminGameContentService {
  private static instance: AdminGameContentService;

  private constructor() {}

  public static getInstance(): AdminGameContentService {
    if (!AdminGameContentService.instance) AdminGameContentService.instance = new AdminGameContentService();
    return AdminGameContentService.instance;
  }

  public async fetchContent(): Promise<GameContent> {
    const content = await this.request<Partial<GameContent>>(ROUTE);
    return {
      locations: Array.isArray(content.locations) ? content.locations : [],
      words: Array.isArray(content.words) ? content.words : [],
    };
  }

  public validateCoordinate(kind: 'latitude' | 'longitude', value: string): number | null {
    const parsed = Number(value);
    const limit = kind === 'latitude' ? 90 : 180;
    return value.trim() !== '' && Number.isFinite(parsed) && parsed >= -limit && parsed <= limit ? parsed : null;
  }

  public async addLocation(input: NewGeoLocationInput): Promise<void> {
    const name = input.name.trim();
    if (!name) throw new Error('Enter a name for the location.');
    if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
      throw new Error('Enter a valid latitude and longitude');
    }
    const imageUrl = input.imageUrl.trim();
    if (!input.image && !imageUrl) throw new Error('Upload an image or provide an image URL');
    if (input.image && Math.floor(input.image.base64.length * 0.75) > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.');
    await this.request(ROUTE, {
      method: 'POST',
      body: {
        contentType: 'location',
        name,
        difficulty: input.difficulty,
        info: input.info.trim(),
        hint: input.hint.trim(),
        imageUrl,
        latitude: input.latitude,
        longitude: input.longitude,
        ...(input.image ? { imageBase64: input.image.base64, imageMimeType: input.image.mimeType } : {}),
      },
    });
  }

  /** Saving an existing word replaces its definition (the document id is the lowercase word). */
  public async addWord(word: string, definition: string): Promise<void> {
    const normalizedWord = word.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(normalizedWord)) throw new Error('Word must contain exactly five letters');
    if (!definition.trim()) throw new Error('Enter a definition.');
    await this.request(ROUTE, { method: 'POST', body: { contentType: 'word', word: normalizedWord, definition: definition.trim() } });
  }

  public async deleteLocation(location: ManagedGeoLocation): Promise<void> {
    const query = new URLSearchParams({ contentType: 'location', id: location.id, difficulty: location.difficulty });
    await this.request(`${ROUTE}?${query.toString()}`, { method: 'DELETE' });
  }

  public async deleteWord(word: ManagedWordleWord): Promise<void> {
    const query = new URLSearchParams({ contentType: 'word', id: word.id });
    await this.request(`${ROUTE}?${query.toString()}`, { method: 'DELETE' });
  }

  /** Picks the photo, resized to a JPEG, for upload with a new location. */
  public async prepareImage(localUri: string): Promise<{ base64: string; mimeType: 'image/jpeg'; previewUri: string }> {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const image = await manipulateAsync(localUri, [{ resize: { width: 1600 } }], { compress: 0.82, format: SaveFormat.JPEG, base64: true });
    if (!image.base64) throw new Error('This image could not be read. Try another one.');
    return { base64: image.base64, mimeType: 'image/jpeg', previewUri: image.uri };
  }

  private async request<TResponse>(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; body?: object } = {}): Promise<TResponse> {
    try {
      return await adminApiService.request<TResponse>(path, options);
    } catch (error: unknown) {
      // The adminApi function answers not-found for routes it does not serve yet.
      if (error instanceof AppServerError && error.code === 'not-found') throw new Error(UNAVAILABLE_MESSAGE);
      if (error instanceof AdminApiError) throw new Error(error.message);
      throw error;
    }
  }
}

export const adminGameContentService = AdminGameContentService.getInstance();
