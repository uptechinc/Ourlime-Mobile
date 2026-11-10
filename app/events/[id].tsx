import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Clock, MapPin, MessageCircle, Repeat, Send, Share2, Trash2, Users } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { EventsSkeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { eventService, type EventAttendanceStatus, type EventComment, type EventOrganizer } from '@/lib/services/EventService';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import type { Event } from '@/types/eventTypes';

const WEB_BASE_URL = 'https://ourlime.com';
const CONTENT_MAX_WIDTH = 760;

const formatDay = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};
const formatTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const formatCommentTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

/** Event detail, the app's counterpart of the website's /events/[id]: when and where, organiser, attendance, discussion. */
export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : '';
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<EventOrganizer | null>(null);
  const [attendance, setAttendance] = useState<EventAttendanceStatus | null>(null);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<EventComment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoadError(null);
    try {
      const [detail, attendanceState, eventComments] = await Promise.all([
        eventService.fetchEvent(eventId),
        eventService.getAttendance(eventId),
        eventService.fetchComments(eventId).catch((error: unknown) => {
          console.error('[EventDetailScreen.load] Comments error:', error instanceof Error ? error.message : 'Unknown error');
          return [] as EventComment[];
        }),
      ]);
      if (!detail) {
        setEvent(null);
        setLoadError('This event was removed or is no longer available.');
        return;
      }
      setEvent(detail.event);
      setOrganizer(detail.organizer);
      setAttendance(attendanceState);
      setComments(eventComments);
    } catch (error: unknown) {
      console.error('[EventDetailScreen.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      setLoadError('The event could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const isOrganizer = Boolean(activeUserId && organizer?.id === activeUserId);
  const hasEnded = event ? new Date(event.endDate).getTime() < Date.now() : false;
  const location = event ? linkPresentationService.presentLocation(event.location) : null;
  const isOnline = !event?.location || /^online$/i.test(event.location.trim());
  const gallery = (event?.media ?? []).filter((item) => item.type === 'image' && item.url !== event?.image);
  const heroImage = event?.image ?? event?.media?.find((item) => item.type === 'image')?.url;
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);

  const handleAttendance = async () => {
    if (!event?.id) return;
    setIsUpdatingAttendance(true);
    setActionError(null);
    try {
      setAttendance(await eventService.toggleAttendance(event.id));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Attendance could not be updated.');
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  const handleShare = () => {
    if (!event?.id) return;
    const url = `${WEB_BASE_URL}/events/${encodeURIComponent(event.id)}`;
    void Share.share({ message: `${event.title}\n${url}`, url }).catch((error: unknown) => {
      console.error('[EventDetailScreen.handleShare] Error:', error instanceof Error ? error.message : 'Unknown error');
    });
  };

  const handleOpenLocation = () => {
    if (!event || isOnline) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`).catch((error: unknown) => {
      console.error('[EventDetailScreen.handleOpenLocation] Error:', error instanceof Error ? error.message : 'Unknown error');
    });
  };

  const handleOpenProfile = (userName: string | null) => {
    if (userName) router.push({ pathname: '/profile/[username]', params: { username: userName } });
  };

  const handlePostComment = async () => {
    if (!event?.id || !draft.trim()) return;
    setIsPosting(true);
    setActionError(null);
    try {
      await eventService.addComment(event.id, draft, isOrganizer);
      setDraft('');
      setComments(await eventService.fetchComments(event.id));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Your comment could not be posted.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || !event?.id) return;
    setIsDeleting(true);
    try {
      await eventService.deleteComment(commentToDelete.id);
      setComments((current) => current.filter((comment) => comment.id !== commentToDelete.id));
      setCommentToDelete(null);
    } catch (error: unknown) {
      setCommentToDelete(null);
      setActionError(error instanceof Error ? error.message : 'The comment could not be deleted.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Event" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex} onKeyboardChange={setIsKeyboardOpen}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.content}><EventsSkeleton /></ScrollView>
        ) : !event ? (
          <View style={styles.center}>
            <CalendarDays size={40} color={colors.mutedText} />
            <Text style={styles.centerText}>{loadError ?? 'This event is not available.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setIsLoading(true); void load(); }} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}
          >
            <View style={[styles.column, { width: contentWidth }]}>
              {heroImage ? (
                <Image source={{ uri: heroImage }} contentFit="cover" style={styles.hero} recyclingKey={`event-hero-${event.id}`} />
              ) : (
                <View style={[styles.hero, styles.heroPlaceholder]}><CalendarDays size={44} color={colors.accent} /></View>
              )}

              <View style={styles.section}>
                <View style={styles.tagRow}>
                  {event.category ? <Text style={styles.category}>{event.category}</Text> : null}
                  {hasEnded ? <Text style={styles.ended}>Ended</Text> : null}
                </View>
                <Text style={styles.title}>{event.title}</Text>
                {event.summary && event.summary !== event.description ? <Text style={styles.summary}>{event.summary}</Text> : null}
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <CalendarDays size={20} color={colors.accent} />
                  <View style={styles.flex}>
                    <Text style={styles.infoTitle}>{formatDay(event.startDate)}</Text>
                    <View style={styles.inline}>
                      <Clock size={14} color={colors.mutedText} />
                      <Text style={styles.infoDetail}>
                        {formatTime(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${formatDay(event.endDate) === formatDay(event.startDate) ? formatTime(event.endDate) : `${formatDay(event.endDate)}, ${formatTime(event.endDate)}`}` : ''}
                      </Text>
                    </View>
                    {event.recurrence && event.recurrence !== 'none' ? (
                      <View style={styles.inline}><Repeat size={14} color={colors.mutedText} /><Text style={styles.infoDetail}>Repeats {event.recurrence}</Text></View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.divider} />
                <Pressable accessibilityRole={isOnline ? undefined : 'link'} disabled={isOnline} onPress={handleOpenLocation} style={styles.infoRow}>
                  <MapPin size={20} color={colors.accent} />
                  <View style={styles.flex}>
                    <Text style={styles.infoTitle}>{isOnline ? 'Online event' : location?.title ?? event.location}</Text>
                    {!isOnline ? <Text style={styles.infoDetail}>{location?.detail ? `${location.detail} · ` : ''}Open in Maps</Text> : null}
                  </View>
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isUpdatingAttendance || hasEnded}
                  onPress={() => void handleAttendance()}
                  style={[styles.attendButton, attendance?.isAttending && styles.attendingButton, (isUpdatingAttendance || hasEnded) && styles.disabled]}
                >
                  <Users size={18} color={attendance?.isAttending ? colors.successText : '#ffffff'} />
                  <Text style={[styles.attendText, attendance?.isAttending && styles.attendingText]}>
                    {isUpdatingAttendance ? 'Updating…' : attendance?.isAttending ? 'Going' : hasEnded ? 'Event ended' : 'Attend'} · {attendance?.attendeeCount ?? 0}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Share event" onPress={handleShare} style={styles.iconButton}>
                  <Share2 size={20} color={colors.text} />
                </Pressable>
              </View>
              {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}

              {organizer ? (
                <Pressable accessibilityRole="button" disabled={!organizer.userName} onPress={() => handleOpenProfile(organizer.userName)} style={styles.organizer}>
                  <UserAvatar profileImage={organizer.profileImage} firstName={organizer.name} size={44} />
                  <View style={styles.flex}>
                    <Text style={styles.muted}>Organised by</Text>
                    <Text style={styles.organizerName}>{organizer.name}{isOrganizer ? ' (you)' : ''}</Text>
                  </View>
                </Pressable>
              ) : null}

              {event.description ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About this event</Text>
                  <Text style={styles.body}>{event.description}</Text>
                </View>
              ) : null}

              {gallery.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Photos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                    {gallery.map((item) => <Image key={item.url} source={{ uri: item.url }} contentFit="cover" style={styles.galleryImage} />)}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.inline}>
                  <MessageCircle size={20} color={colors.text} />
                  <Text style={styles.sectionTitle}>Discussion · {comments.length}</Text>
                </View>
                {comments.length === 0 ? <Text style={styles.muted}>No comments yet. Ask a question or say you are coming.</Text> : null}
                {comments.map((comment) => (
                  <View key={comment.id} style={[styles.comment, comment.parentId ? styles.reply : null]}>
                    <Pressable onPress={() => handleOpenProfile(comment.authorUserName)} disabled={!comment.authorUserName}>
                      <UserAvatar profileImage={comment.authorImage} firstName={comment.authorName} size={36} />
                    </Pressable>
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor} numberOfLines={1}>{comment.authorName}</Text>
                        {comment.isOrganizerReply ? <Text style={styles.organizerBadge}>Organiser</Text> : null}
                        <Text style={styles.commentTime}>{formatCommentTime(comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{comment.comment}</Text>
                    </View>
                    {comment.userId === activeUserId || isOrganizer ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Delete comment" hitSlop={8} onPress={() => setCommentToDelete(comment)} style={styles.commentDelete}>
                        <Trash2 size={16} color={colors.mutedText} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {event ? (
          <View style={[styles.composerBar, { paddingBottom: 10 + (isKeyboardOpen ? 0 : insets.bottom) }]}>
            <View style={[styles.composer, { width: contentWidth - 24 }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add to the discussion…"
                placeholderTextColor={colors.mutedText}
                multiline
                maxLength={5000}
                style={styles.composerInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Post comment"
                disabled={isPosting || !draft.trim()}
                onPress={() => void handlePostComment()}
                style={[styles.sendButton, (isPosting || !draft.trim()) && styles.disabled]}
              >
                <Send size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardSafeView>

      <CustomModal
        visible={Boolean(commentToDelete)}
        type="warning"
        title="Delete this comment?"
        message="The comment will be removed from the event discussion. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteComment()}
        onCancel={() => setCommentToDelete(null)}
        onClose={() => setCommentToDelete(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { padding: 18 },
  scroll: { alignItems: 'center', paddingBottom: 28 },
  column: { gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  centerText: { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  hero: { width: '100%', aspectRatio: 16 / 9, maxHeight: 420 },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  section: { paddingHorizontal: 18, gap: 10 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  category: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  ended: { color: colors.mutedText, backgroundColor: colors.control, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '900' },
  summary: { color: colors.secondaryText, fontSize: 15, lineHeight: 22 },
  infoCard: { marginHorizontal: 18, padding: 16, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  infoDetail: { flexShrink: 1, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.border },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  attendButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#10b981' },
  attendingButton: { backgroundColor: colors.successSurface },
  attendText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  attendingText: { color: colors.successText },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  disabled: { opacity: 0.5 },
  error: { marginHorizontal: 18, color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  organizer: { marginHorizontal: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  organizerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  body: { color: colors.text, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.mutedText, fontSize: 13 },
  gallery: { gap: 10 },
  galleryImage: { width: 200, height: 140, borderRadius: 14 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  reply: { marginLeft: 36 },
  commentBody: { flex: 1, padding: 12, gap: 4, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentAuthor: { color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  organizerBadge: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  commentTime: { color: colors.mutedText, fontSize: 11 },
  commentText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  commentDelete: { paddingTop: 10 },
  composerBar: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  primaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
});
