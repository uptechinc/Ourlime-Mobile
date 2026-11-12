import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type DocumentData } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as Location from 'expo-location';
import { db, storage } from '../firebaseConfig';
import { AuthService } from './AuthService';
import { appServerService, AppServerError } from './AppServerService';
import type { CoOrganizer, CoOrganizerPermission, Event, EventStatus, MediaItem, RegistrationQuestion } from '@/types/eventTypes';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import { communityDataService } from './CommunityDataService';
import { firestoreBatchReadService } from './FirestoreBatchReadService';

export type EventAttendanceStatus = { isAttending: boolean; attendeeCount: number; waitlistPosition?: number | null };
export type EventOrganizer = { id: string; name: string; userName: string | null; profileImage: string | null; verified: boolean };
export type EventComment = { id: string; userId: string; comment: string; createdAt: string | null; parentId: string | null; isOrganizerReply: boolean; authorName: string; authorUserName: string | null; authorImage: string | null };
type EventMediaRecord = { type?: unknown; url?: unknown; typeUrl?: unknown };
export type CreateEventInput = {
  title: string;
  description: string;
  summary: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  recurrence: string;
  creatorId: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; userName: string; profileImage: string | null };
  communityVariantId?: string;
  image?: string;
  media?: MediaItem[];
  category?: string;
  hashtags?: string[];
};
/** The event fields the organiser may change directly (firestore.rules eventEditableFields). */
export type EventEditableFields = {
  title: string;
  description: string;
  summary: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  recurrence: string;
  image: string;
  media: MediaItem[];
  category: string;
  hashtags: string[];
};
export type EventManageResult = { attendeeCount: number };

const READ_STATUS = (data: DocumentData): string => (typeof data.status === 'string' ? data.status.toLowerCase() : '');
const toMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Web helpers/Events isEventVisible plus the events page rule: hides archived, hidden, cancelled, removed and ended
 * events. Drafts and not-yet-published scheduled events stay visible to their own organiser only.
 */
const isEventVisible = (data: DocumentData, viewerId?: string | null): boolean => {
  if (data.isArchived === true || data.deletedAt != null) return false;
  if (data.hidden === true || data.isHidden === true || data.moderationVisibility === 'hidden') return false;
  if (data.cancelled === true || data.isCancelled === true) return false;
  if (data.removed === true || data.isRemoved === true || data.isDeleted === true) return false;
  const status = READ_STATUS(data);
  if (['cancelled', 'removed', 'deleted', 'archived', 'inactive'].includes(status)) return false;
  const isOwner = Boolean(viewerId && (data.userId === viewerId || data.creatorId === viewerId));
  if (data.draft === true || data.isDraft === true || status === 'draft') return isOwner;
  if (status === 'scheduled' && data.publishAt) {
    const publishTime = toMillis(data.publishAt);
    if (publishTime !== null && publishTime > Date.now()) return isOwner;
  }
  if (data.isExpired === true) return false;
  const endsAt = toMillis(data.endDate) ?? toMillis(data.startDate);
  return endsAt === null || endsAt >= Date.now();
};

const PERMISSION_DENIED = /permission|insufficient/i;

/** What the eventApi callable returns for attend/leave (website setEventAttendance). */
type EventApiAttendance = { attendeeCount: number; attending: boolean; waitlistPosition: number | null };
type EventApiCancel = { requiresConfirm: true; attendeeCount: number } | { cancelled: true; attendeeCount: number; attendeesNotified: number };
type RegistrationAnswers = { [questionId: string]: string | string[] | boolean };

/**
 * True when the eventApi callable is not deployed yet (the server answers not-found for the function itself, or
 * unimplemented), as opposed to the callable reporting that the event does not exist.
 */
const isEventApiUnavailable = (error: unknown): boolean => {
  if (!(error instanceof AppServerError)) return false;
  if (error.code === 'not-found') return !/event not found/i.test(error.message);
  return error.code === 'unknown' && /unimplemented/i.test(error.message);
};

export class EventService {
  private static instance: EventService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) EventService.instance = new EventService();
    return EventService.instance;
  }

  /** All visible events, newest start date first (same filters as the website's events page), with organiser details. */
  public async fetchEvents(): Promise<Event[]> {
    const viewerId = this.authService.getVerifiedCurrentUser()?.uid ?? null;
    const snapshot = await getDocs(collection(db, 'events'));
    const events = snapshot.docs
      .filter((document) => !accountLifecycleVisibilityService.isHidden(document.data()) && isEventVisible(document.data(), viewerId))
      .map((document) => this.toEvent(document.id, document.data()))
      .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime());
    const organizerIds = [...new Set(events.map((event) => event.userId).filter(Boolean))];
    const profiles = organizerIds.length ? await firestoreBatchReadService.getDocumentsByIds('users', organizerIds) : new Map<string, DocumentData>();
    return events.map((event) => {
      const profile = profiles.get(event.userId);
      return profile ? { ...event, organizer: { name: this.profileName(profile) ?? 'Event organiser', userName: typeof profile.userName === 'string' ? profile.userName : null, image: typeof profile.profileImage === 'string' ? profile.profileImage : null, verified: this.isVerified(profile) } } : event;
    });
  }

  /** One event for the detail screen; null when it was removed, cancelled or is hidden (past events still open from links). */
  public async fetchEvent(eventId: string): Promise<{ event: Event; organizer: EventOrganizer | null } | null> {
    const snapshot = await getDoc(doc(db, 'events', eventId));
    const data = snapshot.data();
    const viewerId = this.authService.getVerifiedCurrentUser()?.uid ?? null;
    if (!snapshot.exists() || !data || accountLifecycleVisibilityService.isHidden(data) || !isEventVisible({ ...data, endDate: null, startDate: null, isExpired: false }, viewerId)) return null;
    return { event: this.toEvent(snapshot.id, data), organizer: await this.organizer(data) };
  }

  /** Discussion on an event (eventVariantComments, as on the website), oldest first, with each author's name and photo. */
  public async fetchComments(eventId: string): Promise<EventComment[]> {
    const snapshot = await getDocs(query(collection(db, 'eventVariantComments'), where('eventId', '==', eventId)));
    const visible = snapshot.docs.filter((document) => !accountLifecycleVisibilityService.isHidden(document.data()) && typeof document.data().comment === 'string');
    const authorIds = [...new Set(visible.map((document) => String(document.data().userId ?? '')).filter(Boolean))];
    const profiles = authorIds.length ? await firestoreBatchReadService.getDocumentsByIds('users', authorIds) : new Map<string, DocumentData>();
    return visible.map((document): EventComment => {
      const data = document.data();
      const userId = String(data.userId ?? '');
      const profile = profiles.get(userId);
      return {
        id: document.id, userId, comment: String(data.comment), createdAt: this.isoDate(data.timestamp),
        parentId: typeof data.parentId === 'string' ? data.parentId : null, isOrganizerReply: data.isOrganizerReply === true,
        authorName: this.profileName(profile) ?? 'Ourlime member', authorUserName: typeof profile?.userName === 'string' ? profile.userName : null,
        authorImage: typeof profile?.profileImage === 'string' ? profile.profileImage : null,
      };
    }).sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));
  }

  public async addComment(eventId: string, comment: string, isOrganizer: boolean): Promise<void> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Your verified session is still loading. Please try again.');
    const text = comment.trim();
    if (!text) throw new Error('Write a comment first.');
    // Same fields as the website's createEventComment; the rules only allow these keys.
    await addDoc(collection(db, 'eventVariantComments'), {
      eventId, eventVariantId: eventId, comment: text.slice(0, 5000), userId, timestamp: serverTimestamp(), likeCount: 0, parentId: null, isOrganizerReply: isOrganizer,
    });
  }

  public async deleteComment(commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'eventVariantComments', commentId));
  }

  /** The device's position for the distance filter and sort (asks for location permission). */
  public async getViewerCoordinates(): Promise<{ lat: number; lng: number }> {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) throw new Error('Could not access your location');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  }

  /** Whether the member's identity is verified (the website requires it to publish an event). */
  public async isIdentityVerified(userId: string): Promise<boolean> {
    const profile = (await getDoc(doc(db, 'users', userId))).data();
    return this.isVerified(profile);
  }

  /** Uploads an event cover to the same shared events/ folder the website uses (images up to 5 MB). */
  public async uploadEventImage(uri: string, mimeType?: string | null): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob.size > 5 * 1024 * 1024) throw new Error('Pick a cover image under 5 MB.');
    const contentType = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const upload = await uploadBytes(ref(storage, `events/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${extension}`), blob, { contentType });
    return getDownloadURL(upload.ref);
  }

  /** Who may edit (the organiser), manage (organiser or staff) and use each co-organiser permission, as on the website. */
  public canEdit(event: Event, userId: string | null | undefined): boolean {
    return Boolean(userId && userId === event.userId);
  }

  public canManage(event: Event, userId: string | null | undefined, isStaff: boolean): boolean {
    return Boolean(userId && (userId === event.userId || isStaff));
  }

  public hasPermission(event: Event, userId: string | null | undefined, permission: CoOrganizerPermission): boolean {
    if (!userId) return false;
    if (userId === event.userId) return true;
    return Boolean(event.coOrganizers?.find((coOrganizer) => coOrganizer.userId === userId)?.permissions.includes(permission));
  }

  /** The website's effectiveEventStatus: a scheduled event whose publish time has passed counts as published. */
  public effectiveStatus(event: Event): EventStatus {
    if (event.status === 'scheduled' && event.publishAt) {
      const publishTime = new Date(event.publishAt).getTime();
      if (!Number.isNaN(publishTime) && publishTime <= Date.now()) return 'published';
    }
    return event.status ?? 'published';
  }

  /** Edits the organiser's own event (only the fields the rules let the organiser change). */
  public async updateEvent(eventId: string, updates: Partial<EventEditableFields>): Promise<void> {
    if (updates.title !== undefined && !updates.title.trim()) throw new Error('The event needs a title.');
    await updateDoc(doc(db, 'events', eventId), { ...updates, updatedAt: new Date().toISOString() });
  }

  /**
   * Archives (hides from listings) or restores an event through the eventApi callable (port of the website's
   * PATCH /api/events/[id]/archive: organiser, community staff or administrator, with an audit entry). Until the
   * callable is deployed it falls back to a direct write, which the rules allow for Ourlime administrators only.
   */
  public async archiveEvent(eventId: string, archived: boolean, reason?: string): Promise<void> {
    try {
      await appServerService.call('eventApi', { action: 'archive', eventId, archived, ...(reason?.trim() ? { reason: reason.trim() } : {}) });
      return;
    } catch (error: unknown) {
      if (!isEventApiUnavailable(error)) throw error;
    }
    try {
      await updateDoc(doc(db, 'events', eventId), archived
        ? { isArchived: true, archivedAt: serverTimestamp(), archivedReason: reason?.trim().slice(0, 400) || null }
        : { isArchived: false, archivedAt: null, archivedReason: null });
    } catch (error: unknown) {
      if (error instanceof Error && PERMISSION_DENIED.test(error.message)) throw new Error('Archiving events from the app is only available to Ourlime administrators for now. Archive it on ourlime.com.');
      throw error;
    }
  }

  /** Attendees the organiser would notify by cancelling (the website asks for a stronger confirmation when there are any). */
  public async countAttendees(eventId: string): Promise<number> {
    const attendees = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId)));
    return new Set(attendees.docs.map((document) => String(document.data().userId ?? '')).filter(Boolean)).size;
  }

  /**
   * Cancels (soft-deletes) an event through the eventApi callable (port of the website's POST /api/events/[id]/cancel:
   * marks it cancelled, writes the audit entry and notifies attendees). Callers confirm with the organiser first
   * (countAttendees), so the attendee confirmation is passed along. Until the callable is deployed it falls back to a
   * direct write, which the rules allow for Ourlime administrators only (no attendee notices).
   */
  public async cancelEvent(eventId: string, reason?: string): Promise<void> {
    const viewerId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!viewerId) throw new Error('Your verified session is still loading. Please try again.');
    try {
      await appServerService.call<EventApiCancel>('eventApi', {
        action: 'cancel', eventId, confirmAttendeeAction: true, ...(reason?.trim() ? { reason: reason.trim() } : {}),
      }, 60_000);
      return;
    } catch (error: unknown) {
      if (!isEventApiUnavailable(error)) throw error;
    }
    try {
      await updateDoc(doc(db, 'events', eventId), {
        isCancelled: true, status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: viewerId, cancellationReason: reason?.trim().slice(0, 1000) || null,
      });
    } catch (error: unknown) {
      if (error instanceof Error && PERMISSION_DENIED.test(error.message)) throw new Error('Cancelling events from the app is only available to Ourlime administrators for now. Cancel it on ourlime.com so attendees are notified.');
      throw error;
    }
  }

  private async organizer(data: DocumentData): Promise<EventOrganizer | null> {
    const userId = typeof data.userId === 'string' ? data.userId : typeof data.creatorId === 'string' ? data.creatorId : '';
    if (!userId) return null;
    const profile = (await getDoc(doc(db, 'users', userId))).data()
      ?? (data.user && typeof data.user === 'object' ? data.user as DocumentData : undefined);
    return { id: userId, name: this.profileName(profile) ?? 'Event organiser', userName: typeof profile?.userName === 'string' ? profile.userName : null,
      profileImage: typeof profile?.profileImage === 'string' ? profile.profileImage : null, verified: this.isVerified(profile) };
  }

  private isVerified(profile: DocumentData | undefined): boolean {
    return profile?.identityVerificationStatus === 'verified' || profile?.verificationStatus === 'verified';
  }

  private profileName(profile: DocumentData | undefined): string | undefined {
    if (!profile) return undefined;
    const fullName = [profile.firstName, profile.lastName].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ');
    if (typeof profile.displayName === 'string' && profile.displayName.trim()) return profile.displayName.trim();
    // Some accounts' userName is their email address; never show that publicly.
    return fullName || (typeof profile.userName === 'string' && !profile.userName.includes('@') ? profile.userName : undefined);
  }

  private isoDate(value: unknown): string | null {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    return null;
  }

  /** Dates saved as 'YYYY-MM-DD' plus a separate 'HH:MM' (older app events) are joined into one local date-time. */
  private eventDate(value: unknown, time: unknown): string | null {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value !== 'string' || !value) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const timeMatch = typeof time === 'string' ? /^(\d{1,2}):(\d{2})/.exec(time.trim()) : null;
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), timeMatch ? Number(timeMatch[1]) : 0, timeMatch ? Number(timeMatch[2]) : 0).toISOString();
    }
    return Number.isNaN(Date.parse(value)) ? value : new Date(value).toISOString();
  }

  private stringList(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined;
  }

  private numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readQuestions(value: unknown): RegistrationQuestion[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((item): RegistrationQuestion[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as { id?: unknown; question?: unknown; type?: unknown; required?: unknown; options?: unknown };
      if (typeof record.id !== 'string' || typeof record.question !== 'string') return [];
      const type = record.type === 'radio' || record.type === 'checkbox' || record.type === 'select' ? record.type : 'text';
      return [{ id: record.id, question: record.question, type, required: record.required === true, options: this.stringList(record.options) }];
    });
  }

  private readCoOrganizers(value: unknown): CoOrganizer[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((item): CoOrganizer[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as { userId?: unknown; name?: unknown; userName?: unknown; image?: unknown; permissions?: unknown };
      if (typeof record.userId !== 'string') return [];
      const permissions = (this.stringList(record.permissions) ?? []).filter((permission): permission is CoOrganizerPermission => permission === 'manage_discussions' || permission === 'manage_reviews' || permission === 'manage_attendance');
      return [{ userId: record.userId, name: typeof record.name === 'string' ? record.name : undefined, userName: typeof record.userName === 'string' ? record.userName : undefined, image: typeof record.image === 'string' ? record.image : undefined, permissions }];
    });
  }

  private toEvent(eventId: string, event: DocumentData): Event {
    const startDate = this.eventDate(event.startDate, event.startTime) ?? new Date(0).toISOString();
    const endDate = this.eventDate(event.endDate, event.endTime) ?? startDate;
    const location = typeof event.location === 'string'
      ? event.location
      : event.location && typeof event.location === 'object' && typeof event.location.name === 'string'
        ? event.location.name
        : 'Online';
    const rawMedia: unknown[] = [...(Array.isArray(event.media) ? event.media : []), ...(Array.isArray(event.additionalMedia) ? event.additionalMedia : [])];
    const media: MediaItem[] | undefined = rawMedia.length
      ? rawMedia.flatMap((item): MediaItem[] => {
          if (!item || typeof item !== 'object') return [];
          const value = item as EventMediaRecord;
          const url = typeof value.url === 'string' ? value.url : typeof value.typeUrl === 'string' ? value.typeUrl : '';
          if (!url) return [];
          return [{ type: value.type === 'video' ? 'video' : 'image', url }];
        })
      : undefined;
    const status = READ_STATUS(event);
    const statuses: EventStatus[] = ['draft', 'scheduled', 'published', 'sold_out', 'cancelled', 'completed', 'archived', 'removed'];
    return {
      id: eventId,
      title: typeof event.title === 'string' ? event.title : 'Untitled event',
      summary: typeof event.summary === 'string' ? event.summary : typeof event.description === 'string' ? event.description : '',
      description: typeof event.description === 'string' ? event.description : undefined,
      startDate,
      endDate,
      location,
      userId: typeof event.userId === 'string' ? event.userId : typeof event.creatorId === 'string' ? event.creatorId : '',
      likeCount: typeof event.likeCount === 'number' ? event.likeCount : 0,
      recurrence: typeof event.recurrence === 'string' ? event.recurrence : 'none',
      image: typeof event.image === 'string' && event.image ? event.image : undefined,
      media,
      category: typeof event.category === 'string' && event.category ? event.category : undefined,
      communityVariantId: typeof event.communityVariantId === 'string' ? event.communityVariantId : undefined,
      tags: this.stringList(event.tags) ?? this.stringList(event.hashtags),
      createdAt: this.isoDate(event.createdAt) ?? undefined,
      status: statuses.find((value) => value === status),
      publishAt: this.isoDate(event.publishAt),
      isVirtual: event.isVirtual === true,
      virtualLink: typeof event.virtualLink === 'string' ? event.virtualLink : undefined,
      isFree: typeof event.isFree === 'boolean' ? event.isFree : undefined,
      ticketPrice: this.numberOrNull(event.ticketPrice),
      accessibility: this.stringList(event.accessibility),
      address: typeof event.address === 'string' ? event.address : undefined,
      lat: this.numberOrNull(event.lat),
      lng: this.numberOrNull(event.lng),
      capacity: this.numberOrNull(event.capacity),
      ageRestriction: this.numberOrNull(event.ageRestriction),
      coOrganizers: this.readCoOrganizers(event.coOrganizers),
      registrationQuestions: this.readQuestions(event.registrationQuestions),
      isFeatured: event.isFeatured === true,
    };
  }

  /** Creates the event directly in Firestore (the fields the rules allow) and signs the organiser up, as the website does. */
  public async createEvent(input: CreateEventInput): Promise<string> {
    const event = await addDoc(collection(db, 'events'), { ...input, likeCount: 0, createdAt: new Date().toISOString() });
    // The creator auto-attends, as on the website.
    try {
      await setDoc(doc(db, 'eventAttendees', `${event.id}_${input.userId}`), { eventId: event.id, userId: input.userId, createdAt: new Date().toISOString() });
    } catch (error: unknown) {
      console.error('[EventService.createEvent] Auto-attend error:', error instanceof Error ? error.message : 'Unknown error');
    }
    return event.id;
  }

  /** Community events read and written directly in Firestore (same logic as the website's community events route). */
  public async fetchCommunityEvents(communityId: string): Promise<Event[]> {
    const events = await communityDataService.fetchEvents(communityId);
    return events.filter((event) => !accountLifecycleVisibilityService.isHidden(event));
  }

  public async createCommunityEvent(input: CreateEventInput): Promise<string> {
    if (!input.communityVariantId) throw new Error('Community is required.');
    return communityDataService.createEvent(input.communityVariantId, input);
  }

  public async updateCommunityEvent(communityId: string, eventId: string, updates: Partial<CreateEventInput>): Promise<void> {
    await communityDataService.updateEvent(communityId, eventId, updates);
  }

  public async deleteCommunityEvent(communityId: string, eventId: string): Promise<void> {
    await communityDataService.deleteEvent(communityId, eventId);
  }

  public async toggleCommunityAttendance(communityId: string, eventId: string, desiredAttending?: boolean): Promise<EventAttendanceStatus> {
    const result = await communityDataService.toggleAttendance(communityId, eventId, desiredAttending);
    if (result.onWaitlist) throw new Error(`This event is full. You are number ${result.position ?? 1} on the waitlist.`);
    return { isAttending: result.isAttending, attendeeCount: result.attendeeCount };
  }

  public async getAttendance(eventId: string): Promise<EventAttendanceStatus> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    const [attendees, waitlist] = await Promise.all([
      getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId))),
      userId ? getDocs(query(collection(db, 'eventWaitlists'), where('eventId', '==', eventId))) : Promise.resolve(null),
    ]);
    const ordered = waitlist ? [...waitlist.docs].sort((left, right) => this.position(left.data()) - this.position(right.data())) : [];
    const waitlistIndex = ordered.findIndex((entry) => entry.data().userId === userId);
    return {
      attendeeCount: attendees.size,
      isAttending: Boolean(userId && attendees.docs.some((document) => document.data().userId === userId)),
      waitlistPosition: waitlistIndex >= 0 ? waitlistIndex + 1 : null,
    };
  }

  /** Attendance for a list of events from batched eventAttendees reads, instead of one query per event. */
  public async getAttendanceForEvents(eventIds: string[]): Promise<Map<string, EventAttendanceStatus>> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    const attendees = await firestoreBatchReadService.getDocumentsByField('eventAttendees', 'eventId', eventIds);
    const attendance = new Map<string, EventAttendanceStatus>(eventIds.map((eventId) => [eventId, { attendeeCount: 0, isAttending: false }]));
    attendees.forEach((document) => {
      const attendee = document.data();
      const current = typeof attendee.eventId === 'string' ? attendance.get(attendee.eventId) : undefined;
      if (!current) return;
      current.attendeeCount += 1;
      if (userId && attendee.userId === userId) current.isAttending = true;
    });
    return attendance;
  }

  /**
   * Attends or leaves through the eventApi callable, which runs the website's setEventAttendance transaction: a full
   * event puts the member on the waitlist, a freed place goes to the next in line, the sold-out status follows, and
   * attending stores the registration answers. Until the callable is deployed it falls back to direct writes.
   */
  public async setAttendance(eventId: string, attend: boolean, answers?: RegistrationAnswers): Promise<EventAttendanceStatus> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Your verified session is still loading. Please try again.');
    try {
      const result = await appServerService.call<EventApiAttendance>('eventApi', {
        action: attend ? 'attend' : 'leave', eventId, ...(attend && answers && Object.keys(answers).length ? { answers } : {}),
      });
      return { isAttending: result.attending, attendeeCount: result.attendeeCount, waitlistPosition: result.waitlistPosition };
    } catch (error: unknown) {
      if (!isEventApiUnavailable(error)) throw error;
    }
    return this.setAttendanceDirectly(userId, eventId, attend, answers);
  }

  /**
   * Fallback for setAttendance while eventApi is not deployed: the member's own attendance and waitlist records only.
   * Promoting the next waitlisted member and the sold-out status need the server.
   */
  private async setAttendanceDirectly(userId: string, eventId: string, attend: boolean, answers?: RegistrationAnswers): Promise<EventAttendanceStatus> {
    const [eventSnapshot, attendees, waitlist] = await Promise.all([
      getDoc(doc(db, 'events', eventId)),
      getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'eventWaitlists'), where('eventId', '==', eventId))),
    ]);
    const event = eventSnapshot.data();
    if (!event) throw new Error('This event is no longer available.');
    const own = attendees.docs.filter((entry) => entry.data().userId === userId);
    const ownWaitlist = waitlist.docs.filter((entry) => entry.data().userId === userId);
    if (attend) {
      if (['cancelled', 'archived', 'deleted'].includes(READ_STATUS(event))) throw new Error('This event is no longer taking registrations.');
      if (own.length > 0) return { isAttending: true, attendeeCount: attendees.size, waitlistPosition: null };
      const capacity = this.numberOrNull(event.capacity);
      const ordered = [...waitlist.docs].sort((left, right) => this.position(left.data()) - this.position(right.data()));
      if (capacity !== null && capacity >= 0 && attendees.size >= capacity) {
        if (ownWaitlist.length > 0) return { isAttending: false, attendeeCount: attendees.size, waitlistPosition: ordered.indexOf(ownWaitlist[0]) + 1 };
        const last = ordered.length ? this.position(ordered[ordered.length - 1].data()) : 0;
        const position = Number.isSafeInteger(last) ? last + 1 : ordered.length + 1;
        await addDoc(collection(db, 'eventWaitlists'), { eventId, userId, createdAt: new Date().toISOString(), position });
        return { isAttending: false, attendeeCount: attendees.size, waitlistPosition: ordered.length + 1 };
      }
      await setDoc(doc(db, 'eventAttendees', `${eventId}_${userId}`), { eventId, userId, createdAt: new Date().toISOString(), ...(answers && Object.keys(answers).length ? { answers } : {}) });
      await Promise.all(ownWaitlist.map((entry) => deleteDoc(entry.ref)));
      return { isAttending: true, attendeeCount: attendees.size + 1, waitlistPosition: null };
    }
    await Promise.all([...own, ...ownWaitlist].map((entry) => deleteDoc(entry.ref)));
    return { isAttending: false, attendeeCount: Math.max(0, attendees.size - own.length), waitlistPosition: null };
  }

  /** Kept for existing callers: flips the member's attendance. */
  public async toggleAttendance(eventId: string): Promise<EventAttendanceStatus> {
    const current = await this.getAttendance(eventId);
    return this.setAttendance(eventId, !(current.isAttending || Boolean(current.waitlistPosition)));
  }

  private position(data: DocumentData): number {
    return typeof data.position === 'number' && Number.isFinite(data.position) ? data.position : Number.MAX_SAFE_INTEGER;
  }
}

export const eventService = EventService.getInstance();
