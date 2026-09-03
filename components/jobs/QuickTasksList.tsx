import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, ClipboardCheck, DollarSign, MapPin, Star, Timer, type LucideIcon } from 'lucide-react-native';
import JobApplicationModal from './applyJobs/JobApplicationModal';
import JobDetailsModal from './JobDetailsModal';
import UserAvatar from '@/components/ui/UserAvatar';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { AuthService } from '@/lib/services/AuthService';

type QuickTasksListProps = {
  jobs: JobRecord[];
};

type QuickTaskCardProps = {
  task: JobRecord;
  onApply: (task: JobRecord) => void;
  onCardPress: (task: JobRecord) => void;
};

type TaskBadgeProps = {
  icon: LucideIcon;
  label: string;
};

const authService = AuthService.getInstance();

function TaskBadge({ icon: Icon, label }: TaskBadgeProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.badge}><Icon size={14} color={colors.icon} /><Text style={styles.badgeText}>{label}</Text></View>;
}

function QuickTaskCard({ task, onApply, onCardPress }: QuickTaskCardProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = authService.getCurrentUser()?.uid === task.basic_info.userId;
  const urgency = task.category_specific.urgency ?? 'medium';
  const urgencyColor = urgency === 'high' ? colors.destructiveText : urgency === 'medium' ? colors.warningText : colors.successText;
  const urgencySurface = urgency === 'high' ? colors.destructiveSurface : urgency === 'medium' ? colors.warningSurface : colors.successSurface;
  const location = task.basic_info.location.type === 'remote'
    ? 'Remote'
    : [task.basic_info.location.city, task.basic_info.location.country].filter(Boolean).join(', ') || 'Location flexible';

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onCardPress(task)} style={styles.card}>
      <View style={styles.taskHeader}>
        <View style={styles.headerBadges}>
          <View style={styles.quickTaskBadge}><Text style={styles.quickTaskText}>Quick Task</Text></View>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencySurface }]}><Text style={[styles.urgencyText, { color: urgencyColor }]}>{urgency} priority</Text></View>
        </View>
        <View style={styles.creatorRow}>
          <UserAvatar profileImage={task.creator?.profileImage} firstName={task.creator?.name || 'Task owner'} size={70} />
          <View style={styles.ratingBadge}><Star size={14} color="#facc15" fill="#facc15" /><Text style={styles.ratingText}>4.8</Text></View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.taskTitle}>{task.basic_info.title}</Text>
        <Text numberOfLines={3} style={styles.description}>{task.basic_info.description}</Text>
        {task.details.skills.length ? <View style={styles.chipRow}>{task.details.skills.map((skill) => <View key={skill} style={styles.skillChip}><Text style={styles.skillText}>{skill}</Text></View>)}</View> : null}
        <View style={styles.badgeRow}>
          <TaskBadge icon={Timer} label={task.category_specific.duration || 'Flexible'} />
          <TaskBadge icon={MapPin} label={location} />
          <TaskBadge icon={DollarSign} label={`${task.basic_info.priceRange.from}–${task.basic_info.priceRange.to}`} />
          <TaskBadge icon={AlertCircle} label={`${task.category_specific.complexity || 'Moderate'} complexity`} />
        </View>
        <View style={styles.footer}>
          <Text style={styles.postedText}>Posted {task.basic_info.createdAt?.seconds ? new Date(task.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}</Text>
          {!isCreator ? (
            <TouchableOpacity
              onPress={(e) => {
                onApply(task);
              }}
              style={styles.applyButton}
            >
              <Text style={styles.applyText}>Apply Now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {isDark ? <View pointerEvents="none" style={styles.darkEdge} /> : null}
    </TouchableOpacity>
  );
}

export function QuickTasksList({ jobs }: QuickTasksListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const quickTasks = jobs.filter((job) => job.basic_info.type === 'quickTask');
  const [selectedTask, setSelectedTask] = useState<JobRecord | null>(null);
  const [detailTask, setDetailTask] = useState<JobRecord | null>(null);

  const handleApply = (task: JobRecord) => {
    setSelectedTask(task);
  };

  const handleCloseApplication = () => {
    setSelectedTask(null);
  };

  if (!quickTasks.length) {
    return <View style={styles.emptyState}><ClipboardCheck size={30} color={colors.mutedText} /><Text style={styles.emptyText}>No quick tasks available.</Text></View>;
  }

  return (
    <>
      <View style={styles.list}>
        {quickTasks.map((task) => (
          <QuickTaskCard
            key={task.id}
            task={task}
            onApply={handleApply}
            onCardPress={(selected) => setDetailTask(selected)}
          />
        ))}
      </View>
      {selectedTask ? <JobApplicationModal isOpen onClose={handleCloseApplication} job={selectedTask} jobType="quickTask" /> : null}
      {detailTask ? <JobDetailsModal isOpen onClose={() => setDetailTask(null)} job={detailTask} jobType="quickTask" /> : null}
    </>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 16, paddingHorizontal: 18 },
  emptyState: { alignItems: 'center', gap: 9, paddingVertical: 42 },
  emptyText: { color: colors.mutedText },
  card: { position: 'relative', backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  taskHeader: { minHeight: 126, backgroundColor: colors.successSurface, padding: 14, justifyContent: 'flex-end' },
  headerBadges: { position: 'absolute', top: 10, right: 10, left: 10, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  quickTaskBadge: { backgroundColor: colors.elevated, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  quickTaskText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  urgencyBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  urgencyText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  creatorRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.elevated, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 16 },
  taskTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  description: { color: colors.mutedText, lineHeight: 20, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  skillChip: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  skillText: { color: colors.secondaryText, fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.control, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: colors.secondaryText, fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13 },
  postedText: { color: colors.mutedText, fontSize: 12 },
  applyButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
  applyText: { color: colors.onAccent, fontWeight: '800' },
  darkEdge: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
});
