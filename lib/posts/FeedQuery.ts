import type { FeedFilter, FeedScope } from '@/lib/services/PostService';

export function buildFeedQuery(options: { limit?: number; cursor?: string | null; filter?: FeedFilter; scope?: FeedScope; authorId?: string }): string {
  const search = new URLSearchParams({ pageSize: String(options.limit ?? 20), filter: options.filter ?? 'all' });
  if (options.cursor) search.set('cursor', options.cursor);
  if (options.authorId) search.set('authorId', options.authorId);
  if (options.scope) search.set('scope', options.scope);
  return search.toString();
}
