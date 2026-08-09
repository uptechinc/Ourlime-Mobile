import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { PostService, type PostItem, type FeedFilter } from '@/lib/services/PostService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { FeedsFilterSection } from '@/components/home/MiddleSection/MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

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

      try {
        const reelsSnap = await getDocs(query(collection(db, 'reels'), where('userId', '==', userId)));
        const reelPosts: PostItem[] = reelsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: userId,
            type: 'regular',
            caption: data.caption || '',
            description: '',
            visibility: data.visibility || 'public',
            hashtags: [],
            media: [
              {
                id: d.id,
                type: 'video',
                typeUrl: data.media?.typeUrl || '',
                fileName: data.media?.fileName || 'reel.mp4',
              },
            ],
            user: data.user || { id: userId, firstName: 'Lime', lastName: 'Creator', userName: 'user' },
            stats: data.stats || { likes: Array.isArray(data.likes) ? data.likes.length : 0, comments: 0, shares: 0 },
            likedUserIds: Array.isArray(data.likes) ? data.likes : [],
            mentions: data.mentions || [],
            friendReferences: [],
            createdAt: data.createdAt ? new Date().toISOString() : new Date().toISOString(),
          };
        });

        const combined = [...reelPosts, ...page.posts];
        setPosts(combined);
      } catch {
        setPosts(page.posts);
      }
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
