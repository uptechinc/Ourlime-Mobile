import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Globe2, Lock } from 'lucide-react-native';
import { AuthService } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import PollCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PollCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { SkeletonPostCard } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const postService = PostService.getInstance();
const authService = AuthService.getInstance();

export default function PostScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const {
    id,
    openComments,
    rootCommentId,
    commentId,
    replyId,
  } = useLocalSearchParams<{
    id: string;
    openComments?: string;
    rootCommentId?: string;
    commentId?: string;
    replyId?: string;
  }>();
  const [post, setPost] = useState<PostItem | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setPost(await postService.fetchPost(id));
    } catch (loadError: unknown) {
      console.error('[PostScreen.loadPost]', loadError);
      const message = loadError instanceof Error ? loadError.message : 'This post could not be loaded.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadPost(); }, [loadPost]);

  useEffect(() => {
    if (openComments === 'true' || openComments === '1') setCommentsOpen(true);
  }, [openComments]);

  // Website parity: a post deleted or hidden by moderation while it is open disappears from the page.
  useEffect(() => {
    const viewerId = authService.getCurrentUser()?.uid;
    if (!id || !viewerId || !post) return;
    return postService.watchPostAvailability(id, viewerId, (reason) => {
      setPost(null);
      setCommentsOpen(false);
      setError(reason === 'removed' ? 'This post was removed by an admin.' : 'This post was deleted.');
    });
  }, [id, post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRemovedByAdmin = Boolean(error && /removed by an admin|POST_REMOVED_BY_ADMIN/.test(error));
  const isUserDeleted = Boolean(error && /deleted|POST_DELETED/.test(error));
  const isTerminalError = isRemovedByAdmin || isUserDeleted;
  const errorTitle = isRemovedByAdmin ? 'Post removed' : isUserDeleted ? 'Post deleted' : 'Post not found';
  const errorDescription = isRemovedByAdmin
    ? 'This post was removed by an admin.'
    : isUserDeleted
    ? 'This post was deleted.'
    : (error || 'This post may have been deleted, or its audience settings do not allow you to view it.');
  const isPrivateAudience = post?.visibility === 'private' || post?.visibility === 'friends' || post?.visibility === 'friends_followers';

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}><Ionicons name="chevron-back" size={26} color={colors.icon} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Post conversation</Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.mutedText }}>View the post, reactions, and discussion in one place.</Text>
        </View>
        {post ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8, borderRadius: 999, backgroundColor: colors.successSurface, paddingHorizontal: 10, paddingVertical: 6 }}>
            {isPrivateAudience ? <Lock size={13} color={colors.successText} /> : <Globe2 size={13} color={colors.successText} />}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.successText }}>{isPrivateAudience ? 'Friends only' : 'Public post'}</Text>
          </View>
        ) : null}
      </View>
      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <SkeletonPostCard />
        </ScrollView>
      ) : error || !post ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>{errorTitle}</Text>
          <Text style={{ color: colors.mutedText, fontStyle: 'italic', textAlign: 'center', fontSize: 15, maxWidth: 320 }}>
            {errorDescription}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            {!isTerminalError ? (
              <TouchableOpacity onPress={() => void loadPost()} accessibilityRole="button" style={{ borderWidth: 1, borderColor: '#10b981', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: colors.accentText, fontWeight: '800' }}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} accessibilityRole="button" style={{ backgroundColor: '#10b981', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Return to feed</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {post.type === 'poll' ? (
            <PollCardSection post={post} onCommentClick={() => setCommentsOpen(true)} onPostDelete={() => router.back()} onAuthorBlocked={() => router.back()} onPostUpdate={setPost} />
          ) : (
            <PostCardSection post={post} isVisible onCommentClick={() => setCommentsOpen(true)} onPostDelete={() => router.back()} onAuthorBlocked={() => router.back()} onPostUpdate={setPost} />
          )}
        </ScrollView>
      )}
      {commentsOpen && post && authService.getCurrentUser()?.uid ? <CommentsModal post={post} userId={authService.getCurrentUser()?.uid ?? ''} onClose={() => setCommentsOpen(false)} onPostUpdate={setPost} focusRootCommentId={rootCommentId} focusCommentId={commentId} focusReplyId={replyId} /> : null}
    </SafeAreaView>
  );
}
