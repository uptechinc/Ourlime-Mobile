import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import PostCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection';
import PollCardSection from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PollCardSection';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
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

  const isTerminalError = error === 'This post was deleted.' || error === 'This post was removed by an admin.';

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}><Ionicons name="chevron-back" size={26} color={colors.icon} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginLeft: 10 }}>Post</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#10b981" />
        </View>
      ) : error || !post ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: colors.mutedText, fontStyle: isTerminalError ? 'italic' : 'normal', textAlign: 'center', fontSize: 15 }}>
            {error || 'This post was deleted.'}
          </Text>
          {!isTerminalError ? (
            <TouchableOpacity onPress={() => void loadPost()} style={{ backgroundColor: '#10b981', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          ) : null}
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
