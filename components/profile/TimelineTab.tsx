import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import type { FeedFilter } from '@/lib/services/PostService';
import { useFeedQuery } from '@/lib/hooks/useFeedQuery';
import { feedResourceService } from '@/lib/services/FeedResourceService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { FeedsFilterSection, type FeedFilter as UiFeedFilter } from '@/components/home/MiddleSection/MiddleSectionComponent/FeedsFilterSection/FeedsFilterSection';
import { AuthService } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type TimelineTabProps = { userId: string };

const authService = AuthService.getInstance();
const apiFilters: Record<UiFeedFilter, FeedFilter> = { All: 'all', Photos: 'photo', Videos: 'video', Sound: 'audio', Polls: 'poll', Events: 'event' };

export default function TimelineTab({ userId }: TimelineTabProps) {
  const { colors } = useAppTheme();
  const viewerId = authService.getCurrentUser()?.uid ?? userId;
  const isOwnProfile = viewerId === userId;
  const [activeFilter, setActiveFilter] = useState<UiFeedFilter>('All');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const query = { userId: viewerId, scope: 'home' as const, filter: apiFilters[activeFilter], authorId: userId };
  const { resource, refresh, loadMore } = useFeedQuery(query);
  const posts = resource.data?.posts ?? [];
  const activePost = activePostId ? posts.find((post) => post.id === activePostId) ?? null : null;
  const isInitialLoading = !resource.data && (resource.status === 'idle' || resource.status === 'hydrating');

  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <FeedsFilterSection activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </View>

      {isInitialLoading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator size="small" color="#10b981" /></View>
      ) : resource.error && posts.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error.message}</Text>
          <TouchableOpacity onPress={() => void refresh()} style={{ marginTop: 13, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}><Text style={{ fontSize: 15, color: colors.mutedText, fontWeight: '500' }}>No posts yet</Text></View>
      ) : (
        <>
          {posts.map((post) => {
            const isProfileRepost = post.repostedByUserIds?.includes(userId) === true;
            return <View key={post.id} style={{ width: '100%', marginBottom: 12 }}>
              <PostCardSection
                post={post}
                isVisible={true}
                isProfileRepost={isProfileRepost}
                onCommentClick={setActivePostId}
                onPostDelete={(postId) => void feedResourceService.removePosts((item) => item.id === postId)}
                onAuthorBlocked={(authorId) => void feedResourceService.removePosts((item) => item.userId === authorId)}
                onPostUpdate={(updatedPost) => void feedResourceService.patchPost(updatedPost)}
                onRepostRemoved={isOwnProfile && isProfileRepost
                  ? (_postId, updatedPost) => void feedResourceService.reconcileProfileRepostRemoval(query, updatedPost)
                  : undefined}
              />
            </View>;
          })}
          {resource.data?.hasMore ? (
            <TouchableOpacity onPress={() => void loadMore()} style={{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.successSurface }}><Text style={{ color: colors.successText, fontWeight: '700' }}>Load more posts</Text></TouchableOpacity>
          ) : null}
          {resource.error ? <Text style={{ color: colors.mutedText, textAlign: 'center', fontSize: 12 }}>Showing saved posts</Text> : null}
        </>
      )}

      {activePost ? (
        <CommentsModal post={activePost} userId={viewerId} onClose={() => setActivePostId(null)} onPostUpdate={(updatedPost) => void feedResourceService.patchPost(updatedPost)} />
      ) : null}
    </View>
  );
}
