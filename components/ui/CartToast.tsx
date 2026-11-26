import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Darker emerald under white text (5.5:1); the theme accent is too light for a filled button. */
const PRIMARY_FILL = '#047857';

export type CartToastTone = 'success' | 'info' | 'error';
export type CartToastAction = { label: string; onPress: () => void; isPrimary?: boolean };

type CartToastProps = { tone: CartToastTone; heading: string; detail: string; actions: CartToastAction[] };

/**
 * The slim cart confirmation (about 90 tall): a one-line heading, then the product on the left with the buttons
 * inline on the right, so it never covers more than the top bar of a product page.
 */
export default function CartToast({ tone, heading, detail, actions }: CartToastProps) {
  const { colors } = useAppTheme();
  const accent = tone === 'success' ? colors.successText : tone === 'error' ? colors.destructiveText : colors.icon;
  const border = tone === 'success' ? colors.successBorder : tone === 'error' ? colors.destructiveBorder : colors.border;
  const icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert-circle' : 'info';
  return <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: border, backgroundColor: colors.elevated, shadowColor: '#020617', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={17} color={accent} />
      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' }}>{heading}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
      <Text numberOfLines={2} style={{ flex: 1, marginLeft: 25, color: colors.mutedText, fontSize: 13, lineHeight: 17 }}>{detail}</Text>
      {actions.map((action) => <TouchableOpacity key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={{ minHeight: 34, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: action.isPrimary ? PRIMARY_FILL : colors.successBorder, backgroundColor: action.isPrimary ? PRIMARY_FILL : colors.successSurface }}>
        <Text style={{ color: action.isPrimary ? '#ffffff' : colors.accentText, fontSize: 13, fontWeight: '800' }}>{action.label}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}
