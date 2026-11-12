import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleAlert, Star, Upload } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export const ADS_GREEN = '#10b981';

/*
 * Shared building blocks for the ads marketplace screens: one page frame, card, chip, button, field and empty /
 * error state, so every ads page reads as the same product. Plain style objects only (NativeWind drops
 * function-style Pressable styles).
 */

type AdsScreenProps = {
  title: string;
  children: ReactNode;
  loading?: boolean;
  skeleton?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBackPress?: () => void;
  rightComponent?: ReactNode;
  footer?: ReactNode;
};

/** Header, keyboard-safe scrolling body and optional sticky footer. While loading, the skeleton replaces the body. */
export function AdsScreen({ title, children, loading = false, skeleton, refreshing = false, onRefresh, onBackPress, rightComponent, footer }: AdsScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const handleBack = (): void => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/ads');
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader title={title} onBackPress={handleBack} rightComponent={rightComponent} />
      <KeyboardSafeView style={{ flex: 1 }}>
        {loading ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} scrollEnabled={false}>{skeleton}</ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADS_GREEN} colors={[ADS_GREEN]} /> : undefined}
          >
            {children}
          </ScrollView>
        )}
        {!loading && footer ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>{footer}</View>
        ) : null}
      </KeyboardSafeView>
    </View>
  );
}

type AdsCardProps = { title?: string; subtitle?: string; children?: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string };

export function AdsCard({ title, subtitle, children, style, onPress, accent }: AdsCardProps) {
  const { colors } = useAppTheme();
  const cardStyle: StyleProp<ViewStyle> = [{
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...(accent ? { borderLeftWidth: 4, borderLeftColor: accent } : {}),
  }, style];
  const content = (
    <>
      {title ? (
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 13, color: colors.mutedText }}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </>
  );
  if (onPress) return <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={cardStyle}>{content}</TouchableOpacity>;
  return <View style={cardStyle}>{content}</View>;
}

export type AdsTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple';

export function useToneColors(tone: AdsTone): { background: string; text: string } {
  const { colors, isDark } = useAppTheme();
  switch (tone) {
    case 'success': return { background: colors.successSurface, text: colors.successText };
    case 'warning': return { background: colors.warningSurface, text: colors.warningText };
    case 'danger': return { background: colors.destructiveSurface, text: colors.destructiveText };
    case 'info': return { background: isDark ? '#172554' : '#eff6ff', text: isDark ? '#93c5fd' : '#1d4ed8' };
    case 'purple': return { background: isDark ? '#2e1065' : '#f5f3ff', text: isDark ? '#c4b5fd' : '#6d28d9' };
    case 'accent': return { background: colors.successSurface, text: colors.accentText };
    default: return { background: colors.control, text: colors.secondaryText };
  }
}

export function AdsChip({ label, tone = 'neutral', icon, raw = false }: { label: string; tone?: AdsTone; icon?: ReactNode; raw?: boolean }) {
  const toneColors = useToneColors(tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: toneColors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon}
      <Text style={{ color: toneColors.text, fontSize: 12, fontWeight: '700', textTransform: raw ? 'none' : 'capitalize' }}>{label}</Text>
    </View>
  );
}

type AdsButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type AdsButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AdsButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AdsButton({ label, onPress, variant = 'primary', disabled = false, loading = false, icon, compact = false, style }: AdsButtonProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: { background: ADS_GREEN, text: '#ffffff', border: ADS_GREEN },
    secondary: { background: colors.surface, text: colors.text, border: colors.border },
    ghost: { background: 'transparent', text: colors.accentText, border: 'transparent' },
    danger: { background: colors.destructive, text: '#ffffff', border: colors.destructive },
  }[variant];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      activeOpacity={0.8}
      disabled={isDisabled}
      onPress={onPress}
      style={[{
        minHeight: compact ? 38 : 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDisabled && variant !== 'ghost' ? colors.disabled : palette.border,
        backgroundColor: isDisabled && variant !== 'ghost' ? colors.disabled : palette.background,
        paddingHorizontal: compact ? 12 : 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={isDisabled ? colors.disabledText : palette.text} /> : icon}
      <Text style={{ color: isDisabled ? colors.disabledText : palette.text, fontWeight: '800', fontSize: compact ? 13 : 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

type AdsFieldProps = TextInputProps & { label: string; required?: boolean; hint?: string };

export function AdsField({ label, required = false, hint, style, multiline, ...inputProps }: AdsFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedText}
        multiline={multiline}
        accessibilityLabel={label}
        {...inputProps}
        style={[{
          minHeight: multiline ? 110 : 46,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.input,
          color: colors.text,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 10,
          fontSize: 15,
          textAlignVertical: multiline ? 'top' : 'center',
        }, style]}
      />
      {hint ? <Text style={{ fontSize: 12, color: colors.mutedText }}>{hint}</Text> : null}
    </View>
  );
}

export type AdsOption<TValue extends string> = { value: TValue; label: string };

type AdsOptionGroupProps<TValue extends string> = {
  label?: string;
  required?: boolean;
  value: TValue | '' | undefined;
  options: AdsOption<TValue>[];
  onChange: (value: TValue) => void;
};

/** A single-choice row of chips (the phone version of the website's select fields). */
export function AdsOptionGroup<TValue extends string>({ label, required = false, value, options, onChange }: AdsOptionGroupProps<TValue>) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.secondaryText }}>
          {label}
          {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              activeOpacity={0.8}
              onPress={() => onChange(option.value)}
              style={{ borderRadius: 999, borderWidth: 1, borderColor: isSelected ? ADS_GREEN : colors.border, backgroundColor: isSelected ? colors.successSurface : colors.surface, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: isSelected ? colors.accentText : colors.secondaryText, fontWeight: '700', fontSize: 13 }}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** A toggle chip (multi-select), like the website's ToggleChip. */
export function AdsToggleChip({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (pressed: boolean) => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: pressed }}
      activeOpacity={0.8}
      onPress={() => onChange(!pressed)}
      style={{ borderRadius: 999, borderWidth: 1, borderColor: pressed ? ADS_GREEN : colors.border, backgroundColor: pressed ? colors.successSurface : colors.surface, paddingHorizontal: 14, paddingVertical: 8 }}
    >
      <Text style={{ color: pressed ? colors.accentText : colors.secondaryText, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AdsToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{label}</Text>
        {description ? <Text style={{ fontSize: 12, color: colors.mutedText }}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: ADS_GREEN, false: colors.disabled }} thumbColor="#ffffff" accessibilityLabel={label} />
    </View>
  );
}

export function AdsInfoRow({ label, value, valueStyle }: { label: string; value: ReactNode; valueStyle?: 'strong' | 'muted' }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 14, color: colors.mutedText, flexShrink: 1 }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={{ fontSize: 14, fontWeight: valueStyle === 'strong' ? '800' : '600', color: valueStyle === 'muted' ? colors.mutedText : colors.text, textAlign: 'right', flexShrink: 1 }}>{value}</Text>
        : value}
    </View>
  );
}

/** A labelled value in a two-column grid cell. */
export function AdsStat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexBasis: '46%', flexGrow: 1 }}>
      {icon}
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontSize: 12, color: colors.mutedText }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{value}</Text>
      </View>
    </View>
  );
}

export function AdsSectionLabel({ title, description }: { title: string; description?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{title}</Text>
      {description ? <Text style={{ fontSize: 12, color: colors.mutedText }}>{description}</Text> : null}
    </View>
  );
}

export function AdsNotice({ tone = 'warning', title, message, icon }: { tone?: AdsTone; title?: string; message: string; icon?: ReactNode }) {
  const toneColors = useToneColors(tone);
  return (
    <View style={{ flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, backgroundColor: toneColors.background }}>
      {icon ?? <CircleAlert size={18} color={toneColors.text} />}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={{ color: toneColors.text, fontWeight: '800', fontSize: 14 }}>{title}</Text> : null}
        <Text style={{ color: toneColors.text, fontSize: 13, lineHeight: 19 }}>{message}</Text>
      </View>
    </View>
  );
}

type AdsEmptyStateProps = { icon: ReactNode; title: string; message?: string; actionLabel?: string; onAction?: () => void };

export function AdsEmptyState({ icon, title, message, actionLabel, onAction }: AdsEmptyStateProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {message ? <Text style={{ fontSize: 14, color: colors.mutedText, textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      {actionLabel && onAction ? <AdsButton label={actionLabel} onPress={onAction} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function AdsErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <AdsCard>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <CircleAlert size={30} color={colors.destructive} />
        <Text style={{ fontSize: 14, color: colors.secondaryText, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
        {onRetry ? <AdsButton label="Try again" variant="secondary" onPress={onRetry} compact /> : null}
      </View>
    </AdsCard>
  );
}

/** Horizontally scrolling status tabs (the website's Tabs). */
export function AdsTabs<TValue extends string>({ tabs, value, onChange }: { tabs: AdsOption<TValue>[]; value: TValue; onChange: (value: TValue) => void }) {
  const { colors } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {tabs.map((tab) => {
        const isSelected = tab.value === value;
        return (
          <TouchableOpacity
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            activeOpacity={0.8}
            onPress={() => onChange(tab.value)}
            style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: isSelected ? ADS_GREEN : colors.control }}
          >
            <Text style={{ color: isSelected ? '#ffffff' : colors.secondaryText, fontWeight: '700', fontSize: 13 }}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Five tappable stars; size 32 for the overall rating, 22 for the breakdown. */
export function AdsStarRating({ value, onChange, size = 32, label }: { value: number; onChange: (value: number) => void; size?: number; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} accessibilityRole="button" accessibilityLabel={`Rate ${label} ${star} star${star !== 1 ? 's' : ''}`} hitSlop={4} onPress={() => onChange(star)}>
          <Star size={size} color={star <= value ? '#facc15' : colors.disabledText} fill={star <= value ? '#facc15' : 'transparent'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** A bulleted line with a green check, as on the website's marketplace cards. */
export function AdsCheckLine({ text, icon }: { text: string; icon?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon ?? <Text style={{ color: ADS_GREEN, fontWeight: '900' }}>✓</Text>}
      <Text style={{ fontSize: 14, color: colors.secondaryText, flex: 1 }}>{text}</Text>
    </View>
  );
}

export function AdsHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 14, color: colors.mutedText, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

/** A dashed upload tile (the website's file drop area). */
export function AdsUploadTile({ label, helper, disabled, onPress, icon }: { label: string; helper: string; disabled: boolean; onPress: () => void; icon?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={{ alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 20, paddingHorizontal: 14, opacity: disabled ? 0.6 : 1 }}
    >
      {icon ?? <Upload size={24} color={colors.mutedText} />}
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.mutedText, textAlign: 'center' }}>{helper}</Text>
    </TouchableOpacity>
  );
}
