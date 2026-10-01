import { create } from 'zustand';
import type { BlogPage } from '@/lib/types/blog';
import type { ResourceState } from '@/lib/types/resourceState';

type BlogCatalogStore = {
  ownerId: string | null;
  queryKey: string;
  resource: ResourceState<BlogPage>;
  set: (ownerId: string, queryKey: string, resource: ResourceState<BlogPage>) => void;
  reset: (ownerId: string | null, queryKey: string) => void;
};

const empty = (): ResourceState<BlogPage> => ({ data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null });

export const useBlogCatalogStore = create<BlogCatalogStore>((set) => ({
  ownerId: null,
  queryKey: '',
  resource: empty(),
  set: (ownerId, queryKey, resource) => set((state) => (state.ownerId === ownerId && state.queryKey === queryKey ? { resource } : {})),
  reset: (ownerId, queryKey) => set({ ownerId, queryKey, resource: empty() }),
}));
