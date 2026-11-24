import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { History, RefreshCw } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import { describeProjectActivity, formatActivityTime } from '@/components/projectManagement/projectActivityFormat';
import type { ProjectActivityCursor, ProjectActivityEvent, TeamMember } from '@/lib/types/project';

type ProjectActivityPanelProps = {
  projectId: string;
  teamMembers: TeamMember[];
  currentUserId: string;
  /** Changes whenever the first page should be read again (for example after a status change). */
  refreshKey: string;
};

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** Recent project activity, newest first, 20 at a time (website ProjectActivityPanel). Every accepted member sees it. */
export default function ProjectActivityPanel({ projectId, teamMembers, currentUserId, refreshKey }: ProjectActivityPanelProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [cursor, setCursor] = useState<ProjectActivityCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const loadFirstPage = useCallback(async (): Promise<void> => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const page = await projectService.listActivity(projectId);
      if (current !== generation.current) return;
      setEvents(page.events);
      setCursor(page.cursor);
    } catch (failure: unknown) {
      console.error('[ProjectActivityPanel.loadFirstPage] Error:', failure);
      if (current === generation.current) setError('Recent activity could not be loaded.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void loadFirstPage(); }, [loadFirstPage, refreshKey]);

  const handleLoadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    setError('');
    try {
      const page = await projectService.listActivity(projectId, cursor);
      if (current !== generation.current) return;
      setEvents((previous) => [...previous, ...page.events.filter((event) => !previous.some((existing) => existing.id === event.id))]);
      setCursor(page.cursor);
    } catch (failure: unknown) {
      console.error('[ProjectActivityPanel.handleLoadMore] Error:', failure);
      setError('More activity could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  };

  const nameOf = (userId: string): string => {
    if (!userId) return 'Someone';
    if (userId === currentUserId) return 'You';
    return teamMembers.find((member) => member.id === userId)?.name ?? 'Former member';
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <History size={16} color={colors.accent} />
        <Text accessibilityRole="header" style={styles.title}>Project activity</Text>
        <Pressable onPress={() => void loadFirstPage()} disabled={loading} android_ripple={{ ...RIPPLE, borderless: true }} accessibilityRole="button" accessibilityLabel="Refresh project activity" style={styles.iconButton}>
          {loading ? <ActivityIndicator size="small" color={colors.accent} /> : <RefreshCw size={16} color={colors.mutedText} />}
        </Pressable>
      </View>
      {loading && events.length === 0 ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map((row) => <View key={row} style={styles.placeholder} />)}
        </View>
      ) : events.length === 0 && !error ? (
        <Text style={styles.empty}>Status changes and team changes will show up here.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {events.map((event) => (
            <View key={event.id} style={styles.event}>
              <Text style={styles.eventText}>{describeProjectActivity(event, nameOf)}</Text>
              {event.reason ? <Text style={styles.reason}>“{event.reason}”</Text> : null}
              <Text style={styles.time}>{formatActivityTime(event.at)}</Text>
            </View>
          ))}
        </View>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {cursor ? (
        <Pressable onPress={() => void handleLoadMore()} disabled={loadingMore} android_ripple={RIPPLE} accessibilityRole="button" accessibilityLabel="Load more activity" accessibilityState={{ busy: loadingMore }} style={styles.moreButton}>
          {loadingMore ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.moreText}>Load more</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '900', color: colors.text },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  placeholder: { height: 38, borderRadius: 10, backgroundColor: colors.control },
  empty: { fontSize: 13, color: colors.mutedText },
  event: { borderLeftWidth: 2, borderLeftColor: isDark ? '#065f46' : '#a7f3d0', paddingLeft: 10, gap: 2 },
  eventText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.text },
  reason: { fontSize: 12, fontStyle: 'italic', color: colors.secondaryText },
  time: { fontSize: 11, color: colors.mutedText },
  error: { fontSize: 13, fontWeight: '700', color: colors.destructiveText },
  moreButton: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moreText: { fontSize: 14, fontWeight: '800', color: colors.text },
});
