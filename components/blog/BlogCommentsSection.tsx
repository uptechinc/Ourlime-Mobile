import { contentDateService } from '@/lib/services/ContentDateService';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Send, CornerDownRight, Trash2, Flag, BadgeCheck, Heart } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import type { BlogComment, BlogCommentLikeState, BlogCommentReply } from '@/lib/types/blog';

type BlogCommentsSectionProps = {
  comments: BlogComment[];
  submitting: boolean;
  onSubmitComment: (text: string, replyToCommentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReportComment: (comment: BlogComment | BlogCommentReply, parentId?: string) => void;
  onLikeComment?: (commentId: string, enabled: boolean, replyId?: string) => Promise<BlogCommentLikeState>;
  composerRef?: RefObject<TextInput | null>;
  canMutate?: boolean;
  /** Blog author — may delete any top-level comment (web rule). */
  blogOwnerId?: string;
};

export default function BlogCommentsSection({
  comments,
  submitting,
  onSubmitComment,
  onDeleteComment,
  onReportComment,
  onLikeComment,
  composerRef, canMutate = true, blogOwnerId,
}: BlogCommentsSectionProps) {
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [actionError, setActionError] = useState('');
  const [likeOverrides, setLikeOverrides] = useState<{ [targetKey: string]: BlogCommentLikeState }>({});
  const pendingLikes = useRef(new Set<string>());
  const mounted = useRef(true);
  const sending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const readLikeState = (commentId: string, target: { isLiked?: boolean; likesCount?: number }, replyId?: string): BlogCommentLikeState =>
    likeOverrides[`${commentId}:${replyId ?? ''}`] ?? { isLiked: Boolean(target.isLiked), likesCount: target.likesCount ?? 0 };

  const handleToggleLike = async (commentId: string, current: BlogCommentLikeState, replyId?: string) => {
    const targetKey = `${commentId}:${replyId ?? ''}`;
    if (!onLikeComment || !canMutate || pendingLikes.current.has(targetKey)) return;
    pendingLikes.current.add(targetKey);
    const optimistic = { isLiked: !current.isLiked, likesCount: Math.max(0, current.likesCount + (current.isLiked ? -1 : 1)) };
    setLikeOverrides((overrides) => ({ ...overrides, [targetKey]: optimistic }));
    try {
      const confirmed = await onLikeComment(commentId, optimistic.isLiked, replyId);
      if (mounted.current) setLikeOverrides((overrides) => ({ ...overrides, [targetKey]: confirmed }));
    } catch {
      if (mounted.current) setLikeOverrides((overrides) => ({ ...overrides, [targetKey]: current }));
    } finally {
      pendingLikes.current.delete(targetKey);
    }
  };

  const renderLikeButton = (commentId: string, target: { isLiked?: boolean; likesCount?: number; isDeleted?: boolean }, replyId?: string) => {
    if (!onLikeComment || target.isDeleted) return null;
    const likeState = readLikeState(commentId, target, replyId);
    const tint = likeState.isLiked ? '#10b981' : colors.mutedText;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: likeState.isLiked }}
        accessibilityLabel={likeState.isLiked ? 'Unlike' : 'Like'}
        disabled={!canMutate}
        onPress={() => void handleToggleLike(commentId, likeState, replyId)}
        style={styles.likeTrigger}
      >
        <Heart size={14} color={tint} fill={likeState.isLiked ? tint : 'transparent'} />
        <Text style={[styles.likeTriggerText, { color: tint }]}>
          {likeState.isLiked ? 'Liked' : 'Like'}{likeState.likesCount ? ` (${likeState.likesCount})` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleSendMainComment = async () => {
    if (!canMutate || !commentText.trim() || submitting || sending.current) return;
    sending.current = true;
    const text = commentText;
    try { await onSubmitComment(text); if (mounted.current) setCommentText((current) => current === text ? '' : current); } catch { /* Keep the text available for retry. */ }
    finally { sending.current = false; }
  };

  const handleSendReply = async (commentId: string) => {
    if (!canMutate || !replyText.trim() || submitting || sending.current) return;
    sending.current = true;
    const text = replyText;
    try { await onSubmitComment(text, commentId); if (mounted.current) { setReplyText((current) => current === text ? '' : current); setReplyingToId(null); } } catch { /* Keep the reply available for retry. */ }
    finally { sending.current = false; }
  };

  const confirmDelete = (commentId: string) => {
    setDeletingCommentId(commentId);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!deletingCommentId) return;
    const id = deletingCommentId;
    setDeleteModalVisible(false);
    setDeletingCommentId(null);
    try {
      await onDeleteComment(id);
      setActionError('');
    } catch { setActionError('Comment could not be deleted. Retry.'); }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Responses ({comments.length})
      </Text>

      {/* Main Comment Input */}
      <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          ref={composerRef}
          editable={canMutate}
          placeholder="What are your thoughts?"
          placeholderTextColor={colors.mutedText}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          style={[styles.textInput, { color: colors.text }]}
        />
        <TouchableOpacity
          onPress={handleSendMainComment}
          disabled={!canMutate || !commentText.trim() || submitting}
          style={[
            styles.sendBtn,
            { backgroundColor: commentText.trim() ? '#10b981' : isDark ? '#334155' : '#e2e8f0' },
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Send size={16} color={commentText.trim() ? '#ffffff' : colors.mutedText} />
          )}
        </TouchableOpacity>
      </View>

      {/* Comments List */}
      {actionError ? <Text style={{ color: colors.destructive, marginBottom: 8 }}>{actionError}</Text> : null}
      {comments.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No comments yet. Be the first to share your thoughts!</Text>
      ) : null}
      <View style={styles.commentsList}>
        {comments.map((comment) => {
          const isOwn = activeUserId === comment.userId;
          // Web: the comment author or the blog owner may delete; report is hidden on your own comments.
          const canDelete = canMutate && Boolean(activeUserId) && (isOwn || activeUserId === blogOwnerId);
          const isReplying = replyingToId === comment.id;
          const replies = (comment.replies ?? []).filter((reply) => !reply.isDeleted);

          return (
            <View
              key={comment.id}
              style={[
                styles.commentCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.commentHeader}>
                <UserAvatar
                  profileImage={comment.authorAvatar}
                  firstName={comment.authorName}
                  size={36}
                />
                <View style={styles.commentAuthorBlock}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                      {comment.authorName}
                    </Text>
                    {comment.isVerified ? <BadgeCheck size={14} color="#10b981" /> : null}
                  </View>
                  <Text style={[styles.timeText, { color: colors.mutedText }]}>
                    {contentDateService.formatCommentDate(comment.createdAt)}
                  </Text>
                </View>

                {canDelete ? (
                  <TouchableOpacity onPress={() => confirmDelete(comment.id)} style={styles.headerActionBtn} accessibilityLabel="Delete comment">
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                ) : null}
                {canMutate && !isOwn ? (
                  <TouchableOpacity onPress={() => onReportComment(comment)} style={styles.headerActionBtn} accessibilityLabel="Report comment">
                    <Flag size={15} color={colors.mutedText} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={[styles.commentBody, { color: colors.text }]}>{comment.text}</Text>

              {/* Like & Reply Buttons */}
              <View style={styles.commentActionsRow}>
                {renderLikeButton(comment.id, comment)}
                <TouchableOpacity
                  disabled={!canMutate || comment.isDeleted}
                  onPress={() => setReplyingToId(isReplying ? null : comment.id)}
                  style={styles.replyTrigger}
                >
                  <CornerDownRight size={14} color="#10b981" />
                  <Text style={styles.replyTriggerText}>
                    {isReplying ? 'Cancel' : 'Reply'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline Reply Input */}
              {isReplying ? (
                <View
                  style={[
                    styles.replyInputBox,
                    { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    placeholder={`Reply to ${comment.authorName}...`}
                    placeholderTextColor={colors.mutedText}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                    style={[styles.replyTextInput, { color: colors.text }]}
                  />
                  <TouchableOpacity
                    onPress={() => handleSendReply(comment.id)}
                    disabled={!replyText.trim() || submitting}
                    style={[
                      styles.replySendBtn,
                      { backgroundColor: replyText.trim() ? '#10b981' : colors.border },
                    ]}
                  >
                    <Send size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Nested Replies */}
              {replies.length > 0 ? (
                <View style={styles.repliesList}>
                  {replies.map((reply) => (
                    <View
                      key={reply.id}
                      style={[
                        styles.replyCard,
                        { backgroundColor: isDark ? '#1e293b66' : '#f8fafc', borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.replyHeader}>
                        <UserAvatar
                          profileImage={reply.authorAvatar}
                          firstName={reply.authorName}
                          size={26}
                        />
                        <View style={styles.replyAuthorBlock}>
                          <Text style={[styles.replyAuthorName, { color: colors.text }]}>
                            {reply.authorName}
                          </Text>
                          <Text style={[styles.replyTimeText, { color: colors.mutedText }]}>
                            {contentDateService.formatCommentDate(reply.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.replyBody, { color: colors.text }]}>{reply.text}</Text>
                      <View style={styles.commentActionsRow}>
                        {renderLikeButton(comment.id, reply, reply.id)}
                        {canMutate && activeUserId !== reply.userId ? (
                          <TouchableOpacity accessibilityLabel="Report reply" style={styles.likeTrigger} onPress={() => onReportComment(reply, comment.id)}>
                            <Flag size={13} color={colors.mutedText} />
                            <Text style={[styles.likeTriggerText, { color: colors.mutedText }]}>Report</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Delete Confirmation Modal */}
      <CustomModal
        visible={deleteModalVisible}
        type="danger"
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={executeDelete}
        onCancel={() => setDeleteModalVisible(false)}
        onClose={() => setDeleteModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsList: {
    gap: 14,
  },
  commentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentAuthorBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActionBtn: {
    padding: 6,
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 18,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  likeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  likeTriggerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  replyTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
  },
  replyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginTop: 6,
  },
  replyTextInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 36,
  },
  replySendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repliesList: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#10b98144',
    gap: 8,
  },
  replyCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyAuthorBlock: {
    flex: 1,
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyTimeText: {
    fontSize: 11,
  },
  replyBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteModalBody: {
    padding: 16,
    gap: 16,
  },
  deleteModalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  confirmDeleteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },
  confirmDeleteText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
