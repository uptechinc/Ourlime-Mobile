import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, Heart, CornerDownRight, Edit2, Trash2, Smile, ChevronDown } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { auth, db } from '@/lib/firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  DocumentSnapshot,
} from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LimeComment {
  id: string;
  reelId: string;
  userId: string;
  content: string;
  userName: string;
  firstName?: string;
  profileImage?: string;
  likes: string[];
  replyCount: number;
  parentCommentId?: string;
  replyToUserName?: string;
  createdAt: any;
}

interface CommentModalProps {
  reelId: string;
  isOpen: boolean;
  initialComments?: LimeComment[];
  onClose: () => void;
  onCommentCountUpdate?: (count: number) => void;
}

const EMOJI_PILLS = ['❤️', '🔥', '😂', '👏', '🚀', '🙌'];
const PAGE_SIZE = 50;

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

export default function CommentModal({ reelId, isOpen, initialComments = [], onClose, onCommentCountUpdate }: CommentModalProps) {
  const [comments, setComments] = useState<LimeComment[]>(initialComments);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(initialComments.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDocSnap, setLastDocSnap] = useState<DocumentSnapshot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; userName: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  /* Limit sub-comment replies initially visible per thread */
  const [visibleRepliesLimitMap, setVisibleRepliesLimitMap] = useState<Record<string, number>>({});

  const currentUserId = auth.currentUser?.uid || '';
  const currentUserName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'user';

  /* ── Swipe-Down PanResponder ── */
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  /* ── Fetch Initial Batch (50 comments) ── */
  const fetchComments = useCallback(async () => {
    if (!reelId) return;
    if (initialComments.length === 0) setLoading(true);
    try {
      const q = query(
        collection(db, 'reels', reelId, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const loaded: LimeComment[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          reelId,
          userId: data.userId || '',
          content: data.content || '',
          userName: data.userName || data.user?.userName || 'user',
          firstName: data.firstName || data.user?.firstName || 'User',
          profileImage: data.profileImage || data.user?.profileImage || undefined,
          likes: Array.isArray(data.likes) ? data.likes : [],
          replyCount: data.replyCount || 0,
          parentCommentId: data.parentCommentId || undefined,
          replyToUserName: data.replyToUserName || undefined,
          createdAt: data.createdAt ? (data.createdAt.seconds ? data.createdAt.seconds * 1000 : Date.now()) : Date.now(),
        };
      });
      setComments(loaded);
      if (snap.docs.length > 0) {
        setLastDocSnap(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length >= PAGE_SIZE);
      if (onCommentCountUpdate) onCommentCountUpdate(loaded.length);
    } catch (error) {
      console.error('[LimeCommentModal] Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [reelId, initialComments.length, onCommentCountUpdate]);

  /* ── On-Scroll Pagination: Fetch Next 50 Comments ── */
  const fetchMoreComments = async () => {
    if (loadingMore || !hasMore || !lastDocSnap || !reelId) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'reels', reelId, 'comments'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocSnap),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const nextBatch: LimeComment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            reelId,
            userId: data.userId || '',
            content: data.content || '',
            userName: data.userName || data.user?.userName || 'user',
            firstName: data.firstName || data.user?.firstName || 'User',
            profileImage: data.profileImage || data.user?.profileImage || undefined,
            likes: Array.isArray(data.likes) ? data.likes : [],
            replyCount: data.replyCount || 0,
            parentCommentId: data.parentCommentId || undefined,
            replyToUserName: data.replyToUserName || undefined,
            createdAt: data.createdAt ? (data.createdAt.seconds ? data.createdAt.seconds * 1000 : Date.now()) : Date.now(),
          };
        });

        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = nextBatch.filter((c) => !existingIds.has(c.id));
          return [...prev, ...uniqueNew];
        });
        setLastDocSnap(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[LimeCommentModal] Load more comments error:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (initialComments && initialComments.length > 0) {
      setComments(initialComments);
      setLoading(false);
    }
  }, [initialComments]);

  useEffect(() => {
    if (isOpen) {
      translateY.setValue(0);
      void fetchComments();
    }
  }, [isOpen, fetchComments, translateY]);

  /* ── Add Comment / Reply ── */
  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting || !currentUserId) return;
    setSubmitting(true);
    try {
      const newCommentData = {
        userId: currentUserId,
        userName: currentUserName,
        firstName: auth.currentUser?.displayName?.split(' ')[0] || 'User',
        profileImage: auth.currentUser?.photoURL || null,
        content: commentText.trim(),
        likes: [],
        replyCount: 0,
        parentCommentId: replyTarget ? replyTarget.id : null,
        replyToUserName: replyTarget ? replyTarget.userName : null,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reels', reelId, 'comments'), newCommentData);

      const localItem: LimeComment = {
        id: docRef.id,
        reelId,
        userId: currentUserId,
        content: commentText.trim(),
        userName: currentUserName,
        firstName: auth.currentUser?.displayName?.split(' ')[0] || 'User',
        profileImage: auth.currentUser?.photoURL || undefined,
        likes: [],
        replyCount: 0,
        parentCommentId: replyTarget ? replyTarget.id : undefined,
        replyToUserName: replyTarget ? replyTarget.userName : undefined,
        createdAt: Date.now(),
      };

      setComments((prev) => [localItem, ...prev]);
      setCommentText('');
      setReplyTarget(null);
      if (onCommentCountUpdate) onCommentCountUpdate(comments.length + 1);
    } catch (error) {
      console.error('[LimeCommentModal] Submit error:', error);
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Toggle Like / Reaction with Bright Red Fill ── */
  const handleToggleLike = async (commentId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likes: isLiked ? c.likes.filter((u) => u !== currentUserId) : [...c.likes, currentUserId] }
          : c
      )
    );

    try {
      const commentRef = doc(db, 'reels', reelId, 'comments', commentId);
      await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
      });
    } catch (error) {
      console.error('[LimeCommentModal] Like error:', error);
    }
  };

  /* ── Edit Comment ── */
  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: editText.trim() } : c)));
    setEditingId(null);
    try {
      await updateDoc(doc(db, 'reels', reelId, 'comments', commentId), { content: editText.trim() });
    } catch (error) {
      console.error('[LimeCommentModal] Edit error:', error);
    }
  };

  /* ── Delete Comment ── */
  const handleDeleteComment = async (commentId: string) => {
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          try {
            await deleteDoc(doc(db, 'reels', reelId, 'comments', commentId));
          } catch (error) {
            console.error('[LimeCommentModal] Delete error:', error);
          }
        },
      },
    ]);
  };

  const renderContent = (content: string) =>
    content.split(/(@[a-zA-Z0-9._]+)/g).map((part, index) => (
      <Text key={`${part}-${index}`} style={part.startsWith('@') ? styles.mentionText : styles.normalText}>
        {part}
      </Text>
    ));

  // Separate root comments from sub-comment replies
  const rootComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParentMap: Record<string, LimeComment[]> = {};
  comments.forEach((c) => {
    if (c.parentCommentId) {
      if (!repliesByParentMap[c.parentCommentId]) repliesByParentMap[c.parentCommentId] = [];
      repliesByParentMap[c.parentCommentId].push(c);
    }
  });

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalCard, { transform: [{ translateY }] }]}>
          
          {/* Top Drag Handle Bar */}
          <View style={styles.dragHandleWrapper} {...panResponder.panHandlers}>
            <View style={styles.dragHandleBar} />
          </View>

          {/* Header */}
          <View style={styles.headerRow} {...panResponder.panHandlers}>
            <Text style={styles.headerTitle}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Comments Feed List with Skeleton Loaders & On-Scroll Pagination */}
          {loading && comments.length === 0 ? (
            <View style={styles.commentsList}>
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
            <ScrollView
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
                if (isNearBottom && hasMore && !loadingMore) {
                  void fetchMoreComments();
                }
              }}
              scrollEventThrottle={200}
            >
              {rootComments.map((comment) => {
                const likesArray = Array.isArray(comment.likes) ? comment.likes : [];
                const isLiked = likesArray.includes(currentUserId);
                const isOwner = comment.userId === currentUserId;
                const isEditing = editingId === comment.id;

                const allSubReplies = repliesByParentMap[comment.id] || [];
                const repliesVisibleLimit = visibleRepliesLimitMap[comment.id] || 50;
                const visibleSubReplies = allSubReplies.slice(0, repliesVisibleLimit);
                const hasMoreSubReplies = allSubReplies.length > visibleSubReplies.length;

                return (
                  <View key={comment.id || String(Math.random())} style={styles.commentItem}>
                    <UserAvatar profileImage={comment.profileImage} firstName={comment.firstName || comment.userName} size={36} />
                    <View style={styles.commentBody}>
                      
                      <View style={styles.commentMetaRow}>
                        <Text style={styles.commentUser}>@{comment.userName}</Text>
                      </View>

                      {isEditing ? (
                        <View style={styles.editRow}>
                          <TextInput
                            value={editText}
                            onChangeText={setEditText}
                            style={styles.editInput}
                            autoFocus
                          />
                          <TouchableOpacity onPress={() => handleSaveEdit(comment.id)} style={styles.saveEditBtn}>
                            <Text style={styles.saveEditBtnText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.commentContent}>{renderContent(comment.content)}</Text>
                      )}

                      {/* Comment Actions (Like, Reply, Edit, Delete) */}
                      <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={() => handleToggleLike(comment.id, isLiked)} style={styles.actionBtn}>
                          <Heart size={14} color={isLiked ? '#ef4444' : '#64748b'} fill={isLiked ? '#ef4444' : 'none'} />
                          <Text style={[styles.actionText, isLiked && { color: '#ef4444' }]}>
                            {likesArray.length > 0 ? likesArray.length : 'Like'}
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
                              onPress={() => {
                                setEditingId(comment.id);
                                setEditText(comment.content);
                              }}
                              style={styles.actionBtn}
                            >
                              <Edit2 size={13} color="#64748b" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleDeleteComment(comment.id)} style={styles.actionBtn}>
                              <Trash2 size={13} color="#ef4444" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>

                      {/* Sub-Comments / Replies Thread */}
                      {visibleSubReplies.length > 0 && (
                        <View style={styles.subRepliesThread}>
                          {visibleSubReplies.map((reply) => {
                            const replyLikesArray = Array.isArray(reply.likes) ? reply.likes : [];
                            const isReplyLiked = replyLikesArray.includes(currentUserId);
                            const isReplyOwner = reply.userId === currentUserId;
                            return (
                              <View key={reply.id || String(Math.random())} style={styles.subReplyItem}>
                                <UserAvatar profileImage={reply.profileImage} firstName={reply.firstName || reply.userName} size={26} />
                                <View style={{ flex: 1 }}>
                                  <View style={styles.commentMetaRow}>
                                    <Text style={styles.commentUser}>@{reply.userName}</Text>
                                    <Text style={styles.replyingTo}>
                                      replying to <Text style={{ color: '#10b981', fontWeight: '700' }}>@{reply.replyToUserName || comment.userName}</Text>
                                    </Text>
                                  </View>

                                  <Text style={styles.commentContent}>{renderContent(reply.content)}</Text>

                                  <View style={styles.actionsRow}>
                                    <TouchableOpacity onPress={() => handleToggleLike(reply.id, isReplyLiked)} style={styles.actionBtn}>
                                      <Heart size={13} color={isReplyLiked ? '#ef4444' : '#64748b'} fill={isReplyLiked ? '#ef4444' : 'none'} />
                                      <Text style={[styles.actionText, isReplyLiked && { color: '#ef4444' }]}>
                                        {replyLikesArray.length > 0 ? replyLikesArray.length : 'Like'}
                                      </Text>
                                    </TouchableOpacity>
                                    {isReplyOwner && (
                                      <TouchableOpacity onPress={() => handleDeleteComment(reply.id)} style={styles.actionBtn}>
                                        <Trash2 size={12} color="#ef4444" />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              </View>
                            );
                          })}

                          {/* Load More Sub-Comments Button */}
                          {hasMoreSubReplies && (
                            <TouchableOpacity
                              onPress={() =>
                                setVisibleRepliesLimitMap((prev) => ({
                                  ...prev,
                                  [comment.id]: (prev[comment.id] || 50) + 50,
                                }))
                              }
                              style={styles.loadMoreRepliesBtn}
                            >
                              <ChevronDown size={14} color="#10b981" />
                              <Text style={styles.loadMoreRepliesText}>
                                Load more replies ({allSubReplies.length - visibleSubReplies.length})
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                    </View>
                  </View>
                );
              })}

              {/* On-Scroll Infinite Loading Spinner */}
              {loadingMore && (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              )}
            </ScrollView>
          )}

          {/* Reply Target Banner */}
          {replyTarget && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to @{replyTarget.userName}</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)}>
                <X size={16} color="#047857" />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Emoji Bar */}
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
                placeholder={replyTarget ? `Reply to @${replyTarget.userName}…` : 'Add a comment…'}
                placeholderTextColor="#94a3b8"
                style={styles.inputField}
                multiline
              />
              <TouchableOpacity
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submitting}
                style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
              >
                {submitting ? <ActivityIndicator size="small" color="#ffffff" /> : <Send size={16} color="#ffffff" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

        </Animated.View>
      </View>
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
    paddingVertical: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  commentBody: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  replyingTo: {
    fontSize: 11,
    color: '#64748b',
  },
  commentContent: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
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
    gap: 10,
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
    marginTop: 4,
  },
  loadMoreRepliesText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  saveEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
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
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
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
    marginBottom: 6,
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
    maxHeight: 80,
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
});