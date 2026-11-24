import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ChevronDown, ChevronUp, Flag, Link2, Paperclip, Plus, Trash2, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import DateTimeField from '@/components/ui/DateTimeField';
import UserAvatar from '@/components/ui/UserAvatar';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { FileTypeIcon } from '@/components/projectManagement/ProjectFilesPanel';
import { PRIORITY_OPTIONS, STATUS_LABELS, formatFileSize, toCalendarString } from '@/components/projectManagement/projectFormat';
import type {
  Milestone, PickedTaskFile, Priority, ProjectRecord, Status, Task, TaskTemplate, TeamMember,
} from '@/lib/types/project';

type CreateTaskSheetProps = {
  visible: boolean;
  project: ProjectRecord;
  currentUserId: string;
  teamMembers: TeamMember[];
  tasks: Task[];
  milestones: Milestone[];
  taskTemplates: TaskTemplate[];
  /** Column the task starts in (a board column's "Add task"). */
  initialStatus?: Status;
  /** Milestone the task starts linked to (a milestone's "Add task"). */
  initialMilestoneId?: string;
  onClose: () => void;
  onCreated: () => void;
};

const STATUSES: Status[] = ['todo', 'in-progress', 'done'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Website TaskCreationModal: title, description, status, priority, due date, people and milestone up front; start
 * date, estimate, tags, dependencies, templates and owner attachments under "More options". The website's repeat
 * setting is not offered: nothing creates the next occurrence yet, so it would promise something that never happens.
 */
export default function CreateTaskSheet({ visible, project, currentUserId, teamMembers, tasks, milestones, taskTemplates, initialStatus, initialMilestoneId, onClose, onCreated }: CreateTaskSheetProps) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<Status>('todo');
  const [assignees, setAssignees] = useState<string[]>([currentUserId]);
  const [assignedToAll, setAssignedToAll] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('1');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [files, setFiles] = useState<PickedTaskFile[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const savingRef = useRef(false);
  // One id per form, so a retried create after a dropped connection is the same task (the callable is idempotent).
  const pendingTaskIdRef = useRef<string | null>(null);

  const assignableMembers = teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending' || member.id === currentUserId);

  const resetForm = (): void => {
    setTitle(''); setDescription(''); setPriority('medium'); setStatus('todo'); setAssignees([currentUserId]); setAssignedToAll(false);
    setStartDate(null); setDueDate(null); setEstimatedTime('1'); setTags([]); setTagInput(''); setMilestoneId(''); setNewMilestoneName('');
    setDependencies([]); setShowMore(false); setTemplateId(''); setSaveAsTemplate(false); setFiles([]); setError(''); setProgressLabel('');
    pendingTaskIdRef.current = null;
  };

  // Each time the sheet opens, start in the column / milestone it was opened from.
  useEffect(() => {
    if (!visible) return;
    setStatus(initialStatus ?? 'todo');
    setMilestoneId(initialMilestoneId ?? '');
  }, [initialMilestoneId, initialStatus, visible]);

  const handleClose = (): void => {
    if (savingRef.current) return;
    resetForm();
    onClose();
  };

  const toggle = (list: string[], id: string): string[] => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);

  const handleAddTag = (): void => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags((current) => [...current, tag]);
    setTagInput('');
  };

  const handleSelectTemplate = (id: string): void => {
    setTemplateId(id);
    const template = taskTemplates.find((entry) => entry.id === id);
    if (!template) return;
    setTitle(template.name); setDescription(template.description); setPriority(template.priority);
    setEstimatedTime(String(template.estimatedTime || 0)); setTags([...template.tags]);
    setAssignees(template.assignees.length > 0 ? [...template.assignees] : template.assignee ? [template.assignee] : []);
    setAssignedToAll(template.assignedToAll);
  };

  const handleDeleteTemplate = async (): Promise<void> => {
    if (!templateId) return;
    try {
      await projectService.deleteTaskTemplate(project.id, templateId);
      setTemplateId('');
      toast.success('Template deleted');
    } catch (deleteError: unknown) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'The template could not be deleted.');
    }
  };

  const handleCreateMilestone = async (): Promise<void> => {
    const name = newMilestoneName.trim();
    if (!name || creatingMilestone) return;
    setCreatingMilestone(true);
    try {
      await projectService.createMilestone(project.id, { name });
      setNewMilestoneName('');
      toast.success('Milestone created');
    } catch (milestoneError: unknown) {
      toast.error(milestoneError instanceof Error ? milestoneError.message : 'Failed to create milestone');
    } finally {
      setCreatingMilestone(false);
    }
  };

  const handlePickFiles = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
    if (result.canceled) return;
    const picked = result.assets.map((asset): PickedTaskFile => ({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? 'application/octet-stream' }));
    const rejected = picked.filter((file) => !file.size || file.size > MAX_ATTACHMENT_BYTES);
    if (rejected.length > 0) toast.error(`Up to 10 MB per file. Not added: ${rejected.map((file) => file.name).join(', ')}`);
    setFiles((current) => [...current, ...picked.filter((file) => file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES)]);
  };

  const handleCreate = async (): Promise<void> => {
    if (savingRef.current) return;
    if (!title.trim()) { setError('Please enter a task title'); return; }
    const today = toCalendarString(new Date());
    const start = startDate ? toCalendarString(startDate) : '';
    const due = dueDate ? toCalendarString(dueDate) : '';
    if (start && start < today) { setError('Start date cannot be in the past'); return; }
    if (due && due < today) { setError('Due date cannot be in the past'); return; }
    if (start && due && due < start) { setError('Due date must be on or after the start date'); return; }
    const hours = Number(estimatedTime || '0');
    if (!Number.isFinite(hours) || hours < 0) { setError('Estimated time must be zero or more hours.'); return; }

    const memberIds = assignableMembers.map((member) => member.id);
    const chosen = assignedToAll ? memberIds : assignees;
    const fields = {
      title: title.trim(), description: description.trim(), status, priority,
      assignee: chosen[0] ?? '', assignees: chosen, assignedToAll, startDate: start, dueDate: due, estimatedTime: hours,
      tags, dependencies, milestoneId,
    };

    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      if (saveAsTemplate) {
        await projectService.saveTaskTemplate(project.id, {
          name: fields.title, description: fields.description, priority, assignee: fields.assignee, assignees: chosen, assignedToAll,
          dueDate: due, estimatedTime: hours, tags, subTasks: [],
        }).catch((templateError: unknown) => console.warn('[CreateTaskSheet.handleCreate] Error:', templateError instanceof Error ? templateError.message : 'template not saved'));
      }
      pendingTaskIdRef.current ??= await projectService.newTaskId();
      let uploaded = 0;
      if (files.length > 0) setProgressLabel(`Uploading 0 of ${files.length}…`);
      await projectService.createFullTask(project, teamMembers, pendingTaskIdRef.current, fields, files, [], () => {
        uploaded += 1;
        setProgressLabel(`Uploading ${uploaded} of ${files.length}…`);
      });
      toast.success('Task created');
      resetForm();
      onCreated();
      onClose();
    } catch (createError: unknown) {
      console.error('[CreateTaskSheet.handleCreate] Error:', createError);
      setError(createError instanceof Error ? createError.message : 'Task could not be saved. Retry.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      setProgressLabel('');
    }
  };

  const chip = (selected: boolean, accent: string = '#047857') => ({
    minHeight: 36, justifyContent: 'center' as const, maxWidth: '100%' as const, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1,
    borderColor: selected ? accent : colors.border, backgroundColor: selected ? accent : colors.control,
  });
  const chipText = (selected: boolean) => ({ color: selected ? '#ffffff' : colors.secondaryText, fontWeight: '700' as const, fontSize: 13 });
  const label = { color: colors.secondaryText, fontSize: 13, fontWeight: '700' as const };
  const input = { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 } as const;
  const section = { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 } as const;
  const sectionTitle = (Icon: typeof Flag, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon size={15} color={colors.accent} /><Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{text}</Text></View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={handleClose} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '800' }}>New task</Text>
          <TouchableOpacity onPress={() => void handleCreate()} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Create task" style={{ minWidth: 76, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#047857', opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Create</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardSafeView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
            {error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text> : null}
            {progressLabel ? <Text style={{ color: colors.accent, fontWeight: '700' }}>{progressLabel}</Text> : null}

            <View style={{ gap: 6 }}>
              <Text style={label}>Task title <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput value={title} onChangeText={setTitle} editable={!isSaving} maxLength={200} placeholder="What needs doing?" placeholderTextColor={colors.mutedText} accessibilityLabel="Task title" style={input} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>Description</Text>
              <TextInput value={description} onChangeText={setDescription} editable={!isSaving} multiline placeholder="Enter task description" placeholderTextColor={colors.mutedText} style={[input, { minHeight: 90, paddingVertical: 12, textAlignVertical: 'top' }]} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={label}>Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATUSES.map((option) => <TouchableOpacity key={option} onPress={() => setStatus(option)} style={chip(status === option)}><Text style={chipText(status === option)}>{STATUS_LABELS[option]}</Text></TouchableOpacity>)}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={label}>Priority</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PRIORITY_OPTIONS.map((option) => <TouchableOpacity key={option.value} onPress={() => setPriority(option.value)} style={chip(priority === option.value, option.color)}><Text style={chipText(priority === option.value)}>{option.label}</Text></TouchableOpacity>)}
              </View>
            </View>
            <DateTimeField label="Due date" mode="date" placeholder="No due date" value={dueDate} minimumDate={startDate ?? new Date()} onChange={setDueDate} onClear={() => setDueDate(null)} />

            <View style={section}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Assignee</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Assign to all team members</Text>
                  {assignedToAll ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>{assignableMembers.length} member{assignableMembers.length !== 1 ? 's' : ''} will be assigned</Text> : null}
                </View>
                <Switch value={assignedToAll} onValueChange={setAssignedToAll} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>
              {!assignedToAll ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {assignableMembers.map((member) => {
                    const selected = assignees.includes(member.id);
                    return (
                      <TouchableOpacity key={member.id} onPress={() => setAssignees((current) => toggle(current, member.id))} style={[chip(selected), { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 }]}>
                        <UserAvatar profileImage={member.avatar} firstName={member.name} size={22} />
                        <Text style={chipText(selected)}>{member.id === currentUserId ? 'Me' : member.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              {!assignedToAll && assignees.length === 0 && project.automationRules['1'] !== false ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Nobody picked: the task goes to the project owner (you can change this on the Team tab).</Text> : null}
            </View>

            <View style={section}>
              {sectionTitle(Flag, 'Milestone')}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity onPress={() => setMilestoneId('')} accessibilityRole="radio" accessibilityState={{ selected: milestoneId === '' }} style={chip(milestoneId === '')}><Text style={chipText(milestoneId === '')}>No milestone</Text></TouchableOpacity>
                {milestones.map((milestone) => (
                  <TouchableOpacity key={milestone.id} onPress={() => setMilestoneId(milestone.id)} accessibilityRole="radio" accessibilityState={{ selected: milestoneId === milestone.id }} style={chip(milestoneId === milestone.id)}>
                    <Text numberOfLines={1} style={chipText(milestoneId === milestone.id)}>{milestone.name}{milestone.completed ? ' (done)' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={newMilestoneName} onChangeText={setNewMilestoneName} editable={!isSaving && !creatingMilestone} placeholder="Or add a new milestone" placeholderTextColor={colors.mutedText} accessibilityLabel="New milestone name" style={[input, { flex: 1 }]} />
                <TouchableOpacity onPress={() => void handleCreateMilestone()} disabled={!newMilestoneName.trim() || creatingMilestone} accessibilityRole="button" accessibilityLabel="Add milestone" style={{ paddingHorizontal: 16, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, opacity: newMilestoneName.trim() ? 1 : 0.5 }}>
                  {creatingMilestone ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={{ color: colors.text, fontWeight: '800' }}>Add</Text>}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={() => setShowMore((current) => !current)} accessibilityRole="button" accessibilityState={{ expanded: showMore }} accessibilityLabel={showMore ? 'Hide more options' : 'More options: start date, estimate, tags, dependencies, templates and files'} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>More options</Text>
                {!showMore ? <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 12 }}>Start date, estimate, tags, dependencies, templates{project.isOwner ? ', files' : ''}</Text> : null}
              </View>
              {showMore ? <ChevronUp size={18} color={colors.mutedText} /> : <ChevronDown size={18} color={colors.mutedText} />}
            </TouchableOpacity>

            {showMore ? <>
            <DateTimeField label="Start date" mode="date" placeholder="No start date" value={startDate} minimumDate={new Date()} onChange={setStartDate} onClear={() => setStartDate(null)} />
            <View style={{ gap: 6 }}>
              <Text style={label}>Estimated time (hours)</Text>
              <TextInput value={estimatedTime} onChangeText={setEstimatedTime} keyboardType="decimal-pad" editable={!isSaving} placeholder="1" placeholderTextColor={colors.mutedText} style={input} />
            </View>

            <View style={section}>
              <Text style={label}>Tags</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={handleAddTag} editable={!isSaving} placeholder="Add a tag" placeholderTextColor={colors.mutedText} style={[input, { flex: 1 }]} />
                <TouchableOpacity onPress={handleAddTag} accessibilityLabel="Add tag" style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Plus size={18} color={colors.onAccent} /></TouchableOpacity>
              </View>
              {tags.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((tag) => (
                    <TouchableOpacity key={tag} onPress={() => setTags((current) => current.filter((existing) => existing !== tag))} accessibilityLabel={`Remove tag ${tag}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.successSurface }}>
                      <Text style={{ color: colors.successText, fontWeight: '800', fontSize: 12 }}>{tag}</Text><X size={12} color={colors.successText} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={section}>
              {sectionTitle(Link2, 'Waits on')}
              <Text style={{ color: colors.mutedText, fontSize: 12 }}>Pick tasks that must be done first. Until then this task shows as “Waiting”.</Text>
              {tasks.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>No other tasks yet.</Text> : tasks.map((task) => {
                const selected = dependencies.includes(task.id);
                return (
                  <TouchableOpacity key={task.id} onPress={() => setDependencies((current) => toggle(current, task.id))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.successSurface : colors.surface }}>
                    <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: selected ? colors.accent : colors.mutedText, backgroundColor: selected ? colors.accent : 'transparent' }} />
                    <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13 }}>{task.title}</Text>
                    <Text style={{ color: colors.mutedText, fontSize: 11 }}>{STATUS_LABELS[task.status]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={section}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>Task template</Text>
              {taskTemplates.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>No templates yet.</Text> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {taskTemplates.map((template) => <TouchableOpacity key={template.id} onPress={() => handleSelectTemplate(template.id)} style={chip(templateId === template.id)}><Text style={chipText(templateId === template.id)}>{template.name}</Text></TouchableOpacity>)}
                </View>
              )}
              {templateId ? (
                <TouchableOpacity onPress={() => void handleDeleteTemplate()} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Trash2 size={13} color={colors.destructiveText} /><Text style={{ color: colors.destructiveText, fontSize: 12, fontWeight: '800' }}>Delete template</Text>
                </TouchableOpacity>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Save this task as a template</Text>
                <Switch value={saveAsTemplate} onValueChange={setSaveAsTemplate} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>
            </View>

            {project.isOwner ? (
              <View style={section}>
                {sectionTitle(Paperclip, 'Attachments')}
                <Text style={{ color: colors.mutedText, fontSize: 12 }}>Only project owners can attach files. Up to 10 MB each.</Text>
                <TouchableOpacity disabled={isSaving} onPress={() => void handlePickFiles()} style={{ alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Browse files</Text>
                </TouchableOpacity>
                {files.map((file) => (
                  <View key={file.uri} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: colors.control }}>
                    <FileTypeIcon type={file.mimeType} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{file.name}</Text>
                      <Text style={{ color: colors.mutedText, fontSize: 11 }}>{formatFileSize(file.size)}</Text>
                    </View>
                    <TouchableOpacity disabled={isSaving} accessibilityLabel={`Remove ${file.name}`} onPress={() => setFiles((current) => current.filter((entry) => entry.uri !== file.uri))}><X size={16} color={colors.mutedText} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            </> : null}
          </ScrollView>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}
