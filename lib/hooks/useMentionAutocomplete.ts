import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';
import { findActiveMention, insertMention } from '@/lib/helpers/mentionText';
import { mentionService, type MentionCandidate } from '@/lib/services/MentionService';

const SEARCH_DEBOUNCE_MS = 220;

type TextSelection = { start: number; end: number };

type UseMentionAutocompleteOptions = {
  value: string;
  onChangeText: (text: string) => void;
  /** Turn the picker off (for example while the composer is hidden). */
  enabled?: boolean;
};

type UseMentionAutocompleteResult = {
  suggestions: MentionCandidate[];
  /** A member search is still running (friends are already listed). */
  isSearching: boolean;
  /** Pass to the TextInput's onFocus / onBlur: the list is only shown while the box is focused. */
  handleFocus: () => void;
  handleBlur: () => void;
  /** Pass to the TextInput's onSelectionChange. */
  handleSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void;
  /** Pass to the TextInput's selection: only set for one moment, right after a mention is inserted. */
  selection: TextSelection | undefined;
  handleSelectSuggestion: (person: MentionCandidate) => void;
};

/**
 * "@" autocomplete for a plain TextInput (comments, replies, captions). Friends show instantly, other members after a
 * short pause. Choosing a person writes "@userName " at the "@" and moves the cursor after it.
 */
export function useMentionAutocomplete({ value, onChangeText, enabled = true }: UseMentionAutocompleteOptions): UseMentionAutocompleteResult {
  const [cursor, setCursor] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [forcedSelection, setForcedSelection] = useState<TextSelection | undefined>(undefined);
  const [friends, setFriends] = useState<MentionCandidate[]>([]);
  const [hasLoadedFriends, setHasLoadedFriends] = useState(false);
  const [members, setMembers] = useState<{ query: string; results: MentionCandidate[] }>({ query: '', results: [] });
  const [isSearching, setIsSearching] = useState(false);

  // The cursor event follows the text change by a moment; findActiveMention clamps a stale cursor to the text.
  const activeMention = useMemo(() => (enabled && isFocused ? findActiveMention(value, cursor) : null), [cursor, enabled, isFocused, value]);
  const query = activeMention?.query ?? null;
  const isMentioning = query !== null;

  // Load the friends as soon as the composer is there (cached for a few minutes), so the first "@" lists them at once.
  useEffect(() => {
    if (!enabled) return;
    let isCurrent = true;
    void mentionService.getFriends().then((loaded) => {
      if (!isCurrent) return;
      setFriends(loaded);
      setHasLoadedFriends(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [enabled]);

  const friendMatches = useMemo(() => (query === null ? [] : mentionService.matchFriends(friends, query)), [friends, query]);

  // Other members: only once something is typed after the "@", and after a short pause.
  useEffect(() => {
    if (query === null || query.length < 1) {
      setIsSearching(false);
      return;
    }
    let isCurrent = true;
    setIsSearching(true);
    const timer = setTimeout(() => {
      void mentionService.searchMembers(query, friends).then((results) => {
        if (!isCurrent) return;
        setMembers({ query, results });
        setIsSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [friends, query]);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const memberResults = members.query === query ? members.results : [];
    return mentionService.combine(friendMatches, memberResults);
  }, [friendMatches, members, query]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const handleSelectionChange = useCallback((event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setCursor(event.nativeEvent.selection.end);
    setForcedSelection(undefined);
  }, []);

  const handleSelectSuggestion = useCallback((person: MentionCandidate) => {
    if (!activeMention) return;
    const next = insertMention(value, activeMention, person.userName);
    onChangeText(next.text);
    setCursor(next.cursor);
    setForcedSelection({ start: next.cursor, end: next.cursor });
    setMembers({ query: '', results: [] });
  }, [activeMention, onChangeText, value]);

  // Show "Searching…" while the friends are still loading or the member search is running.
  const isLoading = isMentioning && (!hasLoadedFriends || isSearching);

  return { suggestions, isSearching: isLoading, handleFocus, handleBlur, handleSelectionChange, selection: forcedSelection, handleSelectSuggestion };
}
