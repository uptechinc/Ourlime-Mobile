import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, DollarSign, MapPin, Star, Timer, type LucideIcon } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { JobCardActions } from './JobCardActions';
import type { JobListProps } from './ProfessionalJobsList';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { formatJobLocation, formatJobPostedDate, formatJobPrice } from '@/lib/job/JobPresentation';

type QuickTaskCardProps = Omit<JobListProps, 'jobs' | 'savedJobIds' | 'appliedJobIds'> & { task: JobRecord; isSaved: boolean; isApplied: boolean };

function TaskBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.badge}><Icon size={14} color={colors.icon} /><Text style={styles.badgeText}>{label}</Text></View>;
}

function QuickTaskCard({ task, isSaved, isApplied, onToggleSave, onApply, onViewDetails }: QuickTaskCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = auth.currentUser?.uid === task.basic_info.userId;
  const urgency = task.category_specific.urgency ?? 'medium';
  const isUrgent = urgency === 'high' || urgency === 'critical';
  const urgencyColor = isUrgent ? colors.destructiveText : urgency === 'medium' ? colors.warningText : colors.successText;
  const urgencySurface = isUrgent ? colors.destructiveSurface : urgency === 'medium' ? colors.warningSurface : colors.successSurface;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onViewDetails(task)} style={styles.card}>
      <View style={styles.taskHeader}>
        <View style={styles.headerBadges}>
          <View style={styles.quickTaskBadge}><Text style={styles.quickTaskText}>Quick Task</Text></View>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencySurface }]}><Text style={[styles.urgencyText, { color: urgencyColor }]}>{urgency} Priority</Text></View>
        </View>
        <View style={styles.creatorRow}>
          <UserAvatar profileImage={task.creator?.profileImage} firstName={task.creator?.name || 'Task owner'} size={64} />
          <View style={styles.ratingBadge}><Star size={14} color="#facc15" fill="#facc15" /><Text style={styles.ratingText}>4.8</Text></View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.taskTitle}>{task.basic_info.title}</Text>
        <Text numberOfLines={2} style={styles.description}>{task.basic_info.description}</Text>
        {task.details.skills.length ? <View style={styles.chipRow}>{task.details.skills.map((skill) => <View key={skill} style={styles.skillChip}><Text style={styles.skillText}>{skill}</Text></View>)}</View> : null}
        <View style={styles.badgeRow}>
          <TaskBadge icon={Timer} label={task.category_specific.duration || 'Flexible'} />
          <TaskBadge icon={MapPin} label={formatJobLocation(task)} />
          <TaskBadge icon={DollarSign} label={formatJobPrice(task)} />
          <TaskBadge icon={AlertCircle} label={`${task.category_specific.complexity || 'Moderate'} complexity`} />
        </View>
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.postedText}>Posted {formatJobPostedDate(task)}</Text>
            <JobCardActions jobId={task.id} jobTitle={task.basic_info.title} isSaved={isSaved} onToggleSave={onToggleSave} />
          </View>
          {!isCreator ? (
            <View style={styles.buttons}>
              <TouchableOpacity accessibilityRole="button" onPress={() => onViewDetails(task)} style={styles.detailsButton}><Text style={styles.detailsText}>Details</Text></TouchableOpacity>
              {isApplied ? (
                <View style={styles.appliedBadge}><Text style={styles.appliedText}>Applied</Text></View>
              ) : (
                <TouchableOpacity accessibilityRole="button" onPress={() => onApply(task)} style={styles.applyButton}><Text style={styles.applyText}>Apply Now</Text></TouchableOpacity>
              )}
            </View>
          ) : <Text style={styles.postedText}>Your task</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Quick task cards (web components/jobs/QuickTasksList.tsx). */
export function QuickTasksList({ jobs, savedJobIds, appliedJobIds, onToggleSave, onApply, onViewDetails }: JobListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {jobs.filter((job) => job.basic_info.type === 'quickTask').map((task) => (
        <QuickTaskCard
          key={task.id}
          task={task}
          isSaved={savedJobIds.has(task.id)}
          isApplied={appliedJobIds.has(task.id)}
          onToggleSave={onToggleSave}
          onApply={onApply}
          onViewDetails={onViewDetails}
        />
      ))}
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 14, paddingHorizontal: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  taskHeader: { minHeight: 118, backgroundColor: colors.successSurface, padding: 14, justifyContent: 'flex-end' },
  headerBadges: { position: 'absolute', top: 10, right: 10, left: 90, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  quickTaskBadge: { backgroundColor: colors.elevated, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  quickTaskText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  urgencyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  urgencyText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.elevated, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 16, gap: 10 },
  taskTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  description: { color: colors.mutedText, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  skillText: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.control, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: colors.secondaryText, fontSize: 12, textTransform: 'capitalize' },
  footer: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  postedText: { color: colors.mutedText, fontSize: 12 },
  buttons: { flexDirection: 'row', gap: 8 },
  detailsButton: { flex: 1, alignItems: 'center', borderWidth: 2, borderColor: colors.accent, borderRadius: 999, paddingVertical: 8 },
  detailsText: { color: colors.accentText, fontWeight: '800' },
  applyButton: { flex: 1, alignItems: 'center', backgroundColor: colors.successSurface, borderRadius: 999, paddingVertical: 10 },
  applyText: { color: colors.successText, fontWeight: '900' },
  appliedBadge: { flex: 1, alignItems: 'center', backgroundColor: colors.control, borderColor: colors.border, borderWidth: 1, paddingVertical: 10, borderRadius: 999 },
  appliedText: { color: colors.mutedText, fontWeight: '700', fontSize: 13 },
});
