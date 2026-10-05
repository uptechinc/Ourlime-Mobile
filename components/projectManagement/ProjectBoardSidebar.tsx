import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Activity, Crown, MoreHorizontal, Shield, UserMinus, Users } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { ProjectRole, Task, TeamMember } from '@/lib/types/project';

type ProjectBoardSidebarProps = {
  tasks: Task[];
  teamMembers: TeamMember[];
  currentUserId: string;
  /** Only the owner manages members (same as the website's sidebar). */
  isOwner: boolean;
  onChangeRole: (member: TeamMember, role: ProjectRole) => Promise<void>;
  onRemove: (member: TeamMember) => Promise<void>;
  onTransfer: (member: TeamMember) => Promise<void>;
};

// Same labels as the website's auditConfig.ts.
const AUDIT_LABELS: Record<string, string> = {
  task_created: 'Task created', task_updated: 'Task updated', status_changed: 'Status changed', subtask_added: 'Subtask added',
  subtask_updated: 'Subtask updated', comment_added: 'Comment added', time_entry_added: 'Time entry added',
  attachment_added: 'Attachment added', attachment_deleted: 'Attachment deleted',
};
const ROLES: ProjectRole[] = ['admin', 'member', 'viewer'];

function timeAgo(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type PendingAction = { kind: 'remove' | 'transfer'; member: TeamMember } | null;

/** The website's project sidebar on mobile: Team Members (with owner actions) and Recent Activity. */
export default function ProjectBoardSidebar({ tasks, teamMembers, currentUserId, isOwner, onChangeRole, onRemove, onTransfer }: ProjectBoardSidebarProps) {
  const { colors } = useAppTheme();
  const [menuMember, setMenuMember] = useState<TeamMember | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const acceptedMembers = teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending');
  const pendingMembers = teamMembers.filter((member) => !member.isOwner && member.membershipStatus === 'pending');
  const nameFor = (userId: string): string => teamMembers.find((member) => member.id === userId)?.name || 'Someone';
  const recentActivity = tasks
    .flatMap((task) => (task.auditLog ?? []).map((entry) => ({ ...entry, taskTitle: task.title, taskId: task.id })))
    .sort((first, second) => second.timestamp.localeCompare(first.timestamp))
    .slice(0, 8);

  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
    } catch (error: unknown) {
      console.error('[ProjectBoardSidebar.run] Error:', error);
    } finally {
      setBusy(false);
      setMenuMember(null);
      setPendingAction(null);
    }
  };

  const card = { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 };
  const heading = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 };
  const headingText = { color: colors.text, fontSize: 16, fontWeight: '900' as const };

  return (
    <View style={{ gap: 14 }}>
      <View style={card}>
        <View style={heading}><Users size={18} color={colors.accent} /><Text style={headingText}>Team Members ({acceptedMembers.length})</Text></View>
        {[...acceptedMembers, ...pendingMembers].map((member) => {
          const canManageMember = isOwner && !member.isOwner && member.id !== currentUserId;
          return (
            <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <UserAvatar profileImage={member.avatar} firstName={member.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800' }}>{member.name}{member.id === currentUserId ? ' (You)' : ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {member.isOwner ? <Crown size={12} color="#d97706" /> : member.role === 'admin' ? <Shield size={12} color="#7c3aed" /> : null}
                  <Text style={{ color: colors.mutedText, fontSize: 12, textTransform: 'capitalize' }}>{member.isOwner ? 'Owner' : member.role}</Text>
                  {member.membershipStatus === 'pending' ? <Text style={{ color: colors.warningText, backgroundColor: colors.warningSurface, fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' }}>Pending</Text> : null}
                </View>
              </View>
              {canManageMember && member.membershipStatus !== 'pending' ? (
                <TouchableOpacity accessibilityLabel={`Manage ${member.name}`} hitSlop={8} onPress={() => setMenuMember(member)} style={{ padding: 6 }}>
                  <MoreHorizontal size={18} color={colors.mutedText} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={card}>
        <View style={heading}><Activity size={18} color={colors.accent} /><Text style={headingText}>Recent Activity</Text></View>
        {recentActivity.length === 0 ? <Text style={{ color: colors.mutedText }}>No activity yet. Task changes will show up here.</Text> : recentActivity.map((entry) => (
          <View key={`${entry.taskId}:${entry.id}`} style={{ gap: 2 }}>
            <Text style={{ color: colors.secondaryText, fontSize: 13 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{nameFor(entry.userId)}</Text> {(AUDIT_LABELS[entry.action] ?? entry.action.replace(/_/g, ' ')).toLowerCase()} · <Text style={{ fontWeight: '700' }}>{entry.taskTitle}</Text>
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>{entry.detail ? `${entry.detail} · ` : ''}{timeAgo(entry.timestamp)}</Text>
          </View>
        ))}
      </View>

      <Modal visible={menuMember !== null} transparent animationType="fade" onRequestClose={() => setMenuMember(null)}>
        <Pressable onPress={() => setMenuMember(null)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}>
          <Pressable style={{ backgroundColor: colors.surface, padding: 16, paddingBottom: 32, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 4 }}>
            <Text style={{ color: colors.mutedText, fontWeight: '700', marginBottom: 6 }}>{menuMember?.name}</Text>
            {busy ? <ActivityIndicator color={colors.accent} /> : null}
            {ROLES.filter((role) => role !== menuMember?.role).map((role) => (
              <TouchableOpacity key={role} disabled={busy} onPress={() => { const member = menuMember; if (member) void run(() => onChangeRole(member, role)); }} style={{ paddingVertical: 14 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Make {role}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity disabled={busy} onPress={() => { if (menuMember) setPendingAction({ kind: 'transfer', member: menuMember }); }} style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Crown size={16} color="#d97706" /><Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Transfer ownership</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={() => { if (menuMember) setPendingAction({ kind: 'remove', member: menuMember }); }} style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserMinus size={16} color={colors.destructive} /><Text style={{ color: colors.destructiveText, fontSize: 15, fontWeight: '700' }}>Remove from project</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <CustomModal
        visible={pendingAction !== null}
        type={pendingAction?.kind === 'remove' ? 'danger' : 'warning'}
        title={pendingAction?.kind === 'remove' ? 'Remove member?' : 'Transfer ownership?'}
        message={pendingAction?.kind === 'remove'
          ? `${pendingAction.member.name} will lose access to this project.`
          : `${pendingAction?.member.name ?? 'This member'} will become the project owner.`}
        confirmText={pendingAction?.kind === 'remove' ? 'Remove' : 'Transfer'}
        cancelText="Cancel"
        isLoading={busy}
        onConfirm={() => {
          const action = pendingAction;
          if (!action) return;
          void run(() => (action.kind === 'remove' ? onRemove(action.member) : onTransfer(action.member)));
        }}
        onCancel={() => setPendingAction(null)}
        onClose={() => setPendingAction(null)}
      />
    </View>
  );
}
