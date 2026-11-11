import { useCallback, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { ScrollView, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { jsx as createNativeElement } from 'react/jsx-runtime';

type EHubScrollViewProps = ScrollViewProps & { scrollRef: RefObject<ScrollView | null> };

/**
 * A ScrollView whose ref works, so E-Hub can jump to a section (the website's #featured-products, #saved-products and
 * the /ehub/terms#buyer anchors). It is created with the plain JSX runtime, outside NativeWind, whose wrapper drops
 * ScrollView refs in this app (same workaround as the chat message list).
 */
export function EHubScrollView({ scrollRef, ...props }: EHubScrollViewProps) {
  return createNativeElement(ScrollView, { ...props, ref: scrollRef }) as ReactElement<ScrollViewProps>;
}

/**
 * Remembers where named sections sit and scrolls to them. Put onContainerLayout on the view that holds the sections
 * (when it is not the scroll content itself) and onSectionLayout(name) on each section. A jump asked for before the
 * section was laid out (e.g. a deep link to a terms section) runs once it is.
 */
export function useEHubSectionScroll<TSection extends string>() {
  const scrollRef = useRef<ScrollView | null>(null);
  const containerOffset = useRef(0);
  const offsets = useRef<{ [section in TSection]?: number }>({});
  const pendingSection = useRef<TSection | null>(null);

  const scrollToSection = useCallback((section: TSection, animated = true) => {
    const offset = offsets.current[section];
    if (offset === undefined || !scrollRef.current) { pendingSection.current = section; return; }
    pendingSection.current = null;
    scrollRef.current.scrollTo({ y: Math.max(0, containerOffset.current + offset - 12), animated });
  }, []);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    containerOffset.current = event.nativeEvent.layout.y;
  }, []);

  const onSectionLayout = useCallback((section: TSection) => (event: LayoutChangeEvent) => {
    offsets.current[section] = event.nativeEvent.layout.y;
    if (pendingSection.current === section) setTimeout(() => scrollToSection(section, false), 50);
  }, [scrollToSection]);

  return { scrollRef, scrollToSection, onContainerLayout, onSectionLayout };
}
