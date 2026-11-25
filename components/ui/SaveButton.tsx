import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useSaved } from '@/lib/hooks/useSavedItems';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type { SaveTarget } from '@/lib/types/saved';

export type SaveButtonProps = {
  target: SaveTarget;
  /**
   * 'plain': borderless 44dp icon (cards); 'overlay': round white chip over images; 'outlined': 48dp bordered
   * square (detail bars); 'pill': icon and label.
   */
  variant?: 'plain' | 'overlay' | 'outlined' | 'pill';
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  onChange?: (isSaved: boolean) => void;
};

/**
 * The one Save control used everywhere in the app: a bookmark that fills the brand green (#10b981) when saved.
 * State comes from the shared saved store, so every button for the same item updates together.
 */
export default function SaveButton({ target, variant = 'plain', iconSize = 20, style, onChange }: SaveButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isSaved, isPending, toggle } = useSaved(target);

  const handlePress = async () => {
    void interactionFeedbackService.play('selection');
    const nowSaved = await toggle();
    onChange?.(nowSaved);
  };

  const iconColor = isSaved ? (variant === 'outlined' || variant === 'pill' ? colors.onAccent : colors.accent) : variant === 'overlay' ? '#0f172a' : colors.icon;
  const containerStyle = [
    variant === 'plain' ? styles.plain : null,
    variant === 'overlay' ? styles.overlay : null,
    variant === 'outlined' ? styles.outlined : null,
    variant === 'pill' ? styles.pill : null,
    isSaved && (variant === 'outlined' || variant === 'pill') ? styles.activeFill : null,
    style,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSaved ? `Remove ${target.snapshot.title} from Saved` : `Save ${target.snapshot.title}`}
      accessibilityState={{ selected: isSaved, busy: isPending }}
      onPress={() => void handlePress()}
      disabled={isPending}
      hitSlop={4}
      android_ripple={{ color: colors.control, borderless: variant === 'plain' }}
      style={containerStyle}
    >
      <Bookmark size={iconSize} color={iconColor} fill={isSaved ? iconColor : 'transparent'} />
      {variant === 'pill' ? <Text style={[styles.pillLabel, { color: isSaved ? colors.onAccent : colors.text }]}>{isSaved ? 'Saved' : 'Save'}</Text> : null}
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  plain: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  outlined: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: 40, flexDirection: 'row', gap: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  activeFill: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillLabel: { fontSize: 14, fontWeight: '700' },
});
