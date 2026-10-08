import { useCallback, useEffect, useRef, useState } from 'react';

export type LikeState = { liked: boolean; count: number };

/** What the server confirmed; `likeCount` is null when the call doesn't return a count (it's then adjusted by ±1). */
export type LikeSyncResult = { liked: boolean; likeCount: number | null };

type UseLikeSyncOptions = {
  liked: boolean;
  count: number;
  /** Sets the like to exactly this state on the server (never "toggle"). */
  send: (liked: boolean) => Promise<LikeSyncResult>;
  /** Called once the server matches the screen (not on every tap), e.g. to update caches. */
  onSettled?: (state: LikeState) => void;
  onError?: (error: unknown) => void;
};

type LikeSyncControls = LikeState & {
  /** Heart button: flips the like. */
  toggle: () => void;
  /** Double-tap: only ever likes, never unlikes. */
  like: () => void;
};

const countFor = (liked: boolean, confirmedLiked: boolean, confirmedCount: number): number =>
  Math.max(0, confirmedCount + (liked === confirmedLiked ? 0 : liked ? 1 : -1));

/**
 * Likes that stay correct under rapid taps: each tap only changes the wanted state and the number shown (±1 from the
 * last server-confirmed state). One request runs at a time and sends the latest wanted state; server counts are only
 * applied once nothing is pending, so late replies can't make the number jump up and down.
 */
export function useLikeSync({ liked: initialLiked, count: initialCount, send, onSettled, onError }: UseLikeSyncOptions): LikeSyncControls {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const desiredRef = useRef(initialLiked);
  const confirmedLikedRef = useRef(initialLiked);
  const confirmedCountRef = useRef(initialCount);
  const syncingRef = useRef(false);
  const sendRef = useRef(send);
  const onSettledRef = useRef(onSettled);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    sendRef.current = send;
    onSettledRef.current = onSettled;
    onErrorRef.current = onError;
  }, [send, onSettled, onError]);

  // Fresh data from the feed replaces the confirmed state, unless a tap is still being synced.
  useEffect(() => {
    if (syncingRef.current || desiredRef.current !== confirmedLikedRef.current) return;
    desiredRef.current = initialLiked;
    confirmedLikedRef.current = initialLiked;
    confirmedCountRef.current = initialCount;
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  const sync = useCallback(async (): Promise<void> => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      while (confirmedLikedRef.current !== desiredRef.current) {
        const target = desiredRef.current;
        const result = await sendRef.current(target);
        const previousLiked = confirmedLikedRef.current;
        confirmedLikedRef.current = result.liked;
        confirmedCountRef.current = result.likeCount ?? countFor(result.liked, previousLiked, confirmedCountRef.current);
      }
      const settled = { liked: confirmedLikedRef.current, count: confirmedCountRef.current };
      setLiked(settled.liked);
      setCount(settled.count);
      onSettledRef.current?.(settled);
    } catch (error: unknown) {
      // Back to what the server has.
      desiredRef.current = confirmedLikedRef.current;
      setLiked(confirmedLikedRef.current);
      setCount(confirmedCountRef.current);
      onErrorRef.current?.(error);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const setDesired = useCallback((next: boolean) => {
    if (desiredRef.current === next) return;
    desiredRef.current = next;
    setLiked(next);
    setCount(countFor(next, confirmedLikedRef.current, confirmedCountRef.current));
    void sync();
  }, [sync]);

  const toggle = useCallback(() => setDesired(!desiredRef.current), [setDesired]);
  const like = useCallback(() => setDesired(true), [setDesired]);

  return { liked, count, toggle, like };
}
