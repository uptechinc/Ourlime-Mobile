import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookOpen, Compass, Hammer, Laugh, Music2, Sparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type LimeCategory = {
  name: string;
  description: string;
  Icon: typeof Compass;
};

const LIME_CATEGORIES: LimeCategory[] = [
  { name: 'Comedy', description: 'Laughs and light moments', Icon: Laugh },
  { name: 'Academic', description: 'Ideas and useful lessons', Icon: BookOpen },
  { name: 'DIY', description: 'Make, repair, and create', Icon: Hammer },
  { name: 'Music', description: 'Sounds and performances', Icon: Music2 },
  { name: 'Explore', description: 'Places and discoveries', Icon: Compass },
];

type LimeCategorySheetProps = {
  visible: boolean;
  selectedCategory: string | null;
  onSelect: (category: string) => void;
  onClear: () => void;
  onClose: () => void;
};

export default function LimeCategorySheet({
  visible,
  selectedCategory,
  onSelect,
  onClear,
  onClose,
}: LimeCategorySheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.modalScrim }]} onPress={onClose} />
      <SwipeDismissSurface
        visible={visible}
        onDismiss={onClose}
        handleColor={colors.mutedText}
        accessibilityLabel="Swipe down to close Lime discovery"
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 18),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Discover Limes</Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>Choose what you want to watch.</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close Lime discovery"
            style={[styles.closeButton, { backgroundColor: colors.control }]}
          >
            <X size={19} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onClear}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategory === null }}
          style={[
            styles.forYouCard,
            {
              backgroundColor: selectedCategory === null ? colors.successSurface : colors.control,
              borderColor: selectedCategory === null ? colors.accent : colors.border,
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: selectedCategory === null ? colors.accent : colors.elevated }]}>
            <Sparkles size={19} color={selectedCategory === null ? colors.onAccent : colors.icon} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>For You</Text>
            <Text style={[styles.cardDescription, { color: colors.mutedText }]}>Return to your personalized mix</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.grid}>
          {LIME_CATEGORIES.map((category) => {
            const CategoryIcon = category.Icon;
            const isSelected = selectedCategory === category.name;
            return (
              <TouchableOpacity
                key={category.name}
                onPress={() => onSelect(category.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected ? colors.successSurface : colors.control,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <CategoryIcon size={20} color={isSelected ? colors.accentText : colors.icon} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{category.name}</Text>
                <Text style={[styles.categoryDescription, { color: colors.mutedText }]}>{category.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SwipeDismissSurface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  forYouCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardDescription: { fontSize: 12, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '48.5%', minHeight: 106, borderWidth: 1, borderRadius: 18, padding: 14, justifyContent: 'center' },
  categoryDescription: { fontSize: 11, lineHeight: 16, marginTop: 4 },
});
