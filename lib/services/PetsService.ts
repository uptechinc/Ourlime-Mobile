import { AppServerError, appServerService } from '@/lib/services/AppServerService';
import type {
  CreatePetInterestInput, CreatePetListingInput, PetAdoptionStatus, PetEnquiry, PetEnquiryStatus, PetHealthStatus, PetListing, PetPhotoPick,
} from '@/lib/types/pets';

export const MAX_PET_PHOTOS = 6;
/** Longest side of a photo after resizing; keeps six photos well inside the callable's request limit. */
const PHOTO_MAX_EDGE = 1600;
const CALL_TIMEOUT_MS = 30_000;
const CREATE_TIMEOUT_MS = 120_000;

export const PET_ADOPTION_STATUS_LABELS: Readonly<Record<PetAdoptionStatus, string>> = {
  available: 'Available',
  adoption_pending: 'Adoption pending',
  adopted: 'Adopted',
};
export const PET_HEALTH_LABELS: Readonly<Record<PetHealthStatus, string>> = { yes: 'Yes', no: 'No', unknown: 'Unknown' };

type InlinePhoto = { contentType: 'image/jpeg'; data: string };

/**
 * Pets for Adoption, on the same server code as the website's /api/pets routes (the petsApi callable runs the
 * website's PetsService). Listings and enquiries are server-only, so the app never writes them to Firestore itself.
 */
export class PetsService {
  private static instance: PetsService;

  private constructor() {}

  public static getInstance(): PetsService {
    if (!PetsService.instance) PetsService.instance = new PetsService();
    return PetsService.instance;
  }

  /** Approved listings, newest first (the website's GET /api/pets). */
  public async fetchListings(): Promise<PetListing[]> {
    const result = await this.call<{ listings: PetListing[] }>({ action: 'list' }, 'Could not load adoption listings.');
    return result.listings;
  }

  /** One listing: approved, or the viewer's own / any for administrators (GET /api/pets/[petId]). */
  public async fetchListing(petId: string): Promise<PetListing> {
    const result = await this.call<{ listing: PetListing }>({ action: 'get', petId }, 'Could not load this pet.');
    return result.listing;
  }

  /** Submits a pet for moderation with 1–6 photos (POST /api/pets). */
  public async createListing(input: CreatePetListingInput, photos: PetPhotoPick[]): Promise<PetListing> {
    if (photos.length < 1 || photos.length > MAX_PET_PHOTOS) throw new Error(`Add between 1 and ${MAX_PET_PHOTOS} photographs.`);
    const inlinePhotos: InlinePhoto[] = [];
    for (const photo of photos) inlinePhotos.push(await this.preparePhoto(photo));
    const result = await this.call<{ listing: PetListing }>({ action: 'create', listing: input, photos: inlinePhotos }, 'Could not submit the listing.', CREATE_TIMEOUT_MS);
    return result.listing;
  }

  /** Sends an adoption enquiry to the carer (POST /api/pets/[petId]/interest). */
  public async createInterest(petId: string, input: CreatePetInterestInput): Promise<string> {
    const result = await this.call<{ enquiryId: string }>({ action: 'interest', petId, enquiry: input }, 'Could not send your enquiry.');
    return result.enquiryId;
  }

  /** Enquiries for pets the viewer submitted (all of them for administrators). */
  public async fetchEnquiries(): Promise<PetEnquiry[]> {
    const result = await this.call<{ enquiries: PetEnquiry[] }>({ action: 'enquiries' }, 'Could not load enquiries.');
    return result.enquiries;
  }

  public async updateEnquiryStatus(enquiryId: string, status: Exclude<PetEnquiryStatus, 'withdrawn'>): Promise<void> {
    await this.call<{ updated: true }>({ action: 'updateEnquiry', enquiryId, status }, 'Could not update the enquiry.');
  }

  public async updateAdoptionStatus(petId: string, status: PetAdoptionStatus): Promise<void> {
    await this.call<{ updated: true }>({ action: 'updateAdoptionStatus', petId, status }, 'Could not update the adoption status.');
  }

  /** Resizes to at most 1600 px and re-encodes as JPEG, so every photo passes the server's type and size checks. */
  private async preparePhoto(photo: PetPhotoPick): Promise<InlinePhoto> {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const longest = Math.max(photo.width, photo.height);
    const resize = longest > PHOTO_MAX_EDGE
      ? [{ resize: photo.width >= photo.height ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE } }]
      : [];
    const image = await manipulateAsync(photo.uri, resize, { compress: 0.75, format: SaveFormat.JPEG, base64: true });
    if (!image.base64) throw new Error('A photo could not be read. Try choosing it again.');
    return { contentType: 'image/jpeg', data: image.base64 };
  }

  private async call<TResult>(data: object, fallbackMessage: string, timeoutMs = CALL_TIMEOUT_MS): Promise<TResult> {
    try {
      return await appServerService.call<TResult>('petsApi', data, timeoutMs);
    } catch (error: unknown) {
      console.error('[PetsService.call] Error:', error instanceof Error ? error.message : 'Unknown error');
      // Server checks send a sentence; a bare code ("not-found", "internal") means the call itself failed.
      const message = error instanceof Error ? error.message.trim() : '';
      const isSentence = message.includes(' ') && !(error instanceof AppServerError && message === error.code);
      throw new Error(isSentence ? message : fallbackMessage);
    }
  }
}

export const petsService = PetsService.getInstance();
