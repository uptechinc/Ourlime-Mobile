import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import {
  Archive, CheckSquare, Clock, Copy, FileText, Flag, History, Lock, MessageCircle, MoreVertical, Paperclip, Pause, Pencil, PlayCircle,
  Send, Sparkles, Square, Trash2, Upload, X,
} from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import CustomModal from '@/components/ui/CustomModal';
import DateTimeField from '@/components/ui/DateTimeField';
import UserAvatar from '@/components/ui/UserAvatar';
import { FileTypeIcon, openAttachment } from '@/components/projectManagement/ProjectFilesPanel';
import {
  PRIORITY_OPTIONS, STATUS_LABELS, auditLabel, formatCalendarDate, formatDuration, formatFileSize, parseCalendarString, statusColor, taskMinutes, toCalendarString,
} from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import { projectService } from '@/lib/services/ProjectService';
import type { ActiveTaskTimer, Milestone, ProjectRecord, Status, Task, TaskFieldUpdate, TeamMember } from '@/lib/types/project';

type TaskDetailSheetProps = {
  task: Task | null;
  project: ProjectRecord;
  teamMembers: TeamMember[];
  milestones: Milestone[];
  currentUserId: string;
  /** False for viewers and read-only projects (the reason is shown when they try). */
  canWrite: boolean;
  writeBlockedReason: string;
  activeTimer: ActiveTaskTimer | null;
  onClose: () => void;
  onOpenUpgrade: () => void;
};

type DetailTab = 'details' | 'subtasks' | 'comments' | 'time' | 'files' | 'activity';
const TABS: { id: DetailTab; label: string; Icon: typeof FileText }[] = [
  { id: 'details', label: 'Details', Icon: FileText }, { id: 'subtasks', label: 'Subtasks', Icon: CheckSquare },
  { id: 'comments', label: 'Comments', Icon: MessageCircle }, { id: 'time', label: 'Time', Icon: Clock },
  { id: 'files', label: 'Files', Icon: Paperclip }, { id: 'activity', label: 'Activity', Icon: History },
];
const STATUSES: Status[] = ['todo', 'in-progress', 'done'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Website TaskDetailModal: edit the task, subtasks, comments with @mentions, timer and time log, files and history. */
export default function TaskDetailSheet({ task, project, teamMembers, milestones, currentUserId, canWrite, writeBlockedReason, activeTimer, onClose, onOpenUpgrade }: TaskDetailSheetProps) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<DetailTab>('details');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'task' | 'comment' | 'attachment'; id: string } | null>(null);

  const taskId = task?.id ?? null;
  useEffect(() => {
    setTab('details'); setMenuOpen(false); setEditingTitle(false); setEditingDescription(false); setNewSubtask(''); setNewComment('');
    setMentionIds([]); setEditingCommentId(null); setMinutesInput(''); setConfirm(null);
  }, [taskId]);

  const memberById = useMemo(() => new Map(teamMembers.map((member) => [member.id, member])), [teamMembers]);
  const mentionQuery = useMemo(() => {
    const lastAt = newComment.lastIndexOf('@');
    if (lastAt < 0 || lastAt < newComment.lastIndexOf(' ')) return null;
    return newComment.slice(lastAt + 1).toLowerCase();
  }, [newComment]);
  const mentionSuggestions = mentionQuery === null ? [] : teamMembers.filter((member) => member.membershipStatus !== 'pending' && member.name.toLowerCase().includes(mentionQuery)).slice(0, 6);

  if (!task) return null;
  const subtaskEntitlement = projectEntitlementService.canAddSubtask(task.subTasks.length, project);
  const totalMinutes = taskMinutes(task);
  const isAssignedToMe = task.assignee === currentUserId || (task.assignees ?? []).includes(currentUserId);
  const timerOnThisTask = activeTimer?.taskId === task.id && activeTimer.projectId === project.id;
  const milestone = task.milestoneId ? milestones.find((entry) => entry.id === task.milestoneId) : undefined;

  /** Runs one change at a time and reports failures (website runTaskMutation). */
  const run = async (key: string, action: () => Promise<void>, success?: string): Promise<boolean> => {
    if (!canWrite) { toast.error(writeBlockedReason); return false; }
    if (busy) return false;
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Task could not be saved. Retry.');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const update = (key: string, updates: TaskFieldUpdate): Promise<boolean> => run(key, () => projectService.updateTask(project.id, task.id, updates));

  const handleSaveTitle = async (): Promise<void> => {
    const next = titleDraft.trim();
    if (!next || next === task.title) { setEditingTitle(false); return; }
    if (await update('title', { title: next })) setEditingTitle(false);
  };
  const handleSaveDescription = async (): Promise<void> => {
    if (descriptionDraft === task.description) { setEditingDescription(false); return; }
    if (await update('description', { description: descriptionDraft })) setEditingDescription(false);
  };
  const handleAddSubtask = async (): Promise<void> => {
    const title = newSubtask.trim();
    if (!title) return;
    if (!subtaskEntitlement.allowed) { toast.error(subtaskEntitlement.reason || 'Subtask limit reached'); onOpenUpgrade(); return; }
    if (await run('subtask', () => projectService.addSubTask(project.id, task.id, title))) setNewSubtask((current) => (current.trim() === title ? '' : current));
  };
  const handleInsertMention = (member: TeamMember): void => {
    const lastAt = newComment.lastIndexOf('@');
    setNewComment(`${newComment.slice(0, lastAt)}@${member.name} `);
    setMentionIds((current) => (current.includes(member.id) ? current : [...current, member.id]));
  };
  const handleAddComment = async (): Promise<void> => {
    const content = newComment.trim();
    if (!content) return;
    const mentions = mentionIds.filter((id) => content.includes(`@${memberById.get(id)?.name ?? ''}`));
    if (await run('comment', () => projectService.addComment(project.id, task.id, content, mentions))) { setNewComment(''); setMentionIds([]); }
  };
  const handleSaveComment = async (commentId: string): Promise<void> => {
    const content = editingCommentText.trim();
    if (!content) return;
    if (await run(`edit:${commentId}`, () => projectService.editComment(project.id, task.id, commentId, content))) setEditingCommentId(null);
  };
  const handleLogMinutes = async (): Promise<void> => {
    const minutes = Number(minutesInput);
    if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > 1440) { toast.error('Enter a whole number of minutes between 1 and 1440.'); return; }
    if (await run('time', () => projectService.addTimeEntry(project.id, task.id, minutes), `Logged ${minutes} minutes.`)) setMinutesInput('');
  };
  const handleStartTimer = (): Promise<boolean> => run('timer', () => projectService.startTimer(project.id, task), 'Timer started');
  const handleStopTimer = (): Promise<boolean> => run('timer', async () => {
    const minutes = await projectService.stopTimer(project.id, task.id, activeTimer?.startedAt ?? null);
    toast.success(minutes > 0 ? `Logged ${formatDuration(minutes)}.` : 'Timer stopped (under a minute, nothing logged).');
  });
  const handleUpload = async (): Promise<void> => {
    if (!canWrite) { toast.error(writeBlockedReason); return; }
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const size = asset.size ?? 0;
    if (!size || size > MAX_ATTACHMENT_BYTES) { toast.error('Choose a nonempty attachment up to 10 MB.'); return; }
    await run('upload', () => projectService.addAttachment(project.id, task.id, { uri: asset.uri, name: asset.name, size, mimeType: asset.mimeType ?? 'application/octet-stream' }), 'File attached');
  };
  const handleConfirm = async (): Promise<void> => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.kind === 'task') {
      if (await run('delete', () => projectService.deleteTask(project.id, task.id), 'Task deleted')) onClose();
    } else if (pending.kind === 'comment') {
      await run(`delete:${pending.id}`, () => projectService.deleteComment(project.id, task.id, pending.id), 'Comment deleted');
    } else {
      await run(`attachment:${pending.id}`, () => projectService.deleteAttachment(project.id, task.id, pending.id), 'Attachment deleted');
    }
  };

  const chip = (selected: boolean, tint = colors.accent) => ({
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
    borderColor: selected ? tint : colors.border, backgroundColor: selected ? tint : colors.control,
  });
  const input = { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14 } as const;
  const sectionTitle = { color: colors.text, fontSize: 14, fontWeight: '800' as const };
  const sendButton = (disabled: boolean) => ({ width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.accent, opacity: disabled ? 0.55 : 1 });

  const renderCommentText = (content: string) => content.split(/(@\S+(?: \S+)?)/g).map((part, index) => {
    const isMention = part.startsWith('@') && teamMembers.some((member) => part.slice(1).toLowerCase().startsWith(member.name.toLowerCase()));
    return <Text key={index} style={isMention ? { color: colors.accent, fontWeight: '800' } : undefined}>{part}</Text>;
  });

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <KeyboardSafeView style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close task details" style={{ padding: 4 }}><X size={22} color={colors.text} /></TouchableOpacity>
              <View style={{ flex: 1 }}>
                {editingTitle ? (
                  <TextInput value={titleDraft} onChangeText={setTitleDraft} autoFocus maxLength={200} onSubmitEditing={() => void handleSaveTitle()} onBlur={() => void handleSaveTitle()} style={[input, { fontSize: 17, fontWeight: '800' }]} />
                ) : (
                  <TouchableOpacity disabled={!canWrite} onPress={() => { setTitleDraft(task.title); setEditingTitle(true); }}>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{task.title}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {project.role !== 'viewer' ? (
                <TouchableOpacity onPress={() => setMenuOpen(true)} accessibilityLabel="Task actions" style={{ padding: 4 }}><MoreVertical size={20} color={colors.text} /></TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
              {PRIORITY_OPTIONS.map((option) => (
                <TouchableOpacity key={option.value} disabled={!canWrite || busy !== null} onPress={() => { if (option.value !== task.priority) void update('priority', { priority: option.value }); }} style={chip(task.priority === option.value, option.color)}>
                  <Text style={{ color: task.priority === option.value ? '#ffffff' : colors.secondaryText, fontSize: 11, fontWeight: '800' }}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {STATUSES.map((status) => (
                <TouchableOpacity key={status} disabled={!canWrite || busy !== null} onPress={() => { if (status !== task.status) void update('status', { status }); }} style={chip(task.status === status, statusColor(status))}>
                  <Text style={{ color: task.status === status ? '#ffffff' : colors.secondaryText, fontSize: 11, fontWeight: '800' }}>{STATUS_LABELS[status]}</Text>
                </TouchableOpacity>
              ))}
              {task.status === 'todo' && isAssignedToMe && canWrite ? (
                <TouchableOpacity disabled={busy !== null || (activeTimer !== null && !timerOnThisTask)} onPress={() => void handleStartTimer()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: '#059669' }}>
                  <PlayCircle size={13} color="#ffffff" /><Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>Start Task</Text>
                </TouchableOpacity>
              ) : null}
              {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>
            <View pointerEvents={canWrite ? 'auto' : 'none'}>
              <DateTimeField label="Due date" mode="date" placeholder="No due date" value={parseCalendarString(task.dueDate)} onChange={(date) => void update('dueDate', { dueDate: toCalendarString(date) })} onClear={() => void update('dueDate', { dueDate: '' })} />
            </View>
          </View>

          {/* Tabs */}
          <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8 }}>
              {TABS.map(({ id, label, Icon }) => {
                const selected = tab === id;
                return (
                  <TouchableOpacity key={id} onPress={() => setTab(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: selected ? colors.accent : 'transparent' }}>
                    <Icon size={14} color={selected ? colors.accent : colors.mutedText} />
                    <Text style={{ color: selected ? colors.accent : colors.mutedText, fontSize: 13, fontWeight: '800' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
            {tab === 'details' ? (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={sectionTitle}>Description</Text>
                  {editingDescription ? (
                    <>
                      <TextInput value={descriptionDraft} onChangeText={setDescriptionDraft} multiline autoFocus style={[input, { minHeight: 110, paddingVertical: 10, textAlignVertical: 'top' }]} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => void handleSaveDescription()} disabled={busy !== null} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Save</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingDescription(false)} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity disabled={!canWrite} onPress={() => { setDescriptionDraft(task.description); setEditingDescription(true); }} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.control }}>
                      <Text style={{ color: task.description ? colors.text : colors.mutedText, fontSize: 14, lineHeight: 20 }}>{task.description || (canWrite ? 'No description provided. Tap to add one.' : 'No description provided.')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={sectionTitle}>Assigned to</Text>
                  {task.assignedToAll ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Assigned to all team members</Text> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending').map((member) => {
                      const selected = task.assignee === member.id || (task.assignees ?? []).includes(member.id);
                      return (
                        <TouchableOpacity key={member.id} disabled={!canWrite || busy !== null} onPress={() => { if (task.assignee !== member.id) void update('assignee', { assignee: member.id, assignees: [member.id] }); }} style={[chip(selected), { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                          <UserAvatar profileImage={member.avatar} firstName={member.name} size={20} />
                          <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{member.id === currentUserId ? 'Me' : member.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={sectionTitle}>Progress</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.control, overflow: 'hidden' }}><View style={{ height: '100%', width: `${task.progress}%`, backgroundColor: colors.accent }} /></View>
                    <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{task.progress}%</Text>
                  </View>
                </View>
                {milestone || task.startDate || task.estimatedTime || (task.dependencies?.length ?? 0) > 0 || task.recurrence ? (
                  <View style={{ gap: 6 }}>
                    {milestone ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Flag size={13} color="#9333ea" /><Text style={{ color: colors.secondaryText, fontSize: 12 }}>Milestone: {milestone.name}</Text></View> : null}
                    {task.startDate ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Starts {formatCalendarDate(task.startDate)}</Text> : null}
                    {task.estimatedTime ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Estimated {task.estimatedTime}h</Text> : null}
                    {(task.dependencies?.length ?? 0) > 0 ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Depends on {task.dependencies?.length} task{task.dependencies?.length === 1 ? '' : 's'}</Text> : null}
                    {task.recurrence ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>Repeats every {task.recurrence.interval} {task.recurrence.frequency.replace('ly', '').replace('dai', 'day')}{task.recurrence.interval === 1 ? '' : 's'}</Text> : null}
                  </View>
                ) : null}
                <View style={{ gap: 8 }}>
                  <Text style={sectionTitle}>Tags</Text>
                  {task.tags.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>No tags</Text> : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {task.tags.map((tag) => <Text key={tag} style={{ color: colors.secondaryText, fontSize: 12, backgroundColor: colors.control, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }}>{tag}</Text>)}
                    </View>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'subtasks' ? (
              <>
                {!subtaskEntitlement.allowed ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.warningSurface }}>
                    <Lock size={14} color="#d97706" />
                    <Text style={{ flex: 1, color: colors.warningText, fontSize: 12 }}>Free Plan limit: max 3 subtasks per task.</Text>
                    <TouchableOpacity onPress={onOpenUpgrade} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Sparkles size={12} color="#d97706" /><Text style={{ color: colors.warningText, fontWeight: '900', fontSize: 12, textDecorationLine: 'underline' }}>Upgrade</Text></TouchableOpacity>
                  </View>
                ) : null}
                <Text style={{ color: colors.mutedText, fontSize: 12 }}>{task.subTasks.filter((subTask) => subTask.completed).length} of {task.subTasks.length} completed</Text>
                {task.subTasks.map((subTask) => (
                  <TouchableOpacity key={subTask.id} disabled={!canWrite || busy !== null} onPress={() => void run(`toggle:${subTask.id}`, () => projectService.toggleSubTask(project.id, task.id, subTask.id, !subTask.completed))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: colors.control }}>
                    {subTask.completed ? <CheckSquare size={18} color={colors.accent} /> : <Square size={18} color={colors.mutedText} />}
                    <Text style={{ flex: 1, color: subTask.completed ? colors.mutedText : colors.text, textDecorationLine: subTask.completed ? 'line-through' : 'none', fontSize: 13 }}>{subTask.title}</Text>
                  </TouchableOpacity>
                ))}
                {canWrite ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={newSubtask} onChangeText={setNewSubtask} editable={subtaskEntitlement.allowed} placeholder={subtaskEntitlement.allowed ? 'Add a subtask...' : 'Subtask limit reached (Upgrade to Premium)'} placeholderTextColor={colors.mutedText} onSubmitEditing={() => void handleAddSubtask()} style={[input, { flex: 1 }]} />
                    <TouchableOpacity disabled={busy !== null} onPress={() => void handleAddSubtask()} style={sendButton(!newSubtask.trim())}><CheckSquare size={17} color={colors.onAccent} /></TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}

            {tab === 'comments' ? (
              <>
                {task.comments.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No comments yet.</Text> : task.comments.map((comment) => {
                  const authorId = comment.userId || comment.author;
                  const author = memberById.get(authorId);
                  const isMine = authorId === currentUserId;
                  return (
                    <View key={comment.id} style={{ flexDirection: 'row', gap: 10 }}>
                      <UserAvatar profileImage={comment.avatar || author?.avatar} firstName={comment.authorName || author?.name} size={32} />
                      <View style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: colors.control, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' }}>{comment.authorName || author?.name || 'Member'}</Text>
                          <Text style={{ color: colors.mutedText, fontSize: 10 }}>{comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}{comment.editedAt ? ' · edited' : ''}</Text>
                        </View>
                        {editingCommentId === comment.id ? (
                          <>
                            <TextInput value={editingCommentText} onChangeText={setEditingCommentText} multiline autoFocus style={[input, { minHeight: 60, textAlignVertical: 'top', paddingVertical: 8 }]} />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                              <TouchableOpacity onPress={() => void handleSaveComment(comment.id)}><Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>Save</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => setEditingCommentId(null)}><Text style={{ color: colors.mutedText, fontWeight: '700', fontSize: 12 }}>Cancel</Text></TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>{renderCommentText(comment.content)}</Text>
                        )}
                        {isMine && canWrite && editingCommentId !== comment.id ? (
                          <View style={{ flexDirection: 'row', gap: 14 }}>
                            <TouchableOpacity onPress={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Pencil size={11} color={colors.mutedText} /><Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700' }}>Edit</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setConfirm({ kind: 'comment', id: comment.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Trash2 size={11} color={colors.destructiveText} /><Text style={{ color: colors.destructiveText, fontSize: 11, fontWeight: '700' }}>Delete</Text></TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {canWrite ? (
                  <View style={{ gap: 6 }}>
                    {mentionSuggestions.length > 0 ? (
                      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                        {mentionSuggestions.map((member) => (
                          <TouchableOpacity key={member.id} onPress={() => handleInsertMention(member)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
                            <UserAvatar profileImage={member.avatar} firstName={member.name} size={24} />
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{member.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                      <TextInput value={newComment} onChangeText={setNewComment} multiline maxLength={5000} placeholder="Add a comment... Use @ to mention" placeholderTextColor={colors.mutedText} style={[input, { flex: 1, maxHeight: 120, paddingVertical: 10 }]} />
                      <TouchableOpacity accessibilityLabel="Add comment" disabled={busy !== null || !newComment.trim()} onPress={() => void handleAddComment()} style={sendButton(!newComment.trim())}><Send size={16} color={colors.onAccent} /></TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {tab === 'time' ? (
              <>
                <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.control, gap: 10 }}>
                  <Text style={sectionTitle}>Total Time Spent</Text>
                  <Text style={{ color: colors.accent, fontSize: 26, fontWeight: '900' }}>{formatDuration(totalMinutes)}</Text>
                  {project.role !== 'viewer' ? (
                    timerOnThisTask ? (
                      <TouchableOpacity disabled={busy !== null} onPress={() => void handleStopTimer()} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#dc2626' }}>
                        <Pause size={15} color="#ffffff" /><Text style={{ color: '#ffffff', fontWeight: '800' }}>Stop timer</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity disabled={busy !== null || activeTimer !== null} onPress={() => void handleStartTimer()} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.accent, opacity: activeTimer !== null ? 0.5 : 1 }}>
                        <PlayCircle size={15} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Start timer</Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                  {timerOnThisTask && activeTimer ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Timer running since {activeTimer.startedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : null}
                  {activeTimer !== null && !timerOnThisTask ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Another task&apos;s timer is running. Stop it first.</Text> : null}
                </View>
                {canWrite ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={minutesInput} onChangeText={setMinutesInput} keyboardType="number-pad" placeholder="Log minutes, e.g. 30" placeholderTextColor={colors.mutedText} style={[input, { flex: 1 }]} />
                    <TouchableOpacity disabled={busy !== null || !minutesInput.trim()} onPress={() => void handleLogMinutes()} style={[sendButton(!minutesInput.trim()), { width: 64 }]}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Log</Text></TouchableOpacity>
                  </View>
                ) : null}
                {task.timeEntries.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No time logged yet.</Text> : [...task.timeEntries].reverse().map((entry) => (
                  <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.control }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{entry.description || 'Time entry'}</Text>
                      <Text style={{ color: colors.mutedText, fontSize: 11 }}>{entry.date ? formatCalendarDate(entry.date) : ''} - {memberById.get(entry.userId)?.name ?? 'Member'}</Text>
                    </View>
                    <Text style={{ color: colors.accent, fontWeight: '900' }}>{formatDuration(entry.duration)}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {tab === 'files' ? (
              <>
                {project.role !== 'viewer' ? (
                  <TouchableOpacity disabled={busy !== null} onPress={() => void handleUpload()} style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border }}>
                    {busy === 'upload' ? <ActivityIndicator color={colors.accent} /> : <Upload size={22} color={colors.accent} />}
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{busy === 'upload' ? 'Uploading…' : 'Upload files'}</Text>
                    <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center' }}>Attach documents, images or other files to this task (up to 10 MB)</Text>
                  </TouchableOpacity>
                ) : null}
                {task.attachments.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No files attached.</Text> : task.attachments.map((attachment) => (
                  <View key={attachment.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.control }}>
                    <FileTypeIcon type={attachment.type || ''} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => void openAttachment(attachment.url)}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{attachment.name}</Text>
                      <Text style={{ color: colors.mutedText, fontSize: 11 }}>{formatFileSize(attachment.size)} · {memberById.get(attachment.uploadedBy)?.name ?? 'Member'}</Text>
                    </TouchableOpacity>
                    {canWrite ? <TouchableOpacity accessibilityLabel={`Delete ${attachment.name}`} disabled={busy !== null} onPress={() => setConfirm({ kind: 'attachment', id: attachment.id })} style={{ padding: 6 }}><Trash2 size={16} color={colors.destructiveText} /></TouchableOpacity> : null}
                  </View>
                ))}
              </>
            ) : null}

            {tab === 'activity' ? (
              (task.auditLog ?? []).length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No activity yet.</Text> : [...(task.auditLog ?? [])]
                .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
                .map((entry) => {
                  const member = memberById.get(entry.userId);
                  return (
                    <View key={entry.id} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.control }}>
                      <UserAvatar profileImage={member?.avatar} firstName={member?.name} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{auditLabel(entry.action)}</Text>
                        {entry.detail && entry.detail !== entry.action ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{entry.detail}</Text> : null}
                        <Text style={{ color: colors.mutedText, fontSize: 11 }}>{entry.userId === currentUserId ? 'You' : member?.name || 'Unknown'} · {new Date(entry.timestamp).toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })
            ) : null}
          </ScrollView>
        </KeyboardSafeView>

        {/* Task actions menu (Duplicate / Archive / Delete) */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }} onPress={() => setMenuOpen(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>{task.title}</Text>
              {[
                { key: 'duplicate', label: 'Duplicate', Icon: Copy, danger: false, onPress: () => void run('duplicate', () => projectService.duplicateTask(project, teamMembers, task), 'Task duplicated') },
                { key: 'archive', label: 'Archive', Icon: Archive, danger: false, onPress: () => void run('archive', () => projectService.archiveTask(project.id, task.id), 'Task archived').then((done) => { if (done) onClose(); }) },
                { key: 'delete', label: 'Delete', Icon: Trash2, danger: true, onPress: () => setConfirm({ kind: 'task', id: task.id }) },
              ].map((item) => (
                <TouchableOpacity key={item.key} onPress={() => { setMenuOpen(false); item.onPress(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }}>
                  <item.Icon size={18} color={item.danger ? colors.destructive : colors.text} />
                  <Text style={{ color: item.danger ? colors.destructiveText : colors.text, fontSize: 15, fontWeight: '700' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <CustomModal
          visible={confirm !== null}
          type="danger"
          title={confirm?.kind === 'task' ? 'Delete Task' : confirm?.kind === 'comment' ? 'Delete Comment' : 'Delete Attachment'}
          message={confirm?.kind === 'task' ? `Are you sure you want to delete "${task.title}"? This cannot be undone.` : confirm?.kind === 'comment' ? 'Are you sure you want to delete this comment?' : 'Remove this file from the task?'}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => void handleConfirm()}
          onCancel={() => setConfirm(null)}
          onClose={() => setConfirm(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}
