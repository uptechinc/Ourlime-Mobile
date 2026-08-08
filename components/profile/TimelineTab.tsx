import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { PostService, type PostItem, type FeedFilter } from '@/lib/services/PostService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { FeedsFilterSection } from '@/components/home/MiddleSection/MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';

type TimelineTabProps = {
  userId: string;
};

const postService = PostService.getInstance();

export default function TimelineTab({ userId }: TimelineTabProps) {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Photos' | 'Videos' | 'Sound' | 'Polls' | 'Events'>('All');
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const loadUserPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await postService.fetchFeedPage({
        authorId: userId,
        limit: 20,
      });
      setPosts(page.posts);
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUserPosts();
  }, [loadUserPosts]);

  const activePost = activePostId ? posts.find((p) => p.id === activePostId) ?? null : null;

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <FeedsFilterSection
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </View>

      {posts.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, color: '#64748b', fontWeight: '500' }}>No posts yet</Text>
        </View>
      ) : (
        posts.map((post) => (
          <View key={post.id} style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <PostCardSection
              post={post}
              isVisible={true}
              onCommentClick={(id) => setActivePostId(id)}
              onPostDelete={(id) => setPosts((curr) => curr.filter((p) => p.id !== id))}
              onAuthorBlocked={() => {}}
              onPostUpdate={(updated) => setPosts((curr) => curr.map((p) => (p.id === updated.id ? updated : p)))}
            />
          </View>
        ))
      )}

      {activePost && (
        <CommentsModal
          post={activePost}
          userId={userId}
          onClose={() => setActivePostId(null)}
          onPostUpdate={(updated) => setPosts((curr) => curr.map((p) => (p.id === updated.id ? updated : p)))}
        />
      )}
    </View>
  );
}
