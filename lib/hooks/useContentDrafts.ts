import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { contentDraftService } from '@/lib/services/ContentDraftService';
import type { ContentDraft, SyncStatus } from '@/lib/types/reliability';

export function useContentDrafts(ownerId: string, kind: 'blog' | 'task', projectId?: string) {
  const saveLocal = useMemo(() => contentDraftService.createLocalWriter(ownerId), [ownerId]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selected, setSelected] = useState<ContentDraft | null>(null);
  const [status, setStatus] = useState<SyncStatus>('saved_on_device');
  const [error, setError] = useState('');
  const current = useRef<ContentDraft | null>(null);
  const editGeneration = useRef(0);
  const savedGeneration = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    const list = await contentDraftService.list(ownerId);
    if (alive.current) setDrafts(list.filter((draft) => draft.kind === kind && (kind === 'blog' || draft.projectId === projectId)));
  }, [kind, ownerId, projectId]);
  const flush = useCallback(async () => {
    if (saving.current) await saving.current;
    const operation = (async () => {
      while (current.current && editGeneration.current !== savedGeneration.current) {
        const draft = current.current;
        const generation = editGeneration.current;
        if (alive.current) setStatus('saving');
        const saved = await saveLocal(draft);
        if (current.current?.id === draft.id) {
          // A completed disk write updates version fields only; never replace newer keystrokes.
          current.current = { ...current.current, id: saved.id, editId: saved.editId, revision: saved.revision, localRevision: saved.localRevision, lastSavedAt: saved.lastSavedAt, conflictOf: saved.conflictOf, operationId: saved.operationId };
          savedGeneration.current = generation;
          if (alive.current) setSelected(current.current);
        }
      }
      if (alive.current) { setStatus('saved_on_device'); setError(''); }
      if (alive.current) await refresh();
    })();
    saving.current = operation;
    try { await operation; }
    catch (failure: unknown) { if (alive.current) { setStatus('failed'); setError(failure instanceof Error ? failure.message : 'Draft could not be saved.'); } throw failure; }
    finally { if (saving.current === operation) saving.current = null; }
  }, [refresh, saveLocal]);
  const sync = useCallback(async () => {
    await flush();
    setStatus('syncing');
    try {
      const result = await contentDraftService.sync(ownerId);
      await refresh();
      if (alive.current) { setStatus(result.conflicts ? 'conflict' : result.pending ? 'saved_on_device' : 'synced'); if (result.conflicts) setError('Another device edited this draft. Both versions were retained in your draft list.'); }
    } catch (failure: unknown) {
      if (alive.current) { setStatus('offline'); setError(failure instanceof Error ? failure.message : 'Saved on device; synchronization will retry.'); }
    }
  }, [flush, ownerId, refresh]);
  useEffect(() => {
    alive.current = true;
    void contentDraftService.migrateLegacy(ownerId).then(refresh).then(() => contentDraftService.sync(ownerId)).then(refresh).catch((failure: unknown) => { if (alive.current) setError(failure instanceof Error ? failure.message : 'Drafts could not be restored.'); });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync().catch(() => {});
      else void flush().catch(() => {});
    });
    const interval = setInterval(() => { if (AppState.currentState === 'active') void sync().catch(() => {}); }, 30000);
    return () => { alive.current = false; clearInterval(interval); subscription.remove(); void flush().catch(() => {}); };
  }, [flush, ownerId, refresh, sync]);
  const selectedPayload = selected?.payload;
  const selectedName = selected?.name;
  useEffect(() => {
    if (!selectedPayload) return;
    const timer = setTimeout(() => { void sync().catch(() => {}); }, 1000);
    return () => clearTimeout(timer);
  }, [selectedPayload, selectedName, sync]);
  const select = async (draft: ContentDraft | null) => {
    await flush();
    current.current = draft;
    editGeneration.current = 0; savedGeneration.current = 0;
    setSelected(draft); setError('');
  };
  const update = (draft: ContentDraft) => {
    current.current = draft; ++editGeneration.current;
    setSelected(draft); setStatus('saving');
  };
  const create = async () => {
    await flush();
    const draft = kind === 'blog'
      ? await contentDraftService.create(ownerId, 'blog', { title: '', type: 'blog', excerpt: '', content: '', coverImage: '', categoryId: 'technology', readTime: 0, tags: [], sources: [] })
      : await contentDraftService.create(ownerId, 'task', { title: '', description: '', status: 'todo', priority: 'medium', assignee: ownerId, assignees: [ownerId], dueDate: null, estimatedTime: 1, tags: [] }, projectId ?? '');
    await select(draft); await refresh();
  };
  const publish = async () => {
    await flush();
    if (!current.current) throw new Error('Select a draft to publish.');
    const receipt = await contentDraftService.publish(current.current);
    current.current = null; setSelected(null); await refresh();
    return receipt;
  };
  const remove = async (draft: ContentDraft) => {
    await contentDraftService.remove(draft);
    if (current.current?.id === draft.id) await select(null);
    await refresh();
  };
  return { drafts, selected, status, error, select, update, create, flush, sync, publish, remove };
}
