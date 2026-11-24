import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { JOBS_ACTION_GREEN } from '@/components/jobs/JobCardParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

export type JobFormProgress = { current: number; total: number; label: string; nextLabel?: string };

type JobFormShellProps = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  /** A text action beside Close, e.g. "Save draft". */
  headerAction?: ReactNode;
  /** Step n of total, drawn as a segmented bar under the header. */
  progress?: JobFormProgress;
  /** Changing it remounts the scroll content, so a new step starts at the top (ScrollView refs are dropped here). */
  contentKey?: string;
  /** Shown just above the footer buttons so it is always visible, whatever the scroll position. */
  errorMessage?: string;
};

/**
 * Full-screen form page for creating jobs and quick tasks (web ModalShell size="xl"), laid out for phones: a fixed
 * header with optional step progress, a scrolling body, and a sticky footer that stays above the keyboard.
 */
export default function JobFormShell({ visible, title, description, onClose, footer, children, headerAction, progress, contentKey, errorMessage }: JobFormShellProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
        <JobSheetHeader title={title} subtitle={description} onClose={onClose} closeLabel={`Close ${title}`} action={headerAction} />
        {progress ? <FormStepper progress={progress} /> : null}
        <KeyboardSafeView style={styles.body}>
          <ScrollView key={contentKey} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
          <View style={styles.footer}>
            {errorMessage ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.footerError}>
                <AlertCircle size={16} color={colors.destructiveText} />
                <Text style={styles.footerErrorText}>{errorMessage}</Text>
              </View>
            ) : null}
            <View style={styles.footerRow}>{footer}</View>
          </View>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}

type JobSheetHeaderProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  action?: ReactNode;
  closeDisabled?: boolean;
};

/** The one header used by every Jobs form and sheet: title, a muted subtitle, an optional action and a 44dp Close. */
export function JobSheetHeader({ title, subtitle, onClose, closeLabel, action, closeDisabled = false }: JobSheetHeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={styles.description}>{subtitle}</Text> : null}
      </View>
      {action}
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? `Close ${title}`} accessibilityState={{ disabled: closeDisabled }} disabled={closeDisabled} onPress={onClose} hitSlop={4} android_ripple={{ ...RIPPLE, borderless: true }} style={[styles.close, closeDisabled && styles.disabled]}>
        <X size={22} color={colors.icon} />
      </Pressable>
    </View>
  );
}

type HeaderTextActionProps = { label: string; onPress: () => void; disabled?: boolean; isLoading?: boolean; accessibilityLabel?: string };

/** A compact text button for the header ("Save draft"). */
export function HeaderTextAction({ label, onPress, disabled = false, isLoading = false, accessibilityLabel }: HeaderTextActionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, busy: isLoading }} disabled={disabled} onPress={onPress} android_ripple={RIPPLE} style={[styles.headerAction, disabled && styles.disabled]}>
      {isLoading ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
      <Text numberOfLines={1} style={styles.headerActionText}>{label}</Text>
    </Pressable>
  );
}

type FormStepperProps = { progress: JobFormProgress };

/** "Step 2 of 5 · Company" with "Next: Pay & terms", over a segmented bar (no animation, so nothing can loop). */
export function FormStepper({ progress }: FormStepperProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  const { current, total, label, nextLabel } = progress;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${current} of ${total}: ${label}`} accessibilityValue={{ min: 1, max: total, now: current }} style={styles.stepper}>
      <View style={styles.stepperText}>
        <Text numberOfLines={1} style={styles.stepCount}>Step {current} of {total}</Text>
        <Text numberOfLines={1} style={styles.stepLabel}>{label}</Text>
        {nextLabel ? <Text numberOfLines={1} style={styles.stepNext}>Next: {nextLabel}</Text> : null}
      </View>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_unused, index) => <View key={index} style={[styles.segment, index < current && styles.segmentDone]} />)}
      </View>
    </View>
  );
}

type FooterButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  icon?: ReactNode;
  /** Share of the footer row this button takes (default 1). */
  flex?: number;
  isLoading?: boolean;
  accessibilityLabel?: string;
};

/** Footer buttons shared by the job forms and sheets: 48dp, filled #047857 for the primary action. */
export function FooterButton({ label, onPress, variant = 'primary', disabled = false, icon, flex = 1, isLoading = false, accessibilityLabel }: FooterButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createShellStyles(colors), [colors]);
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      disabled={disabled || isLoading}
      onPress={onPress}
      android_ripple={isPrimary ? { color: 'rgba(255,255,255,0.2)' } : RIPPLE}
      style={[styles.footerButton, { flex }, isPrimary ? styles.footerPrimary : variant === 'secondary' ? styles.footerSecondary : styles.footerGhost, disabled && styles.disabled]}
    >
      {isLoading ? <ActivityIndicator size="small" color={isPrimary ? '#ffffff' : colors.text} /> : icon}
      <Text numberOfLines={1} style={[styles.footerButtonText, isPrimary ? styles.footerPrimaryText : variant === 'secondary' ? styles.footerSecondaryText : styles.footerGhostText]}>{label}</Text>
    </Pressable>
  );
}

export const createShellStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  disabled: { opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 60, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  description: { color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 16 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerAction: { minHeight: 44, maxWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden', paddingHorizontal: 10, borderRadius: 12 },
  headerActionText: { flexShrink: 1, color: colors.accentText, fontSize: 14, fontWeight: '800' },
  stepper: { gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stepperText: { flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  stepCount: { flexShrink: 0, color: colors.accentText, fontSize: 12, fontWeight: '900' },
  stepLabel: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  stepNext: { flexShrink: 2, marginLeft: 'auto', color: colors.mutedText, fontSize: 12 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.control },
  segmentDone: { backgroundColor: JOBS_ACTION_GREEN },
  body: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  footer: { gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  footerErrorText: { flex: 1, color: colors.destructiveText, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  footerButton: { minWidth: 0, minHeight: 48, overflow: 'hidden', borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  footerPrimary: { backgroundColor: JOBS_ACTION_GREEN },
  footerSecondary: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  footerGhost: { backgroundColor: 'transparent' },
  footerButtonText: { flexShrink: 1, fontSize: 15, fontWeight: '800' },
  footerPrimaryText: { color: '#ffffff' },
  footerSecondaryText: { color: colors.text },
  footerGhostText: { color: colors.secondaryText },
});
