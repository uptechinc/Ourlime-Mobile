import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { Crown, LogOut, Mail, MoreHorizontal, Send, Shield, UserMinus, UserPlus, Users, UserX } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import UserAvatar from '@/components/ui/UserAvatar';
import ProjectActionSheet from '@/components/projectManagement/ProjectActionSheet';
import { ROLE_LABELS } from '@/components/projectManagement/ProjectCard';
import { ProjectButton, ProjectIconButton, ProjectPill, ProjectSection, ProjectSheetRow } from '@/components/projectManagement/ProjectUiParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { ProjectEmailInvitation, ProjectRecord, ProjectRole, TeamMember } from '@/lib/types/project';

type ProjectTeamPanelProps = {
  project: ProjectRecord;
  teamMembers: TeamMember[];
  currentUserId: string;
  /** False with the reason when inviting is not possible right now (read-only project, viewer, session). */
  canInvite: boolean;
  onInvite: () => void;
  onChangeRole: (member: TeamMember, role: ProjectRole) => Promise<void>;
  onRemove: (member: TeamMember) => Promise<void>;
  onTransfer: (member: TeamMember) => Promise<void>;
  onResendInvite: (member: TeamMember) => Promise<void>;
  /** Email invitations, pending and expired (loaded for owners and admins only). */
  emailInvitations: ProjectEmailInvitation[];
  onResendEmailInvite: (invitation: ProjectEmailInvitation) => Promise<void>;
  /** The one automation that runs today: new tasks with nobody on them go to the project owner. */
  autoAssignEnabled: boolean;
  onToggleAutoAssign: () => Promise<void>;
  onLeave: () => void;
};

type PendingAction = { kind: 'remove' | 'transfer'; member: TeamMember } | null;

/** Members and invitations, role changes, transfer and removal (owners and admins), and leaving the project. */
export default function ProjectTeamPanel({ project, teamMembers, currentUserId, canInvite, onInvite, onChangeRole, onRemove, onTransfer, onResendInvite, emailInvitations, onResendEmailInvite, autoAssignEnabled, onToggleAutoAssign, onLeave }: ProjectTeamPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [menuMember, setMenuMember] = useState<TeamMember | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [togglingRule, setTogglingRule] = useState(false);
  const isOwner = project.role === 'owner';
  const canManage = isOwner || project.role === 'admin';
  const isActive = project.status === 'active';

  const accepted = teamMembers.filter((member) => member.isOwner || member.membershipStatus !== 'pending')
    .sort((first, second) => Number(second.isOwner) - Number(first.isOwner) || first.name.localeCompare(second.name));
  const pending = teamMembers.filter((member) => !member.isOwner && member.membershipStatus === 'pending');
  const roleChoices: ProjectRole[] = isOwner ? ['admin', 'member', 'viewer'] : ['member', 'viewer'];

  const run = async (operation: () => Promise<void>, success: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      toast.success(success);
    } catch (error: unknown) {
      console.error('[ProjectTeamPanel.run] Error:', error);
      toast.error(error instanceof Error ? error.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
      setMenuMember(null);
      setPendingAction(null);
    }
  };

  // Sending an email invitation again gives it a new 14 days (it counts toward the hourly invite limits).
  const handleResendEmail = async (invitation: ProjectEmailInvitation): Promise<void> => {
    if (resendingEmailId) return;
    setResendingEmailId(invitation.id);
    try {
      await onResendEmailInvite(invitation);
      toast.success(`Invitation sent again to ${invitation.email}`);
    } catch (error: unknown) {
      console.error('[ProjectTeamPanel.handleResendEmail] Error:', error);
      toast.error(error instanceof Error ? error.message : 'The invitation could not be sent.');
    } finally {
      setResendingEmailId(null);
    }
  };

  const formatExpiry = (iso: string): string => {
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  };

  const handleToggleRule = async (): Promise<void> => {
    if (togglingRule) return;
    setTogglingRule(true);
    try { await onToggleAutoAssign(); } finally { setTogglingRule(false); }
  };

  const renderMember = (member: TeamMember) => {
    const isPending = member.membershipStatus === 'pending' && !member.isOwner;
    const manageable = canManage && isActive && !member.isOwner && member.id !== currentUserId;
    const roleLabel = member.isOwner ? 'Owner' : ROLE_LABELS[member.role];
    return (
      <View key={member.id} style={styles.memberRow}>
        <UserAvatar userId={member.id} profileImage={member.avatar} firstName={member.name} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={styles.memberName}>{member.name}{member.id === currentUserId ? ' (you)' : ''}</Text>
          <View style={styles.inline}>
            {member.isOwner ? <Crown size={13} color="#b45309" /> : member.role === 'admin' ? <Shield size={13} color={colors.secondaryText} /> : null}
            <Text style={styles.memberRole}>{roleLabel}</Text>
            {isPending ? <ProjectPill label={member.inviteExpired ? 'Expired' : 'Invited'} tone={member.inviteExpired ? 'danger' : 'warning'} /> : null}
          </View>
        </View>
        {manageable ? (
          <ProjectIconButton size={44} accessibilityLabel={isPending ? `Manage invitation for ${member.name}` : `Manage ${member.name}`} onPress={() => setMenuMember(member)}>
            <MoreHorizontal size={20} color={colors.icon} />
          </ProjectIconButton>
        ) : null}
      </View>
    );
  };

  const menuIsPending = menuMember?.membershipStatus === 'pending';

  return (
    <View style={{ gap: 14 }}>
      <ProjectSection title={`Members (${accepted.length})`} icon={<Users size={18} color={colors.accentText} />}>
        {canInvite ? <ProjectButton label="Invite people" icon={<UserPlus size={18} color="#ffffff" />} onPress={onInvite} /> : null}
        <View style={{ gap: 4 }}>{accepted.map(renderMember)}</View>
      </ProjectSection>

      {pending.length > 0 ? (
        <ProjectSection title={`Invited (${pending.length})`} icon={<Send size={18} color={colors.accentText} />}>
          <Text style={styles.hint}>They can see the project once they accept.</Text>
          <View style={{ gap: 4 }}>{pending.map(renderMember)}</View>
        </ProjectSection>
      ) : null}

      {canManage && emailInvitations.length > 0 ? (
        <ProjectSection title={`Email invitations (${emailInvitations.length})`} icon={<Mail size={18} color={colors.accentText} />}>
          <Text style={styles.hint}>Each invitation lasts 14 days. They join once they sign in to Ourlime with this address verified.</Text>
          <View style={{ gap: 4 }}>
            {emailInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.memberRow}>
                <View style={styles.emailIcon}><Mail size={18} color={colors.secondaryText} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text numberOfLines={1} style={styles.memberName}>{invitation.email}</Text>
                  <View style={styles.inline}>
                    <Text style={styles.memberRole}>{ROLE_LABELS[invitation.role]}</Text>
                    {invitation.status === 'expired'
                      ? <ProjectPill label="Expired" tone="danger" />
                      : <Text style={styles.memberRole}>· Expires {formatExpiry(invitation.expiresAt)}</Text>}
                  </View>
                </View>
                {isActive ? (
                  <ProjectButton
                    label="Resend"
                    variant="secondary"
                    isCompact
                    isBusy={resendingEmailId === invitation.id}
                    isDisabled={resendingEmailId !== null && resendingEmailId !== invitation.id}
                    accessibilityLabel={`Resend the invitation to ${invitation.email}`}
                    onPress={() => void handleResendEmail(invitation)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </ProjectSection>
      ) : null}

      <ProjectSection title="Roles">
        <Text style={styles.hint}><Text style={styles.strong}>Owner</Text> and <Text style={styles.strong}>admins</Text> manage the team, details and status. <Text style={styles.strong}>Members</Text> add and change tasks and milestones. <Text style={styles.strong}>Viewers</Text> can read everything but change nothing.</Text>
      </ProjectSection>

      {canManage ? (
        <ProjectSection title="New task assignment">
          <View style={styles.switchRow}>
            <Text style={[styles.hint, { flex: 1 }]}>When someone creates a task without picking anyone, give it to the project owner.</Text>
            {togglingRule ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <Switch value={autoAssignEnabled} onValueChange={() => void handleToggleRule()} disabled={togglingRule || !isActive} accessibilityLabel="Give unassigned new tasks to the project owner" trackColor={{ true: colors.accent, false: colors.border }} />
          </View>
        </ProjectSection>
      ) : null}

      {!project.isOwner ? <ProjectButton label="Leave project" variant="danger" icon={<LogOut size={18} color={colors.destructiveText} />} onPress={onLeave} /> : null}

      <ProjectActionSheet visible={menuMember !== null} title={menuMember?.name ?? ''} subtitle={menuMember ? (menuIsPending ? `Invited as ${ROLE_LABELS[menuMember.role].toLowerCase()}` : ROLE_LABELS[menuMember.role]) : undefined} onClose={() => { if (!busy) setMenuMember(null); }}>
        {busy ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 8 }} /> : null}
        {menuMember && menuIsPending ? <>
          <ProjectSheetRow label={menuMember.inviteExpired ? 'Resend invitation' : 'Send a reminder'} detail={menuMember.inviteExpired ? 'This invitation expired' : undefined} icon={<Send size={18} color={colors.icon} />} onPress={() => { const member = menuMember; void run(() => onResendInvite(member), member.inviteExpired ? 'Invitation sent again' : 'Reminder sent'); }} />
          <ProjectSheetRow label="Cancel invitation" tone="danger" icon={<UserX size={18} color={colors.destructive} />} onPress={() => setPendingAction({ kind: 'remove', member: menuMember })} />
        </> : null}
        {menuMember && !menuIsPending ? <>
          {roleChoices.filter((role) => role !== menuMember.role).map((role) => (
            <ProjectSheetRow key={role} label={`Make ${ROLE_LABELS[role].toLowerCase()}`} icon={<Shield size={18} color={colors.icon} />} onPress={() => { const member = menuMember; void run(() => onChangeRole(member, role), `${member.name} is now ${role === 'admin' ? 'an' : 'a'} ${role}`); }} />
          ))}
          {isOwner ? <ProjectSheetRow label="Transfer ownership" detail="You become an admin" icon={<Crown size={18} color="#b45309" />} onPress={() => setPendingAction({ kind: 'transfer', member: menuMember })} /> : null}
          <ProjectSheetRow label="Remove from project" tone="danger" icon={<UserMinus size={18} color={colors.destructive} />} onPress={() => setPendingAction({ kind: 'remove', member: menuMember })} />
        </> : null}
      </ProjectActionSheet>

      <CustomModal
        visible={pendingAction !== null}
        type={pendingAction?.kind === 'remove' ? 'danger' : 'warning'}
        title={pendingAction?.kind === 'remove' ? (pendingAction.member.membershipStatus === 'pending' ? 'Cancel invitation?' : 'Remove member?') : 'Transfer ownership?'}
        message={pendingAction?.kind === 'remove'
          ? (pendingAction.member.membershipStatus === 'pending' ? `Cancel the invitation sent to ${pendingAction.member.name}?` : `${pendingAction.member.name} will lose access to this project.`)
          : `${pendingAction?.member.name ?? 'This member'} will become the project owner. You will stay on as an admin.`}
        confirmText={pendingAction?.kind === 'remove' ? (pendingAction.member.membershipStatus === 'pending' ? 'Cancel invitation' : 'Remove') : 'Transfer'}
        cancelText="Keep"
        isLoading={busy}
        onConfirm={() => {
          const action = pendingAction;
          if (!action) return;
          const isInvite = action.member.membershipStatus === 'pending';
          void run(() => (action.kind === 'remove' ? onRemove(action.member) : onTransfer(action.member)),
            action.kind === 'transfer' ? `${action.member.name} now owns the project` : isInvite ? 'Invitation cancelled' : `${action.member.name} was removed`);
        }}
        onCancel={() => setPendingAction(null)}
        onClose={() => setPendingAction(null)}
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  memberName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emailIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  memberRole: { color: colors.mutedText, fontSize: 13 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  hint: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  strong: { color: colors.text, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
