import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CalendarDays, Flag, FolderKanban, MoreHorizontal, Users } from 'lucide-react-native';
import { projectColorHex } from '@/components/projectManagement/projectColors';
import { PROJECT_RIPPLE, ProjectIconButton, ProjectPill, ProjectProgressBar, projectStatusTone } from '@/components/projectManagement/ProjectUiParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { projectInsightRules, type ProjectPulse } from '@/lib/services/ProjectInsightRules';
import { projectLifecycleRules } from '@/lib/services/ProjectLifecycleRules';
import type { ProjectRecord, ProjectRole } from '@/lib/types/project';

type ProjectCardProps = {
  project: ProjectRecord;
  /** Overdue count and next milestone; undefined while loading or for closed projects. */
  pulse?: ProjectPulse;
  isFocused?: boolean;
  isOpening?: boolean;
  isDisabled?: boolean;
  onOpen: (projectId: string) => void;
  /** Owners and admins get a ⋯ menu (edit, status, delete). */
  onMenu?: (project: ProjectRecord) => void;
};

export const ROLE_LABELS: { [role in ProjectRole]: string } = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
const toTime = (value: Date | string | undefined): number => (value ? new Date(value).getTime() || 0 : 0);

function lastActivity(value: Date | string | undefined): string {
  const time = toTime(value);
  if (!time) return '';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated ${new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** One project on the projects list: identity, status and role, progress, the next date and what is overdue. */
export default function ProjectCard({ project, pulse, isFocused = false, isOpening = false, isDisabled = false, onOpen, onMenu }: ProjectCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = projectInsightRules.today();
  const statusLabel = projectLifecycleRules.label(project.status);
  const roleLine = project.isOwner ? 'You own this' : `${ROLE_LABELS[project.role]} · Owned by ${project.ownerName || 'the project owner'}`;
  const tasksLine = project.totalTasks > 0 ? `${project.completedTasks} of ${plural(project.totalTasks, 'task', 'tasks')} done` : 'No tasks yet';
  const nextMilestone = pulse?.nextMilestone ?? null;
  const milestoneDue = nextMilestone ? projectInsightRules.dueLabel(nextMilestone.dueDate, today) : null;
  const projectDue = project.status === 'active' || project.status === 'on-hold' ? projectInsightRules.dueLabel(project.dueDate, today) : null;
  const overdue = pulse?.overdueTasks ?? 0;
  const accessibilityLabel = [project.name, statusLabel, roleLine, tasksLine, overdue > 0 ? `${overdue} overdue` : '', nextMilestone ? `Next milestone ${nextMilestone.name}` : ''].filter(Boolean).join('. ');

  return (
    <View style={[styles.card, isFocused && styles.focused, isOpening && { opacity: 0.7 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Opens the project" disabled={isDisabled} onPress={() => onOpen(project.id)} android_ripple={PROJECT_RIPPLE} style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.tile, { backgroundColor: projectColorHex(project.color) }]}>
            {isOpening ? <ActivityIndicator size="small" color="#ffffff" /> : <FolderKanban size={20} color="#ffffff" />}
          </View>
          <View style={styles.titleBlock}>
            <Text numberOfLines={2} style={styles.title}>{project.name}</Text>
            <Text numberOfLines={1} style={styles.roleLine}>{roleLine}</Text>
          </View>
          {onMenu ? <View style={{ width: 44 }} /> : null}
        </View>
        <View style={styles.pills}>
          <ProjectPill label={statusLabel} tone={projectStatusTone(project.status)} />
          {overdue > 0 ? <ProjectPill label={`${overdue} overdue`} tone="danger" icon={<AlertTriangle size={12} color={colors.destructiveText} />} /> : null}
          {pulse && pulse.myOpenTasks > 0 ? <ProjectPill label={`${pulse.myOpenTasks} for you`} tone="info" /> : null}
        </View>
        {project.description ? <Text numberOfLines={2} style={styles.description}>{project.description}</Text> : null}
        <View style={{ gap: 6 }}>
          <View style={styles.progressRow}>
            <Text numberOfLines={1} style={styles.meta}>{tasksLine}</Text>
            <Text style={styles.percent}>{project.progress}%</Text>
          </View>
          <ProjectProgressBar value={project.progress} accessibilityLabel={`${project.name} progress`} />
        </View>
        <View style={styles.footer}>
          {nextMilestone ? (
            <View style={styles.metaItem}>
              <Flag size={14} color={colors.mutedText} />
              <Text numberOfLines={1} style={[styles.meta, styles.metaShrink]}>{nextMilestone.name}{milestoneDue ? ` · ${milestoneDue.label}` : ''}</Text>
            </View>
          ) : projectDue ? (
            <View style={styles.metaItem}>
              <CalendarDays size={14} color={projectDue.tone === 'danger' ? colors.destructiveText : colors.mutedText} />
              <Text numberOfLines={1} style={[styles.meta, styles.metaShrink, projectDue.tone === 'danger' && { color: colors.destructiveText }]}>{projectDue.label.replace(/^Overdue/, 'Target passed')}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}><Users size={14} color={colors.mutedText} /><Text style={styles.meta}>{plural(project.teamMembers, 'member', 'members')}</Text></View>
          {lastActivity(project.updatedAt) ? <Text numberOfLines={1} style={styles.meta}>{lastActivity(project.updatedAt)}</Text> : null}
        </View>
      </Pressable>
      {onMenu ? (
        <View style={styles.menu}>
          <ProjectIconButton size={44} accessibilityLabel={`Options for ${project.name}`} onPress={() => onMenu(project)}>
            <MoreHorizontal size={20} color={colors.icon} />
          </ProjectIconButton>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  focused: { borderColor: colors.accent, borderWidth: 2 },
  body: { padding: 14, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  roleLine: { color: colors.mutedText, fontSize: 13 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  percent: { color: colors.text, fontSize: 13, fontWeight: '800' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  meta: { color: colors.mutedText, fontSize: 12 },
  metaShrink: { flexShrink: 1 },
  menu: { position: 'absolute', top: 6, right: 4 },
});
