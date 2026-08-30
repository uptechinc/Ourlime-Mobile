import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { X, Send, Heart, CornerDownRight, Edit2, Trash2, Smile, ChevronDown, Flag } from 'lucide-react-native';
import { Image } from 'expo-image';
import UserAvatar from '@/components/ui/UserAvatar';
import { dispatchMentionNotifications } from '@/lib/services/dispatchMentionNotifications';
import { AuthService } from '@/lib/services/AuthService';
import { limeService } from '@/lib/services/LimeService';
import type { LimeComment, LimeCommentCursor } from '@/lib/types/lime';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import GifPickerModal from '@/components/comments/GifPickerModal';
import { EmojiStickerKeyboard } from '@/components/chat/EmojiStickerKeyboard';
import { getLocalStickerSource } from '@/assets/images/stickers/stickerMap';
import type { CommentMediaAsset } from '@/lib/services/CommentService';
import type { Sticker } from '@/lib/types/sticker';
import CommunityReportModal from '@/components/communities/CommunityReportModal';
import { ModerationService, type ReportReasonCategory } from '@/lib/services/ModerationService';
import type { ChildSafetyIntakeValues } from '@/lib/types/childSafety';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const authService = AuthService.getInstance();
const moderationService = ModerationService.getInstance();

type CommentReportTarget = {
  id: string;
  authorId: string;
  authorName: string;
  preview: string;
  contentType: 'comment' | 'reply';
};

type CommentModalProps = {
  reelId: string;
  isOpen: boolean;
  initialComments?: LimeComment[];
  onClose: () => void;
  onCommentCountUpdate?: (count: number) => void;
};

const EMOJI_PILLS = ['❤️', '🔥', '😂', '👏', '🚀', '🙌'];
const PAGE_SIZE = 50;

function safeParse(raw: unknown): LimeComment | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id : '';
    if (!id) return null;
    return {
      id,
      reelId: typeof value.reelId === 'string' ? value.reelId : '',
      userId: typeof value.userId === 'string' ? value.userId : '',
      content: typeof value.content === 'string' ? value.content : '',
      userName: typeof value.userName === 'string' && value.userName ? value.userName : 'user',
      firstName: typeof value.firstName === 'string' && value.firstName ? value.firstName : 'User',
      profileImage: typeof value.profileImage === 'string' && value.profileImage ? value.profileImage : undefined,
      likes: Array.isArray(value.likes) ? value.likes.filter((u): u is string => typeof u === 'string') : [],
      replyCount: typeof value.replyCount === 'number' ? value.replyCount : 0,
      parentCommentId: typeof value.parentCommentId === 'string' ? value.parentCommentId : null,
      replyToUserName: typeof value.replyToUserName === 'string' ? value.replyToUserName : null,
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
      editedAt: typeof value.editedAt === 'number' ? value.editedAt : undefined,
      sticker: (() => {
        if (!value.sticker || typeof value.sticker !== 'object') return null;
        const media = value.sticker as Record<string, unknown>;
        const type = media.type === 'sticker' || media.type === 'gif' ? media.type : null;
        const imageUrl = typeof media.imageUrl === 'string' ? media.imageUrl : '';
        if (!type || !imageUrl) return null;
        return {
          id: typeof media.id === 'string' ? media.id : imageUrl,
          name: typeof media.name === 'string' ? media.name : type === 'gif' ? 'GIF' : 'Sticker',
          imageUrl,
          type,
        };
      })(),
    };
  } catch {
    return null;
  }
}

function CommentSkeletonRow() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.skeletonRow}>
      <View style={[styles.skeletonAvatar, { backgroundColor: colors.control }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonName, { backgroundColor: colors.control }]} />
        <View style={[styles.skeletonText, { backgroundColor: colors.input }]} />
        <View style={[styles.skeletonMeta, { backgroundColor: colors.control }]} />
      </View>
    </View>
  );
}

function renderContent(
  content: string,
  textColor: string,
  onMentionPress: (userName: string) => void,
): ReactNode {
  if (!content || typeof content !== 'string') return null;
  const parts = content.split(/(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <Text key={i} style={styles.mentionText} onPress={() => onMentionPress(part.slice(1))}>{part}</Text>
    ) : part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.') ? (
      <Text
        key={i}
        style={styles.mentionText}
        onPress={() => void Linking.openURL(part.startsWith('www.') ? `https://${part}` : part)}
      >
        {part}
      </Text>
    ) : (
      <Text key={i} style={[styles.normalText, { color: textColor }]}>{part}</Text>
    )
  );
}

function formatTime(ms: number): string {
  const elapsed = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CommentModal({
  reelId,
  isOpen,
  initialComments = [],
  onClose,
  onCommentCountUpdate,
}: CommentModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [comments, setComments] = useState<LimeComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<LimeCommentCursor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; userName: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [visibleRepliesLimitMap, setVisibleRepliesLimitMap] = useState<Record<string, number>>({});
  const [selectedMedia, setSelectedMedia] = useState<CommentMediaAsset | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [enhancementPickerOpen, setEnhancementPickerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<CommentReportTarget | null>(null);

  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.uid ?? '';
  const currentUserName =
    currentUser?.displayName?.trim() || currentUser?.email?.split('@')[0] || 'user';
  const currentFirstName =
    currentUser?.displayName?.split(' ')[0] || 'User';

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const swipeDismiss = useSwipeDismiss({
    visible: isOpen,
    onDismiss: onClose,
    disabled: submitting,
    animateOnOpen: true,
  });

  const handleMentionPress = useCallback((userName: string) => {
    onClose();
    router.push({ pathname: '/profile/[username]', params: { username: userName } });
  }, [onClose, router]);

  /* ── Load 50 comments from Firestore ── */
  const fetchComments = useCallback(async (replace = true) => {
    if (!reelId) return;
    if (replace) setLoading(true);
    try {
      const page = await limeService.fetchComments(reelId, PAGE_SIZE);
      const loaded = page.items;
      if (replace) {
        setComments(loaded);
      } else {
        setComments((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          return [...prev, ...loaded.filter((c) => !ids.has(c.id))];
        });
      }
      lastDocRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('[LimeCommentModal] fetchComments error:', err);
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  /* ── Paginate next batch ── */
  const fetchMoreComments = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current || !reelId) return;
    setLoadingMore(true);
    try {
      const page = await limeService.fetchComments(reelId, PAGE_SIZE, lastDocRef.current);
      if (page.items.length > 0) {
        const nextBatch = page.items;
        setComments((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          return [...prev, ...nextBatch.filter((c) => !ids.has(c.id))];
        });
        lastDocRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[LimeCommentModal] fetchMoreComments error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, reelId]);

  /* ── Seed initialComments immediately, then fetch real data ── */
  useEffect(() => {
    if (!isOpen) return;
    // Show pre-fetched data immediately
    if (initialComments && initialComments.length > 0) {
      const safe = initialComments.map((c) => safeParse(c)).filter(Boolean) as LimeComment[];
      if (safe.length > 0) {
        setComments(safe);
        setLoading(false);
        fetchComments(false);
        return;
      }
    }
    void fetchComments(true);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Submit comment or reply ── */
  const handleSubmit = useCallback(async () => {
    const text = commentText.trim();
    if ((!text && !selectedMedia) || submitting || !currentUserId) return;
    setSubmitting(true);
    const optimisticId = `temp_${Date.now()}`;
    const newComment: LimeComment = {
      id: optimisticId,
      reelId,
      userId: currentUserId,
      content: text,
      userName: currentUserName,
      firstName: currentFirstName,
      profileImage: currentUser?.photoURL ?? undefined,
      likes: [],
      replyCount: 0,
      parentCommentId: replyTarget?.id ?? null,
      replyToUserName: replyTarget?.userName ?? null,
      createdAt: Date.now(),
      sticker: selectedMedia,
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
    setSelectedMedia(null);
    setReplyTarget(null);
    if (onCommentCountUpdate) onCommentCountUpdate(comments.length + 1);
    try {
      const commentId = await limeService.createComment({
        reelId,
        userId: currentUserId,
        userName: currentUserName,
        firstName: currentFirstName,
        profileImage: currentUser?.photoURL ?? undefined,
        content: text,
        parentCommentId: replyTarget?.id ?? null,
        replyToUserName: replyTarget?.userName ?? null,
        sticker: selectedMedia ?? undefined,
      });
      // Replace temp with real ID
      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? { ...c, id: commentId } : c))
      );
      if (text) {
        dispatchMentionNotifications({
          actorUserId: currentUserId,
          actorName: currentUserName,
          actorProfileImage: currentUser?.photoURL ?? undefined,
          content: text,
          contentType: 'lime',
          postId: reelId,
          commentId,
        });
      }
      void interactionFeedbackService.play('success');
    } catch (err) {
      console.error('[LimeCommentModal] submit error:', err);
      // Roll back optimistic add
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
    } finally {
      setSubmitting(false);
    }
  }, [commentText, selectedMedia, submitting, currentUserId, currentUserName, currentFirstName, currentUser?.photoURL, reelId, replyTarget, comments.length, onCommentCountUpdate]);

  const handleStickerSelect = useCallback((sticker: Sticker) => {
    setSelectedMedia({ id: sticker.id, name: sticker.name, imageUrl: sticker.imageUrl, type: 'sticker' });
    setEnhancementPickerOpen(false);
  }, []);

  const handleSubmitReport = useCallback(async (
    category: ReportReasonCategory,
    reason: string,
    details: string,
    childSafety?: ChildSafetyIntakeValues,
  ): Promise<void> => {
    if (!reportTarget) return;
    await moderationService.reportContent(reportTarget.contentType, {
      targetId: reportTarget.id,
      reportedUserId: reportTarget.authorId,
      reasonCategory: category,
      reason,
      description: details,
      routePath: `/limes?limeId=${encodeURIComponent(reelId)}`,
      immediateDanger: childSafety?.immediateDanger,
      goodFaithAcknowledged: childSafety?.goodFaithAcknowledged,
      allowContact: childSafety?.allowContact,
    });
    setReportTarget(null);
  }, [reelId, reportTarget]);

  /* ── Toggle like ── */
  const handleToggleLike = useCallback(async (commentId: string) => {
    if (!currentUserId || !commentId) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const safeL = Array.isArray(c.likes) ? c.likes : [];
        const liked = safeL.includes(currentUserId);
        return { ...c, likes: liked ? safeL.filter((u) => u !== currentUserId) : [...safeL, currentUserId] };
      })
    );
    try {
      const liked = comments.find((c) => c.id === commentId)?.likes?.includes(currentUserId) ?? false;
      await limeService.toggleCommentLike(reelId, commentId, currentUserId, liked);
    } catch (err) {
      console.error('[LimeCommentModal] toggleLike error:', err);
    }
  }, [currentUserId, reelId, comments]);

  /* ── Save edit ── */
  const handleSaveEdit = useCallback(async () => {
    const text = editText.trim();
    if (!editingId || !text) return;
    const now = Date.now();
    setComments((prev) =>
      prev.map((c) => (c.id === editingId ? { ...c, content: text, editedAt: now } : c))
    );
    setEditingId(null);
    setEditText('');
    try {
      await limeService.editComment(reelId, editingId, text);
    } catch (err) {
      console.error('[LimeCommentModal] saveEdit error:', err);
    }
  }, [editingId, editText, reelId]);

  /* ── Delete comment ── */
  const handleDelete = useCallback((commentId: string) => {
    setDeleteTargetId(commentId);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    const idToDelete = deleteTargetId;
    setDeleteTargetId(null);
    setComments((prev) => prev.filter((c) => c.id !== idToDelete));
    onCommentCountUpdate?.(Math.max(0, comments.length - 1));
    try {
      await limeService.deleteComment(reelId, idToDelete);
    } catch (err) {
      console.error('[LimeCommentModal] delete error:', err);
    }
  }, [comments.length, deleteTargetId, onCommentCountUpdate, reelId]);

  /* ── Split root / replies ── */
  const rootComments = comments.filter(
    (c) => !c.parentCommentId || c.parentCommentId === 'null'
  );
  const repliesByParent: Record<string, LimeComment[]> = {};
  comments.forEach((c) => {
    if (c.parentCommentId && c.parentCommentId !== 'null') {
      if (!repliesByParent[c.parentCommentId]) repliesByParent[c.parentCommentId] = [];
      repliesByParent[c.parentCommentId].push(c);
    }
  });

  const renderComment = ({ item: comment }: { item: LimeComment }) => {
    const safeL = Array.isArray(comment.likes) ? comment.likes : [];
    const isLiked = currentUserId ? safeL.includes(currentUserId) : false;
    const isOwner = currentUserId && comment.userId === currentUserId;
    const isEditing = editingId === comment.id;

    const subReplies = repliesByParent[comment.id] ?? [];
    const visibleLimit = visibleRepliesLimitMap[comment.id] ?? 50;
    const visibleSubReplies = subReplies.slice(0, visibleLimit);
    const canLoadMoreReplies = subReplies.length > visibleSubReplies.length;

    return (
      <View style={styles.commentItem}>
        <UserAvatar
          profileImage={comment.profileImage}
          firstName={comment.firstName || comment.userName || 'U'}
          size={36}
        />
        <View style={styles.commentBody}>
          <View style={styles.commentMetaRow}>
            <Text style={[styles.commentUser, { color: colors.text }]}>
              {comment.userName ? `@${comment.userName}` : 'Unknown'}
            </Text>
            <Text style={[styles.commentTime, { color: colors.mutedText }]}>{formatTime(comment.createdAt)}</Text>
            {comment.editedAt && (
              <Text style={[styles.editedLabel, { color: colors.mutedText }]}>· edited</Text>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                autoFocus
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => { setEditingId(null); setEditText(''); }}
                  style={[styles.editCancelBtn, { backgroundColor: colors.control }]}
                >
                  <Text style={[styles.editCancelText, { color: colors.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={styles.saveEditBtn}
                  disabled={!editText.trim()}
                >
                  <Text style={styles.saveEditBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {comment.content ? (
                <Text style={[styles.commentContent, { color: colors.secondaryText }]}>
                  {renderContent(comment.content, colors.secondaryText, handleMentionPress)}
                </Text>
              ) : null}
              {comment.sticker ? (
                <Image
                  source={comment.sticker.type === 'sticker' ? getLocalStickerSource(comment.sticker.imageUrl) ?? { uri: comment.sticker.imageUrl } : { uri: comment.sticker.imageUrl }}
                  contentFit={comment.sticker.type === 'gif' ? 'cover' : 'contain'}
                  style={styles.commentMedia}
                />
              ) : null}
            </>
          )}

          <View style={styles.actionsRow}>
            <AnimatedActionButton feedback="like" accessibilityLabel={isLiked ? 'Unlike Lime comment' : 'Like Lime comment'} onPress={() => handleToggleLike(comment.id)} style={styles.actionBtn}>
              <Heart
                size={14}
                color={isLiked ? '#ef4444' : colors.mutedText}
                fill={isLiked ? '#ef4444' : 'none'}
              />
              <Text style={[styles.actionText, { color: colors.mutedText }, isLiked && { color: '#ef4444' }]}>
                {safeL.length > 0 ? safeL.length : 'Like'}
              </Text>
            </AnimatedActionButton>

            <TouchableOpacity
              onPress={() => {
                setReplyTarget({ id: comment.id, userName: comment.userName });
                setCommentText(`@${comment.userName} `);
              }}
              style={styles.actionBtn}
            >
              <CornerDownRight size={14} color={colors.mutedText} />
              <Text style={[styles.actionText, { color: colors.mutedText }]}>Reply</Text>
            </TouchableOpacity>

            {isOwner && (
              <>
                <TouchableOpacity
                  onPress={() => { setEditingId(comment.id); setEditText(comment.content ?? ''); }}
                  style={styles.actionBtn}
                >
                  <Edit2 size={13} color={colors.mutedText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(comment.id)} style={styles.actionBtn}>
                  <Trash2 size={13} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
            {!isOwner && currentUserId ? (
              <TouchableOpacity
                onPress={() => setReportTarget({
                  id: comment.id,
                  authorId: comment.userId,
                  authorName: comment.userName,
                  preview: comment.content || (comment.sticker ? `[${comment.sticker.name}]` : 'Comment'),
                  contentType: 'comment',
                })}
                style={styles.actionBtn}
                accessibilityLabel={`Report comment from @${comment.userName}`}
              >
                <Flag size={12} color={colors.mutedText} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Sub-replies */}
          {visibleSubReplies.length > 0 && (
            <View style={[styles.subRepliesThread, { borderLeftColor: colors.border }]}>
              {visibleSubReplies.map((reply) => {
                const replyL = Array.isArray(reply.likes) ? reply.likes : [];
                const replyLiked = currentUserId ? replyL.includes(currentUserId) : false;
                const replyOwner = currentUserId && reply.userId === currentUserId;
                const replyEditing = editingId === reply.id;
                return (
                  <View key={reply.id} style={styles.subReplyItem}>
                    <UserAvatar
                      profileImage={reply.profileImage}
                      firstName={reply.firstName || reply.userName || 'U'}
                      size={26}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentMetaRow}>
                        <Text style={[styles.commentUser, { color: colors.text }]}>
                          {reply.userName ? `@${reply.userName}` : 'Unknown'}
                        </Text>
                        {reply.replyToUserName && (
                          <Text style={[styles.replyingTo, { color: colors.mutedText }]}>
                            → <Text style={styles.mentionText}>@{reply.replyToUserName}</Text>
                          </Text>
                        )}
                        <Text style={[styles.commentTime, { color: colors.mutedText }]}>{formatTime(reply.createdAt)}</Text>
                        {reply.editedAt && (
                          <Text style={[styles.editedLabel, { color: colors.mutedText }]}>· edited</Text>
                        )}
                      </View>
                      {replyEditing ? (
                        <View style={styles.editRow}>
                          <TextInput
                            value={editText}
                            onChangeText={setEditText}
                            style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                            autoFocus
                            multiline
                          />
                          <View style={styles.editActions}>
                            <TouchableOpacity onPress={() => { setEditingId(null); setEditText(''); }} style={[styles.editCancelBtn, { backgroundColor: colors.control }]}>
                              <Text style={[styles.editCancelText, { color: colors.secondaryText }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveEdit} style={styles.saveEditBtn} disabled={!editText.trim()}>
                              <Text style={styles.saveEditBtnText}>Save</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <>
                          {reply.content ? <Text style={[styles.commentContent, { color: colors.secondaryText }]}>{renderContent(reply.content, colors.secondaryText, handleMentionPress)}</Text> : null}
                          {reply.sticker ? (
                            <Image
                              source={reply.sticker.type === 'sticker' ? getLocalStickerSource(reply.sticker.imageUrl) ?? { uri: reply.sticker.imageUrl } : { uri: reply.sticker.imageUrl }}
                              contentFit={reply.sticker.type === 'gif' ? 'cover' : 'contain'}
                              style={styles.replyMedia}
                            />
                          ) : null}
                        </>
                      )}
                      <View style={styles.actionsRow}>
                        <AnimatedActionButton feedback="like" accessibilityLabel={replyLiked ? 'Unlike Lime reply' : 'Like Lime reply'} onPress={() => handleToggleLike(reply.id)} style={styles.actionBtn}>
                          <Heart
                            size={13}
                            color={replyLiked ? '#ef4444' : colors.mutedText}
                            fill={replyLiked ? '#ef4444' : 'none'}
                          />
                          <Text style={[styles.actionText, { color: colors.mutedText }, replyLiked && { color: '#ef4444' }]}>
                            {replyL.length > 0 ? replyL.length : 'Like'}
                          </Text>
                        </AnimatedActionButton>
                        <TouchableOpacity
                          onPress={() => {
                            setReplyTarget({ id: comment.id, userName: reply.userName });
                            setCommentText(`@${reply.userName} `);
                          }}
                          style={styles.actionBtn}
                        >
                          <CornerDownRight size={13} color={colors.mutedText} />
                          <Text style={[styles.actionText, { color: colors.mutedText }]}>Reply</Text>
                        </TouchableOpacity>
                        {replyOwner && (
                          <>
                            <TouchableOpacity onPress={() => { setEditingId(reply.id); setEditText(reply.content ?? ''); }} style={styles.actionBtn}>
                              <Edit2 size={12} color={colors.mutedText} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(reply.id)} style={styles.actionBtn}>
                              <Trash2 size={12} color="#ef4444" />
                            </TouchableOpacity>
                          </>
                        )}
                        {!replyOwner && currentUserId ? (
                          <TouchableOpacity
                            onPress={() => setReportTarget({
                              id: reply.id,
                              authorId: reply.userId,
                              authorName: reply.userName,
                              preview: reply.content || (reply.sticker ? `[${reply.sticker.name}]` : 'Reply'),
                              contentType: 'reply',
                            })}
                            style={styles.actionBtn}
                            accessibilityLabel={`Report reply from @${reply.userName}`}
                          >
                            <Flag size={12} color={colors.mutedText} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
              {canLoadMoreReplies && (
                <TouchableOpacity
                  onPress={() =>
                    setVisibleRepliesLimitMap((prev) => ({
                      ...prev,
                      [comment.id]: (prev[comment.id] ?? 50) + 50,
                    }))
                  }
                  style={styles.loadMoreRepliesBtn}
                >
                  <ChevronDown size={14} color="#10b981" />
                  <Text style={styles.loadMoreRepliesText}>
                    Load {subReplies.length - visibleSubReplies.length} more replies
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const keyExtractor = (item: LimeComment, index: number) =>
    item.id ? item.id : `comment-${index}`;

  return (
    <Modal visible={isOpen} animationType="none" transparent onRequestClose={swipeDismiss.dismissWithAnimation}>
      <View style={[styles.overlay, { backgroundColor: colors.modalScrim }]}>
        <Animated.View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: Math.max(20, insets.bottom) }, swipeDismiss.animatedStyle]}>
          {/* Top Drag Handle Bar */}
          <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.mutedText} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close Lime comments" />

          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <TouchableOpacity onPress={swipeDismiss.dismissWithAnimation} style={[styles.closeBtn, { backgroundColor: colors.control }]}>
              <X size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading && comments.length === 0 ? (
            <View style={styles.skeletonContainer}>
              <CommentSkeletonRow />
              <CommentSkeletonRow />
              <CommentSkeletonRow />
              <CommentSkeletonRow />
            </View>
          ) : rootComments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Smile size={36} color={colors.mutedText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No comments yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedText }]}>Be the first to share your thoughts on this Lime!</Text>
            </View>
          ) : (
            <FlatList
              data={rootComments}
              keyExtractor={keyExtractor}
              renderItem={renderComment}
              style={styles.commentsList}
              contentContainerStyle={{ paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              onEndReached={() => { if (hasMore && !loadingMore) void fetchMoreComments(); }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#10b981" />
                  </View>
                ) : null
              }
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Reply Target Banner */}
          {replyTarget && (
            <View style={[styles.replyBanner, { backgroundColor: colors.successSurface }]}>
              <Text style={[styles.replyBannerText, { color: colors.successText }]}>Replying to @{replyTarget.userName}</Text>
              <TouchableOpacity onPress={() => { setReplyTarget(null); setCommentText(''); }}>
                <X size={16} color={colors.successText} />
              </TouchableOpacity>
            </View>
          )}

          {/* Emoji Bar */}
          <View style={styles.emojiRow}>
            {EMOJI_PILLS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setCommentText((prev) => prev + emoji)}
                style={[styles.emojiPill, { backgroundColor: colors.control }]}
              >
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input Footer */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {selectedMedia ? (
              <View style={styles.selectedMediaRow}>
                <Image
                  source={selectedMedia.type === 'sticker' ? getLocalStickerSource(selectedMedia.imageUrl) ?? { uri: selectedMedia.imageUrl } : { uri: selectedMedia.imageUrl }}
                  contentFit={selectedMedia.type === 'gif' ? 'cover' : 'contain'}
                  style={styles.selectedMedia}
                />
                <TouchableOpacity onPress={() => setSelectedMedia(null)} accessibilityLabel={`Remove selected ${selectedMedia.type}`} style={styles.removeMediaButton}>
                  <X size={17} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={() => setEnhancementPickerOpen(true)}
                accessibilityLabel="Open emojis and stickers"
                style={styles.enhancementButton}
              >
                <Smile size={20} color={colors.accentText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setGifPickerOpen(true)} accessibilityLabel="Choose a GIF" style={styles.gifButton}>
                <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '900' }}>GIF</Text>
              </TouchableOpacity>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  replyTarget
                    ? `Reply to @${replyTarget.userName}…`
                    : 'Add a comment…'
                }
                placeholderTextColor={colors.mutedText}
                style={[styles.inputField, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSubmit}
              />
              <AnimatedActionButton
                feedback="comment"
                accessibilityLabel={replyTarget ? 'Send Lime reply' : 'Send Lime comment'}
                onPress={handleSubmit}
                disabled={(!commentText.trim() && !selectedMedia) || submitting}
                style={[
                  styles.sendBtn,
                  ((!commentText.trim() && !selectedMedia) || submitting) && { backgroundColor: colors.disabled },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Send size={16} color="#ffffff" />
                )}
              </AnimatedActionButton>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      <GifPickerModal
        visible={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onSelect={(gif) => {
          setSelectedMedia(gif);
          setGifPickerOpen(false);
        }}
      />
      {enhancementPickerOpen ? (
        <EmojiStickerKeyboard
          visible
          onClose={() => setEnhancementPickerOpen(false)}
          onEmojiSelect={(emoji) => setCommentText((currentText) => currentText + emoji)}
          onStickerSelect={handleStickerSelect}
          onBackspace={() => setCommentText((currentText) => Array.from(currentText).slice(0, -1).join(''))}
        />
      ) : null}

      <CommunityReportModal
        visible={Boolean(reportTarget)}
        title={reportTarget?.contentType === 'reply' ? 'Report reply' : 'Report comment'}
        subjectLabel={reportTarget ? `@${reportTarget.authorName}: ${reportTarget.preview}` : ''}
        childSafetyTarget={reportTarget ? {
          type: reportTarget.contentType,
          id: reportTarget.id,
          parentId: reelId,
          ownerUserId: reportTarget.authorId,
          routePath: `/limes?limeId=${encodeURIComponent(reelId)}`,
        } : undefined}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
      />

      <CustomModal
        visible={deleteTargetId !== null}
        type="danger"
        title="Delete comment?"
        message="This permanently removes your comment and cannot be undone."
        confirmText="Delete"
        cancelText="Keep comment"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTargetId(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '84%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dragHandleWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandleBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
  },
  skeletonName: {
    width: 120,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  skeletonText: {
    width: '85%',
    height: 14,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  skeletonMeta: {
    width: '40%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  commentsList: {
    flex: 1,
    paddingTop: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  commentBody: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 2,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  commentTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  editedLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  replyingTo: {
    fontSize: 11,
    color: '#64748b',
  },
  commentContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  commentMedia: { width: 150, height: 112, borderRadius: 12, marginTop: 7 },
  replyMedia: { width: 120, height: 90, borderRadius: 10, marginTop: 6 },
  mentionText: {
    color: '#10b981',
    fontWeight: '700',
  },
  normalText: {
    color: '#334155',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  subRepliesThread: {
    marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e2e8f0',
    gap: 12,
  },
  subReplyItem: {
    flexDirection: 'row',
    gap: 10,
  },
  loadMoreRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    marginTop: 2,
  },
  loadMoreRepliesText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  editRow: {
    marginTop: 4,
    gap: 6,
  },
  editInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 38,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  editCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  saveEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  saveEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginBottom: 6,
  },
  replyBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    marginBottom: 4,
  },
  emojiPill: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedMediaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  selectedMedia: { width: 72, height: 54, borderRadius: 9 },
  removeMediaButton: { padding: 9 },
  enhancementButton: { paddingVertical: 10, paddingHorizontal: 3 },
  gifButton: { paddingVertical: 10, paddingHorizontal: 2 },
  inputField: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    maxHeight: 90,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  /* Delete confirmation */
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  deleteSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  deleteConfirmBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteConfirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteCancelBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  deleteCancelText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
});
