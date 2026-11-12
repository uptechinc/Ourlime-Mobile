import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ban, Flag, Heart, MessageSquare, MoreHorizontal, Pencil, ShieldAlert, Square, SquareCheck, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import UserAvatar from '@/components/ui/UserAvatar';
import MentionText from '@/components/ui/MentionText';
import CustomModal from '@/components/ui/CustomModal';
import CommunityReportModal from '@/components/communities/CommunityReportModal';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { eventDiscussionService, type EventDiscussionComment, type EventDiscussionNode, type EventDiscussionSort } from '@/lib/services/EventDiscussionService';
import { moderationService, type ReportReasonCategory } from '@/lib/services/ModerationService';
import type { ChildSafetyIntakeValues } from '@/lib/types/childSafety';
import { EventDiscussionSkeleton } from '../EventSkeletons';

type EventDiscussionSectionProps = {
  eventId: string;
  viewerId: string | null;
  organizerId: string;
  /** The organiser, or a co-organiser with manage_discussions: may remove other members' comments. */
  canModerate: boolean;
  onCountChange: (count: number) => void;
};

type ConfirmAction = { type: 'delete' | 'mute' | 'block'; comment: EventDiscussionComment };
const PAGE_SIZE = 20;
const SORT_OPTIONS: { value: EventDiscussionSort; label: string }[] = [{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'most_liked', label: 'Most liked' }];

const formatTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

/** The website's Discussions tab: guidelines, start a discussion, sorted threads with likes, replies, edit and moderation. */
export default function EventDiscussionSection({ eventId, viewerId, organizerId, canModerate, onCountChange }: EventDiscussionSectionProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [comments, setComments] = useState<EventDiscussionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<EventDiscussionSort>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mutedIds, setMutedIds] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(true);
  const [guidelinesChecked, setGuidelinesChecked] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [reportComment, setReportComment] = useState<EventDiscussionComment | null>(null);

  const load = useCallback(async () => {
    try {
      const [loaded, viewer] = await Promise.all([eventDiscussionService.fetchComments(eventId, sort), eventDiscussionService.fetchViewerState(eventId)]);
      setComments(loaded);
      onCountChange(loaded.length);
      setMutedIds(viewer.mutedUserIds);
      setBlockedIds(viewer.blockedUserIds);
      setLikedIds(new Set(viewer.likedCommentIds));
      setGuidelinesAccepted(!viewerId || viewer.guidelinesAccepted);
    } catch (error: unknown) {
      console.error('[EventDiscussionSection.load] Error:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [eventId, onCountChange, sort, viewerId]);
  useEffect(() => { void load(); }, [load]);

  const hidden = useMemo(() => new Set([...mutedIds, ...blockedIds]), [blockedIds, mutedIds]);
  const visible = useMemo(() => comments.filter((comment) => !hidden.has(comment.userId)), [comments, hidden]);
  const tree = useMemo(() => eventDiscussionService.buildTree(visible), [visible]);

  const requireSignIn = (message: string): boolean => {
    if (viewerId) return true;
    toast.error(message);
    return false;
  };

  const handleAcceptGuidelines = async () => {
    setIsAccepting(true);
    try {
      await eventDiscussionService.acceptGuidelines();
      setGuidelinesAccepted(true);
      toast.success('Thank you for accepting the Community Guidelines');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept the guidelines. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handlePost = async (parentId: string | null) => {
    if (!requireSignIn(parentId ? 'Please sign in to reply' : 'Please sign in to start a discussion')) return;
    const text = parentId ? replyText : draft;
    if (!text.trim()) return;
    if (!parentId && !guidelinesAccepted) { toast.error('Please accept the Community Guidelines first'); return; }
    setIsPosting(true);
    try {
      await eventDiscussionService.addComment(eventId, text, { parentId, isOrganizerReply: Boolean(parentId) && viewerId === organizerId });
      if (parentId) { setReplyTo(null); setReplyText(''); toast.success('Reply added successfully'); }
      else { setDraft(''); toast.success('Discussion post added successfully'); }
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Your post could not be added. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    try {
      await eventDiscussionService.editComment(commentId, editText);
      setComments((current) => current.map((comment) => (comment.id === commentId ? { ...comment, comment: editText.trim(), editedAt: new Date().toISOString() } : comment)));
      setEditingId(null);
      toast.success('Comment updated');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The comment could not be updated.');
    }
  };

  const handleLike = async (comment: EventDiscussionComment) => {
    if (!requireSignIn('Please sign in to like comments')) return;
    const wasLiked = likedIds.has(comment.id);
    const adjust = (delta: number) => setComments((current) => current.map((item) => (item.id === comment.id ? { ...item, likeCount: Math.max(0, item.likeCount + delta) } : item)));
    setLikedIds((current) => { const next = new Set(current); if (wasLiked) next.delete(comment.id); else next.add(comment.id); return next; });
    adjust(wasLiked ? -1 : 1);
    try {
      await eventDiscussionService.toggleCommentLike(eventId, comment.id, !wasLiked);
    } catch (error: unknown) {
      setLikedIds((current) => { const next = new Set(current); if (wasLiked) next.add(comment.id); else next.delete(comment.id); return next; });
      adjust(wasLiked ? 1 : -1);
      toast.error(error instanceof Error ? error.message : 'Failed to update like. Please try again.');
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setIsConfirming(true);
    try {
      if (confirmAction.type === 'delete') {
        await eventDiscussionService.deleteComment(confirmAction.comment.id);
        setComments((current) => current.filter((comment) => comment.id !== confirmAction.comment.id));
        toast.success('Comment deleted successfully');
      } else if (confirmAction.type === 'mute') {
        await eventDiscussionService.muteUser(confirmAction.comment.userId);
        setMutedIds((current) => [...current, confirmAction.comment.userId]);
        toast.success('User muted. Their comments are now hidden.');
      } else {
        await eventDiscussionService.blockUser(confirmAction.comment.userId);
        setBlockedIds((current) => [...current, confirmAction.comment.userId]);
        toast.success('User blocked. Their comments are now hidden.');
      }
      setConfirmAction(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action failed. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const submitReport = async (category: ReportReasonCategory, reason: string, details: string, childSafety?: ChildSafetyIntakeValues) => {
    if (!reportComment) return;
    // The website files these as "event_comment"; the app's moderation service has no such type yet, so "other" with the event as parent.
    const reference = await moderationService.reportContent('other', {
      targetId: reportComment.id, reportedUserId: reportComment.userId || undefined, parentContentId: eventId, reasonCategory: category, reason,
      description: details ? `${details}\n\nReported event comment: ${reportComment.comment.slice(0, 500)}` : `Reported event comment: ${reportComment.comment.slice(0, 500)}`,
      routePath: `/events/${eventId}`, immediateDanger: childSafety?.immediateDanger, goodFaithAcknowledged: childSafety?.goodFaithAcknowledged, allowContact: childSafety?.allowContact,
    });
    toast.success(category === 'child_safety' ? `Restricted report received. Keep confirmation reference ${reference}.` : 'Your report was sent to Ourlime moderation.');
  };

  const renderComment = (node: EventDiscussionNode, depth: number) => {
    const isOwn = viewerId === node.userId;
    const isLiked = likedIds.has(node.id);
    return (
      <View key={node.id} style={[styles.comment, depth > 0 && styles.reply]}>
        <View style={styles.commentRow}>
          <TouchableOpacity disabled={!node.authorUserName} onPress={() => node.authorUserName && router.push({ pathname: '/profile/[username]', params: { username: node.authorUserName } })}>
            <UserAvatar profileImage={node.authorImage} firstName={node.authorName} size={depth > 0 ? 30 : 36} />
          </TouchableOpacity>
          <View style={styles.commentBody}>
            <View style={styles.commentHeader}>
              <Text style={styles.author} numberOfLines={1}>{node.authorName}</Text>
              {node.isOrganizerReply ? <Text style={styles.organizerBadge}>Organizer</Text> : null}
            </View>
            <Text style={styles.time}>{formatTime(node.createdAt)}{node.editedAt ? ' · edited' : ''}</Text>
            {editingId === node.id ? (
              <View style={styles.editBox}>
                <TextInput value={editText} onChangeText={setEditText} multiline maxLength={5000} style={styles.input} placeholderTextColor={colors.mutedText} />
                <View style={styles.inlineButtons}>
                  <TouchableOpacity onPress={() => setEditingId(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity disabled={!editText.trim()} onPress={() => void handleSaveEdit(node.id)} style={[styles.primaryButton, !editText.trim() && styles.disabled]}><Text style={styles.primaryButtonText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <MentionText content={node.comment} style={styles.commentText} mentionStyle={styles.mention} onMentionPress={(username) => router.push({ pathname: '/profile/[username]', params: { username } })} />
            )}
          </View>
          {viewerId ? (
            <TouchableOpacity accessibilityLabel="Comment actions" hitSlop={8} onPress={() => setMenuId((current) => (current === node.id ? null : node.id))} style={styles.menuButton}>
              <MoreHorizontal size={18} color={colors.mutedText} />
            </TouchableOpacity>
          ) : null}
        </View>
        {menuId === node.id ? (
          <View style={styles.menu}>
            {isOwn ? (
              <>
                <TouchableOpacity onPress={() => { setMenuId(null); setEditingId(node.id); setEditText(node.comment); }} style={styles.menuItem}><Pencil size={15} color={colors.text} /><Text style={styles.menuText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setMenuId(null); setConfirmAction({ type: 'delete', comment: node }); }} style={styles.menuItem}><Trash2 size={15} color={colors.destructiveText} /><Text style={[styles.menuText, styles.danger]}>Delete</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => { setMenuId(null); setReportComment(node); }} style={styles.menuItem}><Flag size={15} color={colors.text} /><Text style={styles.menuText}>Report</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setMenuId(null); setConfirmAction({ type: 'mute', comment: node }); }} style={styles.menuItem}><Ban size={15} color={colors.text} /><Text style={styles.menuText}>Mute</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setMenuId(null); setConfirmAction({ type: 'block', comment: node }); }} style={styles.menuItem}><ShieldAlert size={15} color={colors.destructiveText} /><Text style={[styles.menuText, styles.danger]}>Block</Text></TouchableOpacity>
                {canModerate ? <TouchableOpacity onPress={() => { setMenuId(null); setConfirmAction({ type: 'delete', comment: node }); }} style={styles.menuItem}><Trash2 size={15} color={colors.destructiveText} /><Text style={[styles.menuText, styles.danger]}>Remove comment</Text></TouchableOpacity> : null}
              </>
            )}
          </View>
        ) : null}
        <View style={styles.commentActions}>
          <TouchableOpacity accessibilityLabel={isLiked ? 'Unlike comment' : 'Like comment'} onPress={() => void handleLike(node)} style={styles.actionButton}>
            <Heart size={15} color={isLiked ? '#ef4444' : colors.mutedText} fill={isLiked ? '#ef4444' : 'transparent'} />
            <Text style={styles.actionText}>{node.likeCount}</Text>
          </TouchableOpacity>
          {depth === 0 ? (
            <TouchableOpacity onPress={() => { setReplyTo((current) => (current === node.id ? null : node.id)); setReplyText(''); }} style={styles.actionButton}>
              <MessageSquare size={15} color={colors.mutedText} /><Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {replyTo === node.id ? (
          <View style={styles.editBox}>
            <TextInput value={replyText} onChangeText={setReplyText} placeholder="Write a reply..." placeholderTextColor={colors.mutedText} multiline maxLength={5000} style={styles.input} />
            <View style={styles.inlineButtons}>
              <TouchableOpacity onPress={() => { setReplyTo(null); setReplyText(''); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={isPosting || !replyText.trim()} onPress={() => void handlePost(node.id)} style={[styles.primaryButton, (isPosting || !replyText.trim()) && styles.disabled]}><Text style={styles.primaryButtonText}>Reply</Text></TouchableOpacity>
            </View>
          </View>
        ) : null}
        {node.replies.map((child) => renderComment(child, depth + 1))}
      </View>
    );
  };

  const confirmCopy = confirmAction?.type === 'delete'
    ? { title: 'Delete this comment?', message: 'The comment will be removed from the event discussion. This cannot be undone.', confirm: 'Delete' }
    : confirmAction?.type === 'mute'
      ? { title: 'Mute this member?', message: 'Their comments will be hidden from you.', confirm: 'Mute' }
      : { title: 'Block this member?', message: 'Their comments will be hidden and they will no longer be able to interact with you.', confirm: 'Block' };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Discussions ({comments.length})</Text>
      </View>
      <View style={styles.sortRow}>
        <Text style={styles.muted}>Sort:</Text>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ selected: sort === option.value }} onPress={() => { setSort(option.value); setVisibleCount(PAGE_SIZE); }} style={[styles.sortPill, sort === option.value && styles.sortPillActive]}>
            <Text style={[styles.sortText, sort === option.value && styles.sortTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewerId && !guidelinesAccepted ? (
        <View style={styles.guidelines}>
          <Text style={styles.body}>To participate in discussions, please accept our Community Guidelines.</Text>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: guidelinesChecked }} onPress={() => setGuidelinesChecked((value) => !value)} style={styles.checkRow}>
            {guidelinesChecked ? <SquareCheck size={20} color={colors.accent} /> : <Square size={20} color={colors.mutedText} />}
            <Text style={[styles.body, styles.flex]}>
              I have read and agree to the <Text style={styles.link} onPress={() => router.push('/terms-and-conditions')}>Community Guidelines</Text>, Privacy Policy, and Terms of Use.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!guidelinesChecked || isAccepting} onPress={() => void handleAcceptGuidelines()} style={[styles.primaryButton, styles.alignEnd, (!guidelinesChecked || isAccepting) && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{isAccepting ? 'Accepting…' : 'Accept'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.composer}>
        <Text style={styles.composerTitle}>Start a Discussion</Text>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Ask a question or share your thoughts about this event..." placeholderTextColor={colors.mutedText} multiline maxLength={5000} style={[styles.input, styles.composerInput]} />
        <TouchableOpacity disabled={isPosting || !draft.trim()} onPress={() => void handlePost(null)} style={[styles.primaryButton, styles.alignEnd, (isPosting || !draft.trim()) && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{isPosting ? 'Posting…' : 'Post'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? <EventDiscussionSkeleton /> : tree.length === 0 ? (
        <View style={styles.empty}>
          <MessageSquare size={40} color={colors.mutedText} />
          <Text style={styles.muted}>No discussions yet. Be the first to start a conversation!</Text>
        </View>
      ) : (
        <>
          {tree.slice(0, visibleCount).map((node) => renderComment(node, 0))}
          {tree.length > visibleCount ? (
            <TouchableOpacity onPress={() => setVisibleCount((count) => count + PAGE_SIZE)} style={styles.loadMore}><Text style={styles.secondaryButtonText}>Load more</Text></TouchableOpacity>
          ) : null}
        </>
      )}

      <CustomModal
        visible={Boolean(confirmAction)}
        type="warning"
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmText={confirmCopy.confirm}
        cancelText="Cancel"
        isLoading={isConfirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmAction(null)}
        onClose={() => setConfirmAction(null)}
      />
      <CommunityReportModal
        visible={Boolean(reportComment)}
        title="Report comment"
        subjectLabel={reportComment?.comment.slice(0, 120) ?? ''}
        childSafetyTarget={reportComment ? { type: 'comment', id: reportComment.id, ownerUserId: reportComment.userId || undefined, routePath: `/events/${eventId}`, parentId: eventId } : undefined}
        onClose={() => setReportComment(null)}
        onSubmit={submitReport}
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sortPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.control },
  sortPillActive: { backgroundColor: colors.selectedControl },
  sortText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  sortTextActive: { color: colors.selectedText },
  guidelines: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: colors.surface },
  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  link: { color: colors.accentText, textDecorationLine: 'underline' },
  composer: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.control },
  composerTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  composerInput: { minHeight: 84 },
  input: { minHeight: 44, maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
  primaryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.onAccent, fontWeight: '900' },
  secondaryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.text, fontWeight: '800' },
  alignEnd: { alignSelf: 'flex-end' },
  disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  muted: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  comment: { gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reply: { marginLeft: 14, marginTop: 6, backgroundColor: colors.canvas },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentBody: { flex: 1, gap: 3 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { color: colors.text, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  organizerBadge: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  time: { color: colors.mutedText, fontSize: 11 },
  commentText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
  mention: { color: colors.accentText, fontWeight: '700' },
  menuButton: { padding: 4 },
  menu: { alignSelf: 'flex-end', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, paddingVertical: 4, minWidth: 170 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  menuText: { color: colors.text, fontSize: 14 },
  danger: { color: colors.destructiveText },
  commentActions: { flexDirection: 'row', gap: 16, paddingLeft: 46 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  actionText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  editBox: { gap: 8, marginTop: 6 },
  inlineButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  loadMore: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
});
