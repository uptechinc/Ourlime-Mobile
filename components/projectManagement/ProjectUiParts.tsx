import { useMemo } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { jsx as createNativeElement } from 'react/jsx-runtime';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { ProjectStatus, TeamMember } from '@/lib/types/project';

/**
 * eProjects building blocks in the E-Hub / Jobs / E-Learning look: white or slate surfaces, 16dp-radius cards,
 * filled #047857 buttons (white text at 5.5:1; the brand #10b981 is only ~2.5:1), 44-48dp touch targets. Pressables
 * use static styles plus android_ripple (NativeWind drops Pressable style functions in this app).
 */
export const PROJECT_ACTION_GREEN = '#047857';
export const PROJECT_GUTTER = 16;
export const PROJECT_RIPPLE = { color: 'rgba(15,23,42,0.12)' };

export type ProjectTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function projectToneColors(colors: AppThemeColors, tone: ProjectTone): { background: string; text: string } {
  if (tone === 'success') return { background: colors.successSurface, text: colors.successText };
  if (tone === 'warning') return { background: colors.warningSurface, text: colors.warningText };
  if (tone === 'danger') return { background: colors.destructiveSurface, text: colors.destructiveText };
  if (tone === 'info') return { background: colors.control, text: colors.text };
  return { background: colors.control, text: colors.secondaryText };
}

export function projectStatusTone(status: ProjectStatus): ProjectTone {
  if (status === 'active') return 'success';
  if (status === 'on-hold') return 'warning';
  if (status === 'completed') return 'info';
  return 'neutral';
}

type PillProps = { label: string; tone: ProjectTone; icon?: ReactNode };

/** A status in words, never colour alone. */
export function ProjectPill({ label, tone, icon }: PillProps) {
  const { colors } = useAppTheme();
  const palette = projectToneColors(colors, tone);
  return <View style={[sharedStyles.pill, { backgroundColor: palette.background }]}>
    {icon}
    <Text numberOfLines={1} style={[sharedStyles.pillText, { color: palette.text }]}>{label}</Text>
  </View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
  isBusy?: boolean;
  busyLabel?: string;
  isDisabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 44dp instead of 48dp, for buttons inside cards. */
  isCompact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProjectButton({ label, onPress, variant = 'primary', icon, isBusy = false, busyLabel, isDisabled = false, accessibilityLabel, accessibilityHint, isCompact = false, style }: ButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? '#ffffff' : variant === 'danger' ? colors.destructiveText : colors.text;
  const isInactive = isBusy || isDisabled;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: isInactive, busy: isBusy }}
    disabled={isInactive}
    onPress={onPress}
    android_ripple={isPrimary ? { color: 'rgba(255,255,255,0.2)' } : PROJECT_RIPPLE}
    style={[styles.button, isCompact && styles.buttonCompact, isPrimary ? styles.buttonPrimary : variant === 'danger' ? styles.buttonDanger : styles.buttonSecondary, isDisabled && !isBusy && styles.buttonDisabled, style]}
  >
    {isBusy ? <ActivityIndicator size="small" color={textColor} /> : icon}
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.buttonText, { color: textColor }]}>{isBusy && busyLabel ? busyLabel : label}</Text>
  </Pressable>;
}

type ChipProps = { label: string; isSelected: boolean; onPress: () => void; count?: number; accessibilityLabel?: string };

/** A filter chip: 36 tall with hit slop to 44; selected = filled green with white text. */
export function ProjectChip({ label, isSelected, onPress, count, accessibilityLabel }: ChipProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const text = count === undefined ? label : `${label} ${count}`;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? text} accessibilityState={{ selected: isSelected }} onPress={onPress} hitSlop={4} android_ripple={PROJECT_RIPPLE} style={[styles.chip, isSelected && styles.chipSelected]}>
    <Text numberOfLines={1} style={[styles.chipText, isSelected && styles.chipTextSelected]}>{text}</Text>
  </Pressable>;
}

type SegmentOption<T extends string> = { value: T; label: string; count?: number };
type SegmentedProps<T extends string> = { options: readonly SegmentOption<T>[]; value: T; onChange: (value: T) => void; accessibilityLabel: string };

/** Equal-width tabs on one row (they shrink their text to fit a 360dp screen rather than scroll). */
export function ProjectSegmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.segmented}>
    {options.map((option) => {
      const isSelected = option.value === value;
      const label = option.count === undefined ? option.label : `${option.label} ${option.count}`;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: isSelected }} onPress={() => onChange(option.value)} android_ripple={PROJECT_RIPPLE} style={[styles.segment, isSelected && styles.segmentSelected]}>
        {/* Android can leave a one-line label blank after its weight changes from bold back to normal, so the label is
            remounted when the selection changes. No adjustsFontSizeToFit: it shrinks text unevenly in flex segments. */}
        <Text key={isSelected ? 'selected' : 'idle'} numberOfLines={1} ellipsizeMode="tail" style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

type SectionProps = { title?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> };

/** A rounded card with an optional heading row. */
export function ProjectSection({ title, icon, action, children, style }: SectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.section, style]}>
    {title ? <View style={styles.sectionHeader}>
      {icon}
      <Text accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle}>{title}</Text>
      {action}
    </View> : null}
    {children}
  </View>;
}

type ProgressProps = { value: number; height?: number; accessibilityLabel?: string; color?: string };

export function ProjectProgressBar({ value, height = 6, accessibilityLabel, color }: ProgressProps) {
  const { colors } = useAppTheme();
  const progress = Math.max(0, Math.min(100, Math.round(value)));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: progress }} style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: colors.control }}>
    <View style={{ width: `${progress}%`, height, borderRadius: height / 2, backgroundColor: color ?? colors.accent }} />
  </View>;
}

type AvatarStackProps = { members: readonly TeamMember[]; max?: number; size?: number };

export function ProjectAvatarStack({ members, max = 4, size = 28 }: AvatarStackProps) {
  const { colors } = useAppTheme();
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible accessibilityLabel={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}>
    {shown.map((member, index) => <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -8, borderRadius: size, borderWidth: 2, borderColor: colors.surface }}>
      <UserAvatar profileImage={member.avatar} firstName={member.name} size={size} />
    </View>)}
    {extra > 0 ? <View style={{ marginLeft: -8, width: size + 4, height: size + 4, borderRadius: size, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: '700' }}>+{extra}</Text>
    </View> : null}
  </View>;
}

type EmptyStateProps = { icon: ReactNode; title: string; hint?: string; actionLabel?: string; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void };

/** One line, a hint and a call to action. */
export function ProjectEmptyState({ icon, title, hint, actionLabel, onAction, secondaryLabel, onSecondary }: EmptyStateProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.empty}>
    {icon}
    <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
    {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    {actionLabel && onAction ? <ProjectButton label={actionLabel} onPress={onAction} style={{ marginTop: 6, alignSelf: 'stretch' }} /> : null}
    {secondaryLabel && onSecondary ? <ProjectButton label={secondaryLabel} onPress={onSecondary} variant="secondary" style={{ alignSelf: 'stretch' }} /> : null}
  </View>;
}

type HeaderProps = { title: string; subtitle?: string; onBack: () => void; right?: ReactNode };

/** The screen bar: 48dp back button, one-line title, up to one 48dp action. Includes the top safe area. */
export function ProjectScreenHeader({ title, subtitle, onBack, right }: HeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.surface }}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} android_ripple={{ ...PROJECT_RIPPLE, borderless: true }} style={styles.iconButton}>
        <ArrowLeft size={22} color={colors.icon} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? <View style={{ width: 48 }} />}
    </View>
  </SafeAreaView>;
}

type IconButtonProps = { accessibilityLabel: string; accessibilityHint?: string; onPress: () => void; children: ReactNode; isDisabled?: boolean; size?: 44 | 48 };

/** A round icon-only button with a 44 or 48dp target. */
export function ProjectIconButton({ accessibilityLabel, accessibilityHint, onPress, children, isDisabled = false, size = 48 }: IconButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: isDisabled }} disabled={isDisabled} onPress={onPress} android_ripple={{ ...PROJECT_RIPPLE, borderless: true }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', opacity: isDisabled ? 0.5 : 1 }}>
    {children}
  </Pressable>;
}

type ScrollWithRefProps = ScrollViewProps & { scrollRef: RefObject<ScrollView | null> };

/**
 * A ScrollView whose ref works (NativeWind's wrapper drops ScrollView refs in this app), so the board can page to a
 * column when its tab is tapped. Same plain-JSX-runtime workaround as EHubScrollView.
 */
export function ProjectRefScrollView({ scrollRef, ...props }: ScrollWithRefProps) {
  return createNativeElement(ScrollView, { ...props, ref: scrollRef }) as ReactElement<ScrollViewProps>;
}

type SheetRowProps = { label: string; detail?: string; icon?: ReactNode; onPress: () => void; tone?: 'default' | 'danger'; right?: ReactNode; isSelected?: boolean; accessibilityLabel?: string };

/** One 56dp row of an action sheet. */
export function ProjectSheetRow({ label, detail, icon, onPress, tone = 'default', right, isSelected, accessibilityLabel }: SheetRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }} onPress={onPress} android_ripple={PROJECT_RIPPLE} style={styles.sheetRow}>
    {icon ? <View style={[styles.sheetIcon, { backgroundColor: tone === 'danger' ? colors.destructiveSurface : colors.control }]}>{icon}</View> : null}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[styles.sheetLabel, tone === 'danger' && { color: colors.destructiveText }]}>{label}</Text>
      {detail ? <Text numberOfLines={2} style={styles.sheetDetail}>{detail}</Text> : null}
    </View>
    {right}
  </Pressable>;
}

const sharedStyles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, maxWidth: '100%' },
  pillText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
});

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    button: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, overflow: 'hidden' },
    buttonCompact: { minHeight: 44, paddingHorizontal: 12 },
    buttonPrimary: { backgroundColor: PROJECT_ACTION_GREEN },
    buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    buttonDanger: { borderWidth: 1, borderColor: colors.destructiveText, backgroundColor: colors.surface },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { flexShrink: 1, fontSize: 15, fontWeight: '700' },

    chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
    chipSelected: { backgroundColor: PROJECT_ACTION_GREEN, borderColor: PROJECT_ACTION_GREEN },
    chipText: { color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
    chipTextSelected: { color: '#ffffff' },

    segmented: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control },
    segment: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden' },
    segmentSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    segmentText: { color: colors.mutedText, fontSize: 14, fontWeight: '600' },
    segmentTextSelected: { color: colors.text, fontWeight: '800' },

    section: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
    sectionTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },

    empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    emptyHint: { color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },

    header: { minHeight: 56, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
    headerSubtitle: { color: colors.mutedText, fontSize: 12, marginTop: 1 },

    sheetRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' },
    sheetIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sheetLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
    sheetDetail: { color: colors.mutedText, fontSize: 12, marginTop: 1 },
  });
}
