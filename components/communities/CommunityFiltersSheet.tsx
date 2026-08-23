import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCategory, CommunityDirectorySort, CommunityDirectoryVisibility } from '@/lib/types/community';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type CommunityFiltersSheetProps = {
  visible: boolean;
  categories: CommunityCategory[];
  visibility: CommunityDirectoryVisibility;
  sort: CommunityDirectorySort;
  categoryId: string | null;
  onApply: (visibility: CommunityDirectoryVisibility, sort: CommunityDirectorySort, categoryId: string | null) => void;
  onClose: () => void;
};

const VISIBILITY_OPTIONS: { value: CommunityDirectoryVisibility; label: string; description: string }[] = [
  { value: 'all', label: 'Any visibility', description: 'Show public and private communities' },
  { value: 'public', label: 'Public only', description: 'Anyone can discover these communities' },
  { value: 'private', label: 'Private only', description: 'Access may require approval' },
];

const SORT_OPTIONS: { value: CommunityDirectorySort; label: string; description: string }[] = [
  { value: 'popular', label: 'Most popular', description: 'Largest and most-liked communities first' },
  { value: 'newest', label: 'Newest', description: 'Recently created communities first' },
  { value: 'active', label: 'Most active', description: 'Communities with recent activity first' },
  { value: 'trending', label: 'Trending', description: 'Fast-growing communities first' },
];

export default function CommunityFiltersSheet({ visible, categories, visibility, sort, categoryId, onApply, onClose }: CommunityFiltersSheetProps) {
  const { colors } = useAppTheme();
  const [draftVisibility, setDraftVisibility] = useState<CommunityDirectoryVisibility>(visibility);
  const [draftSort, setDraftSort] = useState<CommunityDirectorySort>(sort);
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(categoryId);

  useEffect(() => {
    if (!visible) return;
    setDraftVisibility(visibility);
    setDraftSort(sort);
    setDraftCategoryId(categoryId);
  }, [categoryId, sort, visibility, visible]);

  const handleReset = (): void => {
    setDraftVisibility('all');
    setDraftSort('popular');
    setDraftCategoryId(null);
  };

  const handleApply = (): void => {
    onApply(draftVisibility, draftSort, draftCategoryId);
    onClose();
  };

  const renderOption = <TValue extends string>(
    value: TValue,
    label: string,
    description: string,
    selectedValue: TValue,
    onSelect: (nextValue: TValue) => void,
  ) => {
    const selected = value === selectedValue;
    return (
      <TouchableOpacity
        key={value}
        onPress={() => onSelect(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={{
          flexDirection: 'row', alignItems: 'center', minHeight: 62, marginBottom: 8, paddingHorizontal: 14,
          borderRadius: 15, borderWidth: 1, borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.successSurface : colors.surface,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: selected ? colors.accentText : colors.text, fontWeight: '900' }}>{label}</Text>
          <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 11 }}>{description}</Text>
        </View>
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.control }}>
          {selected ? <Check size={15} color={colors.onAccent} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel="Swipe down to close community filters" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <SlidersHorizontal size={21} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: 9 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Refine communities</Text>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Choose what you want to discover</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close community filters" hitSlop={12} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
            <X size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          <Text style={{ marginBottom: 9, color: colors.secondaryText, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 }}>VISIBILITY</Text>
          {VISIBILITY_OPTIONS.map((option) => renderOption(option.value, option.label, option.description, draftVisibility, setDraftVisibility))}

          <Text style={{ marginTop: 18, marginBottom: 9, color: colors.secondaryText, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 }}>SORT BY</Text>
          {SORT_OPTIONS.map((option) => renderOption(option.value, option.label, option.description, draftSort, setDraftSort))}

          <Text style={{ marginTop: 18, marginBottom: 9, color: colors.secondaryText, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 }}>CATEGORY</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => setDraftCategoryId(null)} style={{ marginRight: 8, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: draftCategoryId === null ? colors.accent : colors.border, backgroundColor: draftCategoryId === null ? colors.selectedControl : colors.control }}>
              <Text style={{ color: draftCategoryId === null ? colors.selectedText : colors.secondaryText, fontWeight: '800' }}>All categories</Text>
            </TouchableOpacity>
            {categories.map((category) => {
              const selected = draftCategoryId === category.id;
              return <TouchableOpacity key={category.id} onPress={() => setDraftCategoryId(category.id)} style={{ marginRight: 8, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.selectedControl : colors.control }}><Text style={{ color: selected ? colors.selectedText : colors.secondaryText, fontWeight: '800' }}>{category.name}</Text></TouchableOpacity>;
            })}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', padding: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={handleReset} style={{ flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control }}>
            <RotateCcw size={17} color={colors.icon} /><Text style={{ marginLeft: 7, color: colors.secondaryText, fontWeight: '900' }}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApply} style={{ flex: 1.7, minHeight: 50, marginLeft: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent }}>
            <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Show communities</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}
