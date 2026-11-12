import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Archive, ArchiveRestore, Crown, Trash2, Users, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import type { ProjectRecord, ProjectRole, TeamMember } from '@/lib/types/project';

type ProjectSettingsExtrasProps = {
  project: ProjectRecord;
  teamMembers: TeamMember[];
  currentUserId: string;
  onChangeRole: (member: TeamMember, role: ProjectRole) => Promise<void>;
  onRemove: (member: TeamMember) => Promise<void>;
  onTransfer: (member: TeamMember) => Promise<void>;
  onArchiveToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
};

type Confirmation = { kind: 'remove' | 'transfer'; member: TeamMember } | { kind: 'archive' | 'delete' } | null;

/** Website ProjectSettingsModal "Team & Roles" and "Danger zone" sections, under the settings form. */
export default function ProjectSettingsExtras({ project, teamMembers, currentUserId, onChangeRole, onRemove, onTransfer, onArchiveToggle, onDelete }: ProjectSettingsExtrasProps) {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const canManage = project.role === 'owner' || project.role === 'admin';
  const isOwner = project.role === 'owner';
  const isArchived = project.status === 'archived';

  const run = async (key: string, action: () => Promise<void>, success: string): Promise<void> => {
    if (pending) return;
    setPending(key);
    try { await action(); toast.success(success); }
    catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'The change could not be saved.'); }
    finally { setPending(null); }
  };

  const handleConfirm = (): void => {
    const current = confirmation;
    setConfirmation(null);
    if (!current) return;
    if (current.kind === 'remove') void run(`remove:${current.member.id}`, () => onRemove(current.member), current.member.membershipStatus === 'pending' ? 'Invitation cancelled' : `${current.member.name} removed from project`);
    else if (current.kind === 'transfer') void run(`transfer:${current.member.id}`, () => onTransfer(current.member), `Ownership transferred to ${current.member.name}`);
    else if (current.kind === 'archive') void run('archive', onArchiveToggle, isArchived ? 'Project unarchived' : 'Project archived');
    else void run('delete', onDelete, 'Project deleted');
  };

  const roleChip = (selected: boolean) => ({ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.control });
  const card = { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 } as const;

  return (
    <View style={{ gap: 16, marginTop: 4 }}>
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Users size={16} color={colors.accent} /><Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>Team & Roles</Text></View>
        {teamMembers.map((member) => {
          const isPending = member.membershipStatus === 'pending';
          const manageable = canManage && !member.isOwner && member.id !== currentUserId;
          const roles: ProjectRole[] = isOwner ? ['admin', 'member', 'viewer'] : ['member', 'viewer'];
          return (
            <View key={member.id} style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <UserAvatar profileImage={member.avatar} firstName={member.name} size={34} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800' }}>{member.name}{member.id === currentUserId ? ' (You)' : ''}</Text>
                  <Text style={{ color: colors.mutedText, fontSize: 12, textTransform: 'capitalize' }}>{member.isOwner ? 'owner' : isPending ? `Pending invitation · ${member.role}` : member.role}</Text>
                </View>
                {pending && pending.endsWith(member.id) ? <ActivityIndicator size="small" color={colors.accent} /> : null}
                {manageable ? (
                  <TouchableOpacity accessibilityLabel={isPending ? `Cancel invitation to ${member.name}` : `Remove ${member.name}`} disabled={pending !== null} onPress={() => setConfirmation({ kind: 'remove', member })} style={{ padding: 6 }}>
                    <X size={17} color={colors.destructive} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {manageable && !isPending ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {roles.map((role) => (
                    <TouchableOpacity key={role} disabled={pending !== null || member.role === role} onPress={() => void run(`role:${member.id}`, () => onChangeRole(member, role), `${member.name}'s role updated`)} style={roleChip(member.role === role)}>
                      <Text style={{ color: member.role === role ? colors.onAccent : colors.secondaryText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                  {isOwner ? (
                    <TouchableOpacity disabled={pending !== null} onPress={() => setConfirmation({ kind: 'transfer', member })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: '#fcd34d' }}>
                      <Crown size={12} color="#d97706" /><Text style={{ color: '#b45309', fontSize: 11, fontWeight: '800' }}>Transfer</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {canManage ? (
        <View style={[card, { borderColor: '#fecaca' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color={colors.destructive} /><Text style={{ color: colors.destructiveText, fontSize: 15, fontWeight: '900' }}>Danger zone</Text></View>
          <Text style={{ color: colors.mutedText, fontSize: 12 }}>These actions affect everyone on the project. Proceed with caution.</Text>
          <TouchableOpacity disabled={pending !== null} onPress={() => setConfirmation({ kind: 'archive' })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            {isArchived ? <ArchiveRestore size={16} color={colors.text} /> : <Archive size={16} color={colors.text} />}
            <Text style={{ color: colors.text, fontWeight: '800' }}>{isArchived ? 'Unarchive project' : 'Archive project'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={pending !== null} onPress={() => setConfirmation({ kind: 'delete' })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.destructiveSurface }}>
            {pending === 'delete' ? <ActivityIndicator size="small" color={colors.destructiveText} /> : <Trash2 size={16} color={colors.destructiveText} />}
            <Text style={{ color: colors.destructiveText, fontWeight: '800' }}>Delete project</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <CustomModal
        visible={confirmation !== null}
        type={confirmation?.kind === 'transfer' || confirmation?.kind === 'archive' ? 'warning' : 'danger'}
        title={confirmation?.kind === 'remove' ? (confirmation.member.membershipStatus === 'pending' ? 'Cancel invitation?' : 'Remove member?')
          : confirmation?.kind === 'transfer' ? 'Transfer ownership?' : confirmation?.kind === 'archive' ? (isArchived ? 'Unarchive project?' : 'Archive project?') : 'Delete project?'}
        message={confirmation?.kind === 'remove' ? (confirmation.member.membershipStatus === 'pending' ? `Cancel the invitation sent to ${confirmation.member.name}?` : `Remove ${confirmation.member.name} from this project?`)
          : confirmation?.kind === 'transfer' ? `Transfer ownership to ${confirmation.member.name}? You will become an admin and will no longer be the owner.`
            : confirmation?.kind === 'archive' ? `Are you sure you want to ${isArchived ? 'unarchive' : 'archive'} this project?` : 'Are you sure? This permanently deletes all tasks and attachments.'}
        confirmText={confirmation?.kind === 'remove' ? 'Yes' : confirmation?.kind === 'transfer' ? 'Transfer' : confirmation?.kind === 'archive' ? (isArchived ? 'Unarchive' : 'Archive') : 'Delete'}
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmation(null)}
        onClose={() => setConfirmation(null)}
      />
    </View>
  );
}
