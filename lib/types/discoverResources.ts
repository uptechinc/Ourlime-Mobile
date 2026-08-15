import type { CommunityCardModel, CommunityCategory } from '@/lib/types/community';
import type { RelationshipSuggestion } from '@/lib/services/RelationshipService';

export type DiscoverCommunity = {
  id: string;
  title: string;
  membershipCount: number;
  imageUrl: string | null;
};

export type DiscoverEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  image: string | null;
};

export type DiscoverJob = {
  id: string;
  role: string;
  company: string;
  type: string;
  salary: string;
  image: string | null;
};

export type DiscoverSectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DiscoverResourceData = {
  suggestedPeople: RelationshipSuggestion[];
  communities: DiscoverCommunity[];
  events: DiscoverEvent[];
  jobs: DiscoverJob[];
  sectionStatus: {
    people: DiscoverSectionStatus;
    communities: DiscoverSectionStatus;
    events: DiscoverSectionStatus;
    jobs: DiscoverSectionStatus;
  };
};

export type CommunitiesResourceData = {
  communities: CommunityCardModel[];
  categories: CommunityCategory[];
  friendCommunityIds: string[];
  friendFilterStatus: DiscoverSectionStatus;
};
