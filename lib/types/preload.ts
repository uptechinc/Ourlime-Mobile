export type PreloadPriority = 'critical' | 'navigation' | 'background';
export type PreloadMediaPolicy = 'metadata' | 'thumbnail';
export type PagePreloadPolicy = 'startup' | 'parent-driven' | 'interaction-only' | 'none';

export type PreloadTask = {
  key: string;
  route: string;
  priority: PreloadPriority;
  mediaPolicy: PreloadMediaPolicy;
  run: () => Promise<void>;
};

export type PagePreloadRegistration = {
  route: string;
  policy: PagePreloadPolicy;
  resource: 'feed' | 'discover' | 'communities' | 'conversations' | 'profile' | 'admin' | 'static' | 'dynamic';
};
