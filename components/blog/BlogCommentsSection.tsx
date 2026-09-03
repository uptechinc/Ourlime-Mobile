import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Send, CornerDownRight, Trash2, Flag, BadgeCheck } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import type { BlogComment } from '@/lib/types/blog';

type BlogCommentsSectionProps = {
  comments: BlogComment[];
  submitting: boolean;
  onSubmitComment: (text: string, replyToCommentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReportComment: (comment: BlogComment) => void;
};

function formatTimeAgo(rawDate: { seconds?: number } | string | Date | undefined): string {
  if (!rawDate) return 'just now';
  const timestamp = typeof rawDate === 'object' && 'seconds' in rawDate && rawDate.seconds
    ? rawDate.seconds * 1000
    : new Date(rawDate as string | Date).getTime();
  if (isNaN(timestamp)) return 'just now';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function BlogCommentsSection({
  comments,
  submitting,
  onSubmitComment,
  onDeleteComment,
  onReportComment,
}: BlogCommentsSectionProps) {
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const handleSendMainComment = async () => {
    if (!commentText.trim() || submitting) return;
    const text = commentText;
    setCommentText('');
    await onSubmitComment(text);
  };

  const handleSendReply = async (commentId: string) => {
    if (!replyText.trim() || submitting) return;
    const text = replyText;
    setReplyText('');
    setReplyingToId(null);
    await onSubmitComment(text, commentId);
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
    await onDeleteComment(id);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Responses ({comments.length})
      </Text>

      {/* Main Comment Input */}
      <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          placeholder="What are your thoughts?"
          placeholderTextColor={colors.mutedText}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          style={[styles.textInput, { color: colors.text }]}
        />
        <TouchableOpacity
          onPress={handleSendMainComment}
          disabled={!commentText.trim() || submitting}
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
      <View style={styles.commentsList}>
        {comments.map((comment) => {
          const isOwn = activeUserId === comment.userId;
          const isReplying = replyingToId === comment.id;

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
                    {formatTimeAgo(comment.createdAt)}
                  </Text>
                </View>

                {isOwn ? (
                  <TouchableOpacity
                    onPress={() => confirmDelete(comment.id)}
                    style={styles.headerActionBtn}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => onReportComment(comment)}
                    style={styles.headerActionBtn}
                  >
                    <Flag size={15} color={colors.mutedText} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.commentBody, { color: colors.text }]}>{comment.text}</Text>

              {/* Reply Button */}
              <TouchableOpacity
                onPress={() => setReplyingToId(isReplying ? null : comment.id)}
                style={styles.replyTrigger}
              >
                <CornerDownRight size={14} color="#10b981" />
                <Text style={styles.replyTriggerText}>
                  {isReplying ? 'Cancel' : 'Reply'}
                </Text>
              </TouchableOpacity>

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
              {comment.replies && comment.replies.length > 0 ? (
                <View style={styles.repliesList}>
                  {comment.replies.map((reply) => (
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
                            {formatTimeAgo(reply.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.replyBody, { color: colors.text }]}>{reply.text}</Text>
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
