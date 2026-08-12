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
  Dimensions,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, Heart, CornerDownRight, Edit2, Trash2, Smile, ChevronDown } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { dispatchMentionNotifications } from '@/lib/services/dispatchMentionNotifications';
import { AuthService } from '@/lib/services/AuthService';
import { limeService } from '@/lib/services/LimeService';
import type { LimeComment, LimeCommentCursor } from '@/lib/types/lime';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const authService = AuthService.getInstance();

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
    };
  } catch {
    return null;
  }
}

function CommentSkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.skeletonName} />
        <View style={styles.skeletonText} />
        <View style={styles.skeletonMeta} />
      </View>
    </View>
  );
}

function renderContent(content: string): ReactNode {
  if (!content || typeof content !== 'string') return null;
  const parts = content.split(/(@[a-zA-Z0-9._]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <Text key={i} style={styles.mentionText}>{part}</Text>
    ) : (
      <Text key={i} style={styles.normalText}>{part}</Text>
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

  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?.uid ?? '';
  const currentUserName =
    currentUser?.displayName?.trim() || currentUser?.email?.split('@')[0] || 'user';
  const currentFirstName =
    currentUser?.displayName?.split(' ')[0] || 'User';

  /* ── Swipe-Down — we own the animation (animationType=none) ── */
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const closeSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(SCREEN_HEIGHT);
      onClose();
    });
  }, [translateY, onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && g.dy > 0,
      onPanResponderGrant: () => { translateY.setOffset(0); },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        if (g.dy > 120 || g.vy > 0.6) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(SCREEN_HEIGHT);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 3,
          }).start();
        }
      },
    })
  ).current;

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
      if (onCommentCountUpdate) onCommentCountUpdate(loaded.length);
    } catch (err) {
      console.error('[LimeCommentModal] fetchComments error:', err);
    } finally {
      setLoading(false);
    }
  }, [reelId, onCommentCountUpdate]);

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
    // Slide-in animation
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 3,
      speed: 16,
    }).start();
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
    if (!text || submitting || !currentUserId) return;
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
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
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
      });
      // Replace temp with real ID
      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? { ...c, id: commentId } : c))
      );
      dispatchMentionNotifications({
        actorUserId: currentUserId,
        actorName: currentUserName,
        actorProfileImage: currentUser?.photoURL ?? undefined,
        content: text,
        contentType: 'lime',
        postId: reelId,
        commentId,
      });
    } catch (err) {
      console.error('[LimeCommentModal] submit error:', err);
      // Roll back optimistic add
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
    } finally {
      setSubmitting(false);
    }
  }, [commentText, submitting, currentUserId, currentUserName, currentFirstName, currentUser?.photoURL, reelId, replyTarget, comments.length, onCommentCountUpdate]);

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
    try {
      await limeService.deleteComment(reelId, idToDelete);
    } catch (err) {
      console.error('[LimeCommentModal] delete error:', err);
    }
  }, [deleteTargetId, reelId]);

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
            <Text style={styles.commentUser}>
              {comment.userName ? `@${comment.userName}` : 'Unknown'}
            </Text>
            <Text style={styles.commentTime}>{formatTime(comment.createdAt)}</Text>
            {comment.editedAt && (
              <Text style={styles.editedLabel}>· edited</Text>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                style={styles.editInput}
                autoFocus
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => { setEditingId(null); setEditText(''); }}
                  style={styles.editCancelBtn}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
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
            <Text style={styles.commentContent}>
              {renderContent(comment.content ?? '')}
            </Text>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => handleToggleLike(comment.id)} style={styles.actionBtn}>
              <Heart
                size={14}
                color={isLiked ? '#ef4444' : '#64748b'}
                fill={isLiked ? '#ef4444' : 'none'}
              />
              <Text style={[styles.actionText, isLiked && { color: '#ef4444' }]}>
                {safeL.length > 0 ? safeL.length : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setReplyTarget({ id: comment.id, userName: comment.userName });
                setCommentText(`@${comment.userName} `);
              }}
              style={styles.actionBtn}
            >
              <CornerDownRight size={14} color="#64748b" />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>

            {isOwner && (
              <>
                <TouchableOpacity
                  onPress={() => { setEditingId(comment.id); setEditText(comment.content ?? ''); }}
                  style={styles.actionBtn}
                >
                  <Edit2 size={13} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(comment.id)} style={styles.actionBtn}>
                  <Trash2 size={13} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Sub-replies */}
          {visibleSubReplies.length > 0 && (
            <View style={styles.subRepliesThread}>
              {visibleSubReplies.map((reply) => {
                const replyL = Array.isArray(reply.likes) ? reply.likes : [];
                const replyLiked = currentUserId ? replyL.includes(currentUserId) : false;
                const replyOwner = currentUserId && reply.userId === currentUserId;
                return (
                  <View key={reply.id} style={styles.subReplyItem}>
                    <UserAvatar
                      profileImage={reply.profileImage}
                      firstName={reply.firstName || reply.userName || 'U'}
                      size={26}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.commentMetaRow}>
                        <Text style={styles.commentUser}>
                          {reply.userName ? `@${reply.userName}` : 'Unknown'}
                        </Text>
                        {reply.replyToUserName && (
                          <Text style={styles.replyingTo}>
                            → <Text style={styles.mentionText}>@{reply.replyToUserName}</Text>
                          </Text>
                        )}
                        <Text style={styles.commentTime}>{formatTime(reply.createdAt)}</Text>
                        {reply.editedAt && (
                          <Text style={styles.editedLabel}>· edited</Text>
                        )}
                      </View>
                      <Text style={styles.commentContent}>{renderContent(reply.content ?? '')}</Text>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={() => handleToggleLike(reply.id)} style={styles.actionBtn}>
                          <Heart
                            size={13}
                            color={replyLiked ? '#ef4444' : '#64748b'}
                            fill={replyLiked ? '#ef4444' : 'none'}
                          />
                          <Text style={[styles.actionText, replyLiked && { color: '#ef4444' }]}>
                            {replyL.length > 0 ? replyL.length : 'Like'}
                          </Text>
                        </TouchableOpacity>
                        {replyOwner && (
                          <TouchableOpacity onPress={() => handleDelete(reply.id)} style={styles.actionBtn}>
                            <Trash2 size={12} color="#ef4444" />
                          </TouchableOpacity>
                        )}
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
    <Modal visible={isOpen} animationType="none" transparent onRequestClose={closeSheet}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalCard, { transform: [{ translateY }] }]}>
          {/* Top Drag Handle Bar */}
          <View style={styles.dragHandleWrapper} {...panResponder.panHandlers}>
            <View style={styles.dragHandleBar} />
          </View>

          {/* Header */}
          <View style={styles.headerRow} {...panResponder.panHandlers}>
            <Text style={styles.headerTitle}>
              Comments {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
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
              <Smile size={36} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share your thoughts on this Lime!</Text>
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
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to @{replyTarget.userName}</Text>
              <TouchableOpacity onPress={() => { setReplyTarget(null); setCommentText(''); }}>
                <X size={16} color="#047857" />
              </TouchableOpacity>
            </View>
          )}

          {/* Emoji Bar */}
          <View style={styles.emojiRow}>
            {EMOJI_PILLS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setCommentText((prev) => prev + emoji)}
                style={styles.emojiPill}
              >
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input Footer */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.inputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  replyTarget
                    ? `Reply to @${replyTarget.userName}…`
                    : 'Add a comment…'
                }
                placeholderTextColor="#94a3b8"
                style={styles.inputField}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!commentText.trim() || submitting}
                style={[
                  styles.sendBtn,
                  (!commentText.trim() || submitting) && styles.sendBtnDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Send size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      {/* Custom Delete Confirmation Sheet */}
      <Modal
        visible={deleteTargetId !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTargetId(null)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteSheet}>
            <View style={styles.deleteIconCircle}>
              <Trash2 size={28} color="#ef4444" />
            </View>
            <Text style={styles.deleteTitle}>Delete comment?</Text>
            <Text style={styles.deleteSubtitle}>
              This will permanently remove your comment. This action cannot be undone.
            </Text>
            <TouchableOpacity onPress={confirmDelete} style={styles.deleteConfirmBtn} activeOpacity={0.85}>
              <Text style={styles.deleteConfirmText}>Yes, delete it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteTargetId(null)}
              style={styles.deleteCancelBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteCancelText}>Keep comment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
