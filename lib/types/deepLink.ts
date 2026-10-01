export type ShareableEntityKind =
  | 'post'
  | 'profile'
  | 'community'
  | 'blog'
  | 'lime'
  | 'event'
  | 'job'
  | 'market-product'
  | 'admin-report';

export type DeepLinkDestination =
  | { kind: 'post'; postId: string }
  | { kind: 'profile'; username: string }
  | { kind: 'community'; identifier: string }
  | { kind: 'blogs' }
  | { kind: 'blog'; blogId: string }
  | { kind: 'lime'; limeId: string }
  | { kind: 'event'; eventId: string | null }
  | { kind: 'job'; jobId: string | null }
  | { kind: 'market-product'; productId: string | null }
  | { kind: 'admin-report'; reportId: string }
  | { kind: 'ehub' }
  | { kind: 'elearning'; path?: string }
  | { kind: 'projects'; projectId?: string }
  | { kind: 'register'; referralToken?: string };

export type DeepLinkResolution =
  | {
      kind: 'internal';
      destination: DeepLinkDestination;
      route: string;
      sourceUrl: string;
    }
  | {
      kind: 'external';
      url: string;
    }
  | {
      kind: 'invalid';
      reason: 'empty' | 'malformed' | 'unsupported';
    };

export type PendingDeepLink = {
  route: string;
  sourceUrl: string;
  receivedAt: number;
};
