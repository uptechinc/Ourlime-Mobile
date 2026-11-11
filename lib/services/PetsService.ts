import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, limit, query, setDoc, where, type DocumentData } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import type { CreatePetInterestInput, CreatePetListingInput, PetListing, PetListingMode, PetModerationStatus, PetType, PetsFilterValues } from '@/lib/types/pets';

export const PET_TYPES: readonly PetType[] = ['Dogs', 'Cats', 'Small pets', 'Other'];
/** The website's location picker on /market/pets. */
export const PET_LOCATIONS: readonly string[] = ['All locations', 'Port of Spain', 'San Juan', 'Chaguanas', 'Arima', 'Couva', 'Tunapuna'];
/** "nearby" counts shown on the website's pet type cards. */
export const PET_TYPE_COUNTS: Readonly<Record<PetType, number>> = { Dogs: 84, Cats: 61, 'Small pets': 23, Other: 15 };
export const EMPTY_PET_FILTERS: PetsFilterValues = { isVaccinatedOnly: false, isVerifiedOnly: false, isUrgentOnly: false };
/** The website's default photo for new listings (its List a pet form has no photo picker). */
export const DEFAULT_PET_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=85';

/** The example listings the website shows after the real ones (PetsMarketPageContent PET_LISTINGS). */
export const SAMPLE_PET_LISTINGS: readonly PetListing[] = [
  { id: 'milo', name: 'Milo', breed: 'Potcake mix', age: '1 year', sex: 'Male', location: 'Port of Spain', distance: '2.4 km', mode: 'adoption', petType: 'Dogs', priceLabel: 'Free adoption', imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=85', isVaccinated: true, isUrgent: true, isVerified: true, isSample: true },
  { id: 'luna', name: 'Luna', breed: 'Domestic shorthair', age: '8 months', sex: 'Female', location: 'San Juan', distance: '5.1 km', mode: 'adoption', petType: 'Cats', priceLabel: 'Free adoption', imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=85', isVaccinated: true, isVerified: true, isSample: true },
  { id: 'coco', name: 'Coco', breed: 'Mixed breed', age: '3 months', sex: 'Female', location: 'Chaguanas', distance: '18 km', mode: 'adoption', petType: 'Dogs', priceLabel: 'Free adoption', imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=85', isVaccinated: false, isUrgent: true, isSample: true },
  { id: 'archie', name: 'Archie', breed: 'Golden retriever', age: '10 weeks', sex: 'Male', location: 'Arima', distance: '27 km', mode: 'sale', petType: 'Dogs', priceLabel: 'TT$3,200', imageUrl: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=85', isVaccinated: true, isVerified: true, isSample: true },
  { id: 'pepper', name: 'Pepper', breed: 'Domestic longhair', age: '5 months', sex: 'Female', location: 'Couva', distance: '31 km', mode: 'sale', petType: 'Cats', priceLabel: 'TT$800', imageUrl: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=900&q=85', isVaccinated: true, isVerified: true, isSample: true },
  { id: 'rio', name: 'Rio', breed: 'Lovebird', age: '7 months', sex: 'Male', location: 'Tunapuna', distance: '14 km', mode: 'sale', petType: 'Other', priceLabel: 'TT$450', imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=900&q=85', isVaccinated: false, isSample: true },
];

export type PetShelter = { name: string; location: string; specialty: string; hours: string; phone: string; availablePets: number };
export const PET_SHELTERS: readonly PetShelter[] = [
  { name: "Tardieu's Kitten & Puppy Sanctuary", location: 'Claxton Bay', specialty: 'Kittens, puppies, and emergency rescue', hours: 'Visits by appointment', phone: '(868) 555-0142', availablePets: 18 },
  { name: 'Animal Welfare Network', location: 'Port of Spain', specialty: 'Rescue, fostering, and community outreach', hours: 'Mon–Sat · 9 AM–4 PM', phone: '(868) 555-0188', availablePets: 24 },
  { name: 'The Mustapha Project', location: 'Chaguanas', specialty: 'Dogs, rehabilitation, and rehoming', hours: 'Weekends · 10 AM–3 PM', phone: '(868) 555-0116', availablePets: 11 },
];

export type PetSafetyStepKey = 'meet' | 'ownership' | 'health' | 'deposit';
export const PET_SAFETY_STEPS: readonly { key: PetSafetyStepKey; title: string; description: string }[] = [
  { key: 'meet', title: 'Meet in person', description: 'Meet the pet and current carer in a safe place. Observe temperament and ask about daily routines.' },
  { key: 'ownership', title: 'Confirm ownership', description: 'Ask for identification, ownership history, and any adoption or purchase agreement before committing.' },
  { key: 'health', title: 'Review health records', description: 'Check vaccination, deworming, spay or neuter, and recent veterinary records where applicable.' },
  { key: 'deposit', title: 'Avoid advance deposits', description: 'Never send money before meeting the pet and confirming that the listing and person are legitimate.' },
];

const FAVORITES_KEY = 'ourlime_pet_favorites';

const text = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback;
const isPetType = (value: unknown): value is PetType => value === 'Dogs' || value === 'Cats' || value === 'Small pets' || value === 'Other';
const isListingMode = (value: unknown): value is PetListingMode => value === 'adoption' || value === 'sale';
const isModerationStatus = (value: unknown): value is PetModerationStatus => value === 'pending' || value === 'approved' || value === 'rejected' || value === 'removed';

/**
 * Market → Pets & Adoption, reading and writing the same petListings / petEnquiries records as the website's /api/pets
 * routes, directly in Firestore (firestore.rules keeps new listings pending and unverified for moderation).
 */
export class PetsService {
  private static instance: PetsService;
  public static getInstance(): PetsService { return this.instance ??= new PetsService(); }

  /** Approved listings plus the signer's own (pending) ones, newest first — the website then appends its examples. */
  public async fetchListings(): Promise<PetListing[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to see pet listings.');
    const listings = collection(db, 'petListings');
    const [approved, own] = await Promise.all([
      getDocs(query(listings, where('moderationStatus', '==', 'approved'), limit(100))),
      getDocs(query(listings, where('ownerId', '==', userId), limit(50))).catch((error: unknown) => {
        console.error('[PetsService.fetchListings] Error:', error instanceof Error ? error.message : 'Own listings unavailable');
        return null;
      }),
    ]);
    const byId = new Map<string, PetListing>();
    for (const entry of [...approved.docs, ...(own?.docs ?? [])]) {
      const listing = this.mapListing(entry.id, entry.data());
      if (listing.moderationStatus === 'approved' || listing.moderationStatus === 'pending') byId.set(listing.id, listing);
    }
    return [...byId.values()].sort((first, second) => (second.createdAt ?? '').localeCompare(first.createdAt ?? ''));
  }

  /** Website PetsService.createListing: the same fields and limits, saved as a pending, unverified listing. */
  public async createListing(input: CreatePetListingInput): Promise<PetListing> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to list a pet.');
    const reference = doc(collection(db, 'petListings'));
    const listing: PetListing = {
      id: reference.id,
      name: this.requireText(input.name, 'Pet name', 80),
      breed: this.requireText(input.breed, 'Breed', 100),
      age: this.requireText(input.age, 'Age', 40),
      location: this.requireText(input.location, 'Location', 120),
      sex: 'Male',
      mode: input.mode,
      petType: input.petType,
      priceLabel: input.mode === 'adoption' ? 'Free adoption' : 'Contact owner',
      imageUrl: DEFAULT_PET_IMAGE,
      isVaccinated: input.isVaccinated,
      distance: 'Nearby',
      ownerId: userId,
      moderationStatus: 'pending',
      isVerified: false,
      isUrgent: false,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(reference, listing);
      return listing;
    } catch (error: unknown) {
      console.error('[PetsService.createListing] Error:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Could not create pet listing. Make sure your email is verified and try again.');
    }
  }

  /** Website PetsService.createInterest: an enquiry for the listing's owner (approved listings only, never your own). */
  public async createInterest(listing: PetListing, input: CreatePetInterestInput): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to send an enquiry.');
    if (listing.isSample) throw new Error('This is an example listing, so it cannot receive enquiries yet.');
    if (listing.ownerId === userId) throw new Error('You cannot enquire about your own listing.');
    if (listing.moderationStatus !== 'approved') throw new Error('This listing is not accepting enquiries.');
    const reference = doc(collection(db, 'petEnquiries'));
    try {
      await setDoc(reference, {
        id: reference.id,
        petId: listing.id,
        petName: listing.name,
        ownerId: listing.ownerId ?? null,
        requesterId: userId,
        name: this.requireText(input.name, 'Name', 100),
        contact: this.requireText(input.contact, 'Contact', 160),
        message: this.requireText(input.message, 'Message', 1000),
        status: 'new',
        createdAt: new Date().toISOString(),
      });
      return reference.id;
    } catch (error: unknown) {
      if (error instanceof Error && /is (required|too long)\.$/.test(error.message)) throw error;
      console.error('[PetsService.createInterest] Error:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Could not send pet enquiry.');
    }
  }

  /** Website PetsMarketPageContent visiblePetListings. */
  public filter(listings: readonly PetListing[], options: { mode: PetListingMode; search: string; petType: PetType | null; location: string; filters: PetsFilterValues }): PetListing[] {
    const search = options.search.trim().toLocaleLowerCase();
    return listings.filter((listing) => listing.mode === options.mode
      && (!options.petType || listing.petType === options.petType)
      && (options.location === 'All locations' || listing.location === options.location)
      && (!options.filters.isVaccinatedOnly || listing.isVaccinated)
      && (!options.filters.isVerifiedOnly || listing.isVerified === true)
      && (!options.filters.isUrgentOnly || listing.isUrgent === true)
      && (!search || listing.name.toLocaleLowerCase().includes(search) || listing.breed.toLocaleLowerCase().includes(search) || listing.location.toLocaleLowerCase().includes(search)));
  }

  /** Favourites stay on the device, like the website's localStorage list. */
  public async loadFavorites(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((petId): petId is string => typeof petId === 'string') : [];
    } catch (error: unknown) {
      console.error('[PetsService.loadFavorites] Error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  public async saveFavorites(petIds: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(petIds));
    } catch (error: unknown) {
      console.error('[PetsService.saveFavorites] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private requireText(value: string, fieldName: string, maximumLength: number): string {
    const trimmed = value.trim();
    if (!trimmed) throw new Error(`${fieldName} is required.`);
    if (trimmed.length > maximumLength) throw new Error(`${fieldName} is too long.`);
    return trimmed;
  }

  private mapListing(id: string, data: DocumentData): PetListing {
    return {
      id,
      name: text(data.name, 'Pet'),
      breed: text(data.breed, 'Mixed breed'),
      age: text(data.age, 'Age unknown'),
      sex: data.sex === 'Female' ? 'Female' : 'Male',
      location: text(data.location, 'Trinidad & Tobago'),
      distance: text(data.distance, 'Nearby'),
      mode: isListingMode(data.mode) ? data.mode : 'adoption',
      petType: isPetType(data.petType) ? data.petType : 'Other',
      priceLabel: text(data.priceLabel, 'Contact owner'),
      imageUrl: text(data.imageUrl, ''),
      isVaccinated: data.isVaccinated === true,
      isUrgent: data.isUrgent === true,
      isVerified: data.isVerified === true,
      moderationStatus: isModerationStatus(data.moderationStatus) ? data.moderationStatus : 'pending',
      ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    };
  }
}

export const petsService = PetsService.getInstance();
