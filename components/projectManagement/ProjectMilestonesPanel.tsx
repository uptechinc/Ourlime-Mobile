import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, ChevronRight, Flag, Plus, RotateCcw, Trash2, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import DateTimeField from '@/components/ui/DateTimeField';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import ProjectColorPicker from '@/components/projectManagement/ProjectColorPicker';
import { DEFAULT_PROJECT_COLOR, projectColorHex } from '@/components/projectManagement/projectColors';
import { STATUS_LABELS, toCalendarString } from '@/components/projectManagement/projectFormat';
import {
  PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectEmptyState, ProjectIconButton, ProjectPill, ProjectProgressBar, ProjectScreenHeader, type ProjectTone,
} from '@/components/projectManagement/ProjectUiParts';
import { projectInsightRules } from '@/lib/services/ProjectInsightRules';
import { projectService } from '@/lib/services/ProjectService';
import type { Milestone, ProjectRecord, Task } from '@/lib/types/project';

type ProjectMilestonesPanelProps = {
  project: ProjectRecord;
  milestones: Milestone[];
  tasks: Task[];
  /** Members who can change project content (not viewers, not read-only projects). */
  canEdit: boolean;
  currentUserId: string;
  /** Opens the add form from outside (the Overview's "Set a milestone"). */
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  onOpenTask: (task: Task) => void;
  onAddTask: (milestoneId: string) => void;
};

const MAX_LINKED_SHOWN = 4;

/** Milestones in date order with the progress of their linked tasks, plus the add form. */
export default function ProjectMilestonesPanel({ project, milestones, tasks, canEdit, currentUserId, isCreateOpen, onOpenCreate, onCloseCreate, onOpenTask, onAddTask }: ProjectMilestonesPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = projectInsightRules.today();
  const sorted = useMemo(() => projectInsightRules.sortMilestones(milestones), [milestones]);
  const canManage = project.role === 'owner' || project.role === 'admin';

  const resetForm = (): void => { setName(''); setDueDate(null); setColor(DEFAULT_PROJECT_COLOR); };

  const handleCreate = async (): Promise<void> => {
    if (creating) return;
    if (!name.trim()) { toast.error('Give the milestone a name.'); return; }
    setCreating(true);
    try {
      await projectService.createMilestone(project.id, { name: name.trim(), dueDate: dueDate ? toCalendarString(dueDate) : '', color });
      toast.success('Milestone added');
      resetForm();
      onCloseCreate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The milestone could not be added.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (milestone: Milestone): Promise<void> => {
    if (busyId) return;
    setBusyId(milestone.id);
    try {
      await projectService.setMilestoneCompleted(project.id, milestone.id, !milestone.completed);
      toast.success(milestone.completed ? 'Milestone reopened' : 'Milestone completed');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The milestone could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try { await projectService.deleteMilestone(project.id, target.id); toast.success('Milestone deleted'); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'The milestone could not be deleted.'); }
  };

  const statusOf = (milestone: Milestone): { label: string; tone: ProjectTone } => {
    if (milestone.completed) return { label: 'Completed', tone: 'success' };
    const due = projectInsightRules.dueLabel(milestone.dueDate, today);
    if (!due) return { label: 'No date', tone: 'neutral' };
    return { label: due.label, tone: due.tone === 'danger' ? 'danger' : due.tone === 'warning' ? 'warning' : 'neutral' };
  };

  return (
    <View style={{ gap: 12 }}>
      {canEdit && sorted.length > 0 ? <ProjectButton label="Add milestone" icon={<Plus size={18} color="#ffffff" />} onPress={onOpenCreate} /> : null}

      {sorted.length === 0 ? (
        <View style={styles.card}>
          <ProjectEmptyState
            icon={<Flag size={34} color={colors.accentText} />}
            title="No milestones yet"
            hint={'A milestone is a checkpoint with a date, like "Venue booked" or "First release". Link tasks to it to see how close you are.'}
            actionLabel={canEdit ? 'Add the first milestone' : undefined}
            onAction={canEdit ? onOpenCreate : undefined}
          />
        </View>
      ) : sorted.map((milestone) => {
        const linked = projectInsightRules.sortTasks(tasks.filter((task) => task.milestoneId === milestone.id));
        const progress = projectInsightRules.milestoneProgress(milestone.id, tasks);
        const status = statusOf(milestone);
        const canDelete = canEdit && (canManage || milestone.createdBy === currentUserId);
        return (
          <View key={milestone.id} style={[styles.card, milestone.completed && { opacity: 0.85 }]}>
            <View style={styles.titleRow}>
              <View style={[styles.dot, { backgroundColor: projectColorHex(milestone.color) }]} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text numberOfLines={3} style={[styles.name, milestone.completed && styles.nameDone]}>{milestone.name}</Text>
                <View style={styles.pills}>
                  <ProjectPill label={status.label} tone={status.tone} />
                  {milestone.dueDate && !milestone.completed ? <Text style={styles.muted}>{projectInsightRules.shortDate(milestone.dueDate, today)}</Text> : null}
                </View>
              </View>
              {canDelete ? (
                <ProjectIconButton size={44} accessibilityLabel={`Delete ${milestone.name}`} onPress={() => setDeleteTarget(milestone)}>
                  <Trash2 size={18} color={colors.destructiveText} />
                </ProjectIconButton>
              ) : null}
            </View>
            {milestone.description ? <Text style={styles.muted}>{milestone.description}</Text> : null}

            <View style={{ gap: 6 }}>
              <Text style={styles.muted}>{progress.total > 0 ? `${progress.done} of ${progress.total} linked ${progress.total === 1 ? 'task' : 'tasks'} done` : 'No tasks linked yet'}</Text>
              {progress.total > 0 ? <ProjectProgressBar value={progress.percent} color={progress.percent === 100 ? '#047857' : undefined} accessibilityLabel={`${milestone.name} progress`} /> : null}
            </View>

            {linked.length > 0 ? (
              <View style={styles.linkedList}>
                {linked.slice(0, MAX_LINKED_SHOWN).map((task) => (
                  <Pressable key={task.id} onPress={() => onOpenTask(task)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`${task.title}, ${STATUS_LABELS[task.status]}`} style={styles.linkedRow}>
                    {task.status === 'done' ? <CheckCircle2 size={16} color={colors.accentText} /> : <View style={styles.openDot} />}
                    <Text numberOfLines={1} style={[styles.linkedTitle, task.status === 'done' && styles.nameDone]}>{task.title}</Text>
                    <ChevronRight size={16} color={colors.mutedText} />
                  </Pressable>
                ))}
                {linked.length > MAX_LINKED_SHOWN ? <Text style={styles.muted}>and {linked.length - MAX_LINKED_SHOWN} more</Text> : null}
              </View>
            ) : null}

            {canEdit ? (
              <View style={styles.actions}>
                <ProjectButton
                  label={milestone.completed ? 'Reopen' : 'Mark complete'}
                  variant="secondary"
                  isCompact
                  isBusy={busyId === milestone.id}
                  icon={milestone.completed ? <RotateCcw size={16} color={colors.text} /> : <CheckCircle2 size={16} color={colors.accentText} />}
                  onPress={() => void handleToggle(milestone)}
                  style={{ flex: 1 }}
                />
                {!milestone.completed ? <ProjectButton label="Add task" variant="secondary" isCompact icon={<Plus size={16} color={colors.text} />} onPress={() => onAddTask(milestone.id)} accessibilityLabel={`Add a task to ${milestone.name}`} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <Modal visible={isCreateOpen} animationType="slide" onRequestClose={() => { if (!creating) onCloseCreate(); }}>
        <View style={{ flex: 1, backgroundColor: colors.canvas }}>
          <ProjectScreenHeader
            title="Add milestone"
            onBack={() => { if (!creating) onCloseCreate(); }}
            right={<ProjectIconButton accessibilityLabel="Close" onPress={() => { if (!creating) onCloseCreate(); }}><X size={22} color={colors.icon} /></ProjectIconButton>}
          />
          <KeyboardSafeView style={{ flex: 1 }}>
            <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: PROJECT_GUTTER, gap: 16 }}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Milestone name *</Text>
                  <TextInput value={name} onChangeText={setName} maxLength={120} editable={!creating} placeholder="e.g. Venue booked" placeholderTextColor={colors.mutedText} accessibilityLabel="Milestone name" style={styles.input} />
                </View>
                <DateTimeField label="Target date" mode="date" placeholder="No date" value={dueDate} onChange={setDueDate} onClear={() => setDueDate(null)} />
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Colour</Text>
                  <ProjectColorPicker value={color} onChange={setColor} disabled={creating} />
                </View>
                <Text style={styles.muted}>Link tasks to it from a task&apos;s details, or with “Add task” on the milestone.</Text>
              </ScrollView>
            </SafeAreaView>
            <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom) }]}>
              <ProjectButton label="Add milestone" busyLabel="Adding…" isBusy={creating} onPress={() => void handleCreate()} />
            </View>
          </KeyboardSafeView>
        </View>
      </Modal>

      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Delete milestone?"
        message={`${deleteTarget?.name ?? 'This milestone'} will be removed. Its tasks stay in the project.`}
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  nameDone: { color: colors.mutedText, textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  linkedList: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderRadius: 8, overflow: 'hidden' },
  openDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.mutedText, marginHorizontal: 1 },
  linkedTitle: { flex: 1, color: colors.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  label: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  bar: { paddingHorizontal: PROJECT_GUTTER, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
