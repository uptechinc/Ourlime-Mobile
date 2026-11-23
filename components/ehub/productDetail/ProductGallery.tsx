import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Package, X } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { EHubScrollView } from '@/components/ehub/EHubScrollView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type ProductGalleryProps = {
  images: string[];
  title: string;
  width: number;
  height: number;
  /** Phones: edge to edge under the floating header (square corners, top scrim). Wide: a rounded panel with thumbnails. */
  isFullBleed: boolean;
  /** Height of the floating header, so the top scrim keeps its buttons and the status bar readable. */
  topScrimHeight?: number;
};

const MAXIMUM_DOTS = 8;

function readPageIndex(event: NativeSyntheticEvent<NativeScrollEvent>, pageWidth: number, count: number): number {
  if (pageWidth <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / pageWidth)));
}

/**
 * The product photos: a swipeable paging gallery with page dots and a "1/4" counter, thumbnails on wide screens, and
 * a full-screen viewer on tap. Uses EHubScrollView so the gallery can be moved programmatically (thumbnails, and
 * returning from the viewer on the photo last seen); NativeWind drops plain ScrollView refs.
 */
export default function ProductGallery({ images, title, width, height, isFullBleed, topScrimHeight = 0 }: ProductGalleryProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [rawIndex, setIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const count = images.length;
  // A refresh can drop photos; never point past the last one.
  const index = Math.min(rawIndex, Math.max(0, count - 1));

  const goToImage = (nextIndex: number, animated = true) => {
    setIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated });
  };

  const handleViewerClose = (lastIndex: number) => {
    setIsViewerOpen(false);
    if (lastIndex !== index) goToImage(lastIndex, false);
  };

  if (!count) {
    return <View accessibilityRole="image" accessibilityLabel="No product photo" style={[styles.frame, !isFullBleed && styles.rounded, { width, height }]}>
      {isFullBleed && topScrimHeight ? <TopScrim height={topScrimHeight} /> : null}
      <View style={styles.placeholderIcon}><Package size={44} color={colors.mutedText} /></View>
      <Text style={styles.placeholderText}>No photo from the seller yet</Text>
    </View>;
  }

  return <View style={styles.stack}>
    <View style={[styles.frame, !isFullBleed && styles.rounded, { width, height }]}>
      <EHubScrollView scrollRef={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} bounces={false}
        onMomentumScrollEnd={(event) => setIndex(readPageIndex(event, width, count))} style={{ width, height }}>
        {images.map((image, imageIndex) => <Pressable key={image} accessibilityRole="imagebutton" accessibilityLabel={`${title}, photo ${imageIndex + 1} of ${count}. Opens full screen`} onPress={() => setIsViewerOpen(true)} style={{ width, height }}>
          <CachedImage uri={image} style={{ width, height }} contentFit="cover" />
        </Pressable>)}
      </EHubScrollView>
      {isFullBleed && topScrimHeight ? <TopScrim height={topScrimHeight} /> : null}
      {count > 1 ? <>
        <View pointerEvents="none" style={styles.counter}><Text style={styles.counterText}>{index + 1}/{count}</Text></View>
        {count <= MAXIMUM_DOTS ? <View pointerEvents="none" style={styles.dots}>
          {images.map((image, imageIndex) => <View key={image} style={[styles.dot, imageIndex === index && styles.dotActive]} />)}
        </View> : null}
      </> : null}
    </View>
    {!isFullBleed && count > 1 ? <View style={styles.thumbnails}>
      {images.map((image, imageIndex) => <Pressable key={image} accessibilityRole="button" accessibilityLabel={`Show photo ${imageIndex + 1} of ${count}`} accessibilityState={{ selected: imageIndex === index }} onPress={() => goToImage(imageIndex)} style={[styles.thumbnail, imageIndex === index && styles.thumbnailActive]}>
        <CachedImage uri={image} style={styles.fill} />
      </Pressable>)}
    </View> : null}
    <ProductImageViewer visible={isViewerOpen} images={images} title={title} initialIndex={index} onClose={handleViewerClose} />
  </View>;
}

function TopScrim({ height }: { height: number }) {
  return <LinearGradient pointerEvents="none" colors={['rgba(2,6,23,0.42)', 'rgba(2,6,23,0)']} style={[scrimStyles.scrim, { height }]} />;
}

const scrimStyles = StyleSheet.create({ scrim: { position: 'absolute', top: 0, left: 0, right: 0 } });

type ProductImageViewerProps = { visible: boolean; images: string[]; title: string; initialIndex: number; onClose: (lastIndex: number) => void };

/** Full-screen photos on black: swipe between them, close with the button or the back gesture. */
function ProductImageViewer({ visible, images, title, initialIndex, onClose }: ProductImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const count = images.length;

  return <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onShow={() => setIndex(initialIndex)} onRequestClose={() => onClose(index)}>
    <View style={viewerStyles.screen}>
      {/* contentOffset (not a ref) opens the viewer on the photo that was showing. */}
      {visible ? <EHubViewerPager images={images} title={title} width={width} height={height} initialIndex={initialIndex} onIndexChange={setIndex} /> : null}
      <SafeAreaView edges={['top', 'left', 'right']} style={viewerStyles.top} pointerEvents="box-none">
        <Text accessibilityLiveRegion="polite" style={viewerStyles.counter}>{count > 1 ? `${index + 1} / ${count}` : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photos" onPress={() => onClose(index)} hitSlop={8} style={viewerStyles.close}>
          <X size={22} color="#ffffff" />
        </Pressable>
      </SafeAreaView>
    </View>
  </Modal>;
}

type ViewerPagerProps = { images: string[]; title: string; width: number; height: number; initialIndex: number; onIndexChange: (index: number) => void };

function EHubViewerPager({ images, title, width, height, initialIndex, onIndexChange }: ViewerPagerProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  return <EHubScrollView scrollRef={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: initialIndex * width, y: 0 }}
    onMomentumScrollEnd={(event) => onIndexChange(readPageIndex(event, width, images.length))}>
    {images.map((image, imageIndex) => <View key={image} style={{ width, height, justifyContent: 'center' }}>
      <CachedImage uri={image} style={{ width, height }} contentFit="contain" accessibilityLabel={`${title}, photo ${imageIndex + 1} of ${images.length}`} />
    </View>)}
  </EHubScrollView>;
}

const viewerStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  counter: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)' },
});

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    stack: { gap: 8 },
    fill: { width: '100%', height: '100%' },
    frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    rounded: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    placeholderIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 44, backgroundColor: colors.control },
    placeholderText: { marginTop: 12, color: colors.mutedText, fontSize: 13, fontWeight: '600' },
    counter: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.66)' },
    counterText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    dots: { position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(100,116,139,0.45)' },
    dotActive: { width: 16, backgroundColor: colors.accent },
    thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    thumbnail: { width: 64, height: 64, overflow: 'hidden', borderRadius: 12, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.control },
    thumbnailActive: { borderColor: colors.accent },
  });
}
