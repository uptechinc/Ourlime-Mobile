import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Star } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** The star colour used everywhere ratings show (amber reads on both themes). */
export const RATING_STAR_COLOR = '#f59e0b';
const STARS = [1, 2, 3, 4, 5] as const;
/** Words for each score, said after the number ("4 out of 5 stars, Very good"). */
export const RATING_WORDS: { [score: number]: string } = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

export function describeStars(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} out of 5 stars`;
}

type RatingStarsProps = { value: number; size?: number; gap?: number };

/** Read-only stars; fractions fill part of a star (4.3 shows four and a third). One label for screen readers. */
export function RatingStars({ value, size = 14, gap = 1 }: RatingStarsProps) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(5, value));
  return <View accessible accessibilityRole="image" accessibilityLabel={describeStars(clamped)} style={{ flexDirection: 'row', gap }}>
    {STARS.map((star) => {
      const fill = Math.max(0, Math.min(1, clamped - star + 1));
      return <View key={star} style={{ width: size, height: size }}>
        <Star size={size} color={colors.border} fill={colors.border} strokeWidth={1.5} />
        {fill > 0 ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: size * fill, overflow: 'hidden' }}>
          <Star size={size} color={RATING_STAR_COLOR} fill={RATING_STAR_COLOR} strokeWidth={1.5} />
        </View> : null}
      </View>;
    })}
  </View>;
}

type StarRatingInputProps = {
  /** 0 means not rated yet. */
  value: number;
  onChange: (value: number) => void;
  /** What is being rated, for screen readers ("Overall rating", "Punctuality"). */
  label: string;
  /** Star glyph size; every star keeps a 44pt touch target. */
  size?: number;
  /** Optional ratings can be cleared: tapping the chosen star again clears it. */
  isClearable?: boolean;
  /** Shows the word for the chosen score ("Good") next to the stars. */
  showWord?: boolean;
  /** Tighter rows (40pt wide stars plus hit slop, so each still takes a 44pt touch) for labelled criteria rows. */
  isCompact?: boolean;
};

/**
 * Five tappable stars (44pt each). Screen readers get one adjustable control: "Punctuality, 4 out of 5 stars, Good",
 * swipe up or down to change it.
 */
export function StarRatingInput({ value, onChange, label, size = 28, isClearable = false, showWord = false, isCompact = false }: StarRatingInputProps) {
  const target = isCompact ? 40 : 44;
  const { colors } = useAppTheme();
  const handleAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onChange(Math.min(5, value + 1));
    if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(isClearable ? 0 : 1, value - 1));
  };
  const spoken = value ? `${describeStars(value)}, ${RATING_WORDS[value]}` : 'Not rated';
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value, text: spoken }}
      accessibilityHint={value ? 'Swipe up or down to change' : 'Swipe up to rate'}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={handleAction}
      style={{ flexDirection: 'row', marginLeft: isCompact ? 0 : -((target - size) / 2), marginRight: isCompact ? -((target - size) / 2) : 0 }}>
      {STARS.map((star) => {
        const isOn = star <= value;
        return <Pressable key={star} onPress={() => onChange(isClearable && star === value ? 0 : star)} hitSlop={{ left: 2, right: 2, top: 2, bottom: 2 }}
          style={{ width: target, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Star size={size} color={isOn ? RATING_STAR_COLOR : colors.mutedText} fill={isOn ? RATING_STAR_COLOR : 'transparent'} strokeWidth={1.6} />
        </Pressable>;
      })}
    </View>
    {showWord && value ? <Text importantForAccessibility="no" style={{ color: colors.secondaryText, fontSize: 14, fontWeight: '700' }}>{RATING_WORDS[value]}</Text> : null}
  </View>;
}
