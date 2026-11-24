import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Archive, ArchiveRestore, CheckCircle2, PauseCircle, PlayCircle, RotateCcw } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { ProjectStatus } from '@/lib/types/project';

type ProjectStatusBannerProps = {
  status: ProjectStatus;
  changedAt?: Date | null;
  /** Display name of whoever changed it, already resolved from the team ('' when unknown). */
  changedByName?: string;
  canManage: boolean;
  onReactivate: () => void;
};

const COPY: { [status in Exclude<ProjectStatus, 'active'>]: { label: string; detail: string; action: string; Icon: typeof Archive; ActionIcon: typeof Archive } } = {
  'on-hold': { label: 'Paused', detail: 'Tasks and milestones are read-only until the project resumes.', action: 'Resume project', Icon: PauseCircle, ActionIcon: PlayCircle },
  completed: { label: 'Completed', detail: 'This project is finished and read-only.', action: 'Reopen project', Icon: CheckCircle2, ActionIcon: RotateCcw },
  archived: { label: 'Archived', detail: 'This project is read-only. Nothing was deleted.', action: 'Restore project', Icon: Archive, ActionIcon: ArchiveRestore },
};

/** Shown at the top of a project that is not active, with the way back for owners and admins. */
export default function ProjectStatusBanner({ status, changedAt, changedByName, canManage, onReactivate }: ProjectStatusBannerProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  if (status === 'active') return null;
  const copy = COPY[status];
  const tone = status === 'on-hold'
    ? { surface: colors.warningSurface, text: colors.warningText }
    : status === 'completed' ? { surface: colors.successSurface, text: colors.successText } : { surface: colors.control, text: colors.secondaryText };
  const day = changedAt ? changedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const when = [day ? `on ${day}` : '', changedByName ? `by ${changedByName}` : ''].filter(Boolean).join(' ');
  return (
    <View accessibilityRole="summary" accessibilityLabel={`${copy.label}${when ? ` ${when}` : ''}. ${copy.detail}`} style={[styles.banner, { backgroundColor: tone.surface }]}>
      <View style={styles.row}>
        <copy.Icon size={20} color={tone.text} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: tone.text }]}>{copy.label}{when ? ` ${when}` : ''}</Text>
          <Text style={[styles.detail, { color: tone.text }]}>{copy.detail}</Text>
        </View>
      </View>
      {canManage ? (
        <Pressable onPress={onReactivate} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} accessibilityRole="button" accessibilityLabel={copy.action} style={styles.button}>
          <copy.ActionIcon size={16} color="#ffffff" />
          <Text style={styles.buttonText}>{copy.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  banner: { borderRadius: 18, borderWidth: 1, borderColor: isDark ? colors.border : 'rgba(15,23,42,0.06)', padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 14, fontWeight: '900' },
  detail: { fontSize: 13, lineHeight: 18, opacity: 0.9 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden' },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
