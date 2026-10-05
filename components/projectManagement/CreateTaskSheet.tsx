import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import DateTimeField from '@/components/ui/DateTimeField';
import UserAvatar from '@/components/ui/UserAvatar';
import type { Priority, Status, TeamMember } from '@/lib/types/project';

type CreateTaskSheetProps = {
  visible: boolean;
  projectId: string;
  currentUserId: string;
  teamMembers: TeamMember[];
  onClose: () => void;
  onCreated: () => void;
};

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'medium', label: 'Medium', color: '#10b981' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#c64d53' },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

/** Local calendar date as 'YYYY-MM-DD' (no time), the format the website's task form saves. */
function toDueDateString(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Simple "New task" form for a project board: fill in and create in one tap (no drafts screen). */
export default function CreateTaskSheet({ visible, projectId, currentUserId, teamMembers, onClose, onCreated }: CreateTaskSheetProps) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<Status>('todo');
  const [assignees, setAssignees] = useState<string[]>([currentUserId]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const assignableMembers = teamMembers.filter((member) => member.isOwner || member.membershipStatus === 'accepted' || member.id === currentUserId);

  const resetForm = (): void => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('todo');
    setAssignees([currentUserId]);
    setDueDate(null);
    setError('');
  };

  const handleClose = (): void => {
    if (savingRef.current) return;
    resetForm();
    onClose();
  };

  const handleToggleAssignee = (memberId: string): void => {
    setAssignees((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  };

  const handleCreate = async (): Promise<void> => {
    if (savingRef.current) return;
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    const chosenAssignees = assignees.length > 0 ? assignees : [currentUserId];
    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      await projectService.createTask(projectId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assignee: chosenAssignees[0],
        assignees: chosenAssignees,
        ...(dueDate ? { dueDate: toDueDateString(dueDate) } : {}),
      });
      toast.success('Task created');
      resetForm();
      onCreated();
      onClose();
    } catch (createError: unknown) {
      console.error('[CreateTaskSheet.handleCreate] Error:', createError);
      setError(createError instanceof Error ? createError.message : 'The task could not be created. Please try again.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const chip = (selected: boolean, accent: string = colors.accent) => ({
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: selected ? accent : colors.border,
    backgroundColor: selected ? accent : colors.control,
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={handleClose} disabled={isSaving} accessibilityLabel="Close" style={{ padding: 6 }}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '900' }}>New task</Text>
          <TouchableOpacity
            onPress={() => void handleCreate()}
            disabled={isSaving}
            style={{ minWidth: 72, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent, opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Create</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
            {error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text> : null}

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Title <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                editable={!isSaving}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.mutedText}
                style={{ minHeight: 46, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={!isSaving}
                multiline
                placeholder="Add details (optional)"
                placeholderTextColor={colors.mutedText}
                style={{ minHeight: 90, padding: 12, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Priority</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PRIORITIES.map((option) => (
                  <TouchableOpacity key={option.value} onPress={() => setPriority(option.value)} style={chip(priority === option.value, option.color)}>
                    <Text style={{ color: priority === option.value ? '#ffffff' : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Column</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATUSES.map((option) => (
                  <TouchableOpacity key={option.value} onPress={() => setStatus(option.value)} style={chip(status === option.value)}>
                    <Text style={{ color: status === option.value ? colors.onAccent : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {assignableMembers.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800' }}>Assign to</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {assignableMembers.map((member) => {
                    const selected = assignees.includes(member.id);
                    return (
                      <TouchableOpacity key={member.id} onPress={() => handleToggleAssignee(member.id)} style={[chip(selected), { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 }]}>
                        <UserAvatar profileImage={member.avatar} firstName={member.name} size={22} />
                        <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>
                          {member.id === currentUserId ? 'Me' : member.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <DateTimeField
              label="Due date"
              mode="date"
              placeholder="No due date"
              value={dueDate}
              minimumDate={new Date()}
              onChange={setDueDate}
              onClear={() => setDueDate(null)}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
