import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarDays, Crop, Edit3, Flag, ImagePlus, MapPin, Plus, Repeat2, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import MediaCropModal from '@/components/home/MiddleSection/MiddleSectionComponent/CreatePostModal/MediaCropModal';
import type { PendingImageCrop } from '@/lib/services/PostMediaService';
import type { PostMediaDraft } from '@/lib/services/PostService';
import type { Event, MediaItem } from '@/types/eventTypes';
import type { ResourceState } from '@/lib/types/resourceState';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EventsSkeleton } from '@/components/ui/Skeleton';
import { communityMediaService } from '@/lib/services/CommunityMediaService';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import DateTimeField from '@/components/ui/DateTimeField';

export type CommunityEventPollDraft = { question: string; options: string[] };
export type CommunityEventDraft = { title: string; summary: string; startDate: string; endDate: string; location: string; recurrence: 'none' | 'daily' | 'weekly' | 'monthly'; imageUrl: string; media: MediaItem[]; poll?: CommunityEventPollDraft | null };
type CommunityEventsWorkspaceProps = { resource: ResourceState<Event[]>; canCreate: boolean; canCreatePoll?: boolean; createRequestKey: number; onRetry: () => void; onCreate: (draft: CommunityEventDraft) => Promise<void>; onToggleAttendance: (eventId: string) => Promise<void>; onUpdate: (eventId: string, draft: CommunityEventDraft) => Promise<void>; onDelete: (eventId: string) => Promise<void>; onReport: (event: Event) => void };
const DEFAULT_EVENT_LENGTH_MS = 2 * 60 * 60 * 1000;
const DEFAULT_POLL_OPTIONS = ['Yes', 'No', 'Maybe'];
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 5;

/** Draft dates are ISO strings; empty or invalid ones read as null. */
function parseDraftDate(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const INITIAL_DRAFT: CommunityEventDraft = { title: '', summary: '', startDate: '', endDate: '', location: '', recurrence: 'none', imageUrl: '', media: [] };

export default function CommunityEventsWorkspace({ resource, canCreate, canCreatePoll = false, createRequestKey, onRetry, onCreate, onToggleAttendance, onUpdate, onDelete, onReport }: CommunityEventsWorkspaceProps) {
  const { colors } = useAppTheme();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CommunityEventDraft>(INITIAL_DRAFT);
  const [selectedMedia, setSelectedMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // The uncropped pick, so "Crop" always starts from the full image rather than a previous crop.
  const [originalMedia, setOriginalMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cropTarget, setCropTarget] = useState<PendingImageCrop | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollDraft, setPollDraft] = useState<CommunityEventPollDraft>({ question: '', options: DEFAULT_POLL_OPTIONS });
  const resetPoll = (): void => { setPollEnabled(false); setPollDraft({ question: '', options: DEFAULT_POLL_OPTIONS }); };
  const handleTogglePoll = (enabled: boolean): void => {
    setPollEnabled(enabled);
    if (enabled && !pollDraft.question.trim()) setPollDraft((current) => ({ ...current, question: draft.title.trim() ? `Are you going to ${draft.title.trim()}?` : 'Are you going?' }));
  };

  const pickMedia = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setFeedback('Photo and video library permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.88, videoMaxDuration: 120 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setSelectedMedia(asset);
    setOriginalMedia(asset);
    if (asset.type !== 'video') openCrop(asset);
  };
  const openCrop = (asset: ImagePicker.ImagePickerAsset): void => {
    setCropTarget({ asset, fileName: asset.fileName || `event-cover-${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
  };
  const handleCropped = (media: PostMediaDraft): void => {
    setSelectedMedia((current) => current ? { ...current, uri: media.uri, width: media.width ?? current.width, height: media.height ?? current.height, fileName: media.fileName, mimeType: media.mimeType ?? 'image/jpeg', fileSize: media.fileSize } : current);
    setCropTarget(null);
  };
  const clearSelectedMedia = (): void => { setSelectedMedia(null); setOriginalMedia(null); };
  const beginCreate = (): void => { setEditingEventId(null); setDraft(INITIAL_DRAFT); clearSelectedMedia(); resetPoll(); setCreating(true); };
  useEffect(() => {
    if (createRequestKey <= 0 || !canCreate) return;
    setEditingEventId(null);
    setDraft(INITIAL_DRAFT);
    setSelectedMedia(null);
    setOriginalMedia(null);
    resetPoll();
    setCreating(true);
  }, [canCreate, createRequestKey]);
  const beginEdit = (event: Event): void => {
    if (!event.id) return;
    const recurrence: CommunityEventDraft['recurrence'] = event.recurrence === 'daily' || event.recurrence === 'weekly' || event.recurrence === 'monthly' ? event.recurrence : 'none';
    setEditingEventId(event.id); setDraft({ title: event.title, summary: event.summary, startDate: event.startDate, endDate: event.endDate, location: event.location, recurrence, imageUrl: event.image ?? '', media: event.media ?? [] }); setCreating(true);
  };
  const handleSave = async (): Promise<void> => {
    const start = parseDraftDate(draft.startDate);
    const end = parseDraftDate(draft.endDate);
    if (!draft.title.trim()) { setFeedback('Give your event a title.'); return; }
    if (!start) { setFeedback('Pick a start date and time.'); return; }
    if (!end) { setFeedback('Pick an end date and time.'); return; }
    if (end <= start) { setFeedback('The end must be after the start.'); return; }
    const includePoll = pollEnabled && !editingEventId;
    const pollOptions = pollDraft.options.map((option) => option.trim()).filter(Boolean);
    if (includePoll && !pollDraft.question.trim()) { setFeedback('Add a question for the event poll.'); return; }
    if (includePoll && pollOptions.length < MIN_POLL_OPTIONS) { setFeedback('The event poll needs at least two options.'); return; }
    setBusy(true);
    try {
      const uploaded = selectedMedia ? await communityMediaService.uploadEventMedia(selectedMedia, setUploadProgress) : null;
      const uploadedMedia: MediaItem[] = uploaded ? [{ type: selectedMedia?.type === 'video' ? 'video' : 'image', url: uploaded.downloadUrl }] : [];
      const completed: CommunityEventDraft = { ...draft, imageUrl: uploadedMedia[0]?.type === 'image' ? uploadedMedia[0].url : draft.imageUrl, media: uploadedMedia.length ? uploadedMedia : draft.media, poll: includePoll ? { question: pollDraft.question.trim(), options: pollOptions } : null };
      if (editingEventId) await onUpdate(editingEventId, completed); else await onCreate(completed);
      setCreating(false); setEditingEventId(null); setDraft(INITIAL_DRAFT); clearSelectedMedia(); resetPoll(); setUploadProgress(0);
    } catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Event could not be saved.'); }
    finally { setBusy(false); }
  };
  const handleDelete = async (): Promise<void> => {
    if (!deleteEventId) return;
    setBusy(true);
    try { await onDelete(deleteEventId); setDeleteEventId(null); }
    catch (error: unknown) { setFeedback(error instanceof Error ? error.message : 'Event could not be deleted.'); }
    finally { setBusy(false); }
  };

  if (!resource.data && (resource.status === 'hydrating' || resource.status === 'idle')) return <View style={{ margin: 16 }}><EventsSkeleton /></View>;
  if (!resource.data && resource.status === 'error') return <View style={{ padding: 28, alignItems: 'center' }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error?.message ?? 'Events could not be loaded.'}</Text><TouchableOpacity onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>;

  const fields: { key: 'title' | 'summary' | 'location' | 'imageUrl'; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'title', label: 'Title', placeholder: 'Community meetup' }, { key: 'summary', label: 'Description', placeholder: 'Tell members what to expect', multiline: true }, { key: 'location', label: 'Location', placeholder: 'Venue or online' }, { key: 'imageUrl', label: 'Cover image URL', placeholder: 'https://…' },
  ];
  return <View style={{ margin: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><CalendarDays size={20} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontWeight: '900', fontSize: 18 }}>Community events</Text>{canCreate ? <TouchableOpacity onPress={beginCreate} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.accent }}><Plus size={15} color={colors.onAccent} /><Text style={{ marginLeft: 4, color: colors.onAccent, fontWeight: '900', fontSize: 12 }}>Host</Text></TouchableOpacity> : null}</View>
    {creating ? <View style={{ padding: 15, marginBottom: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{editingEventId ? 'Edit event' : 'Host an event'}</Text>{fields.filter((field) => field.key === 'title' || field.key === 'summary').map((field) => <View key={field.key} style={{ marginTop: 11 }}><Text style={{ marginBottom: 5, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>{field.label}</Text><TextInput value={draft[field.key]} onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} multiline={field.multiline} placeholder={field.placeholder} placeholderTextColor={colors.mutedText} style={{ minHeight: field.multiline ? 76 : 44, textAlignVertical: 'top', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} /></View>)}<View style={{ marginTop: 11, gap: 11 }}><DateTimeField label="Start" required mode="datetime" placeholder="Pick a start date and time" value={parseDraftDate(draft.startDate)} minimumDate={editingEventId ? undefined : new Date()} onChange={(start) => setDraft((current) => { const end = parseDraftDate(current.endDate); const nextEnd = !end || end <= start ? new Date(start.getTime() + DEFAULT_EVENT_LENGTH_MS) : end; return { ...current, startDate: start.toISOString(), endDate: nextEnd.toISOString() }; })} /><DateTimeField label="End" required mode="datetime" placeholder="Pick an end date and time" value={parseDraftDate(draft.endDate)} minimumDate={parseDraftDate(draft.startDate) ?? undefined} onChange={(end) => setDraft((current) => ({ ...current, endDate: end.toISOString() }))} /></View>{fields.filter((field) => field.key === 'location' || field.key === 'imageUrl').map((field) => <View key={field.key} style={{ marginTop: 11 }}><Text style={{ marginBottom: 5, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>{field.label}</Text><TextInput value={draft[field.key]} onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} multiline={field.multiline} placeholder={field.placeholder} placeholderTextColor={colors.mutedText} style={{ minHeight: field.multiline ? 76 : 44, textAlignVertical: 'top', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} /></View>)}{selectedMedia ? <View style={{ marginTop: 12, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}>{selectedMedia.type === 'video' ? <View style={{ height: 64, alignItems: 'center', justifyContent: 'center' }}><Text numberOfLines={1} style={{ color: colors.secondaryText, fontWeight: '800' }}>{selectedMedia.fileName || 'Selected event video'}</Text></View> : <Image source={{ uri: selectedMedia.uri }} style={{ width: '100%', aspectRatio: selectedMedia.width && selectedMedia.height ? Math.max(0.8, Math.min(2, selectedMedia.width / selectedMedia.height)) : 1.6 }} contentFit="cover" accessibilityLabel="Event cover preview" />}<View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>{selectedMedia.type !== 'video' && originalMedia ? <TouchableOpacity disabled={busy} onPress={() => openCrop(originalMedia)} accessibilityLabel="Crop event cover" style={{ flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface }}><Crop size={15} color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.secondaryText, fontWeight: '800' }}>Crop</Text></TouchableOpacity> : null}<TouchableOpacity disabled={busy} onPress={() => void pickMedia()} accessibilityLabel="Replace event media" style={{ flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface }}><ImagePlus size={15} color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.secondaryText, fontWeight: '800' }}>Replace</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={clearSelectedMedia} accessibilityLabel="Remove event media" style={{ minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface }}><X size={15} color={colors.icon} /></TouchableOpacity></View></View> : <TouchableOpacity onPress={() => void pickMedia()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}><ImagePlus size={19} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, fontWeight: '800' }}>Choose photo or video</Text></TouchableOpacity>}{busy && uploadProgress > 0 ? <Text style={{ marginTop: 6, color: colors.accentText, fontSize: 11 }}>Uploading {Math.round(uploadProgress * 100)}%</Text> : null}<Text style={{ marginTop: 12, marginBottom: 6, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Recurrence</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(['none', 'daily', 'weekly', 'monthly'] as const).map((recurrence) => <TouchableOpacity key={recurrence} onPress={() => setDraft((current) => ({ ...current, recurrence }))} style={{ marginRight: 6, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: draft.recurrence === recurrence ? colors.selectedControl : colors.control }}><Text style={{ color: draft.recurrence === recurrence ? colors.selectedText : colors.secondaryText, fontWeight: '800', fontSize: 11, textTransform: 'capitalize' }}>{recurrence}</Text></TouchableOpacity>)}</View>{canCreatePoll && !editingEventId ? <EventPollFields enabled={pollEnabled} poll={pollDraft} disabled={busy} onToggle={handleTogglePoll} onChange={setPollDraft} /> : null}<View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><TouchableOpacity onPress={() => setCreating(false)} style={{ flex: 1, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={() => void handleSave()} style={{ flex: 1.5, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>{editingEventId ? 'Save event' : 'Create event'}</Text>}</TouchableOpacity></View></View> : null}
    {resource.data?.length ? resource.data.map((event) => <View key={event.id} style={{ marginBottom: 13, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{event.image ? <CachedImage uri={event.image} recyclingKey={`community-event-${event.id}-${event.image}`} style={{ width: '100%', height: 145 }} contentFit="cover" /> : null}<View style={{ padding: 15 }}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' }}>{event.title}</Text>{event.id ? <TouchableOpacity onPress={() => onReport(event)} accessibilityLabel="Report event" style={{ padding: 7 }}><Flag size={17} color={colors.icon} /></TouchableOpacity> : null}</View><Text numberOfLines={3} style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 20 }}>{event.summary}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><CalendarDays size={15} color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{new Date(event.startDate).toLocaleString()}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}><MapPin size={15} color={colors.accent} /><Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{linkPresentationService.compactUrlsInText(event.location)}</Text>{event.recurrence && event.recurrence !== 'none' ? <><Repeat2 size={14} color={colors.icon} style={{ marginLeft: 12 }} /><Text style={{ marginLeft: 4, color: colors.mutedText, fontSize: 11 }}>{event.recurrence}</Text></> : null}</View><TouchableOpacity disabled={busy || !event.id} onPress={() => { if (!event.id) return; setBusy(true); void onToggleAttendance(event.id).then(() => setFeedback(event.userRSVP ? 'You are no longer attending.' : 'You are attending this event.')).catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Attendance could not be updated.')).then(() => setBusy(false)); }} style={{ marginTop: 13, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: event.userRSVP ? colors.selectedControl : colors.accent }}><Text style={{ color: event.userRSVP ? colors.selectedText : colors.onAccent, fontWeight: '900' }}>{event.userRSVP ? 'Going' : 'Attend'} · {event.attendeeCount ?? 0}</Text></TouchableOpacity>{event.id && (event.permissions?.canEdit || event.permissions?.canDelete) ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{event.permissions?.canEdit ? <TouchableOpacity onPress={() => beginEdit(event)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.control }}><Edit3 size={15} color={colors.icon} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800' }}>Edit</Text></TouchableOpacity> : null}{event.permissions?.canDelete ? <TouchableOpacity onPress={() => setDeleteEventId(event.id ?? null)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.destructiveSurface }}><Trash2 size={15} color={colors.destructive} /><Text style={{ marginLeft: 5, color: colors.destructiveText, fontWeight: '800' }}>Delete</Text></TouchableOpacity> : null}</View> : null}</View></View>) : <View style={{ alignItems: 'center', padding: 30 }}><CalendarDays size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No events scheduled</Text></View>}
    {cropTarget ? <MediaCropModal pending={cropTarget} queueLength={1} onCancel={() => setCropTarget(null)} onComplete={handleCropped} /> : null}
    <CustomModal visible={Boolean(feedback)} title="Community event" message={feedback ?? ''} type="info" onClose={() => setFeedback(null)} />
    <CustomModal visible={Boolean(deleteEventId)} title="Delete event?" message="This event and its community activity entry will be permanently removed." type="danger" confirmText="Delete event" cancelText="Cancel" isLoading={busy} onConfirm={() => void handleDelete()} onCancel={() => setDeleteEventId(null)} onClose={() => setDeleteEventId(null)} />
  </View>;
}

type EventPollFieldsProps = { enabled: boolean; poll: CommunityEventPollDraft; disabled: boolean; onToggle: (enabled: boolean) => void; onChange: (poll: CommunityEventPollDraft) => void };

/** Optional poll attached to a new event; voting closes when the event starts. */
function EventPollFields({ enabled, poll, disabled, onToggle, onChange }: EventPollFieldsProps) {
  const { colors } = useAppTheme();
  const inputStyle = { minHeight: 42, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };
  const updateOption = (index: number, value: string): void => onChange({ ...poll, options: poll.options.map((option, optionIndex) => optionIndex === index ? value : option) });
  const removeOption = (index: number): void => onChange({ ...poll, options: poll.options.filter((_, optionIndex) => optionIndex !== index) });
  const addOption = (): void => onChange({ ...poll, options: [...poll.options, ''] });
  return <View style={{ marginTop: 6 }}>
    <Text style={{ marginBottom: 6, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Add a poll?</Text>
    <View style={{ flexDirection: 'row', gap: 6 }}>{([false, true] as const).map((value) => <Pressable key={String(value)} disabled={disabled} onPress={() => onToggle(value)} accessibilityRole="button" accessibilityState={{ selected: enabled === value }} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: enabled === value ? colors.selectedControl : colors.control }}><Text style={{ color: enabled === value ? colors.selectedText : colors.secondaryText, fontWeight: '800', fontSize: 11 }}>{value ? 'Yes' : 'No'}</Text></Pressable>)}</View>
    {enabled ? <View style={{ marginTop: 10, gap: 8 }}>
      <TextInput value={poll.question} onChangeText={(question) => onChange({ ...poll, question })} editable={!disabled} placeholder="Ask members something about this event" placeholderTextColor={colors.mutedText} maxLength={200} style={inputStyle} />
      {poll.options.map((option, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput value={option} onChangeText={(value) => updateOption(index, value)} editable={!disabled} placeholder={`Option ${index + 1}`} placeholderTextColor={colors.mutedText} maxLength={80} style={[inputStyle, { flex: 1 }]} />
        {poll.options.length > MIN_POLL_OPTIONS ? <TouchableOpacity disabled={disabled} onPress={() => removeOption(index)} accessibilityLabel={`Remove option ${index + 1}`} style={{ padding: 8 }}><X size={16} color={colors.icon} /></TouchableOpacity> : null}
      </View>)}
      {poll.options.length < MAX_POLL_OPTIONS ? <TouchableOpacity disabled={disabled} onPress={addOption} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4 }}><Plus size={14} color={colors.accent} /><Text style={{ marginLeft: 4, color: colors.accentText, fontWeight: '800', fontSize: 12 }}>Add option</Text></TouchableOpacity> : null}
      <Text style={{ color: colors.mutedText, fontSize: 11 }}>Voting closes when the event starts.</Text>
    </View> : null}
  </View>;
}
