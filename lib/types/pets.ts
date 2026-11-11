/** Mirrors the website's shared/types/pets.ts (Market → Pets & Adoption). */
export type PetListingMode = 'adoption' | 'sale';
export type PetType = 'Dogs' | 'Cats' | 'Small pets' | 'Other';
export type PetModerationStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type PetSex = 'Male' | 'Female';

export type PetListing = {
  id: string;
  name: string;
  breed: string;
  age: string;
  sex: PetSex;
  location: string;
  distance: string;
  mode: PetListingMode;
  petType: PetType;
  priceLabel: string;
  imageUrl: string;
  isVaccinated: boolean;
  isUrgent?: boolean;
  isVerified?: boolean;
  moderationStatus?: PetModerationStatus;
  ownerId?: string;
  createdAt?: string;
  /** The website's built-in example listings; they cannot receive enquiries. */
  isSample?: boolean;
};

export type CreatePetListingInput = Pick<PetListing, 'name' | 'breed' | 'age' | 'location' | 'mode' | 'petType' | 'isVaccinated'>;

export type CreatePetInterestInput = {
  name: string;
  contact: string;
  message: string;
};

export type PetsFilterValues = {
  isVaccinatedOnly: boolean;
  isVerifiedOnly: boolean;
  isUrgentOnly: boolean;
};
