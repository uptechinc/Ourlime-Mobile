import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Reel } from '@/types/userTypes';
import { limeService } from '@/lib/services/LimeService';
import { useFeedQuery } from '@/lib/hooks/useFeedQuery';
import { feedResourceService } from '@/lib/services/FeedResourceService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { AuthService } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ProfileRepostsTabProps = {
  userId: string;
};

type RepostFilter = 'all' | 'posts' | 'limes';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 8;
const HORIZONTAL_PADDING = 12;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);

const authService = AuthService.getInstance();

export default function ProfileRepostsTab({ userId }: ProfileRepostsTabProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const viewerId = authService.getCurrentUser()?.uid ?? userId;
  const isOwnProfile = viewerId === userId;

  const [activeFilter, setActiveFilter] = useState<RepostFilter>('all');
  const [repostedLimes, setRepostedLimes] = useState<Reel[]>([]);
  const [isLimesLoading, setIsLimesLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  // Feed posts query for this profile
  const query = { userId: viewerId, scope: 'home' as const, filter: 'all' as const, authorId: userId };
  const { resource } = useFeedQuery(query);
  const allPosts = resource.data?.posts ?? [];
  // Filter only posts that the user actually reposted
  const repostedPosts = allPosts.filter(
    (post) => post.repostedByUserIds?.includes(userId) === true
  );

  const loadRepostedLimes = useCallback(async () => {
    try {
      const limes = await limeService.fetchUserRepostedLimes(userId);
      setRepostedLimes(limes);
    } catch (err) {
      console.error('[ProfileRepostsTab] Error fetching reposted limes:', err);
    } finally {
      setIsLimesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadRepostedLimes();
  }, [loadRepostedLimes]);

  const activePost = activePostId ? allPosts.find((post) => post.id === activePostId) ?? null : null;
  const isPostsLoading = !resource.data && (resource.status === 'idle' || resource.status === 'hydrating');
  const isLoading = isPostsLoading && isLimesLoading;

  const totalCount = repostedPosts.length + repostedLimes.length;

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 12 }}>
      {/* Sub-filter Pills: All | Posts | Limes */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
        {([
          { key: 'all', label: `All (${totalCount})` },
          { key: 'posts', label: `Posts (${repostedPosts.length})` },
          { key: 'limes', label: `Limes (${repostedLimes.length})` },
        ] as const).map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: isActive ? colors.selectedControl : colors.control,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? '800' : '600',
                  color: isActive ? colors.selectedText : colors.secondaryText,
                }}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Empty State */}
      {totalCount === 0 ? (
        <View
          style={{
            marginHorizontal: 16,
            paddingVertical: 44,
            alignItems: 'center',
            paddingHorizontal: 24,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="repeat-outline" size={44} color={colors.secondaryText} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 }}>
            No Reposts yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.secondaryText, textAlign: 'center', marginTop: 4 }}>
            {isOwnProfile
              ? 'Posts and Limes you repost will appear here.'
              : 'This user has not reposted anything yet.'}
          </Text>
        </View>
      ) : (
        <>
          {/* Limes Section (when filter is 'all' or 'limes') */}
          {(activeFilter === 'all' || activeFilter === 'limes') && repostedLimes.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              {activeFilter === 'all' && (
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    Reposted Limes
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: COLUMN_GAP,
                  paddingHorizontal: HORIZONTAL_PADDING,
                }}
              >
                {repostedLimes.map((item) => {
                  const thumbnail = item.thumbnailUrl || item.media?.thumbnailUrl;
                  const likeCount = item.stats?.likes || item.likes?.length || 0;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/Limes',
                          params: { limeId: item.id },
                        })
                      }
                      activeOpacity={0.85}
                      style={{
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        borderRadius: 14,
                        overflow: 'hidden',
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        marginBottom: COLUMN_GAP,
                      }}
                    >
                      {thumbnail ? (
                        <Image
                          source={{ uri: thumbnail }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#0f172a',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="videocam" size={32} color="#10b981" />
                        </View>
                      )}

                      {/* Repost Badge */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 10,
                        }}
                      >
                        <Ionicons name="repeat" size={12} color="#10b981" />
                        <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                          Repost
                        </Text>
                      </View>

                      {/* Bottom Overlay */}
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: 8,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                        }}
                      >
                        {item.caption ? (
                          <Text
                            numberOfLines={1}
                            style={{ color: '#ffffff', fontSize: 11, fontWeight: '600', marginBottom: 4 }}
                          >
                            {item.caption}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="heart" size={12} color="#ef4444" />
                            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                              {likeCount}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="chatbubble" size={11} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                              {item.stats?.comments || 0}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Posts Section (when filter is 'all' or 'posts') */}
          {(activeFilter === 'all' || activeFilter === 'posts') && repostedPosts.length > 0 && (
            <View>
              {activeFilter === 'all' && (
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    Reposted Posts
                  </Text>
                </View>
              )}
              {repostedPosts.map((post) => (
                <View key={post.id} style={{ width: '100%', paddingHorizontal: 12, marginBottom: 14 }}>
                  <PostCardSection
                    post={post}
                    isVisible={true}
                    isProfileRepost={true}
                    onCommentClick={setActivePostId}
                    onPostDelete={(postId) =>
                      void feedResourceService.removePosts((item) => item.id === postId)
                    }
                    onAuthorBlocked={(authorId) =>
                      void feedResourceService.removePosts((item) => item.userId === authorId)
                    }
                    onPostUpdate={(updatedPost) => void feedResourceService.patchPost(updatedPost)}
                    onRepostRemoved={
                      isOwnProfile
                        ? (_postId, updatedPost) =>
                            void feedResourceService.reconcileProfileRepostRemoval(query, updatedPost)
                        : undefined
                    }
                  />
                </View>
              ))}
            </View>
          )}

          {/* No results for the active sub-filter */}
          {activeFilter === 'posts' && repostedPosts.length === 0 && (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: colors.secondaryText }}>No reposted posts.</Text>
            </View>
          )}
          {activeFilter === 'limes' && repostedLimes.length === 0 && (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: colors.secondaryText }}>No reposted Limes.</Text>
            </View>
          )}
        </>
      )}

      {/* Comments Modal */}
      {activePost ? (
        <CommentsModal
          post={activePost}
          userId={viewerId}
          onClose={() => setActivePostId(null)}
          onPostUpdate={(updatedPost) => void feedResourceService.patchPost(updatedPost)}
        />
      ) : null}
    </View>
  );
}
