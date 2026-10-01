import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Search, X } from 'lucide-react-native';
import { gifService, type GifAsset } from '@/lib/services/GifService';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const GIF_CATEGORIES = [
  { label: 'Trending', query: '' },
  { label: 'Reactions', query: 'reactions' },
  { label: 'Memes', query: 'memes' },
  { label: 'Love', query: 'love' },
  { label: 'Anime', query: 'anime' },
  { label: 'Caribbean', query: 'caribbean' },
  { label: 'Celebration', query: 'celebration' },
  { label: 'Sports', query: 'sports' },
] as const;

const GIF_SKELETON_ITEMS = ['gif-skeleton-1', 'gif-skeleton-2', 'gif-skeleton-3', 'gif-skeleton-4'] as const;

type GifPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (gif: GifAsset) => void;
};

export default function GifPickerModal({ visible, onClose, onSelect }: GifPickerModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestGenerationRef = useRef(0);
  const swipeDismiss = useSwipeDismiss({ visible, onDismiss: onClose, disabled: loading });

  const load = useCallback(async (value: string) => {
    const requestGeneration = ++requestGenerationRef.current;
    setLoading(true);
    setError('');
    try {
      const nextGifs = await gifService.search(value);
      if (requestGeneration !== requestGenerationRef.current) return;
      setGifs(nextGifs);
    } catch (loadError: unknown) {
      if (requestGeneration !== requestGenerationRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'GIFs could not be loaded.');
    } finally {
      if (requestGeneration === requestGenerationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      void load('');
      return;
    }
    requestGenerationRef.current += 1;
  }, [load, visible]);

  const handleCategorySelect = (categoryQuery: string) => {
    setQuery(categoryQuery);
    void load(categoryQuery);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
          <SwipeDismissHandle
            gesture={swipeDismiss.gesture}
            color={colors.border}
            animatedStyle={swipeDismiss.handleAnimatedStyle}
            accessibilityLabel="Swipe down to close GIF picker"
          />
          <View style={styles.header}>
            <Text style={styles.title}>Choose a GIF</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close GIF picker" onPress={swipeDismiss.dismissWithAnimation} style={styles.closeButton}>
              <X size={22} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.search}>
            <Search size={18} color={colors.mutedText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void load(query)}
              returnKeyType="search"
              placeholder="Search GIPHY"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroller}
            contentContainerStyle={styles.categories}
          >
            {GIF_CATEGORIES.map((category) => {
              const selected = query === category.query;
              return (
                <TouchableOpacity
                  key={category.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => handleCategorySelect(category.query)}
                  style={[styles.category, selected && styles.categorySelected]}
                >
                  <Text
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.15}
                    style={[styles.categoryText, selected && styles.categoryTextSelected]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.resultsRegion}>
            {loading ? (
              <View accessibilityLabel="Loading GIFs" style={[styles.grid, styles.skeletonGrid]}>
                {GIF_SKELETON_ITEMS.map((skeletonId) => (
                  <Skeleton key={skeletonId} height={148} borderRadius={12} style={styles.skeletonTile} />
                ))}
              </View>
            ) : error ? (
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            ) : (
              <FlatList
                data={gifs}
                numColumns={2}
                keyExtractor={(gif) => gif.id}
                style={styles.gifList}
                contentContainerStyle={styles.grid}
                columnWrapperStyle={styles.row}
                renderItem={({ item }) => (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Use ${item.name} GIF`} onPress={() => onSelect(item)} style={styles.gifButton}>
                    <Image source={{ uri: item.imageUrl }} recyclingKey={item.id} contentFit="cover" style={styles.gif} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No GIFs found.</Text>}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={3}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
  sheet: { height: '80%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.control },
  search: { marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: colors.control, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 11, paddingHorizontal: 8, color: colors.text },
  categoryScroller: { flexGrow: 0, flexShrink: 0, height: 50 },
  categories: { paddingHorizontal: 16, paddingBottom: 12, gap: 7, alignItems: 'center' },
  category: { minHeight: 38, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  categorySelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  categoryText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: '700', includeFontPadding: false },
  categoryTextSelected: { color: colors.onAccent },
  resultsRegion: { flex: 1, minHeight: 304 },
  gifList: { flex: 1 },
  error: { color: colors.destructiveText, padding: 18 },
  grid: { paddingHorizontal: 12, paddingBottom: 28 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skeletonTile: { width: '48.7%' },
  row: { gap: 8 },
  gifButton: { flex: 1, height: 148, marginBottom: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control },
  gif: { width: '100%', height: '100%' },
  empty: { textAlign: 'center', color: colors.mutedText, padding: 30 },
});
