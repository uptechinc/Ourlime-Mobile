import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, CheckCircle2, Clock, Flag, ListTodo, Lock, Plus, Sparkles, Trash2, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import DateTimeField from '@/components/ui/DateTimeField';
import CustomModal from '@/components/ui/CustomModal';
import ProjectColorPicker from '@/components/projectManagement/ProjectColorPicker';
import { DEFAULT_PROJECT_COLOR, projectColorHex } from '@/components/projectManagement/projectColors';
import { EmptyPanel, PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { formatCalendarDate, toCalendarString } from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import { projectService } from '@/lib/services/ProjectService';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import type { Milestone, ProjectRecord, Task } from '@/lib/types/project';

type ProjectMilestonesPanelProps = {
  project: ProjectRecord;
  milestones: Milestone[];
  tasks: Task[];
  canEdit: boolean;
  onOpenUpgrade: () => void;
};

/** Website ProjectMilestonesTab: milestone cards with linked-task progress, plus the Add milestone form. */
export default function ProjectMilestonesPanel({ project, milestones, tasks, canEdit, onOpenUpgrade }: ProjectMilestonesPanelProps) {
  const { colors } = useAppTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const entitlement = projectEntitlementService.canCreateMilestone(milestones.length, project);
  const isPremium = projectEntitlementService.isPremium(project);

  const handleOpenCreate = (): void => {
    if (!entitlement.allowed) { onOpenUpgrade(); return; }
    setName(''); setDueDate(null); setColor(DEFAULT_PROJECT_COLOR); setShowCreate(true);
  };

  const handleCreate = async (): Promise<void> => {
    if (creating) return;
    if (!name.trim()) { toast.error('Milestone title is required'); return; }
    if (!entitlement.allowed) { toast.error(entitlement.reason || 'Milestone limit reached'); onOpenUpgrade(); return; }
    setCreating(true);
    try {
      await projectService.createMilestone(project.id, { name: name.trim(), dueDate: dueDate ? toCalendarString(dueDate) : '', color });
      toast.success('Milestone created!');
      setShowCreate(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create milestone');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (milestone: Milestone): Promise<void> => {
    if (busyId) return;
    setBusyId(milestone.id);
    try { await projectService.setMilestoneCompleted(project.id, milestone.id, !milestone.completed); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Could not update the milestone.'); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (): Promise<void> => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try { await projectService.deleteMilestone(project.id, target.id); toast.success('Milestone deleted'); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Could not delete the milestone.'); }
  };

  const today = toCalendarString(new Date());
  const card = { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 } as const;

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Flag size={18} color={colors.accent} />}
        title="Project Milestones & Roadmaps"
        badge={`${milestones.length} ${milestones.length === 1 ? 'Milestone' : 'Milestones'}${isPremium ? '' : ' (Max 2 on Free Plan)'}`}
        description="Group related tasks into high-level phases and critical project delivery goals."
        action={canEdit ? (
          <TouchableOpacity onPress={handleOpenCreate} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.accent }}>
            {entitlement.allowed ? <Plus size={15} color={colors.onAccent} /> : <Lock size={15} color={colors.onAccent} />}
            <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 13 }}>{entitlement.allowed ? 'Add Milestone' : 'Upgrade for More Milestones'}</Text>
          </TouchableOpacity>
        ) : null}
      />

      {!isPremium && milestones.length >= 2 ? (
        <View style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: colors.warningSurface, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Sparkles size={16} color="#d97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.warningText, fontWeight: '900', fontSize: 13 }}>Milestone Limit Reached</Text>
              <Text style={{ color: colors.warningText, fontSize: 12, lineHeight: 17 }}>You have reached the 2-milestone limit for Free projects. Upgrade to Premium for unlimited milestones and timeline dependencies.</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onOpenUpgrade} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#d97706' }}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>Upgrade Project</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {milestones.length === 0 ? (
        <EmptyPanel
          icon={<Flag size={26} color="#9333ea" />}
          title="No milestones defined yet"
          message={'Set major checkpoints like "Design Phase Signoff" or "Beta Launch" to track team progress.'}
          action={canEdit ? <TouchableOpacity onPress={handleOpenCreate} style={{ marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 12 }}>Create First Milestone</Text></TouchableOpacity> : null}
        />
      ) : milestones.map((milestone) => {
        const linked = tasks.filter((task) => task.milestoneId === milestone.id);
        const done = linked.filter((task) => task.status === 'done').length;
        const progress = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;
        const overdue = Boolean(milestone.dueDate) && !milestone.completed && milestone.dueDate < today;
        const badge = milestone.completed
          ? { label: 'Completed', color: '#15803d', background: '#dcfce7', Icon: CheckCircle2 }
          : overdue ? { label: 'Overdue', color: '#b91c1c', background: '#fee2e2', Icon: Clock } : { label: 'Active', color: '#1d4ed8', background: '#dbeafe', Icon: null };
        return (
          <View key={milestone.id} style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: projectColorHex(milestone.color) }} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' }}>{milestone.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: badge.background }}>
                {badge.Icon ? <badge.Icon size={12} color={badge.color} /> : null}
                <Text style={{ color: badge.color, fontSize: 11, fontWeight: '800' }}>{badge.label}</Text>
              </View>
            </View>
            {milestone.description ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>{milestone.description}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Calendar size={13} color={colors.mutedText} /><Text style={{ color: colors.mutedText, fontSize: 12 }}>{milestone.dueDate ? formatCalendarDate(milestone.dueDate) : 'No due date'}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ListTodo size={13} color={colors.mutedText} /><Text style={{ color: colors.mutedText, fontSize: 12 }}>{linked.length} linked task{linked.length !== 1 ? 's' : ''}</Text></View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Task Progress</Text>
                <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{done} of {linked.length} ({progress}%)</Text>
              </View>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.control, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#3b82f6' }} />
              </View>
            </View>
            {canEdit ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity disabled={busyId === milestone.id} onPress={() => void handleToggle(milestone)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  {busyId === milestone.id ? <ActivityIndicator size="small" color={colors.accent} /> : <CheckCircle2 size={14} color={colors.accent} />}
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{milestone.completed ? 'Reopen' : 'Mark complete'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeleteTarget(milestone)} accessibilityLabel={`Delete ${milestone.name}`} style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.destructiveSurface }}>
                  <Trash2 size={15} color={colors.destructiveText} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => { if (!creating) setShowCreate(false); }}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setShowCreate(false)} disabled={creating} accessibilityLabel="Close" style={{ padding: 6 }}><X size={22} color={colors.text} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '900' }}>Add milestone</Text>
            <TouchableOpacity onPress={() => void handleCreate()} disabled={creating} style={{ minWidth: 72, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent, opacity: creating ? 0.7 : 1 }}>
              {creating ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Create</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardSafeView style={{ flex: 1 }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Milestone name <Text style={{ color: '#ef4444' }}>*</Text></Text>
                <TextInput value={name} onChangeText={setName} maxLength={120} editable={!creating} placeholder="e.g. Beta Launch" placeholderTextColor={colors.mutedText} style={{ minHeight: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }} />
              </View>
              <DateTimeField label="Target date" mode="date" placeholder="No due date" value={dueDate} onChange={setDueDate} onClear={() => setDueDate(null)} />
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Colour</Text>
                <ProjectColorPicker value={color} onChange={setColor} disabled={creating} />
              </View>
            </ScrollView>
          </KeyboardSafeView>
        </SafeAreaView>
      </Modal>

      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Delete milestone?"
        message={`${deleteTarget?.name ?? 'This milestone'} will be removed. Linked tasks stay on the board.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      />
    </View>
  );
}
