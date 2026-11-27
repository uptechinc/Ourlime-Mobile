import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, Circle, Lock, Users, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import {
  PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectIconButton, ProjectPill, ProjectScreenHeader, ProjectSection,
} from '@/components/projectManagement/ProjectUiParts';
import { projectService } from '@/lib/services/ProjectService';
import type { CommunityLinkCandidate, ProjectRecord } from '@/lib/types/project';

type ProjectCommunityLinkCardProps = {
  project: ProjectRecord;
  /** Owner or accepted admin: may ask a Community, withdraw the request or remove the link. */
  canManage: boolean;
};

/**
 * The project's sponsoring Community (at most one, website ProjectCommunityLinkCard). A manager asks a Community they
 * belong to; its owner or an admin approves. The Community then shows the project's name, status, progress and owner
 * name only, and its members get no access to the project.
 */
export default function ProjectCommunityLinkCard({ project, canManage }: ProjectCommunityLinkCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const link = project.communityLink ?? null;
  const open = link && (link.status === 'pending' || link.status === 'active') ? link : null;
  const canAsk = canManage && project.status !== 'archived';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (): Promise<void> => {
    setConfirmRemove(false);
    if (!open || removing) return;
    setRemoving(true);
    try {
      await projectService.removeCommunityLink(project.id, open.communityId);
      toast.success(open.status === 'pending' ? 'Request withdrawn' : 'Community link removed');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The link could not be removed.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <ProjectSection title="Community" icon={<Users size={18} color={colors.accentText} />}>
      {open?.status === 'active' ? (
        <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/communities/[id]', params: { id: open.communityId } })}
            android_ripple={PROJECT_RIPPLE}
            accessibilityRole="link"
            accessibilityLabel={`Sponsored by ${open.communityName}. Open the Community`}
            style={styles.linkRow}
          >
            <Text style={styles.body}>Sponsored by <Text style={styles.strong}>{open.communityName}</Text></Text>
          </Pressable>
          <Text style={styles.muted}>The Community sees this project&apos;s name, status, progress and owner. Its members get no access to the project.</Text>
        </View>
      ) : open?.status === 'pending' ? (
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <ProjectPill label="Waiting for approval" tone="warning" />
          <Text style={styles.body}>Waiting for <Text style={styles.strong}>{open.communityName}</Text> to approve the link.</Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {link?.status === 'declined' ? <Text style={styles.body}><Text style={styles.strong}>{link.communityName}</Text> declined the link.</Text> : null}
          <Text style={styles.muted}>{canManage ? 'Ask a Community you belong to to sponsor this project. It shows on the Community once its owner or an admin approves.' : 'This project is not linked to a Community.'}</Text>
        </View>
      )}

      {canManage ? (
        open ? (
          <ProjectButton label={open.status === 'pending' ? 'Withdraw request' : 'Remove link'} variant="secondary" isCompact isBusy={removing} onPress={() => setConfirmRemove(true)} />
        ) : (
          <View style={{ gap: 6 }}>
            <ProjectButton label={link?.status === 'declined' ? 'Ask a Community' : 'Link to a Community'} isCompact isDisabled={!canAsk} onPress={() => setPickerOpen(true)} />
            {!canAsk ? <Text style={styles.muted}>Restore this project before linking it.</Text> : null}
          </View>
        )
      ) : null}

      <CommunityPickerModal visible={pickerOpen} projectId={project.id} onClose={() => setPickerOpen(false)} />

      <CustomModal
        visible={confirmRemove}
        type="warning"
        title={open?.status === 'pending' ? 'Withdraw this request?' : 'Remove the Community link?'}
        message={open?.status === 'pending' ? `${open.communityName} will no longer see the request.` : `${open?.communityName ?? 'The Community'} will stop showing this project. The project and its team are not affected.`}
        confirmText={open?.status === 'pending' ? 'Withdraw' : 'Remove'}
        cancelText="Keep"
        onConfirm={() => void handleRemove()}
        onCancel={() => setConfirmRemove(false)}
        onClose={() => setConfirmRemove(false)}
      />
    </ProjectSection>
  );
}

type CommunityPickerModalProps = { visible: boolean; projectId: string; onClose: () => void };

function CommunityPickerModal({ visible, projectId, onClose }: CommunityPickerModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [communities, setCommunities] = useState<CommunityLinkCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setSelected(''); setError(''); setLoading(true);
    projectService.communityLinkCandidates(projectId)
      .then((list) => { if (!cancelled) setCommunities(list); })
      .catch((failure: unknown) => {
        console.error('[CommunityPickerModal.load] Error:', failure instanceof Error ? failure.message : failure);
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'Your Communities could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, projectId]);

  const handleSend = async (): Promise<void> => {
    if (!selected || sending) return;
    setSending(true); setError('');
    try {
      const status = await projectService.requestCommunityLink(projectId, selected);
      toast.success(status === 'active' ? 'Project linked to the Community' : 'Request sent to the Community');
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'The request could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const close = (): void => { if (!sending) onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <ProjectScreenHeader
          title="Link to a Community"
          onBack={close}
          right={<ProjectIconButton accessibilityLabel="Close" onPress={close}><X size={22} color={colors.icon} /></ProjectIconButton>}
        />
        <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right']} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: PROJECT_GUTTER, gap: 10 }}>
            <Text style={styles.muted}>Choose one Community you belong to. Its owner or an admin approves the link; if that is you, it is linked straight away.</Text>
            {loading ? <ActivityIndicator color={colors.accentText} style={{ marginTop: 16 }} accessibilityLabel="Loading your Communities" /> : null}
            {!loading && communities.length === 0 && !error ? <Text style={styles.body}>You have not joined any Communities yet. Join one, then ask it to sponsor this project.</Text> : null}
            {communities.map((community) => {
              const isSelected = selected === community.id;
              return (
                <Pressable
                  key={community.id}
                  onPress={() => setSelected(community.id)}
                  android_ripple={PROJECT_RIPPLE}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${community.title}${community.isPrivate ? ', private Community' : ''}`}
                  style={[styles.option, isSelected && styles.optionSelected]}
                >
                  {isSelected ? <CheckCircle2 size={20} color={colors.accentText} /> : <Circle size={20} color={colors.mutedText} />}
                  <Text style={styles.optionTitle} numberOfLines={2}>{community.title}</Text>
                  {community.isPrivate ? <Lock size={16} color={colors.mutedText} /> : null}
                </Pressable>
              );
            })}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
        <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <ProjectButton label="Send request" busyLabel="Sending…" isBusy={sending} isDisabled={!selected} onPress={() => void handleSend()} />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  strong: { color: colors.text, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  linkRow: { minHeight: 44, justifyContent: 'center', borderRadius: 10, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  optionSelected: { borderColor: colors.accentText },
  optionTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  error: { color: colors.destructiveText, fontSize: 14, lineHeight: 20 },
  bar: { paddingHorizontal: PROJECT_GUTTER, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
