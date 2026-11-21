import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CalendarDays, Edit3, Flag, Heart, MapPin, MessageCircle, Plus, Repeat2, Share2, Trash2 } from 'lucide-react-native';
import type { Event } from '@/types/eventTypes';
import type { ResourceState } from '@/lib/types/resourceState';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { CommunityEventsWorkspaceSkeleton } from './CommunityWorkspaceSkeletons';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import { communityEventEngagementService } from '@/lib/services/CommunityEventEngagementService';
import { describeEventRecurrence } from '@/components/events/eventPresentation';
import type { CommunityEventEngagement } from '@/lib/types/community';

type CommunityEventsWorkspaceProps = {
  resource: ResourceState<Event[]>;
  canCreate: boolean;
  /** Bumped by the community header's "Host event" to open the event form. */
  createRequestKey: number;
  onRetry: () => void;
  /** Opens the full event form for this community (the website's community page uses the same form). */
  onHost: () => void;
  onEdit: (event: Event) => void;
  onToggleAttendance: (eventId: string) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onReport: (event: Event) => void;
  onOpenEvent: (event: Event) => void;
  onShareEvent: (event: Event) => void;
};

/** A community's events: hosting and editing open the full event form; cards keep attend, like, comments and share. */
export default function CommunityEventsWorkspace({ resource, canCreate, createRequestKey, onRetry, onHost, onEdit, onToggleAttendance, onDelete, onReport, onOpenEvent, onShareEvent }: CommunityEventsWorkspaceProps) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  // Web CommunityEventsModal: like and comment totals per event card.
  const [engagement, setEngagement] = useState<Map<string, CommunityEventEngagement>>(new Map());
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);
  const eventIdsKey = useMemo(() => (resource.data ?? []).map((event) => event.id ?? '').filter(Boolean).join(','), [resource.data]);
  useEffect(() => {
    if (!eventIdsKey) return;
    let cancelled = false;
    void communityEventEngagementService.getEngagement(eventIdsKey.split(','))
      .then((next) => { if (!cancelled) setEngagement(next); })
      .catch((error: unknown) => console.error('[CommunityEventsWorkspace.loadEngagement] Error:', error instanceof Error ? error.message : 'load failed'));
    return () => { cancelled = true; };
    // Re-read when the events reload (pull to refresh, after an edit) so totals stay current.
  }, [eventIdsKey, resource.updatedAt]);
  useEffect(() => {
    if (createRequestKey > 0 && canCreate) onHost();
    // Only a new request opens the form; onHost changes identity on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate, createRequestKey]);
  const handleToggleLike = async (eventId: string): Promise<void> => {
    if (likeBusyId) return;
    const current = engagement.get(eventId) ?? { liked: false, likeCount: 0, commentCount: 0 };
    setLikeBusyId(eventId);
    try {
      const next = await communityEventEngagementService.toggleLike(eventId, !current.liked);
      setEngagement((previous) => new Map(previous).set(eventId, { ...current, ...next }));
    } catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'The event like could not be saved.'); }
    finally { setLikeBusyId(null); }
  };
  const handleDelete = async (): Promise<void> => {
    if (!deleteEventId) return;
    setBusy(true);
    try { await onDelete(deleteEventId); setDeleteEventId(null); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Event could not be deleted.'); }
    finally { setBusy(false); }
  };

  if (!resource.data && (resource.status === 'hydrating' || resource.status === 'idle')) return <CommunityEventsWorkspaceSkeleton canCreate={canCreate} />;
  if (!resource.data && resource.status === 'error') return <View style={{ padding: 28, alignItems: 'center' }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error?.message ?? 'Events could not be loaded.'}</Text><TouchableOpacity onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>;

  return <View style={{ margin: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><CalendarDays size={20} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontWeight: '900', fontSize: 18 }}>Community events</Text>{canCreate ? <TouchableOpacity onPress={onHost} accessibilityRole="button" accessibilityLabel="Host an event" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.accent }}><Plus size={15} color={colors.onAccent} /><Text style={{ marginLeft: 4, color: colors.onAccent, fontWeight: '900', fontSize: 12 }}>Host</Text></TouchableOpacity> : null}</View>
    {resource.data?.length ? resource.data.map((event) => <View key={event.id} style={{ marginBottom: 13, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{event.image ? <TouchableOpacity activeOpacity={0.9} disabled={!event.id} onPress={() => onOpenEvent(event)} accessibilityLabel={`Open ${event.title}`}><CachedImage uri={event.image} recyclingKey={`community-event-${event.id}-${event.image}`} style={{ width: '100%', height: 145 }} contentFit="cover" /></TouchableOpacity> : null}<View style={{ padding: 15 }}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><TouchableOpacity disabled={!event.id} onPress={() => onOpenEvent(event)} style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{event.title}</Text></TouchableOpacity>{event.id ? <TouchableOpacity onPress={() => onReport(event)} accessibilityLabel="Report event" style={{ padding: 7 }}><Flag size={17} color={colors.icon} /></TouchableOpacity> : null}</View><Text numberOfLines={3} style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 20 }}>{event.summary}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><CalendarDays size={15} color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{new Date(event.startDate).toLocaleString()}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}><MapPin size={15} color={colors.accent} /><Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{linkPresentationService.compactUrlsInText(event.location)}</Text>{describeEventRecurrence(event) ? <><Repeat2 size={14} color={colors.icon} style={{ marginLeft: 12 }} /><Text numberOfLines={1} style={{ marginLeft: 4, maxWidth: 160, color: colors.mutedText, fontSize: 11 }}>{describeEventRecurrence(event)}</Text></> : null}</View><TouchableOpacity disabled={busy || !event.id} onPress={() => { if (!event.id) return; setBusy(true); void onToggleAttendance(event.id).then(() => setFeedback(event.userRSVP ? 'You are no longer attending.' : 'You are attending this event.')).catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Attendance could not be updated.')).then(() => setBusy(false)); }} style={{ marginTop: 13, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: event.userRSVP ? colors.selectedControl : colors.accent }}><Text style={{ color: event.userRSVP ? colors.selectedText : colors.onAccent, fontWeight: '900' }}>{event.userRSVP ? 'Going' : 'Attend'} · {event.attendeeCount ?? 0}</Text></TouchableOpacity>{event.id ? <EventEngagementRow engagement={engagement.get(event.id)} likeBusy={likeBusyId === event.id} onLike={() => { if (event.id) void handleToggleLike(event.id); }} onComments={() => onOpenEvent(event)} onShare={() => onShareEvent(event)} /> : null}{event.id && (event.permissions?.canEdit || event.permissions?.canDelete) ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{event.permissions?.canEdit ? <TouchableOpacity onPress={() => onEdit(event)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.control }}><Edit3 size={15} color={colors.icon} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800' }}>Edit</Text></TouchableOpacity> : null}{event.permissions?.canDelete ? <TouchableOpacity onPress={() => setDeleteEventId(event.id ?? null)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.destructiveSurface }}><Trash2 size={15} color={colors.destructive} /><Text style={{ marginLeft: 5, color: colors.destructiveText, fontWeight: '800' }}>Delete</Text></TouchableOpacity> : null}</View> : null}</View></View>) : <View style={{ alignItems: 'center', padding: 30 }}><CalendarDays size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No events scheduled</Text></View>}
    <CustomModal visible={Boolean(feedback)} title="Community event" message={feedback ?? ''} type="info" onClose={() => setFeedback(null)} />
    <CustomModal visible={Boolean(deleteEventId)} title="Delete event?" message="This event, its attendees, likes and comments will be permanently removed." type="danger" confirmText="Delete event" cancelText="Cancel" isLoading={busy} onConfirm={() => void handleDelete()} onCancel={() => setDeleteEventId(null)} onClose={() => setDeleteEventId(null)} />
  </View>;
}

type EventEngagementRowProps = { engagement: CommunityEventEngagement | undefined; likeBusy: boolean; onLike: () => void; onComments: () => void; onShare: () => void };

/** Like, comments and share for an event card (web CommunityEventsModal footer). */
function EventEngagementRow({ engagement, likeBusy, onLike, onComments, onShare }: EventEngagementRowProps) {
  const { colors } = useAppTheme();
  const liked = engagement?.liked ?? false;
  const buttonStyle = { flex: 1, minHeight: 38, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 11 };
  return <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
    <TouchableOpacity disabled={likeBusy} onPress={onLike} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike event' : 'Like event'} accessibilityState={{ selected: liked }} style={buttonStyle}><Heart size={17} color={liked ? '#ef4444' : colors.icon} fill={liked ? '#ef4444' : 'transparent'} /><Text style={{ marginLeft: 5, color: liked ? '#ef4444' : colors.secondaryText, fontWeight: '800' }}>{engagement?.likeCount ?? 0}</Text></TouchableOpacity>
    <TouchableOpacity onPress={onComments} accessibilityRole="button" accessibilityLabel={`View comments (${engagement?.commentCount ?? 0})`} style={buttonStyle}><MessageCircle size={17} color={colors.icon} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800' }}>{engagement?.commentCount ?? 0}</Text></TouchableOpacity>
    <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={buttonStyle}><Share2 size={17} color={colors.icon} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800' }}>Share</Text></TouchableOpacity>
  </View>;
}
