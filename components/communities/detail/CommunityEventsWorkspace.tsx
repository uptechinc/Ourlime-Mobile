import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarDays, Edit3, Flag, ImagePlus, MapPin, Plus, Repeat2, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Event, MediaItem } from '@/types/eventTypes';
import type { ResourceState } from '@/lib/types/resourceState';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { communityMediaService } from '@/lib/services/CommunityMediaService';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';

export type CommunityEventDraft = { title: string; summary: string; startDate: string; endDate: string; location: string; recurrence: 'none' | 'daily' | 'weekly' | 'monthly'; imageUrl: string; media: MediaItem[] };
type CommunityEventsWorkspaceProps = { resource: ResourceState<Event[]>; canCreate: boolean; createRequestKey: number; onRetry: () => void; onCreate: (draft: CommunityEventDraft) => Promise<void>; onToggleAttendance: (eventId: string) => Promise<void>; onUpdate: (eventId: string, draft: CommunityEventDraft) => Promise<void>; onDelete: (eventId: string) => Promise<void>; onReport: (event: Event) => void };
const INITIAL_DRAFT: CommunityEventDraft = { title: '', summary: '', startDate: '', endDate: '', location: '', recurrence: 'none', imageUrl: '', media: [] };

export default function CommunityEventsWorkspace({ resource, canCreate, createRequestKey, onRetry, onCreate, onToggleAttendance, onUpdate, onDelete, onReport }: CommunityEventsWorkspaceProps) {
  const { colors } = useAppTheme();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CommunityEventDraft>(INITIAL_DRAFT);
  const [selectedMedia, setSelectedMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  const pickMedia = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setFeedback('Photo and video library permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.88, videoMaxDuration: 120 });
    if (!result.canceled && result.assets[0]) setSelectedMedia(result.assets[0]);
  };
  const beginCreate = (): void => { setEditingEventId(null); setDraft(INITIAL_DRAFT); setSelectedMedia(null); setCreating(true); };
  useEffect(() => {
    if (createRequestKey <= 0 || !canCreate) return;
    setEditingEventId(null);
    setDraft(INITIAL_DRAFT);
    setSelectedMedia(null);
    setCreating(true);
  }, [canCreate, createRequestKey]);
  const beginEdit = (event: Event): void => {
    if (!event.id) return;
    const recurrence: CommunityEventDraft['recurrence'] = event.recurrence === 'daily' || event.recurrence === 'weekly' || event.recurrence === 'monthly' ? event.recurrence : 'none';
    setEditingEventId(event.id); setDraft({ title: event.title, summary: event.summary, startDate: event.startDate, endDate: event.endDate, location: event.location, recurrence, imageUrl: event.image ?? '', media: event.media ?? [] }); setCreating(true);
  };
  const handleSave = async (): Promise<void> => {
    if (!draft.title.trim() || !draft.startDate.trim() || !draft.endDate.trim()) { setFeedback('Title, start date, and end date are required.'); return; }
    setBusy(true);
    try {
      const uploaded = selectedMedia ? await communityMediaService.uploadEventMedia(selectedMedia, setUploadProgress) : null;
      const uploadedMedia: MediaItem[] = uploaded ? [{ type: selectedMedia?.type === 'video' ? 'video' : 'image', url: uploaded.downloadUrl }] : [];
      const completed = { ...draft, imageUrl: uploadedMedia[0]?.type === 'image' ? uploadedMedia[0].url : draft.imageUrl, media: uploadedMedia.length ? uploadedMedia : draft.media };
      if (editingEventId) await onUpdate(editingEventId, completed); else await onCreate(completed);
      setCreating(false); setEditingEventId(null); setDraft(INITIAL_DRAFT); setSelectedMedia(null); setUploadProgress(0);
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

  if (!resource.data && (resource.status === 'hydrating' || resource.status === 'idle')) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />;
  if (!resource.data && resource.status === 'error') return <View style={{ padding: 28, alignItems: 'center' }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error?.message ?? 'Events could not be loaded.'}</Text><TouchableOpacity onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>;

  const fields: { key: 'title' | 'summary' | 'startDate' | 'endDate' | 'location' | 'imageUrl'; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'title', label: 'Title', placeholder: 'Community meetup' }, { key: 'summary', label: 'Description', placeholder: 'Tell members what to expect', multiline: true }, { key: 'startDate', label: 'Start', placeholder: '2026-08-20T18:00:00' }, { key: 'endDate', label: 'End', placeholder: '2026-08-20T20:00:00' }, { key: 'location', label: 'Location', placeholder: 'Venue or online' }, { key: 'imageUrl', label: 'Cover image URL', placeholder: 'https://…' },
  ];
  return <View style={{ margin: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><CalendarDays size={20} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontWeight: '900', fontSize: 18 }}>Community events</Text>{canCreate ? <TouchableOpacity onPress={beginCreate} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.accent }}><Plus size={15} color={colors.onAccent} /><Text style={{ marginLeft: 4, color: colors.onAccent, fontWeight: '900', fontSize: 12 }}>Host</Text></TouchableOpacity> : null}</View>
    {creating ? <View style={{ padding: 15, marginBottom: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{editingEventId ? 'Edit event' : 'Host an event'}</Text>{fields.map((field) => <View key={field.key} style={{ marginTop: 11 }}><Text style={{ marginBottom: 5, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>{field.label}</Text><TextInput value={draft[field.key]} onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} multiline={field.multiline} placeholder={field.placeholder} placeholderTextColor={colors.mutedText} style={{ minHeight: field.multiline ? 76 : 44, textAlignVertical: 'top', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} /></View>)}<TouchableOpacity onPress={() => void pickMedia()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}><ImagePlus size={19} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, fontWeight: '800' }}>{selectedMedia ? selectedMedia.fileName || 'Selected event media' : 'Choose photo or video'}</Text></TouchableOpacity>{busy && uploadProgress > 0 ? <Text style={{ marginTop: 6, color: colors.accentText, fontSize: 11 }}>Uploading {Math.round(uploadProgress * 100)}%</Text> : null}<Text style={{ marginTop: 12, marginBottom: 6, color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Recurrence</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(['none', 'daily', 'weekly', 'monthly'] as const).map((recurrence) => <TouchableOpacity key={recurrence} onPress={() => setDraft((current) => ({ ...current, recurrence }))} style={{ marginRight: 6, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: draft.recurrence === recurrence ? colors.selectedControl : colors.control }}><Text style={{ color: draft.recurrence === recurrence ? colors.selectedText : colors.secondaryText, fontWeight: '800', fontSize: 11, textTransform: 'capitalize' }}>{recurrence}</Text></TouchableOpacity>)}</View><View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><TouchableOpacity onPress={() => setCreating(false)} style={{ flex: 1, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontWeight: '900' }}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={() => void handleSave()} style={{ flex: 1.5, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>{editingEventId ? 'Save event' : 'Create event'}</Text>}</TouchableOpacity></View></View> : null}
    {resource.data?.length ? resource.data.map((event) => <View key={event.id} style={{ marginBottom: 13, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{event.image ? <CachedImage uri={event.image} recyclingKey={`community-event-${event.id}-${event.image}`} style={{ width: '100%', height: 145 }} contentFit="cover" /> : null}<View style={{ padding: 15 }}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' }}>{event.title}</Text>{event.id ? <TouchableOpacity onPress={() => onReport(event)} accessibilityLabel="Report event" style={{ padding: 7 }}><Flag size={17} color={colors.icon} /></TouchableOpacity> : null}</View><Text numberOfLines={3} style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 20 }}>{event.summary}</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><CalendarDays size={15} color={colors.accent} /><Text style={{ marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{new Date(event.startDate).toLocaleString()}</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}><MapPin size={15} color={colors.accent} /><Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, marginLeft: 6, color: colors.mutedText, fontSize: 12 }}>{linkPresentationService.compactUrlsInText(event.location)}</Text>{event.recurrence && event.recurrence !== 'none' ? <><Repeat2 size={14} color={colors.icon} style={{ marginLeft: 12 }} /><Text style={{ marginLeft: 4, color: colors.mutedText, fontSize: 11 }}>{event.recurrence}</Text></> : null}</View><TouchableOpacity disabled={busy || !event.id} onPress={() => { if (!event.id) return; setBusy(true); void onToggleAttendance(event.id).then(() => setFeedback(event.userRSVP ? 'You are no longer attending.' : 'You are attending this event.')).catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Attendance could not be updated.')).finally(() => setBusy(false)); }} style={{ marginTop: 13, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: event.userRSVP ? colors.selectedControl : colors.accent }}><Text style={{ color: event.userRSVP ? colors.selectedText : colors.onAccent, fontWeight: '900' }}>{event.userRSVP ? 'Going' : 'Attend'} · {event.attendeeCount ?? 0}</Text></TouchableOpacity>{event.id && (event.permissions?.canEdit || event.permissions?.canDelete) ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{event.permissions?.canEdit ? <TouchableOpacity onPress={() => beginEdit(event)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.control }}><Edit3 size={15} color={colors.icon} /><Text style={{ marginLeft: 5, color: colors.secondaryText, fontWeight: '800' }}>Edit</Text></TouchableOpacity> : null}{event.permissions?.canDelete ? <TouchableOpacity onPress={() => setDeleteEventId(event.id ?? null)} style={{ flex: 1, minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.destructiveSurface }}><Trash2 size={15} color={colors.destructive} /><Text style={{ marginLeft: 5, color: colors.destructiveText, fontWeight: '800' }}>Delete</Text></TouchableOpacity> : null}</View> : null}</View></View>) : <View style={{ alignItems: 'center', padding: 30 }}><CalendarDays size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No events scheduled</Text></View>}
    <CustomModal visible={Boolean(feedback)} title="Community event" message={feedback ?? ''} type="info" onClose={() => setFeedback(null)} />
    <CustomModal visible={Boolean(deleteEventId)} title="Delete event?" message="This event and its community activity entry will be permanently removed." type="danger" confirmText="Delete event" cancelText="Cancel" isLoading={busy} onConfirm={() => void handleDelete()} onCancel={() => setDeleteEventId(null)} onClose={() => setDeleteEventId(null)} />
  </View>;
}
