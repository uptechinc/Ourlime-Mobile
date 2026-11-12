import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import {
  Accessibility, BadgeCheck, Bookmark, CalendarDays, Check, ClipboardList, Clock, Flag, Heart, MapPin, Pencil, Plus, Repeat, Share2, ShieldAlert, Trash2, Users, Video,
} from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import UserAvatar from '@/components/ui/UserAvatar';
import { EventDetailSkeleton } from '@/components/events/EventSkeletons';
import CreateEventModal from '@/components/events/createEventModal/CreateEventModal';
import EventDiscussionSection from '@/components/events/detail/EventDiscussionSection';
import EventReviewsSection from '@/components/events/detail/EventReviewsSection';
import EventGalleryViewer from '@/components/events/detail/EventGalleryViewer';
import { RegistrationsDialog } from '@/components/events/EventDialogs';
import { useEventActions } from '@/components/events/useEventActions';
import { STATUS_BADGES, accessibilityLabel, daysRemaining, formatEventLong } from '@/components/events/eventPresentation';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { eventService, type EventOrganizer } from '@/lib/services/EventService';
import { eventEngagementService, type EventRegistration, type EventViewerState } from '@/lib/services/EventEngagementService';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import type { Event } from '@/types/eventTypes';

const CONTENT_MAX_WIDTH = 760;
type DetailTab = 'about' | 'discussions' | 'reviews';

/** Event detail, the app's counterpart of the website's /events/[id]: header, actions, About / Discussions / Reviews and event information. */
export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = typeof id === 'string' ? id : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { activeUserId } = useAppData();
  const { authorization } = usePageAccess();
  const isStaff = authorization.isAdmin || authorization.isModerator;
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);

  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<EventOrganizer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<{ kind: 'missing' | 'failed'; message: string } | null>(null);
  const [tab, setTab] = useState<DetailTab>('about');
  const [commentCount, setCommentCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [registrations, setRegistrations] = useState<EventRegistration[] | null>(null);

  const actions = useEventActions({ viewerId: activeUserId, requireDisclaimer: true, onRemoved: () => router.replace('/events') });
  const { setStates } = actions;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoadError(null);
    try {
      const detail = await eventService.fetchEvent(eventId);
      if (!detail) {
        setEvent(null);
        setLoadError({ kind: 'missing', message: 'The event you are looking for does not exist, has ended, or may have been cancelled.' });
        return;
      }
      setEvent(detail.event);
      setOrganizer(detail.organizer);
      const [attendance, viewerState] = await Promise.all([
        eventService.getAttendance(eventId),
        eventEngagementService.fetchViewerState([eventId]).catch((): EventViewerState => ({ liked: {}, bookmarked: {} })),
      ]);
      setStates(eventId, { attendance, liked: Boolean(viewerState.liked[eventId]), bookmarked: Boolean(viewerState.bookmarked[eventId]) });
    } catch (error: unknown) {
      console.error('[EventDetailScreen.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      setLoadError({ kind: 'failed', message: 'Failed to load event details. Please try again later.' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [eventId, setStates]);
  useEffect(() => { void load(); }, [load]);

  const attendance = actions.attendance[eventId];
  const isAttending = Boolean(attendance?.isAttending);
  const hasEnded = event ? new Date(event.endDate).getTime() < Date.now() : false;
  const hasStarted = event ? new Date(event.startDate).getTime() <= Date.now() : false;
  const status = event ? eventService.effectiveStatus(event) : 'published';
  const statusBadge = STATUS_BADGES[status];
  const location = event ? linkPresentationService.presentLocation(event.location) : null;
  const isOnline = Boolean(event?.isVirtual) || !event?.location || /^online$/i.test(event.location.trim());
  const heroImage = event?.image ?? event?.media?.find((item) => item.type === 'image')?.url;
  const gallery = (event?.media ?? []).filter((item) => item.type === 'image' && item.url !== event?.image).map((item) => item.url);
  const days = event ? daysRemaining(event.startDate) : 0;
  const canEdit = event ? eventService.canEdit(event, activeUserId) : false;
  const canDelete = event ? eventService.canManage(event, activeUserId, isStaff) : false;
  const canSeeRegistrations = Boolean(event && (event.registrationQuestions?.length ?? 0) > 0 && eventService.hasPermission(event, activeUserId, 'manage_attendance'));
  const handleCommentCount = useCallback((count: number) => setCommentCount(count), []);
  const handleReviewCount = useCallback((count: number) => setReviewCount(count), []);

  const handleOpenLocation = () => {
    if (!event || isOnline) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || event.location)}`).catch((error: unknown) => {
      console.error('[EventDetailScreen.handleOpenLocation] Error:', error instanceof Error ? error.message : 'Unknown error');
    });
  };

  const handleViewRegistrations = async () => {
    if (!event?.id) return;
    try {
      setRegistrations(await eventEngagementService.fetchRegistrations(event.id));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load registrations.');
    }
  };

  const openProfile = () => { if (organizer?.userName) router.push({ pathname: '/profile/[username]', params: { username: organizer.userName } }); };
  const iconButton = (label: string, icon: ReactNode, onPress: () => void, tone?: 'danger') => (
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, tone === 'danger' && styles.iconDanger]}>{icon}</TouchableOpacity>
  );

  const renderBody = () => {
    if (isLoading) return <EventDetailSkeleton />;
    if (!event) {
      return (
        <View style={styles.center}>
          {loadError?.kind === 'missing' ? <Text style={styles.notFoundCode}>404</Text> : null}
          <Text style={styles.centerTitle}>{loadError?.kind === 'failed' ? 'Couldn\'t load this event' : 'Event Not Found'}</Text>
          <Text style={styles.centerText}>{loadError?.message ?? 'This event is not available.'}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/events')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Explore Events</Text></TouchableOpacity>
          {loadError?.kind === 'failed' ? <TouchableOpacity accessibilityRole="button" onPress={() => { setIsLoading(true); void load(); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Try again</Text></TouchableOpacity> : null}
        </View>
      );
    }
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
        <View style={[styles.column, { width: contentWidth }]}>
          <View style={styles.hero}>
            {heroImage ? <Image source={{ uri: heroImage }} contentFit="cover" style={styles.fill} recyclingKey={`event-hero-${event.id}`} /> : <View style={[styles.fill, styles.heroPlaceholder]}><CalendarDays size={44} color={colors.accent} /></View>}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.fill} />
            <View style={styles.statusBadge}>
              {statusBadge ? (
                <Text style={[styles.badgeText, { color: statusBadge.tone === 'danger' ? '#dc2626' : statusBadge.tone === 'warning' ? '#d97706' : statusBadge.tone === 'success' ? '#16a34a' : statusBadge.tone === 'info' ? '#2563eb' : '#4b5563' }]}>
                  {status === 'scheduled' && event.publishAt ? `Scheduled · publishes ${new Date(event.publishAt).toLocaleDateString()}` : statusBadge.label}
                </Text>
              ) : (
                <Text style={[styles.badgeText, { color: !hasStarted ? '#16a34a' : hasEnded ? '#4b5563' : '#2563eb' }]}>{!hasStarted ? '● Upcoming' : hasEnded ? '● Past' : '● Ongoing'}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, styles.typeBadge]}>
              {event.isVirtual ? <Video size={14} color="#9333ea" /> : <MapPin size={14} color="#2563eb" />}
              <Text style={[styles.badgeText, { color: event.isVirtual ? '#9333ea' : '#2563eb' }]}>{event.isVirtual ? 'Virtual' : 'In-Person'}</Text>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>{event.title}</Text>
              <View style={styles.heroLine}><CalendarDays size={14} color="#ffffff" /><Text style={styles.heroText}>{formatEventLong(event.startDate, event.endDate)}</Text></View>
              <View style={styles.heroLine}><MapPin size={14} color="#ffffff" /><Text style={styles.heroText} numberOfLines={1}>{event.location}</Text></View>
              <View style={styles.heroLine}><Users size={14} color="#ffffff" /><Text style={styles.heroText}>{attendance?.attendeeCount ?? 0} attending</Text></View>
            </View>
          </View>

          <View style={styles.actionBar}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={actions.workingEventId === event.id}
              onPress={() => actions.requestAttendance(event)}
              style={[styles.attendButton, (isAttending || Boolean(attendance?.waitlistPosition)) && styles.attendingButton, actions.workingEventId === event.id && styles.disabled]}
            >
              {isAttending ? <Check size={17} color={colors.successText} /> : <Plus size={17} color="#ffffff" />}
              <Text style={[styles.attendText, (isAttending || Boolean(attendance?.waitlistPosition)) && styles.attendingText]}>
                {actions.workingEventId === event.id ? 'Updating…' : isAttending ? 'Attending' : attendance?.waitlistPosition ? `Waitlist #${attendance.waitlistPosition}` : 'Attend'}
              </Text>
            </TouchableOpacity>
            <View style={styles.iconRow}>
              {iconButton(actions.liked[eventId] ? 'Unlike' : 'Like', <Heart size={19} color={actions.liked[eventId] ? '#ef4444' : colors.icon} fill={actions.liked[eventId] ? '#ef4444' : 'transparent'} />, () => actions.toggleLike(event))}
              {iconButton(actions.bookmarked[eventId] ? 'Remove bookmark' : 'Bookmark', <Bookmark size={19} color={actions.bookmarked[eventId] ? '#3b82f6' : colors.icon} fill={actions.bookmarked[eventId] ? '#3b82f6' : 'transparent'} />, () => actions.toggleBookmark(event))}
              {iconButton('Share event', <Share2 size={19} color={colors.icon} />, () => actions.share(event))}
              {iconButton('Report', <Flag size={19} color={colors.icon} />, () => actions.report(event))}
              {canEdit ? iconButton('Edit event', <Pencil size={19} color={colors.icon} />, () => setIsEditing(true)) : null}
              {canDelete ? iconButton('Delete event', <Trash2 size={19} color={colors.destructiveText} />, () => actions.cancel(event), 'danger') : null}
              {canSeeRegistrations ? iconButton('View registrations', <ClipboardList size={19} color={colors.icon} />, () => void handleViewRegistrations()) : null}
            </View>
          </View>

          <View style={styles.tabs}>
            {([['about', 'About'], ['discussions', `Discussions (${commentCount})`], ['reviews', `Reviews (${reviewCount})`]] as const).map(([value, label]) => (
              <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}>
                <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <View style={tab === 'about' ? styles.sectionBody : styles.hidden}>
              <Text style={styles.sectionTitle}>About This Event</Text>
              {(event.description || event.summary || '').split('\n').filter((paragraph) => paragraph.trim()).map((paragraph, index) => <Text key={index} style={styles.body}>{paragraph}</Text>)}
              {gallery.length ? (
                <>
                  <Text style={styles.subTitle}>Event Gallery</Text>
                  <View style={styles.galleryGrid}>
                    {gallery.slice(0, 6).map((url, index) => (
                      <TouchableOpacity key={url} accessibilityLabel={`Event image ${index + 1}`} onPress={() => setGalleryIndex(index)} style={styles.galleryItem}>
                        <Image source={{ uri: url }} contentFit="cover" style={styles.fill} />
                        {index === 5 && gallery.length > 6 ? <View style={styles.moreOverlay}><Text style={styles.moreText}>+{gallery.length - 6} more</Text></View> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
              {event.tags?.length ? (
                <>
                  <Text style={styles.subTitle}>Tags</Text>
                  <View style={styles.tagRow}>{event.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
                </>
              ) : null}
            </View>
            {/* Discussions and Reviews stay mounted once loaded so their counts show on the tabs, as on the website. */}
            <View style={tab === 'discussions' ? styles.sectionBody : styles.hidden}>
              <EventDiscussionSection eventId={eventId} viewerId={activeUserId} organizerId={event.userId} canModerate={eventService.hasPermission(event, activeUserId, 'manage_discussions')} onCountChange={handleCommentCount} />
            </View>
            <View style={tab === 'reviews' ? styles.sectionBody : styles.hidden}>
              <EventReviewsSection eventId={eventId} viewerId={activeUserId} hasEnded={hasEnded} isAttending={isAttending} canReply={eventService.hasPermission(event, activeUserId, 'manage_reviews')} onCountChange={handleReviewCount} />
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Event Information</Text>
            <View style={styles.infoRow}>
              <Clock size={20} color={colors.accent} />
              <View style={styles.flex}>
                <Text style={styles.infoTitle}>Date & Time</Text>
                <Text style={styles.infoDetail}>{formatEventLong(event.startDate, event.endDate)}</Text>
                {days > 0 ? <Text style={styles.infoAccent}>{days} {days === 1 ? 'day' : 'days'} remaining</Text> : null}
                {event.recurrence && event.recurrence !== 'none' ? <View style={styles.inline}><Repeat size={13} color={colors.mutedText} /><Text style={styles.infoDetail}>Repeats {event.recurrence}</Text></View> : null}
              </View>
            </View>
            <TouchableOpacity accessibilityRole={isOnline ? undefined : 'link'} disabled={isOnline} onPress={handleOpenLocation} style={styles.infoRow}>
              <MapPin size={20} color={colors.accent} />
              <View style={styles.flex}>
                <Text style={styles.infoTitle}>Location</Text>
                <Text style={styles.infoDetail}>{isOnline ? 'Virtual Event' : location?.title ?? event.location}</Text>
                {!isOnline && (event.address || location?.detail) ? <Text style={styles.infoDetail}>{event.address || location?.detail}</Text> : null}
                {!isOnline ? <Text style={styles.infoAccent}>Open in Maps</Text> : null}
              </View>
            </TouchableOpacity>
            {event.ageRestriction && event.ageRestriction > 0 ? (
              <View style={styles.infoRow}>
                <ShieldAlert size={20} color={colors.accent} />
                <View style={styles.flex}><Text style={styles.infoTitle}>Age Restriction</Text><Text style={styles.infoDetail}>Ages {event.ageRestriction}+</Text></View>
              </View>
            ) : null}
            {event.accessibility?.length ? (
              <View style={styles.infoRow}>
                <Accessibility size={20} color={colors.accent} />
                <View style={styles.flex}>
                  <Text style={styles.infoTitle}>Accessibility</Text>
                  <View style={styles.tagRow}>{event.accessibility.map((feature) => <Text key={feature} style={styles.accessTag}>{accessibilityLabel(feature)}</Text>)}</View>
                </View>
              </View>
            ) : null}
            {organizer ? (
              <TouchableOpacity accessibilityRole="button" disabled={!organizer.userName} onPress={openProfile} style={styles.infoRow}>
                <UserAvatar profileImage={organizer.profileImage} firstName={organizer.name} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.infoTitle}>Organizer</Text>
                  <View style={styles.inline}>
                    <Text style={styles.organizerName}>{organizer.name}{activeUserId === organizer.id ? ' (you)' : ''}</Text>
                    {organizer.verified ? <BadgeCheck size={16} color={colors.successText} /> : null}
                  </View>
                  {organizer.verified ? <Text style={styles.infoAccent}>Verified organizer</Text> : null}
                </View>
              </TouchableOpacity>
            ) : null}
            <View style={styles.divider} />
            <Text style={styles.infoTitle}>Share This Event</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => actions.share(event)} style={styles.shareButton}>
              <Share2 size={17} color={colors.text} /><Text style={styles.secondaryButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Event" onBackPress={() => router.back()} />
      <KeyboardSafeView style={styles.flex}>{renderBody()}</KeyboardSafeView>
      {event ? <CreateEventModal visible={isEditing} event={event} onClose={() => setIsEditing(false)} onCreated={() => { setIsEditing(false); void load(); }} /> : null}
      <RegistrationsDialog visible={registrations !== null} questions={event?.registrationQuestions ?? []} registrations={registrations ?? []} onClose={() => setRegistrations(null)} />
      <EventGalleryViewer images={gallery} index={galleryIndex} onChange={setGalleryIndex} onClose={() => setGalleryIndex(null)} />
      {actions.dialogs}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  scroll: { alignItems: 'center', paddingBottom: 36 },
  column: { gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  notFoundCode: { color: colors.mutedText, fontSize: 44, fontWeight: '900' },
  centerTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  centerText: { color: colors.secondaryText, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hero: { width: '100%', height: 300, backgroundColor: colors.control },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  statusBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, maxWidth: '60%' },
  typeBadge: { left: undefined, right: 14 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  heroBody: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 },
  heroTitle: { color: '#ffffff', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroText: { flex: 1, color: '#ffffff', fontSize: 13 },
  actionBar: { marginHorizontal: 14, padding: 12, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  attendButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: '#10b981' },
  attendingButton: { backgroundColor: colors.successSurface },
  attendText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  attendingText: { color: colors.successText },
  disabled: { opacity: 0.5 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  iconDanger: { backgroundColor: colors.destructiveSurface },
  tabs: { marginHorizontal: 14, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#10b981' },
  tabText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: colors.accentText },
  section: { paddingHorizontal: 16 },
  sectionBody: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  subTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  body: { color: colors.secondaryText, fontSize: 15, lineHeight: 23 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: { width: '48%', aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.control },
  moreOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  moreText: { color: '#ffffff', fontWeight: '800' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { color: colors.secondaryText, backgroundColor: colors.control, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5, fontSize: 13, overflow: 'hidden' },
  accessTag: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, overflow: 'hidden' },
  infoCard: { marginHorizontal: 14, padding: 16, gap: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  infoDetail: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  infoAccent: { color: colors.accentText, fontSize: 12, fontWeight: '700', marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  organizerName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border },
  shareButton: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  primaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
