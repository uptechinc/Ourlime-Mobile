import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, FolderKanban, RefreshCw, XCircle } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import { communityProjectLinkService } from '@/lib/services/CommunityProjectLinkService';
import type { CommunityProjectCard, CommunityProjectList, ProjectStatus } from '@/lib/types/project';

type CommunityProjectsWorkspaceProps = {
  communityId: string;
  /** Changes when the screen is pulled to refresh. */
  refreshKey: number;
};

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const EMPTY: CommunityProjectList = { active: [], pending: [], canDecide: false };
const STATUS_LABELS: { [status in ProjectStatus]: string } = { active: 'Active', 'on-hold': 'Paused', completed: 'Completed', archived: 'Archived' };

/**
 * E-Projects this Community sponsors (website CommunityProjectsPanel): approved links only, with the project's name,
 * status, progress and owner name. Joining the Community gives no access to a project. The Community owner and admins
 * also see waiting requests and approve, decline or remove links.
 */
export default function CommunityProjectsWorkspace({ communityId, refreshKey }: CommunityProjectsWorkspaceProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [list, setList] = useState<CommunityProjectList>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<CommunityProjectCard | null>(null);
  const generation = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const next = await communityProjectLinkService.list(communityId);
      if (current === generation.current) setList(next);
    } catch (failure: unknown) {
      console.error('[CommunityProjectsWorkspace.load] Error:', failure instanceof Error ? failure.message : failure);
      if (current === generation.current) setError('Projects could not be loaded.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const handleDecision = async (card: CommunityProjectCard, decision: 'approve' | 'decline'): Promise<void> => {
    if (busyId) return;
    setBusyId(card.projectId);
    try {
      await communityProjectLinkService.decide(communityId, card.projectId, decision);
      toast.success(decision === 'approve' ? `${card.projectName} now shows in this Community` : 'Request declined');
      await load();
    } catch (failure: unknown) {
      toast.error(failure instanceof Error ? failure.message : 'The request could not be answered.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (): Promise<void> => {
    const target = toRemove;
    setToRemove(null);
    if (!target || busyId) return;
    setBusyId(target.projectId);
    try {
      await communityProjectLinkService.remove(communityId, target.projectId);
      toast.success('Project removed from this Community');
      await load();
    } catch (failure: unknown) {
      toast.error(failure instanceof Error ? failure.message : 'The project could not be removed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={styles.title}>Projects</Text>
          <Text style={styles.muted}>E-Projects this Community sponsors. Joining the Community does not give access to a project.</Text>
        </View>
        <Pressable onPress={() => void load()} disabled={loading} android_ripple={{ ...RIPPLE, borderless: true }} accessibilityRole="button" accessibilityLabel="Refresh projects" style={styles.iconButton}>
          <RefreshCw size={18} color={colors.icon} />
        </Pressable>
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {list.canDecide && list.pending.length > 0 ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Waiting for your approval ({list.pending.length})</Text>
          {list.pending.map((card) => (
            <View key={card.projectId} style={styles.pendingRow}>
              <Text style={styles.cardTitle}>{card.projectName}</Text>
              <Text style={styles.muted}>Owner: {card.ownerDisplayName} · {STATUS_LABELS[card.projectStatus]}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => void handleDecision(card, 'decline')} disabled={busyId === card.projectId} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel={`Decline ${card.projectName}`} style={styles.secondaryButton}>
                  <XCircle size={16} color={colors.text} />
                  <Text style={styles.secondaryText}>Decline</Text>
                </Pressable>
                <Pressable onPress={() => void handleDecision(card, 'approve')} disabled={busyId === card.projectId} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel={`Approve ${card.projectName}`} style={styles.primaryButton}>
                  {busyId === card.projectId ? <ActivityIndicator size="small" color="#ffffff" /> : <CheckCircle2 size={16} color="#ffffff" />}
                  <Text style={styles.primaryText}>Approve</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {loading && list.active.length === 0 ? (
        <ActivityIndicator color={colors.accentText} style={{ marginVertical: 24 }} accessibilityLabel="Loading projects" />
      ) : list.active.length === 0 ? (
        <View style={styles.empty}>
          <FolderKanban size={36} color={colors.mutedText} />
          <Text style={styles.cardTitle}>No projects yet</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>A project manager who belongs to this Community can ask to link their E-Project from the project&apos;s overview.</Text>
        </View>
      ) : list.active.map((card) => (
        <View key={card.projectId} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>{card.projectName}</Text>
            <View style={styles.pill}><Text style={styles.pillText}>{STATUS_LABELS[card.projectStatus]}</Text></View>
          </View>
          <Text style={styles.muted}>Owner: {card.ownerDisplayName}</Text>
          <View style={{ gap: 4 }}>
            <View style={styles.progressRow}><Text style={styles.muted}>Progress</Text><Text style={styles.percent}>{card.progress}%</Text></View>
            <View accessibilityRole="progressbar" accessibilityLabel={`${card.projectName}: ${card.progress}% done`} accessibilityValue={{ min: 0, max: 100, now: card.progress }} style={styles.track}>
              <View style={[styles.fill, { width: `${card.progress}%` }]} />
            </View>
          </View>
          {list.canDecide ? (
            <Pressable onPress={() => setToRemove(card)} disabled={busyId === card.projectId} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel={`Remove ${card.projectName} from this Community`} style={styles.linkButton}>
              <Text style={styles.linkText}>Remove from this Community</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <CustomModal
        visible={toRemove !== null}
        type="warning"
        title="Remove this project?"
        message={`${toRemove?.projectName ?? 'This project'} will stop showing in this Community. The project itself is not affected.`}
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={() => void handleRemove()}
        onCancel={() => setToRemove(null)}
        onClose={() => setToRemove(null)}
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  error: { color: colors.destructiveText, fontSize: 14 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pendingBox: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, gap: 10 },
  pendingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  pendingRow: { padding: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden' },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.control },
  pillText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  percent: { color: colors.text, fontSize: 13, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.control, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4, borderRadius: 8, overflow: 'hidden' },
  linkText: { color: colors.destructiveText, fontSize: 14, fontWeight: '700' },
});
