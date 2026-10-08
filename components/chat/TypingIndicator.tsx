import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';

const DOT_SIZE = 7;
const DOT_RISE = 5;
const RISE_MS = 280;
/** Each dot starts a little after the previous one, so they move as a wave. */
const STAGGER_MS = 150;

type TypingDotProps = {
  index: number;
  color: string;
};

function TypingDot({ index, color }: TypingDotProps) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(-DOT_RISE, { duration: RISE_MS }),
          withTiming(0, { duration: RISE_MS }),
          // Rest so the three dots read as one wave before it repeats.
          withTiming(0, { duration: STAGGER_MS * 2 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(offset);
  }, [index, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: 0.55 + (Math.abs(offset.value) / DOT_RISE) * 0.45,
  }));

  return (
    <Animated.View
      style={[{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: color }, animatedStyle]}
    />
  );
}

type TypingIndicatorProps = {
  profileImage?: string | null;
  firstName: string;
};

/** The other person's "typing…" bubble: three dots rising and falling in a wave (like WhatsApp). */
export default function TypingIndicator({ profileImage, firstName }: TypingIndicatorProps) {
  const { colors } = useAppTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      accessibilityRole="text"
      accessibilityLabel={`${firstName} is typing`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginBottom: 6, marginTop: 2 }}
    >
      <View style={{ marginRight: 6, marginBottom: 2 }}>
        <UserAvatar profileImage={profileImage ?? undefined} firstName={firstName} size={26} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          height: 36,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderBottomLeftRadius: 6,
          backgroundColor: colors.elevated,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {[0, 1, 2].map((index) => (
          <TypingDot key={index} index={index} color={colors.mutedText} />
        ))}
      </View>
    </Animated.View>
  );
}
