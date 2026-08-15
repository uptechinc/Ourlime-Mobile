import { ActivityIndicator, Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ban, Shield, UserMinus, Users, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityMember, CommunityMemberRole } from '@/lib/types/community';
import CustomModal from '@/components/ui/CustomModal';

type MemberAction = 'role' | 'remove' | 'ban';
type PendingMemberAction = { action: MemberAction; role: Exclude<CommunityMemberRole, 'owner' | 'none'> | null };
type CommunityMemberActionSheetProps = {
  visible: boolean;
  member: CommunityMember | null;
  onClose: () => void;
  onRoleChange: (member: CommunityMember, role: Exclude<CommunityMemberRole, 'owner' | 'none'>) => Promise<void>;
  onRemove: (member: CommunityMember) => Promise<void>;
  onBan: (member: CommunityMember) => Promise<void>;
};

export default function CommunityMemberActionSheet({ visible, member, onClose, onRoleChange, onRemove, onBan }: CommunityMemberActionSheetProps) {
  const { colors } = useAppTheme();
  const [busyAction, setBusyAction] = useState<MemberAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingMemberAction | null>(null);

  const runAction = async (action: MemberAction, operation: () => Promise<void>): Promise<void> => {
    setBusyAction(action);
    setErrorMessage(null);
    try {
      await operation();
      onClose();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The member action could not be completed.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!member) return null;
  const name = `${member.firstName} ${member.lastName}`.trim() || member.userName;
  const roles: Exclude<CommunityMemberRole, 'owner' | 'none'>[] = ['member', 'moderator', 'admin'];
  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingAction) return;
    const selectedAction = pendingAction;
    setPendingAction(null);
    const selectedRole = selectedAction.role;
    if (selectedAction.action === 'role' && selectedRole) await runAction('role', () => onRoleChange(member, selectedRole));
    if (selectedAction.action === 'remove') await runAction('remove', () => onRemove(member));
    if (selectedAction.action === 'ban') await runAction('ban', () => onBan(member));
  };

  return (
    <><Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}>
          <TouchableWithoutFeedback>
            <SafeAreaView edges={['top', 'left', 'right']} style={{ padding: 18, paddingBottom: 28, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: colors.elevated }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Manage member</Text>
                  <Text style={{ marginTop: 3, color: colors.mutedText }}>{name} · @{member.userName}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><X size={22} color={colors.icon} /></TouchableOpacity>
              </View>
              {errorMessage ? <View style={{ marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: colors.destructiveSurface }}><Text style={{ color: colors.destructiveText, fontWeight: '800' }}>{errorMessage}</Text></View> : null}
              <Text style={{ marginTop: 18, marginBottom: 8, color: colors.mutedText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Community role</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {roles.map((role) => <TouchableOpacity key={role} disabled={Boolean(busyAction) || member.role === role} onPress={() => setPendingAction({ action: 'role', role })} style={{ flex: 1, minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: member.role === role ? colors.selectedControl : colors.control, borderWidth: 1, borderColor: member.role === role ? colors.accent : colors.border }}>{busyAction === 'role' ? <ActivityIndicator color={member.role === role ? colors.selectedText : colors.accent} /> : <><Shield size={17} color={member.role === role ? colors.selectedText : colors.icon} /><Text style={{ marginTop: 4, color: member.role === role ? colors.selectedText : colors.secondaryText, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' }}>{role}</Text></>}</TouchableOpacity>)}
              </View>
              <TouchableOpacity disabled={Boolean(busyAction)} onPress={() => setPendingAction({ action: 'remove', role: null })} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, minHeight: 52, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.control }}>
                <UserMinus size={20} color={colors.destructive} /><Text style={{ flex: 1, marginLeft: 11, color: colors.destructiveText, fontWeight: '900' }}>Remove from community</Text>{busyAction === 'remove' ? <ActivityIndicator color={colors.destructive} /> : <Users size={18} color={colors.icon} />}
              </TouchableOpacity>
              <TouchableOpacity disabled={Boolean(busyAction)} onPress={() => setPendingAction({ action: 'ban', role: null })} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, minHeight: 52, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.destructiveSurface, borderWidth: 1, borderColor: colors.destructive }}>
                <Ban size={20} color={colors.destructive} /><Text style={{ flex: 1, marginLeft: 11, color: colors.destructiveText, fontWeight: '900' }}>Ban member</Text>{busyAction === 'ban' ? <ActivityIndicator color={colors.destructive} /> : null}
              </TouchableOpacity>
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal><CustomModal visible={pendingAction !== null} title={pendingAction?.action === 'role' ? 'Change community role?' : pendingAction?.action === 'ban' ? 'Ban this member?' : 'Remove this member?'} message={pendingAction?.action === 'role' ? `${name} will become a ${pendingAction.role}. Their community permissions will change immediately.` : pendingAction?.action === 'ban' ? `${name} will be removed and prevented from rejoining this community.` : `${name} will lose access to member-only community content.`} type={pendingAction?.action === 'role' ? 'warning' : 'danger'} confirmText={pendingAction?.action === 'role' ? 'Change role' : pendingAction?.action === 'ban' ? 'Ban member' : 'Remove member'} cancelText="Cancel" onConfirm={() => void confirmPendingAction()} onCancel={() => setPendingAction(null)} onClose={() => setPendingAction(null)} /></>
  );
}
