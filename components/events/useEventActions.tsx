import { useCallback, useState } from 'react';
import { toast } from 'sonner-native';
import CommunityReportModal from '@/components/communities/CommunityReportModal';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import { eventService, type EventAttendanceStatus } from '@/lib/services/EventService';
import { eventEngagementService } from '@/lib/services/EventEngagementService';
import { moderationService, type ReportReasonCategory } from '@/lib/services/ModerationService';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import type { ChildSafetyIntakeValues } from '@/lib/types/childSafety';
import type { Event, RegistrationAnswers } from '@/types/eventTypes';
import { ArchiveEventDialog, CancelEventDialog, RegistrationDisclaimerDialog, RegistrationQuestionsDialog } from './EventDialogs';

type UseEventActionsOptions = {
  viewerId: string | null;
  /** The detail page asks for the "Before you register" acknowledgement; listings attend straight away, like the website. */
  requireDisclaimer?: boolean;
  /** An event left the listing (archived or cancelled). */
  onRemoved?: (eventId: string) => void;
};

export type EventActions = ReturnType<typeof useEventActions>;

const errorMessage = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

/** Attend (with registration questions or the acknowledgement), like, bookmark, share, report, archive and cancel for event screens. */
export function useEventActions({ viewerId, requireDisclaimer, onRemoved }: UseEventActionsOptions) {
  const [attendance, setAttendance] = useState<{ [eventId: string]: EventAttendanceStatus }>({});
  const [liked, setLiked] = useState<{ [eventId: string]: boolean }>({});
  const [bookmarked, setBookmarked] = useState<{ [eventId: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [eventId: string]: number }>({});
  const [workingEventId, setWorkingEventId] = useState<string | null>(null);
  const [registrationEvent, setRegistrationEvent] = useState<Event | null>(null);
  const [disclaimerEvent, setDisclaimerEvent] = useState<Event | null>(null);
  const [reportEvent, setReportEvent] = useState<Event | null>(null);
  const [shareEvent, setShareEvent] = useState<Event | null>(null);
  const [archiveEvent, setArchiveEvent] = useState<Event | null>(null);
  const [archiveState, setArchiveState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [cancelEvent, setCancelEvent] = useState<Event | null>(null);
  const [cancelState, setCancelState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [cancelAttendeeCount, setCancelAttendeeCount] = useState(0);

  /** Loads attendance, likes and bookmarks for a listing. */
  const loadStates = useCallback(async (eventIds: string[]) => {
    if (eventIds.length === 0) return;
    try {
      const [attendanceByEvent, viewerState] = await Promise.all([eventService.getAttendanceForEvents(eventIds), eventEngagementService.fetchViewerState(eventIds)]);
      setAttendance((current) => ({ ...current, ...Object.fromEntries(attendanceByEvent) }));
      setLiked((current) => ({ ...current, ...viewerState.liked }));
      setBookmarked((current) => ({ ...current, ...viewerState.bookmarked }));
    } catch (error: unknown) {
      console.error('[useEventActions.loadStates] Error:', errorMessage(error, 'Unknown error'));
    }
  }, []);

  const setStates = useCallback((eventId: string, state: { attendance?: EventAttendanceStatus; liked?: boolean; bookmarked?: boolean; likeCount?: number }) => {
    if (state.attendance) setAttendance((current) => ({ ...current, [eventId]: state.attendance as EventAttendanceStatus }));
    if (state.liked !== undefined) setLiked((current) => ({ ...current, [eventId]: Boolean(state.liked) }));
    if (state.bookmarked !== undefined) setBookmarked((current) => ({ ...current, [eventId]: Boolean(state.bookmarked) }));
    if (state.likeCount !== undefined) setLikeCounts((current) => ({ ...current, [eventId]: state.likeCount as number }));
  }, []);

  const runAttendance = async (event: Event, attend: boolean, answers?: RegistrationAnswers) => {
    if (!event.id) return;
    setWorkingEventId(event.id);
    try {
      const result = await eventService.setAttendance(event.id, attend, answers);
      setAttendance((current) => ({ ...current, [event.id as string]: result }));
      if (!attend) toast.success('You\'ve cancelled your attendance');
      else if (result.waitlistPosition) toast.success(`You're #${result.waitlistPosition} on the waitlist for ${event.title}`);
      else toast.success(`You're attending ${event.title}`);
      setRegistrationEvent(null);
      setDisclaimerEvent(null);
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to update attendance. Please try again.'));
    } finally {
      setWorkingEventId(null);
    }
  };

  /** Attend button: leaving is immediate; joining goes through the registration questions or the acknowledgement. */
  const requestAttendance = (event: Event) => {
    if (!event.id) return;
    if (!viewerId) { toast.error('Please sign in to attend this event'); return; }
    const state = attendance[event.id];
    if (state?.isAttending || state?.waitlistPosition) { void runAttendance(event, false); return; }
    if (event.registrationQuestions?.length) { setRegistrationEvent(event); return; }
    if (requireDisclaimer) { setDisclaimerEvent(event); return; }
    void runAttendance(event, true);
  };

  const toggleLike = async (event: Event) => {
    if (!event.id) return;
    if (!viewerId) { toast.error('Please sign in to like this event'); return; }
    const eventId = event.id;
    const wasLiked = Boolean(liked[eventId]);
    setLiked((current) => ({ ...current, [eventId]: !wasLiked }));
    setLikeCounts((current) => (current[eventId] === undefined ? current : { ...current, [eventId]: Math.max(0, current[eventId] + (wasLiked ? -1 : 1)) }));
    try {
      await eventEngagementService.toggleLike(eventId, wasLiked);
    } catch (error: unknown) {
      setLiked((current) => ({ ...current, [eventId]: wasLiked }));
      setLikeCounts((current) => (current[eventId] === undefined ? current : { ...current, [eventId]: Math.max(0, current[eventId] + (wasLiked ? 1 : -1)) }));
      toast.error(errorMessage(error, 'Failed to update like. Please try again.'));
    }
  };

  const toggleBookmark = async (event: Event) => {
    if (!event.id) return;
    if (!viewerId) { toast.error('Please sign in to bookmark this event'); return; }
    const eventId = event.id;
    const wasBookmarked = Boolean(bookmarked[eventId]);
    setBookmarked((current) => ({ ...current, [eventId]: !wasBookmarked }));
    try {
      await eventEngagementService.toggleBookmark(eventId, wasBookmarked);
      toast.success(wasBookmarked ? 'Event removed from bookmarks' : 'Event added to bookmarks');
    } catch (error: unknown) {
      setBookmarked((current) => ({ ...current, [eventId]: wasBookmarked }));
      toast.error(errorMessage(error, 'Failed to update bookmark. Please try again.'));
    }
  };

  const openCancel = async (event: Event) => {
    if (!event.id) return;
    setCancelState('idle');
    setCancelAttendeeCount(0);
    setCancelEvent(event);
    try {
      setCancelAttendeeCount(await eventService.countAttendees(event.id));
    } catch (error: unknown) {
      console.error('[useEventActions.openCancel] Error:', errorMessage(error, 'Unknown error'));
    }
  };

  const confirmArchive = async (reason: string) => {
    if (!archiveEvent?.id) return;
    setArchiveState('busy');
    try {
      await eventService.archiveEvent(archiveEvent.id, true, reason);
      setArchiveState('done');
      toast.success('Event archived');
      onRemoved?.(archiveEvent.id);
    } catch (error: unknown) {
      setArchiveState('idle');
      toast.error(errorMessage(error, 'Failed to archive event'));
    }
  };

  const confirmCancel = async () => {
    if (!cancelEvent?.id) return;
    setCancelState('busy');
    try {
      await eventService.cancelEvent(cancelEvent.id);
      setCancelState('done');
      toast.success('Event cancelled');
      onRemoved?.(cancelEvent.id);
    } catch (error: unknown) {
      setCancelState('idle');
      toast.error(errorMessage(error, 'Failed to cancel event'));
    }
  };

  const submitReport = async (category: ReportReasonCategory, reason: string, details: string, childSafety?: ChildSafetyIntakeValues) => {
    if (!reportEvent?.id) return;
    const reference = await moderationService.reportContent('event', {
      targetId: reportEvent.id, reportedUserId: reportEvent.userId || undefined, reasonCategory: category, reason, description: details,
      routePath: `/events/${reportEvent.id}`, contentUrl: reportEvent.image, immediateDanger: childSafety?.immediateDanger,
      goodFaithAcknowledged: childSafety?.goodFaithAcknowledged, allowContact: childSafety?.allowContact,
    });
    toast.success(category === 'child_safety' ? `Restricted report received. Keep confirmation reference ${reference}.` : 'Your report was sent to Ourlime moderation.');
  };

  const dialogs = (
    <>
      <RegistrationQuestionsDialog
        visible={Boolean(registrationEvent)}
        eventTitle={registrationEvent?.title ?? ''}
        questions={registrationEvent?.registrationQuestions ?? []}
        isBusy={Boolean(registrationEvent?.id && workingEventId === registrationEvent.id)}
        onSubmit={(answers) => { if (registrationEvent) void runAttendance(registrationEvent, true, answers); }}
        onClose={() => setRegistrationEvent(null)}
      />
      <RegistrationDisclaimerDialog
        visible={Boolean(disclaimerEvent)}
        isBusy={Boolean(disclaimerEvent?.id && workingEventId === disclaimerEvent.id)}
        onConfirm={() => { if (disclaimerEvent) void runAttendance(disclaimerEvent, true); }}
        onClose={() => setDisclaimerEvent(null)}
      />
      <ArchiveEventDialog visible={Boolean(archiveEvent)} eventTitle={archiveEvent?.title ?? ''} isBusy={archiveState === 'busy'} isDone={archiveState === 'done'} onConfirm={(reason) => void confirmArchive(reason)} onClose={() => setArchiveEvent(null)} />
      <CancelEventDialog visible={Boolean(cancelEvent)} eventTitle={cancelEvent?.title ?? ''} attendeeCount={cancelAttendeeCount} isBusy={cancelState === 'busy'} isDone={cancelState === 'done'} onConfirm={() => void confirmCancel()} onClose={() => setCancelEvent(null)} />
      <CommunityReportModal
        visible={Boolean(reportEvent)}
        title="Report event"
        subjectLabel={reportEvent?.title ?? ''}
        childSafetyTarget={reportEvent?.id ? { type: 'event', id: reportEvent.id, ownerUserId: reportEvent.userId || undefined, routePath: `/events/${reportEvent.id}` } : undefined}
        onClose={() => setReportEvent(null)}
        onSubmit={submitReport}
      />
      {viewerId && shareEvent?.id ? (
        <ShareContentSheet
          visible
          currentUserId={viewerId}
          contentLabel="event"
          title={shareEvent.title}
          message={shareEvent.summary || 'Check out this event on Ourlime'}
          url={deepLinkService.getEventShareUrl(shareEvent.id)}
          onClose={() => setShareEvent(null)}
        />
      ) : null}
    </>
  );

  return {
    attendance, liked, bookmarked, likeCounts, workingEventId, loadStates, setStates, requestAttendance,
    toggleLike: (event: Event) => void toggleLike(event),
    toggleBookmark: (event: Event) => void toggleBookmark(event),
    share: (event: Event) => { if (!viewerId) { toast.error('Please sign in to share this event'); return; } setShareEvent(event); },
    report: (event: Event) => { if (!viewerId) { toast.error('Please sign in to report this event'); return; } setReportEvent(event); },
    archive: (event: Event) => { setArchiveState('idle'); setArchiveEvent(event); },
    cancel: (event: Event) => void openCancel(event),
    dialogs,
  };
}
