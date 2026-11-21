import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Save, Send, X, XCircle, Plus, Square, SquareCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';
import { AuthService } from '@/lib/services/AuthService';
import { EventService } from '@/lib/services/EventService';
import DateTimeField from '@/components/ui/DateTimeField';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useLocalFormDraft } from '@/lib/hooks/useLocalFormDraft';
import SavedDraftBanner from '@/components/drafts/SavedDraftBanner';
import DraftDiscardSheet from '@/components/drafts/DraftDiscardSheet';
import { EVENT_CATEGORIES, EVENT_RECURRENCE_OPTIONS } from '@/components/events/eventPresentation';
import {
  cleanRegistrationQuestions, CustomRecurrenceFields, EventAccessibilityChips, EventAgeField, EventCoOrganizersField, EventFormSection,
  EventLocationFields, EventPricingFields, EventPublishingFields, EventRegistrationQuestionsField, type CustomRecurrenceValue,
} from '@/components/events/createEventModal/EventFormSections';
import type { CoOrganizer, Event, EventFormFields, RegistrationQuestion } from '@/types/eventTypes';

const authService = AuthService.getInstance();
const eventService = EventService.getInstance();

/* ─────────── Types ─────────── */
type CreateEventModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Editing an existing event: the form starts filled in, and the server checks who may change it. */
  event?: Event;
  /** Creating the event inside a community (the website's community events use this same form). */
  communityVariantId?: string;
};
type MediaSource = { url: string; type: 'image' | 'video'; isVerified: boolean };

type CreateEventForm = {
  coverMimeType?: string | null;
  title: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  location: string;
  summary: string;
  coverMedia: string | null;
  additionalMedia: MediaSource[];
  tags: string[];
  recurrence: string;
  customRecurrence: CustomRecurrenceValue;
  category: string;
  isVirtual: boolean;
  isFree: boolean;
  ticketPrice: string;
  accessibility: string[];
  lat: number | null;
  lng: number | null;
  status: EventFormFields['status'];
  publishAt: string | null;
  ageRestriction: number | null;
  coOrganizers: CoOrganizer[];
  registrationQuestions: RegistrationQuestion[];
};

const DEFAULT_CUSTOM_RECURRENCE: CustomRecurrenceValue = { recurrenceInterval: 1, recurrenceUnit: 'week', recurrenceDays: [], recurrenceEndMode: 'never', recurrenceEndDate: '', recurrenceCount: 10 };
const EMPTY_FORM: CreateEventForm = {
  title: '', date: '', time: '', endDate: '', endTime: '', location: '', summary: '', coverMedia: null, coverMimeType: null, additionalMedia: [], tags: [],
  recurrence: 'none', customRecurrence: DEFAULT_CUSTOM_RECURRENCE, category: '', isVirtual: false, isFree: true, ticketPrice: '', accessibility: [],
  lat: null, lng: null, status: 'published', publishAt: null, ageRestriction: null, coOrganizers: [], registrationQuestions: [],
};
const FORM_STATUSES: EventFormFields['status'][] = ['draft', 'scheduled', 'published'];

const DEFAULT_EVENT_LENGTH_MS = 2 * 60 * 60 * 1000;
const padTwo = (value: number): string => String(value).padStart(2, '0');

/** The form keeps local 'YYYY-MM-DD' + 'HH:MM' strings (what eventService and saved drafts expect). */
function joinDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dateMatch) return null;
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), timeMatch ? Number(timeMatch[1]) : 0, timeMatch ? Number(timeMatch[2]) : 0);
}

function splitDateTime(value: Date): { date: string; time: string } {
  return {
    date: `${value.getFullYear()}-${padTwo(value.getMonth() + 1)}-${padTwo(value.getDate())}`,
    time: `${padTwo(value.getHours())}:${padTwo(value.getMinutes())}`,
  };
}

/* ─────────── Component ─────────── */
export default function CreateEventModal({ visible, onClose, onCreated, event, communityVariantId }: CreateEventModalProps) {
  const isEditing = Boolean(event?.id);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // The dialog sits in a transparent Modal, where Android doesn't resize for the keyboard: KeyboardSafeView lifts it.
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [currentMediaUrl, setCurrentMediaUrl] = useState('');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [formData, setFormData] = useState<CreateEventForm>(EMPTY_FORM);
  const updateForm = (changes: Partial<CreateEventForm>) => setFormData((previous) => ({ ...previous, ...changes }));
  useEffect(() => {
    if (!visible || !event) return;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate || event.startDate);
    const startParts = Number.isNaN(start.getTime()) ? { date: '', time: '' } : splitDateTime(start);
    const endParts = Number.isNaN(end.getTime()) ? { date: '', time: '' } : splitDateTime(end);
    setFormData({
      title: event.title, date: startParts.date, time: startParts.time, endDate: endParts.date, endTime: endParts.time,
      location: event.location === 'Location TBD' ? '' : event.location, summary: event.summary || event.description || '',
      coverMedia: event.image ?? null, coverMimeType: null,
      additionalMedia: (event.media ?? []).filter((item) => item.url !== event.image).map((item) => ({ url: item.url, type: item.type, isVerified: true })),
      tags: event.tags ?? [], recurrence: event.recurrence || 'none', category: event.category ?? '',
      customRecurrence: {
        recurrenceInterval: event.recurrenceInterval ?? 1, recurrenceUnit: event.recurrenceUnit ?? 'week', recurrenceDays: event.recurrenceDays ?? [],
        recurrenceEndMode: event.recurrenceEndMode ?? 'never', recurrenceEndDate: event.recurrenceEndDate ?? '', recurrenceCount: event.recurrenceCount ?? 10,
      },
      isVirtual: event.isVirtual === true, isFree: event.isFree !== false, ticketPrice: typeof event.ticketPrice === 'number' ? String(event.ticketPrice) : '',
      accessibility: event.accessibility ?? [], lat: event.lat ?? null, lng: event.lng ?? null,
      status: FORM_STATUSES.find((status) => status === event.status) ?? 'published', publishAt: event.publishAt ?? null,
      ageRestriction: event.ageRestriction ?? null, coOrganizers: event.coOrganizers ?? [], registrationQuestions: event.registrationQuestions ?? [],
    });
  }, [event, visible]);

  // On-device draft (like the website): auto-saves the form, offers Restore next time.
  const hasFormContent = Boolean(formData.title.trim() || formData.summary.trim() || formData.location.trim() || formData.date
    || formData.coverMedia || formData.tags.length > 0 || formData.additionalMedia.length > 0 || formData.category.trim()
    || formData.coOrganizers.length > 0 || formData.registrationQuestions.length > 0);
  const draft = useLocalFormDraft<CreateEventForm>({
    ownerId: authService.getCurrentUser()?.uid,
    kind: 'event',
    scopeId: communityVariantId,
    data: formData,
    hasContent: hasFormContent,
    enabled: visible && !isEditing,
  });
  const [isDiscardSheetVisible, setIsDiscardSheetVisible] = useState(false);
  const shouldDismissForm = (): boolean => {
    if (isSubmitting || !hasFormContent || isEditing) return true;
    setIsDiscardSheetVisible(true);
    return false;
  };
  const swipeDismiss = useSwipeDismiss({ visible, onDismiss: onClose, disabled: isSubmitting, shouldDismiss: shouldDismissForm });

  const handleSaveProgress = async () => {
    await draft.saveNow();
    toast.success('Draft saved on this device');
  };

  /* ───────── File handling ───────── */
  const pickCoverImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      const f = res.assets[0];
      if (f.fileSize && f.fileSize > 5 * 1024 * 1024) {
        toast.error('File > 5 MB – pick a smaller one');
        return;
      }
      setFormData(p => ({ ...p, coverMedia: f.uri, coverMimeType: f.mimeType ?? null }));
    }
  };
  const removeCoverImage = () => setFormData(p => ({ ...p, coverMedia: null }));

  /* ───────── Helpers ───────── */
  const addTag = () => {
    if (currentTag && !formData.tags.includes(currentTag)) {
      setFormData(p => ({ ...p, tags: [...p.tags, currentTag] }));
      setCurrentTag('');
    }
  };
  const removeTag = (tag: string) =>
    setFormData(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));

  const addMedia = () => {
    if (currentMediaUrl.trim()) {
      setFormData(p => ({
        ...p,
        additionalMedia: [
          ...p.additionalMedia,
          { url: currentMediaUrl.trim(), type: 'image', isVerified: false },
        ],
      }));
      setCurrentMediaUrl('');
    }
  };
  const removeMedia = (i: number) =>
    setFormData(p => ({
      ...p,
      additionalMedia: p.additionalMedia.filter((_, idx) => idx !== i),
    }));

  // The website's checks: publishing (or scheduling) needs title, start and end, cover, category and the organiser
  // disclaimer; a draft only needs a title. Custom repeats need a weekday (weekly) and a sensible end date.
  const isPublishing = formData.status !== 'draft';
  const custom = formData.customRecurrence;
  const recurrenceIssue = formData.recurrence !== 'custom' ? null
    : custom.recurrenceUnit === 'week' && custom.recurrenceDays.length === 0 ? 'at least one weekday for the weekly repeat'
      : custom.recurrenceEndMode === 'date' && (!custom.recurrenceEndDate || (formData.date && custom.recurrenceEndDate < formData.date)) ? 'a repeat end date on or after the start date'
        : null;
  const publishIssues = [
    !formData.title.trim() ? 'a title' : null,
    isPublishing && (!formData.date || !formData.time) ? 'a start date and time' : null,
    isPublishing && (!formData.endDate || !formData.endTime) ? 'an end date and time' : null,
    isPublishing && !formData.coverMedia ? 'a cover image' : null,
    isPublishing && !formData.category ? 'a category' : null,
    isPublishing && !formData.summary.trim() ? 'a summary' : null,
    formData.status === 'scheduled' && !formData.publishAt ? 'when to publish' : null,
    !formData.isFree && !(Number(formData.ticketPrice) > 0) ? 'a ticket price' : null,
    recurrenceIssue,
    isPublishing && !isEditing && !acceptedDisclaimer ? 'the Event Organizer Disclaimer agreement' : null,
  ].filter((issue): issue is string => Boolean(issue));
  const isValid = publishIssues.length === 0;

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error(`${isPublishing ? 'To publish' : 'To save'}, add or fix: ${publishIssues.join(', ')}`);
      return;
    }
    const startsAt = joinDateTime(formData.date, formData.time);
    const endsAt = joinDateTime(formData.endDate, formData.endTime);
    if ((startsAt && !endsAt) || (!startsAt && endsAt)) {
      toast.error('Pick both a start and an end date and time');
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      toast.error('The end must be after the start');
      return;
    }
    try {
      setIsSubmitting(true);
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Authentication required');
      if (!isEditing && !(await eventService.isIdentityVerified(user.uid))) {
        throw new Error('Verify your identity before creating events. Go to Settings → Identity verification.');
      }
      const coverMedia = formData.coverMedia ?? '';
      const image = !coverMedia ? '' : /^https?:\/\//i.test(coverMedia) ? coverMedia : await eventService.uploadEventImage(coverMedia, formData.coverMimeType);
      const isCustom = formData.recurrence === 'custom';
      const fields: EventFormFields = {
        title: formData.title.trim(),
        summary: formData.summary.trim(),
        startDate: startsAt ? startsAt.toISOString() : '',
        endDate: endsAt ? endsAt.toISOString() : '',
        image,
        location: formData.location.trim(),
        recurrence: formData.recurrence || 'none',
        recurrenceInterval: isCustom ? custom.recurrenceInterval : 1,
        recurrenceUnit: isCustom ? custom.recurrenceUnit : null,
        recurrenceDays: isCustom && custom.recurrenceUnit === 'week' ? custom.recurrenceDays : [],
        recurrenceEndMode: isCustom ? custom.recurrenceEndMode : 'never',
        recurrenceEndDate: isCustom && custom.recurrenceEndMode === 'date' ? custom.recurrenceEndDate || null : null,
        recurrenceCount: isCustom && custom.recurrenceEndMode === 'count' ? custom.recurrenceCount : null,
        tags: formData.tags,
        additionalMedia: formData.additionalMedia.map((item) => ({ url: item.url, type: item.type, isVerified: item.isVerified })),
        category: formData.category,
        isVirtual: formData.isVirtual,
        isFree: formData.isFree,
        ticketPrice: !formData.isFree && formData.ticketPrice ? Number(formData.ticketPrice) : null,
        accessibility: formData.accessibility,
        lat: formData.isVirtual ? null : formData.lat,
        lng: formData.isVirtual ? null : formData.lng,
        status: formData.status,
        publishAt: formData.status === 'scheduled' ? formData.publishAt : null,
        ageRestriction: formData.ageRestriction,
        coOrganizers: formData.coOrganizers,
        registrationQuestions: cleanRegistrationQuestions(formData.registrationQuestions),
        ...(communityVariantId && !isEditing ? { communityVariantId } : {}),
      };
      if (isEditing && event?.id) {
        // A sold-out, cancelled or completed event keeps its status unless the organiser picks another one here.
        const keepsStatus = !FORM_STATUSES.some((status) => status === event.status) && formData.status === 'published';
        const { status, publishAt, ...unchangedStatusFields } = fields;
        await eventService.updateEvent(event.id, keepsStatus ? unchangedStatusFields : { ...unchangedStatusFields, status, publishAt });
        toast.success('Event updated');
        onCreated?.();
        onClose();
        return;
      }
      await eventService.createEvent(fields);
      onCreated?.();
      toast.success(formData.status === 'draft' ? 'Draft saved. Only you can see it.' : formData.status === 'scheduled' ? 'Event scheduled' : 'Event created successfully!');
      void draft.clear();
      resetForm();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };
  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setAcceptedDisclaimer(false);
    setCurrentTag('');
    setCurrentMediaUrl('');
  };

  /* ───────── UI ───────── */
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <KeyboardSafeView
        onKeyboardChange={setIsKeyboardOpen}
        style={{
          flex: 1,
          backgroundColor: colors.modalScrim,
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingTop: isKeyboardOpen ? insets.top : 0,
        }}
      >
        <Animated.View
          style={[
            {
              backgroundColor: colors.surface,
              borderRadius: 20,
              overflow: 'hidden',
            },
            // Explicit values in both states (Reanimated doesn't reset a removed prop). Keyboard open: the dialog
            // shrinks to the space above the keyboard and its body scrolls.
            isKeyboardOpen ? { maxHeight: '100%', minHeight: 0, flexShrink: 1 } : { maxHeight: '92%', minHeight: 0, flexShrink: 0 },
            swipeDismiss.animatedStyle,
          ]}
        >
          <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close event creation" />
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderBottomWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <View>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
                {isEditing ? 'Edit Event' : 'Create New Event'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>
                {isEditing ? 'Update the details attendees see' : 'Host a gathering, workshop, or celebration'}
              </Text>
            </View>
            <TouchableOpacity onPress={swipeDismiss.dismissWithAnimation} hitSlop={12} accessibilityLabel="Close event creation">
              <XCircle size={22} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            {!isEditing && draft.savedDraft ? (
              <SavedDraftBanner
                savedAt={draft.savedAt}
                onRestore={() => {
                  const restored = draft.restore();
                  if (restored) setFormData({ ...EMPTY_FORM, ...restored, customRecurrence: { ...DEFAULT_CUSTOM_RECURRENCE, ...restored.customRecurrence } });
                }}
                onDiscard={() => void draft.discard()}
              />
            ) : null}
            {/* Title */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 4 }}>
              Title <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              placeholder="Event title"
              value={formData.title}
              onChangeText={v => setFormData(p => ({ ...p, title: v }))}
              placeholderTextColor={colors.mutedText}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.input,
                color: colors.text,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {/* Dates & Times: native pickers (stored as local date + time strings) */}
            <View style={{ gap: 12, marginBottom: 12 }}>
              <DateTimeField
                label="Starts"
                required
                mode="datetime"
                placeholder="Pick a start date and time"
                value={joinDateTime(formData.date, formData.time)}
                minimumDate={new Date()}
                onChange={(start) => setFormData((previous) => {
                  const end = joinDateTime(previous.endDate, previous.endTime);
                  const nextEnd = !end || end <= start ? new Date(start.getTime() + DEFAULT_EVENT_LENGTH_MS) : end;
                  const startParts = splitDateTime(start);
                  const endParts = splitDateTime(nextEnd);
                  return { ...previous, date: startParts.date, time: startParts.time, endDate: endParts.date, endTime: endParts.time };
                })}
              />
              <DateTimeField
                label="Ends"
                required
                mode="datetime"
                placeholder="Pick an end date and time"
                value={joinDateTime(formData.endDate, formData.endTime)}
                minimumDate={joinDateTime(formData.date, formData.time) ?? new Date()}
                onChange={(end) => setFormData((previous) => {
                  const endParts = splitDateTime(end);
                  return { ...previous, endDate: endParts.date, endTime: endParts.time };
                })}
              />
            </View>

            {/* Recurrence */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 6 }}>
              Recurrence
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {EVENT_RECURRENCE_OPTIONS.map((option) => {
                const selected = formData.recurrence === option.key;
                return (
                  <TouchableOpacity key={option.key} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setFormData(p => ({ ...p, recurrence: option.key }))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.selectedControl : colors.control }}>
                    <Text style={{ color: selected ? colors.selectedText : colors.secondaryText, fontSize: 13, fontWeight: '700' }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {formData.recurrence === 'custom' ? (
              <View style={{ marginBottom: 12 }}>
                <CustomRecurrenceFields value={formData.customRecurrence} eventStartDate={joinDateTime(formData.date, formData.time)} onChange={(customRecurrence) => updateForm({ customRecurrence })} />
              </View>
            ) : null}

            {/* Format, location and map position */}
            <View style={{ marginBottom: 12 }}>
              <EventLocationFields isVirtual={formData.isVirtual} location={formData.location} lat={formData.lat} lng={formData.lng} onChange={updateForm} />
            </View>

            {/* Price */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 6 }}>Tickets</Text>
            <View style={{ marginBottom: 12 }}>
              <EventPricingFields isFree={formData.isFree} ticketPrice={formData.ticketPrice} onChange={updateForm} />
            </View>

            {/* Accessibility */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 6 }}>Accessibility</Text>
            <View style={{ marginBottom: 12 }}>
              <EventAccessibilityChips selected={formData.accessibility}
                onToggle={(key) => setFormData((previous) => ({ ...previous, accessibility: previous.accessibility.includes(key) ? previous.accessibility.filter((item) => item !== key) : [...previous.accessibility, key] }))} />
            </View>

            {/* Summary */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 4 }}>
              Summary <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              placeholder="Quick summary"
              multiline
              value={formData.summary}
              onChangeText={v => setFormData(p => ({ ...p, summary: v }))}
              placeholderTextColor={colors.mutedText}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.input,
                color: colors.text,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 14,
                height: 100,
                textAlignVertical: 'top',
                marginBottom: 12,
              }}
            />

            {/* Cover */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 4 }}>
              Cover Image <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            {formData.coverMedia ? (
              <View style={{ marginBottom: 12 }}>
                <Image
                  source={{ uri: formData.coverMedia }}
                  style={{ width: '100%', height: 180, borderRadius: 10 }}
                />
                <TouchableOpacity
                  onPress={removeCoverImage}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    backgroundColor: '#ef4444',
                    borderRadius: 12,
                    padding: 4,
                  }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickCoverImage}
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingVertical: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Plus size={28} color={colors.icon} />
                <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 6 }}>
                  Tap to pick an image ≤ 5 MB
                </Text>
              </TouchableOpacity>
            )}

            {/* Additional media */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginBottom: 4 }}>
              Additional Media (URL)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <TextInput
                placeholder="https://…"
                value={currentMediaUrl}
                onChangeText={setCurrentMediaUrl}
                placeholderTextColor={colors.mutedText}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  color: colors.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                  fontSize: 14,
                }}
              />
              <TouchableOpacity
                onPress={addMedia}
                style={{
                  backgroundColor: '#01eb53',
                  borderRadius: 8,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {formData.additionalMedia.map((m, i) => (
                <View
                  key={i}
                  style={{
                    width: 90,
                    height: 90,
                    marginRight: 10,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: '#ef4444',
                      padding: 2,
                      borderRadius: 10,
                    }}
                    onPress={() => removeMedia(i)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Tags */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginTop: 12, marginBottom: 4 }}>
              Tags
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <TextInput
                placeholder="Add a tag"
                value={currentTag}
                onChangeText={setCurrentTag}
                placeholderTextColor={colors.mutedText}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  color: colors.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                  fontSize: 14,
                }}
              />
              <TouchableOpacity
                onPress={addTag}
                style={{
                  backgroundColor: '#01eb53',
                  borderRadius: 8,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {formData.tags.map(tag => (
                <View
                  key={tag}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: colors.control,
                    borderRadius: 14,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ color: colors.secondaryText }}>{tag}</Text>
                  <TouchableOpacity hitSlop={8} onPress={() => removeTag(tag)}>
                    <X size={12} color={colors.icon} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Category */}
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.secondaryText, marginTop: 12, marginBottom: 6 }}>
              Category <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[...EVENT_CATEGORIES, ...(formData.category && !EVENT_CATEGORIES.some((category) => category === formData.category) ? [formData.category] : [])].map((category) => {
                const selected = formData.category === category;
                return (
                  <TouchableOpacity key={category} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setFormData(p => ({ ...p, category }))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.selectedControl : colors.control }}>
                    <Text style={{ color: selected ? colors.selectedText : colors.secondaryText, fontSize: 13, fontWeight: '700' }}>{category}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <EventFormSection title="Visibility & scheduling" description="Publish now, schedule it, or keep it as a draft.">
              <EventPublishingFields status={formData.status} publishAt={formData.publishAt ? new Date(formData.publishAt) : null}
                onChange={(changes) => updateForm({ ...(changes.status ? { status: changes.status } : {}), ...(changes.publishAt !== undefined ? { publishAt: changes.publishAt ? changes.publishAt.toISOString() : null } : {}) })} />
            </EventFormSection>
            <EventFormSection title="Minimum age">
              <EventAgeField value={formData.ageRestriction} onChange={(ageRestriction) => updateForm({ ageRestriction })} />
            </EventFormSection>
            <EventFormSection title="Co-organizers" description="People who help run this event and what they can manage.">
              <EventCoOrganizersField ownerId={event?.userId ?? authService.getCurrentUser()?.uid ?? null} coOrganizers={formData.coOrganizers} onChange={(coOrganizers) => updateForm({ coOrganizers })} />
            </EventFormSection>
            <EventFormSection title="Registration questions" description="Ask attendees for anything you need when they register.">
              <EventRegistrationQuestionsField questions={formData.registrationQuestions} onChange={(registrationQuestions) => updateForm({ registrationQuestions })} />
            </EventFormSection>

            {!isEditing && isPublishing ? (
              <View style={{ gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Event Organizer Disclaimer</Text>
                <Text style={{ color: colors.secondaryText, fontSize: 12, lineHeight: 18 }}>
                  I confirm that this is a genuine event that I am authorized to organize or publish. The dates, location, pricing, capacity, accessibility details, refund terms, organizer information, and description are accurate to the best of my knowledge. I will not use this event for fraud, unlawful activity, harassment, discrimination, exploitation, or unsafe conduct. I understand that identity verification does not mean Ourlime endorses this event. I accept responsibility for event operations, attendee safety, permissions, payments, refunds, licenses, and applicable requirements.
                </Text>
                <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: acceptedDisclaimer }} onPress={() => setAcceptedDisclaimer((value) => !value)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  {acceptedDisclaimer ? <SquareCheck size={20} color={colors.accent} /> : <Square size={20} color={colors.mutedText} />}
                  <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 18 }}>
                    I have read and agree to the Event Organizer Disclaimer, Events Policy, Community Guidelines, Privacy Policy, and Terms of Use.
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderTopWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={swipeDismiss.dismissWithAnimation}
              disabled={isSubmitting}
              style={{ paddingVertical: 10, paddingHorizontal: 16 }}
            >
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>

            {isEditing ? null : <TouchableOpacity
              onPress={() => void handleSaveProgress()}
              disabled={isSubmitting || !hasFormContent}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, opacity: hasFormContent ? 1 : 0.5 }}
              accessibilityLabel="Save progress"
            >
              <Save size={16} color={colors.icon} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Save progress</Text>
            </TouchableOpacity>}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor:'#01eb53',
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                opacity: !isValid || isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? <Save size={18} color="#000" /> : <Send size={18} color="#fff" />}
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : formData.status === 'draft' ? 'Save draft' : formData.status === 'scheduled' ? 'Schedule event' : 'Publish Event'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardSafeView>
      <DraftDiscardSheet
        visible={isDiscardSheetVisible}
        title="Leave event?"
        message="Save a draft on this device to finish it later, or discard what you've entered."
        onSaveDraft={() => {
          void draft.saveNow().then(() => {
            setIsDiscardSheetVisible(false);
            onClose();
          });
        }}
        onDiscard={() => {
          setIsDiscardSheetVisible(false);
          void draft.clear();
          resetForm();
          onClose();
        }}
        onContinue={() => setIsDiscardSheetVisible(false)}
      />
    </Modal>
  );
}
