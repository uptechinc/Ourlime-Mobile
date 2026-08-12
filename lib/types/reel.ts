export type ReelUser = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage?: string;
};

export type Reel = {
  id: string;
  user: ReelUser;
  userId: string;
  visibility: string;
  caption?: string;
  media: {
    typeUrl: string;
    type: 'video' | 'image';
  };
  likes?: string[];
  comments?: unknown[];
  views?: number;
  createdAt: unknown;
  // other properties...
};
