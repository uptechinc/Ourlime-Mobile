import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import CachedImage from '@/components/ui/CachedImage';

export type EHubHeroSlide<TTarget> = { eyebrow: string; title: string; description: string; imageUrl: string; actionLabel: string; target: TTarget };

type HeroSliderProps<TTarget> = {
  slides: EHubHeroSlide<TTarget>[];
  /** Width of the centred content column (the page's content width). */
  contentWidth: number;
  gutter: number;
  isTablet: boolean;
  onAction: (target: TTarget) => void;
};

const AUTOPLAY_MS = 5_000;
const TRANSITION_MS = 300;
const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 500;
const EASE_OUT = Easing.out(Easing.cubic);

/**
 * The E-Hub hero. Slides crossfade (images stay mounted, so a slide is never blank while it loads) and the text
 * slides in from the side it came from. Autoplays every 5s while the screen is focused, pauses while a finger is on
 * it, and stops for good once the person swipes, taps a dot or arrow, or presses pause. No autoplay and no motion
 * under Reduce Motion. Driven by state + Reanimated: NativeWind drops ScrollView refs here, so a paging ScrollView
 * cannot be moved from code.
 */
export default function EHubHeroSlider<TTarget>({ slides, contentWidth, gutter, isTablet, onAction }: HeroSliderProps<TTarget>) {
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(gutter, isTablet), [gutter, isTablet]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isTouching, setIsTouching] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const dragOffset = useSharedValue(0);
  const textProgress = useSharedValue(1);
  const isFirstRender = useRef(true);
  // At most ~45% of the screen, so the search and catalog stay in view (Baymard: hero carousels push content down).
  const heroHeight = Math.round(Math.max(isTablet ? 380 : 320, Math.min(windowHeight * 0.45, isTablet ? 440 : 380)));
  const slide = slides[activeIndex];
  const isAutoplaying = !reduceMotion && !isStopped && !isTouching && isScreenFocused && slides.length > 1;

  useFocusEffect(useCallback(() => {
    setIsScreenFocused(true);
    return () => setIsScreenFocused(false);
  }, []));

  useEffect(() => {
    if (!isAutoplaying) return undefined;
    const timer = setTimeout(() => {
      setDirection(1);
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, isAutoplaying, slides.length]);

  // Text enters from the side it came from; skipped on the first render and under Reduce Motion.
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (reduceMotion) { textProgress.value = 1; return; }
    textProgress.value = 0;
    textProgress.value = withTiming(1, { duration: TRANSITION_MS, easing: EASE_OUT });
  }, [activeIndex, reduceMotion, textProgress]);

  const goTo = useCallback((nextIndex: number, nextDirection: 1 | -1) => {
    setIsStopped(true);
    setDirection(nextDirection);
    setActiveIndex((nextIndex + slides.length) % slides.length);
  }, [slides.length]);

  const handlePrevious = () => goTo(activeIndex - 1, -1);
  const handleNext = () => goTo(activeIndex + 1, 1);
  const handleDot = (index: number) => { if (index !== activeIndex) goTo(index, index > activeIndex ? 1 : -1); };
  const handleToggleAutoplay = () => setIsStopped((wasStopped) => !wasStopped);

  const handleSwipeEnd = useCallback((translationX: number, velocityX: number) => {
    const isSwipe = Math.abs(translationX) > SWIPE_DISTANCE || Math.abs(velocityX) > SWIPE_VELOCITY;
    dragOffset.value = reduceMotion ? 0 : withTiming(0, { duration: TRANSITION_MS, easing: EASE_OUT });
    if (!isSwipe) return;
    if (translationX < 0) goTo(activeIndex + 1, 1);
    else goTo(activeIndex - 1, -1);
  }, [activeIndex, dragOffset, goTo, reduceMotion]);

  // Horizontal pans only: vertical movement fails the gesture so the page keeps scrolling. Taps reach the buttons.
  const swipeGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onBegin(() => setIsTouching(true))
    .onUpdate((event) => { if (!reduceMotion) dragOffset.value = event.translationX * 0.35; })
    .onEnd((event) => handleSwipeEnd(event.translationX, event.velocityX))
    .onFinalize(() => setIsTouching(false)), [dragOffset, handleSwipeEnd, reduceMotion]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateX: dragOffset.value + (1 - textProgress.value) * 28 * direction }],
  }));

  return <GestureDetector gesture={swipeGesture}>
    <View style={[styles.hero, { height: heroHeight }]} accessibilityLabel={`Featured, slide ${activeIndex + 1} of ${slides.length}`}>
      {slides.map((heroSlide, index) => <HeroImageLayer key={heroSlide.imageUrl} uri={heroSlide.imageUrl} isActive={index === activeIndex} reduceMotion={reduceMotion} />)}
      <LinearGradient colors={['rgba(2,6,23,0.35)', 'rgba(2,6,23,0.92)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.content, { width: contentWidth }, textStyle]}>
        <Text numberOfLines={1} style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text numberOfLines={3} style={styles.title}>{slide.title}</Text>
        <Text numberOfLines={isTablet ? 3 : 2} style={styles.body}>{slide.description}</Text>
        <Pressable accessibilityRole="button" onPress={() => onAction(slide.target)} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={[styles.primary]}>
          <Text numberOfLines={1} style={styles.primaryText}>{slide.actionLabel}</Text>
          <ArrowRight size={16} color="#020617" />
        </Pressable>
      </Animated.View>
      {slides.length > 1 ? <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" onPress={handlePrevious} style={styles.controlButton}><ChevronLeft size={18} color="#ffffff" /></Pressable>
        {slides.map((heroSlide, index) => <Pressable key={heroSlide.eyebrow} accessibilityRole="button" accessibilityLabel={`Show slide ${index + 1}`} accessibilityState={{ selected: index === activeIndex }} onPress={() => handleDot(index)} style={styles.dotTarget}>
          <View style={[styles.dot, index === activeIndex && styles.dotActive]} />
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Next slide" onPress={handleNext} style={styles.controlButton}><ChevronRight size={18} color="#ffffff" /></Pressable>
        {reduceMotion ? null : <Pressable accessibilityRole="button" accessibilityLabel={isStopped ? 'Play slideshow' : 'Pause slideshow'} onPress={handleToggleAutoplay} style={styles.controlButton}>
          {isStopped ? <Play size={15} color="#ffffff" /> : <Pause size={15} color="#ffffff" />}
        </Pressable>}
      </View> : null}
    </View>
  </GestureDetector>;
}

type HeroImageLayerProps = { uri: string; isActive: boolean; reduceMotion: boolean };

/** One slide's photo, always mounted; only its opacity changes, so the crossfade never shows an empty frame. */
function HeroImageLayer({ uri, isActive, reduceMotion }: HeroImageLayerProps) {
  const opacity = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    opacity.value = reduceMotion ? (isActive ? 1 : 0) : withTiming(isActive ? 1 : 0, { duration: TRANSITION_MS, easing: EASE_OUT });
  }, [isActive, opacity, reduceMotion]);
  const layerStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.6 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, layerStyle]}>
    <CachedImage uri={uri} style={layerImageStyle} />
  </Animated.View>;
}

const layerImageStyle = { width: '100%', height: '100%' } as const;

const createStyles = (gutter: number, isTablet: boolean) => StyleSheet.create({
  hero: { width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617', overflow: 'hidden' },
  content: { maxWidth: '100%', paddingHorizontal: gutter + 8, paddingBottom: 48 },
  eyebrow: { color: '#01eb53', fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { marginTop: 8, maxWidth: 620, color: '#ffffff', fontSize: isTablet ? 40 : 26, lineHeight: isTablet ? 46 : 32, fontWeight: '900' },
  body: { marginTop: 8, maxWidth: 520, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  primary: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 16, minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#01eb53' },
  primaryText: { flexShrink: 1, color: '#020617', fontSize: 15, fontWeight: '800' },
  controls: { position: 'absolute', bottom: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.55)' },
  controlButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dotTarget: { minWidth: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 22, backgroundColor: '#01eb53' },
});
