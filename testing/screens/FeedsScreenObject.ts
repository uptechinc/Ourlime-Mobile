import { extractYouTubeVideoId } from '@/lib/utils/youtubeUtils';
import type { FeedFilter, FeedSource } from '@/components/home/MiddleSection/MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';
import { mockPosts } from '../mocks/mockPosts';
import type { PostItem } from '@/lib/services/PostService';

export class FeedsScreenObject {
  private activeFilter: FeedFilter = 'All';
  private activeSource: FeedSource = 'home';
  private posts: PostItem[] = [...mockPosts];

  public setFilter(filter: FeedFilter): { allowed: boolean; isComingSoon: boolean } {
    if (filter === 'Sound') {
      return { allowed: false, isComingSoon: true };
    }
    this.activeFilter = filter;
    return { allowed: true, isComingSoon: false };
  }

  public getActiveFilter(): FeedFilter {
    return this.activeFilter;
  }

  public setFeedSource(source: FeedSource) {
    this.activeSource = source;
  }

  public getActiveSource(): FeedSource {
    return this.activeSource;
  }

  public getPosts(): PostItem[] {
    return this.posts;
  }

  public toggleLike(postId: string, userId: string): PostItem | undefined {
    const post = this.posts.find((p) => p.id === postId);
    if (post) {
      const alreadyLiked = post.likedUserIds.includes(userId);
      if (alreadyLiked) {
        post.likedUserIds = post.likedUserIds.filter((id) => id !== userId);
        post.stats.likes -= 1;
      } else {
        post.likedUserIds.push(userId);
        post.stats.likes += 1;
      }
    }
    return post;
  }

  public parseYouTubeUrl(url: string): string | null {
    return extractYouTubeVideoId(url);
  }
}
