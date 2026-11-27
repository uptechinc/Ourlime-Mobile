import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type ReviewSheetProps = {
  visible: boolean;
  title: string;
  /** What is being rated (provider or product name). */
  subtitle: string;
  onClose: () => void;
  /** Swipe and backdrop do not close it while a request is running. */
  isBusy?: boolean;
  /** Pinned under the scrolling form (submit, delete). */
  footer?: ReactNode;
  children: ReactNode;
};

/** A bottom sheet for writing or editing a review: header, scrolling form, and a pinned footer above the keyboard. */
export function ReviewSheet({ visible, title, subtitle, onClose, isBusy = false, footer, children }: ReviewSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const close = () => { if (!isBusy) onClose(); };
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={close}>
    <KeyboardSafeView style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
      <ModalBackdrop onPress={close} accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
      <ModalMotionSurface variant="sheet" style={{ maxHeight: '92%' }}>
        <SwipeDismissSurface visible={visible} onDismiss={close} disabled={isBusy} handleColor={colors.border} accessibilityLabel="Swipe down to close" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
              <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={4} style={styles.closeButton}><X size={19} color={colors.icon} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Nothing in the form can change while a request is running. */}
            <View pointerEvents={isBusy ? 'none' : 'auto'} accessibilityState={{ disabled: isBusy }} style={[styles.form, isBusy && styles.formBusy]}>{children}</View>
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SwipeDismissSurface>
      </ModalMotionSurface>
    </KeyboardSafeView>
  </Modal>;
}

/** A form label with the red required mark the website uses ("Overall rating *"). */
export function RequiredLabel({ text }: { text: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text accessibilityLabel={`${text}, required`} style={styles.label}>{text} <Text style={{ color: colors.destructiveText }}>*</Text></Text>;
}

type ReviewFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
  /** "Optional" next to the label. */
  isOptional?: boolean;
};

/** A labelled text field with a live "n/max" counter that turns amber near the limit. */
export function ReviewField({ label, value, onChangeText, maxLength, placeholder, multiline = false, isOptional = false }: ReviewFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isNearLimit = value.length >= maxLength * 0.9;
  return <View style={styles.field}>
    <View style={styles.fieldHead}>
      <Text style={styles.label}>{label}{isOptional ? <Text style={styles.optional}>  Optional</Text> : null}</Text>
      <Text accessibilityLabel={`${value.length} of ${maxLength} characters`} style={[styles.counter, isNearLimit && { color: colors.warningText }]}>{value.length}/{maxLength}</Text>
    </View>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={colors.mutedText}
      multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.inputMultiline]} />
  </View>;
}

type ReviewFooterProps = {
  submitLabel: string;
  /** "Posting…" or "Saving…". */
  busyLabel: string;
  isSubmitting: boolean;
  isDisabled: boolean;
  onSubmit: () => void;
  /** Shown above the button with role alert. */
  error?: string | null;
  /** Shown for an existing review. */
  onDelete?: () => void;
};

/** The inline error, an optional Delete, and the primary Submit (with a spinner while sending). */
export function ReviewFooter({ submitLabel, busyLabel, isSubmitting, isDisabled, onSubmit, error, onDelete }: ReviewFooterProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const disabled = isDisabled || isSubmitting;
  return <View style={styles.footerInner}>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    <View style={styles.footerRow}>
      {onDelete ? <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={onDelete} style={styles.deleteButton}>
        <Trash2 size={17} color={colors.destructiveText} /><Text style={styles.deleteText}>Delete</Text>
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: isSubmitting }} disabled={disabled} onPress={onSubmit} style={[styles.submit, disabled && styles.submitDisabled]}>
        {isSubmitting ? <ActivityIndicator size="small" color={colors.onAccent} /> : null}
        <Text numberOfLines={1} style={styles.submitText}>{isSubmitting ? busyLabel : submitLabel}</Text>
      </Pressable>
    </View>
  </View>;
}

type ReviewSuccessProps = { title: string; body?: string; onDone: () => void };

/** The thank-you state shown in the sheet after a review is saved. */
export function ReviewSuccess({ title, body, onDone }: ReviewSuccessProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.success}>
    <View style={styles.successIcon}><CheckCircle2 size={34} color={colors.successText} /></View>
    <Text accessibilityRole="header" style={styles.successTitle}>{title}</Text>
    {body ? <Text style={styles.successBody}>{body}</Text> : null}
    <Pressable accessibilityRole="button" onPress={onDone} style={[styles.submit, styles.successButton]}><Text style={styles.submitText}>Done</Text></Pressable>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  sheet: { flexShrink: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.mutedText, fontSize: 13 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  body: { padding: 16 },
  form: { gap: 18 },
  formBusy: { opacity: 0.6 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footerInner: { gap: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  field: { gap: 6 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  optional: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  counter: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  inputMultiline: { minHeight: 110, lineHeight: 21 },
  error: { padding: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.destructiveSurface, color: colors.destructiveText, fontSize: 13, lineHeight: 19 },
  deleteText: { color: colors.destructiveText, fontSize: 15, fontWeight: '800' },
  deleteButton: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.destructiveBorder, backgroundColor: colors.destructiveSurface },
  submit: { flex: 1, minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: '#047857' },
  submitDisabled: { opacity: 0.45 },
  submitText: { flexShrink: 1, color: '#ffffff', fontSize: 15, fontWeight: '900' },
  success: { paddingVertical: 18, alignItems: 'center', gap: 8 },
  successIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: colors.successSurface },
  successTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  successBody: { maxWidth: 320, color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  successButton: { flex: 0, alignSelf: 'stretch', marginTop: 10 },
});
