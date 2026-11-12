import { useCallback, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { ScrollView, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { jsx as createNativeElement } from 'react/jsx-runtime';

type PolicyScrollViewProps = ScrollViewProps & { scrollRef: RefObject<ScrollView | null> };

/**
 * A ScrollView whose ref works, so the policy pages can jump to a policy or section like the website's #anchors.
 * It is created with the plain JSX runtime, outside NativeWind, whose wrapper drops ScrollView refs in this app
 * (the same workaround as the chat list and E-Hub).
 */
export function PolicyScrollView({ scrollRef, ...props }: PolicyScrollViewProps) {
  return createNativeElement(ScrollView, { ...props, ref: scrollRef }) as ReactElement<ScrollViewProps>;
}

/**
 * Remembers where anchors sit inside the scroll content and scrolls to them. Anchors nested inside another laid-out
 * view report their offset relative to that parent, so a parent anchor id can be given to add its offset.
 * A jump requested before the anchor is laid out (a deep link) runs as soon as it is.
 */
export function usePolicyAnchorScroll() {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsets = useRef<{ [anchorId: string]: { y: number; parentId?: string } }>({});
  const pendingAnchor = useRef<string | null>(null);

  const absoluteOffset = useCallback((anchorId: string): number | null => {
    const entry = offsets.current[anchorId];
    if (!entry) return null;
    if (!entry.parentId) return entry.y;
    const parentOffset = absoluteOffset(entry.parentId);
    return parentOffset === null ? null : parentOffset + entry.y;
  }, []);

  const scrollToAnchor = useCallback((anchorId: string, animated = true) => {
    const offset = absoluteOffset(anchorId);
    if (offset === null || !scrollRef.current) {
      pendingAnchor.current = anchorId;
      return;
    }
    pendingAnchor.current = null;
    scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated });
  }, [absoluteOffset]);

  const onAnchorLayout = useCallback((anchorId: string, parentId?: string) => (event: LayoutChangeEvent) => {
    offsets.current[anchorId] = { y: event.nativeEvent.layout.y, parentId };
    const pending = pendingAnchor.current;
    if (pending && absoluteOffset(pending) !== null) setTimeout(() => scrollToAnchor(pending, false), 50);
  }, [absoluteOffset, scrollToAnchor]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return { scrollRef, scrollToAnchor, onAnchorLayout, scrollToTop };
}
