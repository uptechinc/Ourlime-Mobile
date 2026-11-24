import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, ArchiveRestore, CheckCircle2, ChevronRight, PauseCircle, PlayCircle, RotateCcw } from 'lucide-react-native';
import { toast } from 'sonner-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import { PROJECT_TRANSITION_REASON_LIMIT, projectLifecycleRules, type ProjectTransitionKind } from '@/lib/services/ProjectLifecycleRules';
import type { ProjectOutcomeInput, ProjectStatus } from '@/lib/types/project';

type ProjectLifecycleSheetProps = {
  visible: boolean;
  projectName: string;
  status: ProjectStatus;
  /** Open straight on the confirmation for this status (the banner's Restore); null starts on the list of choices. */
  initialTarget?: ProjectStatus | null;
  onClose: () => void;
  /** Runs the transition (with the outcome report when completing); throw to keep the sheet open with the error shown. */
  onConfirm: (toStatus: ProjectStatus, reason: string, outcome?: ProjectOutcomeInput) => Promise<void>;
  /** Accepted deliverables the outcome will record (null when the deliverables module is off). */
  acceptedDeliverableCount?: number | null;
  /** Called when the server says the project changed meanwhile, so the screen can reload it. */
  onStale?: () => void;
};

const KIND_ICON: { [kind in ProjectTransitionKind]: typeof Archive } = {
  pause: PauseCircle, resume: PlayCircle, complete: CheckCircle2, archive: Archive, restore: ArchiveRestore, reopen: RotateCcw,
};
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const EMPTY_OUTCOME: ProjectOutcomeInput = { summary: '', beneficiaries: '', results: '', lessons: '' };
const OUTCOME_FIELDS: { key: keyof ProjectOutcomeInput; label: string; limit: number; placeholder: string }[] = [
  { key: 'summary', label: 'What the project achieved', limit: 2000, placeholder: 'For example: the garden opened with 24 beds' },
  { key: 'beneficiaries', label: 'Who benefited (optional)', limit: 1000, placeholder: 'For example: 40 families on the estate' },
  { key: 'results', label: 'Results (optional)', limit: 2000, placeholder: 'What changed, with numbers where you have them' },
  { key: 'lessons', label: 'Lessons learned (optional)', limit: 2000, placeholder: 'What you would do differently next time' },
];

/** Project status actions (pause, complete, archive, restore, reopen) and the confirmation with its reason field. */
export default function ProjectLifecycleSheet({ visible, projectName, status, initialTarget = null, onClose, onConfirm, onStale, acceptedDeliverableCount = null }: ProjectLifecycleSheetProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [target, setTarget] = useState<ProjectStatus | null>(initialTarget);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<ProjectOutcomeInput>(EMPTY_OUTCOME);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setTarget(initialTarget);
    setReason('');
    setOutcome(EMPTY_OUTCOME);
    setError('');
    setSaving(false);
  }, [initialTarget, visible]);

  const handleClose = (): void => { if (!savingRef.current) onClose(); };

  const handleConfirm = async (): Promise<void> => {
    if (!target || savingRef.current) return;
    const trimmed = reason.trim();
    if (projectLifecycleRules.reasonRequired(status, target) && !trimmed) { setError('Add a short reason so the team knows why.'); return; }
    const completing = target === 'completed';
    if (completing && !outcome.summary.trim()) { setError('Add a short outcome summary: what the project achieved.'); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onConfirm(target, trimmed, completing ? outcome : undefined);
      toast.success(projectLifecycleRules.copy(status, target).doneMessage);
      onClose();
    } catch (failure: unknown) {
      console.error('[ProjectLifecycleSheet.handleConfirm] Error:', failure);
      if (projectService.isStaleProjectError(failure)) {
        setError('Someone changed this project while you were looking at it. It has been refreshed; check the status and try again.');
        onStale?.();
      } else {
        setError(failure instanceof Error ? failure.message : 'The project status could not be changed. Try again.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const targets = projectLifecycleRules.targets(status);
  const copy = target ? projectLifecycleRules.copy(status, target) : null;
  const required = target ? projectLifecycleRules.reasonRequired(status, target) : false;
  const toneColor = copy?.tone === 'danger' ? colors.destructive : copy?.tone === 'warning' ? '#d97706' : '#047857';
  const ConfirmIcon = target ? KIND_ICON[projectLifecycleRules.kind(status, target)] : CheckCircle2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardSafeView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {!target || !copy ? (
              <>
                <View style={{ gap: 2 }}>
                  <Text style={styles.eyebrow}>Project status · {projectLifecycleRules.label(status)}</Text>
                  <Text numberOfLines={2} style={styles.title}>{projectName}</Text>
                </View>
                <View style={styles.list}>
                  {targets.map((option, index) => {
                    const optionCopy = projectLifecycleRules.copy(status, option);
                    const Icon = KIND_ICON[projectLifecycleRules.kind(status, option)];
                    const danger = option === 'archived';
                    return (
                      <Pressable
                        key={option}
                        onPress={() => { setTarget(option); setError(''); }}
                        android_ripple={RIPPLE}
                        accessibilityRole="button"
                        accessibilityLabel={optionCopy.menuLabel}
                        style={[styles.row, index > 0 ? styles.rowDivider : null]}
                      >
                        <View style={[styles.rowIcon, { backgroundColor: danger ? colors.destructiveSurface : colors.successSurface }]}>
                          <Icon size={18} color={danger ? colors.destructive : '#047857'} />
                        </View>
                        <Text style={[styles.rowText, danger ? { color: colors.destructiveText } : null]}>{optionCopy.menuLabel}</Text>
                        <ChevronRight size={18} color={colors.mutedText} />
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={handleClose} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.confirmHeader}>
                  <View style={[styles.badge, { backgroundColor: copy.tone === 'danger' ? colors.destructiveSurface : copy.tone === 'warning' ? colors.warningSurface : colors.successSurface }]}>
                    <ConfirmIcon size={24} color={toneColor} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.title} accessibilityRole="header">{copy.title}</Text>
                    <Text numberOfLines={2} style={styles.projectName}>{projectName}</Text>
                  </View>
                </View>
                <Text style={styles.body}>{copy.description}</Text>
                {target === 'completed' ? (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.label}>OUTCOME REPORT</Text>
                    <Text style={styles.hint}>
                      {acceptedDeliverableCount === null ? 'A short record of what the project achieved.' : `${acceptedDeliverableCount} accepted ${acceptedDeliverableCount === 1 ? 'deliverable is' : 'deliverables are'} recorded with it.`} Visible to project members only. Nothing is published.
                    </Text>
                    {OUTCOME_FIELDS.map((field) => (
                      <View key={field.key} style={{ gap: 4 }}>
                        <Text style={styles.label}>{field.label}{field.key === 'summary' ? ' *' : ''}</Text>
                        <TextInput
                          value={outcome[field.key]}
                          onChangeText={(value) => { setOutcome((current) => ({ ...current, [field.key]: value.slice(0, field.limit) })); if (error) setError(''); }}
                          editable={!saving}
                          multiline
                          maxLength={field.limit}
                          placeholder={field.placeholder}
                          placeholderTextColor={colors.mutedText}
                          accessibilityLabel={field.label}
                          style={[styles.input, { minHeight: 72 }]}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.label}>{copy.reasonLabel}{required ? ' *' : ''}</Text>
                    <Text style={styles.label}>{reason.trim().length}/{PROJECT_TRANSITION_REASON_LIMIT}</Text>
                  </View>
                  <TextInput
                    value={reason}
                    onChangeText={(value) => { setReason(value.slice(0, PROJECT_TRANSITION_REASON_LIMIT)); if (error) setError(''); }}
                    editable={!saving}
                    multiline
                    maxLength={PROJECT_TRANSITION_REASON_LIMIT}
                    placeholder={required ? 'For example: the season ended' : 'Add a note for the activity log'}
                    placeholderTextColor={colors.mutedText}
                    accessibilityLabel={copy.reasonLabel}
                    style={styles.input}
                  />
                  <Text style={styles.hint}>Everyone on the project can see this change and its note in Project activity.</Text>
                </View>
                {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  <Pressable onPress={() => (initialTarget ? handleClose() : setTarget(null))} disabled={saving} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel={initialTarget ? 'Cancel' : 'Back'} style={[styles.secondaryButton, { flex: 1 }]}>
                    <Text style={styles.secondaryText}>{initialTarget ? 'Cancel' : 'Back'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleConfirm()}
                    disabled={saving}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                    accessibilityRole="button"
                    accessibilityLabel={copy.confirmLabel}
                    accessibilityState={{ disabled: saving, busy: saving }}
                    style={[styles.primaryButton, { backgroundColor: copy.tone === 'danger' ? colors.destructive : copy.tone === 'warning' ? '#d97706' : '#047857', opacity: saving ? 0.7 : 1 }]}
                  >
                    {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryText}>{copy.confirmLabel}</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '88%', borderTopWidth: isDark ? 1 : 0, borderColor: colors.border },
  eyebrow: { fontSize: 11, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  projectName: { fontSize: 13, fontWeight: '700', color: colors.secondaryText },
  list: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, minHeight: 56 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 14, lineHeight: 20, color: colors.secondaryText },
  label: { fontSize: 11, fontWeight: '800', color: colors.mutedText },
  input: { minHeight: 92, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.mutedText },
  error: { fontSize: 13, fontWeight: '700', color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 10 },
  secondaryButton: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  secondaryText: { fontSize: 15, fontWeight: '800', color: colors.text },
  primaryButton: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primaryText: { fontSize: 15, fontWeight: '900', color: '#ffffff' },
});
