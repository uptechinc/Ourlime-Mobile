import { useCallback, useEffect, useRef, useState } from 'react';
import { localFormDraftService, type LocalFormDraftKind } from '@/lib/services/LocalFormDraftService';

type UseLocalFormDraftOptions<T> = {
  ownerId: string | null | undefined;
  kind: LocalFormDraftKind;
  scopeId?: string;
  /** Current form values. */
  data: T;
  /** Whether the form has anything worth keeping (empty forms are never saved). */
  hasContent: boolean;
  /** Load/auto-save only while the form is open. */
  enabled: boolean;
  autosaveDelayMs?: number;
};

type UseLocalFormDraftResult<T> = {
  /** A saved draft exists that hasn't been restored or discarded yet. */
  savedDraft: T | null;
  savedAt: string | null;
  lastSavedAt: string | null;
  saveNow: () => Promise<void>;
  /** Hands back the saved data and starts auto-saving over it. */
  restore: () => T | null;
  discard: () => Promise<void>;
  /** After a successful submit. */
  clear: () => Promise<void>;
};

/**
 * Auto-saving on-device draft for a form (events, job listings, job applications): loads any saved draft when the
 * form opens, offers it for restore, and saves the form a moment after each change.
 */
export function useLocalFormDraft<T>({
  ownerId,
  kind,
  scopeId,
  data,
  hasContent,
  enabled,
  autosaveDelayMs = 2000,
}: UseLocalFormDraftOptions<T>): UseLocalFormDraftResult<T> {
  const [savedDraft, setSavedDraft] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  // Don't overwrite an unanswered saved draft until the user restores or discards it.
  const [isDecisionPending, setIsDecisionPending] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!enabled || !ownerId) return;
    let active = true;
    void localFormDraftService.load<T>(ownerId, kind, scopeId).then((draft) => {
      if (!active) return;
      setSavedDraft(draft?.data ?? null);
      setSavedAt(draft?.savedAt ?? null);
      setIsDecisionPending(Boolean(draft));
    });
    return () => {
      active = false;
    };
  }, [enabled, kind, ownerId, scopeId]);

  const saveNow = useCallback(async () => {
    if (!ownerId) return;
    const draft = await localFormDraftService.save(ownerId, kind, dataRef.current, scopeId);
    setLastSavedAt(draft.savedAt);
  }, [kind, ownerId, scopeId]);

  const serialized = JSON.stringify(data);
  useEffect(() => {
    if (!enabled || !ownerId || !hasContent || isDecisionPending) return;
    const timer = setTimeout(() => { void saveNow(); }, autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [autosaveDelayMs, enabled, hasContent, isDecisionPending, ownerId, saveNow, serialized]);

  const restore = useCallback((): T | null => {
    const draft = savedDraft;
    setSavedDraft(null);
    setIsDecisionPending(false);
    return draft;
  }, [savedDraft]);

  const discard = useCallback(async () => {
    setSavedDraft(null);
    setIsDecisionPending(false);
    if (ownerId) await localFormDraftService.clear(ownerId, kind, scopeId);
  }, [kind, ownerId, scopeId]);

  const clear = useCallback(async () => {
    setSavedDraft(null);
    setIsDecisionPending(false);
    setLastSavedAt(null);
    if (ownerId) await localFormDraftService.clear(ownerId, kind, scopeId);
  }, [kind, ownerId, scopeId]);

  return { savedDraft, savedAt, lastSavedAt, saveNow, restore, discard, clear };
}
