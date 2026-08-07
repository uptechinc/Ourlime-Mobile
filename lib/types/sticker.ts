import { Timestamp } from 'firebase/firestore';

export type Sticker = {
  id: string;
  name: string;
  keywords: string[];
  category: string;
  packId: string;
  imageUrl: string;
  width: number;
  height: number;
  order: number;
  enabled: boolean;
  isAnimated: boolean;
  createdAt: Timestamp;
};

export type StickerPack = {
  id: string;
  name: string;
  description: string;
  icon: string;
  coverImage: string;
  folder: string;
  order: number;
  enabled: boolean;
  createdAt?: Timestamp;
};

export type StickerSearchParams = {
  query?: string;
  packId?: string;
  category?: string;
};
