import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  CommentService,
  type PostComment,
  type PostReply,
} from '@/lib/services/CommentService';
import type { PostItem } from '@/lib/services/PostService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ReplyThread = {
  items: PostReply[];
  expanded: boolean;
  loading: boolean;
  hasMore: boolean;
  nextCursor: number | null;
};

type ReplyTarget = {
  commentId: string;
  parentReplyId?: string;
  userName: string;
};

type EditTarget = {
  type: 'comment' | 'reply';
  id: string;
  rootCommentId: string;
};

type CommentsModalProps = {
  post: PostItem;
  userId: string;
  onClose: () => void;
  onPostUpdate: (post: PostItem) => void;
};

const commentService = CommentService.getInstance();

const formatTimestamp = (milliseconds: number): string => {
  const elapsed = Math.max(0, Date.now() - milliseconds);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(milliseconds).toLocaleDateString();
};

export default function CommentsModal({ post, userId, onClose, onPostUpdate }: CommentsModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [replyThreads, setReplyThreads] = useState<Record<string, ReplyThread>>({});
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadComments = useCallback(async (cursor?: number | null, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);
    try {
      const page = await commentService.fetchComments(post.id, cursor);
      setComments((current) => append
        ? [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]
        : page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load comments');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [post.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleToggleReplies = async (commentId: string) => {
    const existing = replyThreads[commentId];
    if (existing) {
      setReplyThreads((current) => ({
        ...current,
        [commentId]: { ...existing, expanded: !existing.expanded },
      }));
      return;
    }
    setReplyThreads((current) => ({
      ...current,
      [commentId]: { items: [], expanded: true, loading: true, hasMore: false, nextCursor: null },
    }));
    try {
      const page = await commentService.fetchReplies(commentId);
      setReplyThreads((current) => ({
        ...current,
        [commentId]: { items: page.items, expanded: true, loading: false, hasMore: page.hasMore, nextCursor: page.nextCursor },
      }));
    } catch (error: unknown) {
      Alert.alert('Replies unavailable', error instanceof Error ? error.message : 'Could not load replies');
      setReplyThreads((current) => ({
        ...current,
        [commentId]: { items: [], expanded: true, loading: false, hasMore: false, nextCursor: null },
      }));
    }
  };

  const handleLoadMoreReplies = async (commentId: string) => {
    const thread = replyThreads[commentId];
    if (!thread?.nextCursor || thread.loading) return;
    setReplyThreads((current) => ({ ...current, [commentId]: { ...thread, loading: true } }));
    try {
      const page = await commentService.fetchReplies(commentId, thread.nextCursor);
      setReplyThreads((current) => ({
        ...current,
        [commentId]: {
          items: [...thread.items, ...page.items.filter((item) => !thread.items.some((existing) => existing.id === item.id))],
          expanded: true,
          loading: false,
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        },
      }));
    } catch (error: unknown) {
      setReplyThreads((current) => ({ ...current, [commentId]: { ...thread, loading: false } }));
      Alert.alert('Replies unavailable', error instanceof Error ? error.message : 'Could not load more replies');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await commentService.createComment(post.id, commentText);
      setComments((current) => [created, ...current]);
      setCommentText('');
      onPostUpdate({ ...post, stats: { ...post.stats, comments: post.stats.comments + 1 } });
    } catch (error: unknown) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyTarget || !replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await commentService.createReply({
        commentId: replyTarget.commentId,
        content: replyText,
        parentReplyId: replyTarget.parentReplyId,
        replyToUserName: replyTarget.userName,
      });
      const thread = replyThreads[replyTarget.commentId];
      setReplyThreads((current) => ({
        ...current,
        [replyTarget.commentId]: {
          items: [...(thread?.items ?? []), created],
          expanded: true,
          loading: false,
          hasMore: thread?.hasMore ?? false,
          nextCursor: thread?.nextCursor ?? null,
        },
      }));
      setComments((current) => current.map((comment) => comment.id === replyTarget.commentId
        ? { ...comment, replyCount: comment.replyCount + 1 }
        : comment));
      setReplyText('');
      setReplyTarget(null);
    } catch (error: unknown) {
      Alert.alert('Reply not posted', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (type: 'comment' | 'reply', targetId: string, rootCommentId: string) => {
    const updateItem = <TItem extends { id: string; isLiked: boolean; likeCount: number },>(item: TItem): TItem => item.id === targetId
      ? { ...item, isLiked: !item.isLiked, likeCount: Math.max(0, item.likeCount + (item.isLiked ? -1 : 1)) }
      : item;
    if (type === 'comment') {
      setComments((current) => current.map(updateItem));
    } else {
      setReplyThreads((current) => ({
        ...current,
        [rootCommentId]: { ...current[rootCommentId], items: (current[rootCommentId]?.items ?? []).map(updateItem) },
      }));
    }
    try {
      await commentService.toggleLike(type, targetId);
    } catch (error: unknown) {
      if (type === 'comment') {
        setComments((current) => current.map(updateItem));
      } else {
        setReplyThreads((current) => ({
          ...current,
          [rootCommentId]: { ...current[rootCommentId], items: (current[rootCommentId]?.items ?? []).map(updateItem) },
        }));
      }
      Alert.alert('Like not updated', error instanceof Error ? error.message : 'Please try again');
    }
  };

  const handleSubmitEdit = async () => {
    if (!editTarget || !editText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const editedAtMs = editTarget.type === 'comment'
        ? await commentService.editComment(post.id, editTarget.id, editText)
        : await commentService.editReply(editTarget.rootCommentId, editTarget.id, editText);
      if (editTarget.type === 'comment') {
        setComments((current) => current.map((item) => item.id === editTarget.id
          ? { ...item, content: editText.trim(), editedAtMs }
          : item));
      } else {
        setReplyThreads((current) => ({
          ...current,
          [editTarget.rootCommentId]: {
            ...current[editTarget.rootCommentId],
            items: (current[editTarget.rootCommentId]?.items ?? []).map((item) => item.id === editTarget.id
              ? { ...item, content: editText.trim(), editedAtMs }
              : item),
          },
        }));
      }
      setEditTarget(null);
      setEditText('');
    } catch (error: unknown) {
      Alert.alert('Edit not saved', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = (content: string) => content.split(/(@[\w.-]+)/g).map((part, index) => (
    <Text key={`${part}-${index}`} style={part.startsWith('@') ? { color: '#047857', fontWeight: '700' } : undefined}>{part}</Text>
  ));

  const renderActions = (item: PostComment | PostReply, type: 'comment' | 'reply', rootCommentId: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
      <TouchableOpacity onPress={() => void handleToggleLike(type, item.id, rootCommentId)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
        <Icon name="heart" size={14} color={item.isLiked ? '#ef4444' : '#6b7280'} />
        <Text style={{ marginLeft: 4, color: item.isLiked ? '#ef4444' : '#6b7280', fontSize: 12, fontWeight: '600' }}>{item.likeCount || 'Like'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setReplyTarget({ commentId: rootCommentId, parentReplyId: type === 'reply' ? item.id : undefined, userName: item.author.userName }); setReplyText(''); }}>
        <Text style={{ marginRight: 16, color: '#6b7280', fontSize: 12, fontWeight: '600' }}>Reply</Text>
      </TouchableOpacity>
      {item.author.id === userId ? (
        <TouchableOpacity onPress={() => { setEditTarget({ type, id: item.id, rootCommentId }); setEditText(item.content); setReplyTarget(null); }}>
          <Text style={{ marginRight: 16, color: '#6b7280', fontSize: 12, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={{ color: '#9ca3af', fontSize: 11 }}>{formatTimestamp(item.createdAtMs)}{item.editedAtMs ? ' · Edited' : ''}</Text>
    </View>
  );

  const renderReply = (reply: PostReply, rootCommentId: string) => (
    <View key={reply.id} style={{ flexDirection: 'row', marginTop: 12 }}>
      <UserAvatar profileImage={reply.author.profileImage} firstName={reply.author.firstName || reply.author.userName} size={30} />
      <View style={{ flex: 1, marginLeft: 9 }}>
        <View style={{ borderRadius: 16, borderTopLeftRadius: 5, backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ color: '#111827', fontWeight: '700', fontSize: 12 }}>{reply.author.firstName} {reply.author.lastName} <Text style={{ color: '#6b7280', fontWeight: '400' }}>@{reply.author.userName}</Text></Text>
          <Text style={{ marginTop: 4, color: '#374151', fontSize: 13 }}>{reply.replyToUserName ? <Text style={{ color: '#047857', fontWeight: '700' }}>@{reply.replyToUserName} </Text> : null}{renderContent(reply.content)}</Text>
        </View>
        {renderActions(reply, 'reply', rootCommentId)}
      </View>
    </View>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ flex: 1, fontSize: 18, color: colors.text, fontWeight: '800' }}>Comments</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close comments" style={{ padding: 8 }}><Icon name="x" size={23} color={colors.icon} /></TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 16, borderRadius: 18, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UserAvatar profileImage={post.user.profileImage} firstName={post.user.firstName || post.user.userName} size={38} />
                <View style={{ marginLeft: 10, flex: 1 }}><Text style={{ color: '#111827', fontWeight: '700' }}>{post.user.firstName} {post.user.lastName}</Text><Text style={{ color: '#6b7280', fontSize: 12 }}>@{post.user.userName}</Text></View>
              </View>
              {post.caption || post.description ? <Text numberOfLines={4} style={{ marginTop: 10, color: '#374151' }}>{post.caption || post.description}</Text> : null}
            </View>

            {loading && comments.length === 0 ? <ActivityIndicator color="#10b981" size="large" style={{ marginTop: 60 }} /> : null}
            {errorMessage && comments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 55 }}><Icon name="alert-triangle" size={30} color="#c64d53" /><Text style={{ marginTop: 10, color: '#991b1b', textAlign: 'center' }}>{errorMessage}</Text><TouchableOpacity onPress={() => void loadComments()} style={{ marginTop: 14, borderRadius: 16, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 9 }}><Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text></TouchableOpacity></View>
            ) : null}
            {!loading && !errorMessage && comments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}><View style={{ width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' }}><Icon name="message-circle" size={29} color="#10b981" /></View><Text style={{ marginTop: 14, color: '#111827', fontSize: 17, fontWeight: '800' }}>Start the conversation</Text><Text style={{ marginTop: 5, color: '#6b7280' }}>Be the first to leave a thoughtful comment.</Text></View>
            ) : null}

            {comments.map((comment) => {
              const thread = replyThreads[comment.id];
              return (
                <View key={comment.id} style={{ flexDirection: 'row', marginBottom: 20 }}>
                  <UserAvatar profileImage={comment.author.profileImage} firstName={comment.author.firstName || comment.author.userName} size={38} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ borderRadius: 18, borderTopLeftRadius: 5, backgroundColor: '#f3f4f6', paddingHorizontal: 13, paddingVertical: 10 }}>
                      <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13 }}>{comment.author.firstName} {comment.author.lastName} <Text style={{ color: '#6b7280', fontWeight: '400' }}>@{comment.author.userName}</Text></Text>
                      <Text style={{ marginTop: 5, color: '#374151', fontSize: 14 }}>{renderContent(comment.content)}</Text>
                    </View>
                    {renderActions(comment, 'comment', comment.id)}
                    {comment.replyCount > 0 ? <TouchableOpacity onPress={() => void handleToggleReplies(comment.id)} style={{ marginTop: 11 }}><Text style={{ color: '#047857', fontSize: 12, fontWeight: '700' }}>{thread?.expanded ? 'Hide replies' : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}</Text></TouchableOpacity> : null}
                    {thread?.expanded ? <View style={{ marginTop: 5, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#d1fae5' }}>{thread.items.map((reply) => renderReply(reply, comment.id))}{thread.loading ? <ActivityIndicator color="#10b981" style={{ marginTop: 12 }} /> : null}{thread.hasMore && !thread.loading ? <TouchableOpacity onPress={() => void handleLoadMoreReplies(comment.id)} style={{ marginTop: 12 }}><Text style={{ color: '#047857', fontWeight: '700', fontSize: 12 }}>Load 20 more replies</Text></TouchableOpacity> : null}</View> : null}
                  </View>
                </View>
              );
            })}
            {hasMore ? <TouchableOpacity disabled={loadingMore} onPress={() => void loadComments(nextCursor, true)} style={{ alignItems: 'center', paddingVertical: 14 }}>{loadingMore ? <ActivityIndicator color="#10b981" /> : <Text style={{ color: '#047857', fontWeight: '700' }}>Load 20 more comments</Text>}</TouchableOpacity> : null}
          </ScrollView>

          {editTarget ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.control }}>
              <Text style={{ marginBottom: 7, color: '#6b7280', fontSize: 12, fontWeight: '700' }}>Editing your {editTarget.type}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}><TextInput value={editText} onChangeText={setEditText} maxLength={2000} multiline placeholderTextColor={colors.mutedText} style={{ flex: 1, maxHeight: 110, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, paddingVertical: 10 }} /><TouchableOpacity onPress={() => { setEditTarget(null); setEditText(''); }} style={{ marginLeft: 8, padding: 10 }}><Text style={{ color: colors.mutedText }}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={!editText.trim() || submitting} onPress={() => void handleSubmitEdit()} style={{ marginLeft: 5, borderRadius: 16, backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10 }}><Text style={{ color: '#ffffff', fontWeight: '700' }}>Save</Text></TouchableOpacity></View>
            </View>
          ) : replyTarget ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.control }}>
              <Text style={{ marginBottom: 7, color: '#047857', fontSize: 12 }}>Replying to <Text style={{ fontWeight: '800' }}>@{replyTarget.userName}</Text></Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}><TextInput value={replyText} onChangeText={setReplyText} maxLength={2000} multiline placeholder="Write a reply..." placeholderTextColor={colors.mutedText} style={{ flex: 1, maxHeight: 110, borderRadius: 18, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, paddingVertical: 10 }} /><TouchableOpacity onPress={() => { setReplyTarget(null); setReplyText(''); }} style={{ marginLeft: 8, padding: 10 }}><Text style={{ color: colors.mutedText }}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={!replyText.trim() || submitting} onPress={() => void handleSubmitReply()} style={{ marginLeft: 5, borderRadius: 16, backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 10 }}><Text style={{ color: '#ffffff', fontWeight: '700' }}>Reply</Text></TouchableOpacity></View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}><TextInput value={commentText} onChangeText={setCommentText} maxLength={2000} multiline placeholder="Write a comment..." placeholderTextColor={colors.mutedText} style={{ flex: 1, maxHeight: 110, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, color: colors.text, paddingHorizontal: 15, paddingVertical: 10 }} /><TouchableOpacity disabled={!commentText.trim() || submitting} onPress={() => void handleSubmitComment()} style={{ marginLeft: 9, width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: commentText.trim() ? '#10b981' : '#64748b' }}>{submitting ? <ActivityIndicator color="#ffffff" size="small" /> : <Icon name="send" size={19} color="#ffffff" />}</TouchableOpacity></View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
