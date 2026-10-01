import { useEffect, useRef, useState } from 'react';
import type { TeamMember } from '@/lib/types/project';
import { Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MarketFormModal, { MarketButton, MarketField, MarketListField } from '@/components/market/MarketFormModal';
import { useContentDrafts } from '@/lib/hooks/useContentDrafts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';

type ContentDraftModalProps = { ownerId: string; kind: 'blog' | 'task'; projectId?: string; teamMembers?: TeamMember[]; onClose: () => void; onPublished?: () => void };
export default function ContentDraftModal({ ownerId, kind, projectId, teamMembers = [], onClose, onPublished }: ContentDraftModalProps) {
  const editor = useContentDrafts(ownerId, kind, projectId);
  const { colors } = useAppTheme();
  const { getDecision } = usePageAccess();
  const canPublish = getDecision(kind === 'blog' ? '/blogs' : '/projectManagement').canMutate;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const initializedTaskDraft = useRef(false);
  const createDraftRef = useRef(editor.create);
  createDraftRef.current = editor.create;
  const draft = editor.selected;
  const action = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Action failed. Your draft is retained.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (kind !== 'task' || initializedTaskDraft.current) return;
    initializedTaskDraft.current = true;
    setBusy(true);
    setError('');
    void createDraftRef.current().catch((failure: unknown) => {
      setError(failure instanceof Error ? failure.message : 'Task draft could not be created.');
    }).finally(() => setBusy(false));
  }, [kind]);
  return <MarketFormModal visible busy={busy} title={kind === 'blog' ? 'Blog drafts' : 'Task drafts'} onClose={() => void action(async () => { await editor.flush(); onClose(); })}>
    <Text style={{ color: colors.secondaryText }}>{editor.status.replaceAll('_', ' ')}{draft ? ` · ${draft.lastSavedAt}` : ''}</Text>
    {error || editor.error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error || editor.error}</Text> : null}
    {!draft ? <>
      <MarketButton label="Create another draft" disabled={busy} onPress={() => void action(editor.create)} />
      <MarketButton label="Refresh / sync drafts" disabled={busy} onPress={() => void action(editor.sync)} />
      {editor.drafts.map((entry) => <View key={entry.id} style={{ gap: 8 }}><Text style={{ color: colors.text }}>{entry.name}{entry.conflictOf ? ' · Recovered conflict copy' : ''}</Text><MarketButton label="Resume" onPress={() => void action(() => editor.select(entry))} /><MarketButton label="Delete draft" onPress={() => void action(() => editor.remove(entry))} /></View>)}
    </> : <View style={{ gap: 16 }}>
      <MarketField label="Private draft name" value={draft.name} onChangeText={(name) => editor.update({ ...draft, name })} />
      <MarketField label="Title" value={draft.payload.title} onChangeText={(title) => editor.update(draft.kind === 'blog' ? { ...draft, payload: { ...draft.payload, title } } : { ...draft, payload: { ...draft.payload, title } })} />
      {draft.kind === 'blog' ? <>
        <MarketButton label={`Type: ${draft.payload.type} (tap to switch)`} onPress={() => editor.update({ ...draft, payload: { ...draft.payload, type: draft.payload.type === 'blog' ? 'article' : 'blog' } })} />
        {(['excerpt', 'content', 'categoryId', 'coverImage'] as const).map((field) => <MarketField key={field} label={field} value={draft.payload[field]} multiline={field === 'content' || field === 'excerpt'} onChangeText={(value) => editor.update({ ...draft, payload: { ...draft.payload, [field]: value } })} />)}
        <MarketField label="Reading time (minutes)" value={String(draft.payload.readTime)} keyboardType="numeric" onChangeText={(value) => editor.update({ ...draft, payload: { ...draft.payload, readTime: Number(value) || 0 } })} />
        <MarketButton label="Choose cover image" disabled={busy} onPress={() => void action(async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
          if (result.canceled || !result.assets[0]) return;
          const coverImage = await BlogsAndArticlesService.getInstance().uploadCoverImage(result.assets[0].uri);
          editor.update({ ...draft, payload: { ...draft.payload, coverImage } });
        })} />
        {draft.payload.sources.map((source, index) => <View key={index} style={{ gap: 8 }}>
          {(['title', 'url', 'author', 'publishDate', 'type', 'citation'] as const).map((field) => <MarketField key={field} label={`Source ${index + 1}: ${field}`} value={source[field]} onChangeText={(value) => editor.update({ ...draft, payload: { ...draft.payload, sources: draft.payload.sources.map((entry, position) => position === index ? { ...entry, [field]: value } : entry) } })} />)}
          <MarketButton label="Remove source" onPress={() => editor.update({ ...draft, payload: { ...draft.payload, sources: draft.payload.sources.filter((_, position) => position !== index) } })} />
        </View>)}
        <MarketButton label="Add source" onPress={() => editor.update({ ...draft, payload: { ...draft.payload, sources: [...draft.payload.sources, { title: '', url: '', author: '', publishDate: '', type: 'website', citation: '', isVerified: false }] } })} />
      </> : <>
        <MarketField label="Description" multiline value={draft.payload.description} onChangeText={(description) => editor.update({ ...draft, payload: { ...draft.payload, description } })} />
        {(['todo', 'in-progress', 'done'] as const).map((status) => <MarketButton key={status} label={`${draft.payload.status === status ? 'Selected: ' : ''}${status}`} onPress={() => editor.update({ ...draft, payload: { ...draft.payload, status } })} />)}
        {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => <MarketButton key={priority} label={`${draft.payload.priority === priority ? 'Selected: ' : ''}${priority}`} onPress={() => editor.update({ ...draft, payload: { ...draft.payload, priority } })} />)}
        <Text style={{ color: colors.text }}>Assign to project members</Text>
        {teamMembers.filter((member) => member.isOwner || member.membershipStatus === 'accepted').map((member) => <MarketButton key={member.id} label={`${draft.payload.assignees.includes(member.id) ? 'Selected: ' : ''}${member.name}`} onPress={() => {
          const assignees = draft.payload.assignees.includes(member.id) ? draft.payload.assignees.filter((id) => id !== member.id) : [...draft.payload.assignees, member.id];
          editor.update({ ...draft, payload: { ...draft.payload, assignees, assignee: assignees[0] ?? '' } });
        }} />)}
        <MarketField label="Due date (ISO date, optional)" value={draft.payload.dueDate ?? ''} onChangeText={(value) => editor.update({ ...draft, payload: { ...draft.payload, dueDate: value || null } })} />
        <MarketField label="Estimated time" value={String(draft.payload.estimatedTime)} keyboardType="numeric" onChangeText={(value) => editor.update({ ...draft, payload: { ...draft.payload, estimatedTime: Number(value) || 0 } })} />
      </>}
      <MarketListField key={draft.id} label="Tags (comma separated)" values={draft.payload.tags} onChange={(tags) => {
        editor.update(draft.kind === 'blog' ? { ...draft, payload: { ...draft.payload, tags } } : { ...draft, payload: { ...draft.payload, tags } });
      }} />
      <MarketButton label="Save Draft" disabled={busy} onPress={() => void action(editor.sync)} />
      <MarketButton label="Back to drafts" disabled={busy} onPress={() => void action(() => editor.select(null))} />
      <MarketButton label="Publish" disabled={busy || !canPublish} onPress={() => void action(async () => { await editor.publish(); onPublished?.(); onClose(); })} />
    </View>}
  </MarketFormModal>;
}
