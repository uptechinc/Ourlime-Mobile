import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import DateTimeField from '@/components/ui/DateTimeField';
import { PROJECT_RIPPLE, ProjectButton, ProjectChip } from '@/components/projectManagement/ProjectUiParts';
import { parseCalendarString, toCalendarString } from '@/components/projectManagement/projectFormat';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

/**
 * Form building blocks for the optional project modules (deliverables, registers, time log, clients): labelled text
 * fields, a calendar-day field, option chips, an edit sheet and a note sheet (for reasons). No native alerts.
 */
type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  isRequired?: boolean;
  isDisabled?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'url';
  hint?: string;
};

export function ProjectTextField({ label, value, onChangeText, placeholder, multiline = false, maxLength, isRequired = false, isDisabled = false, keyboardType = 'default', hint }: TextFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={{ gap: 6 }}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}{isRequired ? ' *' : ''}</Text>
      {maxLength && multiline ? <Text style={styles.label}>{value.length}/{maxLength}</Text> : null}
    </View>
    <TextInput
      value={value}
      onChangeText={(next) => onChangeText(maxLength ? next.slice(0, maxLength) : next)}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedText}
      multiline={multiline}
      maxLength={maxLength}
      editable={!isDisabled}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
      autoCorrect={keyboardType !== 'url'}
      accessibilityLabel={label}
      style={[styles.input, multiline && styles.inputMultiline]}
    />
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}

type DayFieldProps = { label: string; value: string; onChange: (value: string) => void; placeholder?: string; minimumToday?: boolean };

/** A calendar day stored as 'YYYY-MM-DD' ('' when cleared). */
export function ProjectDayField({ label, value, onChange, placeholder = 'No date', minimumToday = false }: DayFieldProps) {
  return <DateTimeField
    label={label}
    mode="date"
    placeholder={placeholder}
    value={parseCalendarString(value)}
    minimumDate={minimumToday ? new Date() : undefined}
    onChange={(date) => onChange(toCalendarString(date))}
    onClear={() => onChange('')}
  />;
}

type OptionChipsProps<T extends string> = { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void };

export function ProjectOptionChips<T extends string>({ label, value, options, onChange }: OptionChipsProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.chips}>
      {options.map((option) => <ProjectChip key={option.value} label={option.label} isSelected={option.value === value} onPress={() => onChange(option.value)} />)}
    </View>
  </View>;
}

type EditSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  saveLabel: string;
  saveTone?: 'primary' | 'danger';
  isSaving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
};

/** A bottom sheet holding a form, with Cancel and Save; the error shows above the buttons. */
export function ProjectEditSheet({ visible, title, subtitle, saveLabel, saveTone = 'primary', isSaving, error, onSave, onClose, children }: EditSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const close = (): void => { if (!isSaving) onClose(); };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <KeyboardSafeView style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
          </View>
          {children}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <ProjectButton label="Cancel" variant="secondary" onPress={close} isDisabled={isSaving} style={{ flex: 1 }} />
            <ProjectButton label={saveLabel} variant={saveTone} busyLabel="Saving…" isBusy={isSaving} onPress={onSave} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </KeyboardSafeView>
  </Modal>;
}

type NoteSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  label: string;
  confirmLabel: string;
  isRequired: boolean;
  maxLength?: number;
  tone?: 'primary' | 'danger';
  placeholder?: string;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
};

/** Asks for a note or reason before an action (custom sheet, never a native alert). Throw from onConfirm to keep it open. */
export function ProjectNoteSheet({ visible, title, message, label, confirmLabel, isRequired, maxLength = 1000, tone = 'primary', placeholder, onConfirm, onClose }: NoteSheetProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => { if (visible) { setNote(''); setError(''); setSaving(false); } }, [visible]);

  const handleConfirm = async (): Promise<void> => {
    if (savingRef.current) return;
    if (isRequired && !note.trim()) { setError('Add a short note first.'); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onConfirm(note.trim());
      onClose();
    } catch (failure: unknown) {
      console.error('[ProjectNoteSheet.handleConfirm] Error:', failure);
      setError(failure instanceof Error ? failure.message : 'That did not save. Try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <ProjectEditSheet visible={visible} title={title} subtitle={message} saveLabel={confirmLabel} saveTone={tone} isSaving={saving} error={error} onSave={() => void handleConfirm()} onClose={onClose}>
    <ProjectTextField label={label} value={note} onChangeText={(value) => { setNote(value); if (error) setError(''); }} multiline maxLength={maxLength} isRequired={isRequired} placeholder={placeholder} />
  </ProjectEditSheet>;
}

type ListRowProps = { title: string; detail?: string; right?: ReactNode; onPress?: () => void; accessibilityLabel?: string; isFirst?: boolean; children?: ReactNode };

/** One row of a bordered list; pressable when onPress is given. */
export function ProjectListRow({ title, detail, right, onPress, accessibilityLabel, isFirst = false, children }: ListRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const body = <>
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text numberOfLines={2} style={styles.rowTitle}>{title}</Text>
      {detail ? <Text numberOfLines={3} style={styles.hint}>{detail}</Text> : null}
      {children}
    </View>
    {right}
  </>;
  if (!onPress) return <View style={[styles.row, !isFirst && styles.rowDivider]}>{body}</View>;
  return <Pressable onPress={onPress} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={[styles.row, !isFirst && styles.rowDivider]}>{body}</Pressable>;
}

/** "Nov 3, 2026, 4:05 PM" from an ISO time ('' stays ''). */
export function formatWhen(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.getTime() === 0) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const projectListStyle = (colors: AppThemeColors) => ({ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' as const });

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    input: { minHeight: 48, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
    hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim },
    sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '90%' },
    title: { fontSize: 18, fontWeight: '900', color: colors.text },
    error: { fontSize: 13, fontWeight: '700', color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, overflow: 'hidden' },
    actions: { flexDirection: 'row', gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56, overflow: 'hidden' },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  });
}
