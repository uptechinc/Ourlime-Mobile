import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
  label?: string;
};

/** Minus / Plus quantity control with 44-point targets (web ad840e23 enlarged the cart and detail steppers). */
export default function QuantityStepper({ value, onDecrease, onIncrease, canDecrease = true, canIncrease = true, label = 'quantity' }: QuantityStepperProps) {
  const { colors } = useAppTheme();
  const buttonStyle = (enabled: boolean) => ({ width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 12, backgroundColor: colors.control, opacity: enabled ? 1 : 0.4 });
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: 3, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} accessibilityState={{ disabled: !canDecrease }} disabled={!canDecrease} onPress={onDecrease} hitSlop={4} style={buttonStyle(canDecrease)}>
      <Minus size={20} strokeWidth={2.5} color={colors.text} />
    </Pressable>
    <Text accessibilityLiveRegion="polite" style={{ minWidth: 30, textAlign: 'center', color: colors.text, fontSize: 15, fontWeight: '900' }}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} accessibilityState={{ disabled: !canIncrease }} disabled={!canIncrease} onPress={onIncrease} hitSlop={4} style={buttonStyle(canIncrease)}>
      <Plus size={20} strokeWidth={2.5} color={colors.text} />
    </Pressable>
  </View>;
}
