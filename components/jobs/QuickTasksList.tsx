import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Clock, Timer } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { JobSaveButton, JobShareButton } from './JobCardActions';
import { JOBS_ACTION_GREEN, JOBS_CARD_RADIUS, JobPosterLine, JobStatusPill, JobTagRow, formatJobPay, formatTimeAgo, getJobClosingInfo } from './JobCardParts';
import type { JobListProps } from './ProfessionalJobsList';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { formatJobLocation } from '@/lib/job/JobPresentation';

type QuickTaskCardProps = Omit<JobListProps, 'jobs' | 'appliedJobIds'> & { task: JobRecord; isApplied: boolean };

/**
 * A quick task in the TaskRabbit/Upwork order: the price leads, then the title, the duration · place · posted line
 * and who posted it. One badge at most (Applied, otherwise Urgent, otherwise closing soon) beside Share and Apply.
 */
function QuickTaskCard({ task, isApplied, onApply, onViewDetails }: QuickTaskCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = auth.currentUser?.uid === task.basic_info.userId;
  const urgency = task.category_specific.urgency;
  const isUrgent = urgency === 'high' || urgency === 'critical';
  const closing = getJobClosingInfo(task);
  const canApply = !isCreator && !isApplied && !closing?.isPast;
  const posterName = task.creator?.name || 'Task owner';
  const pay = formatJobPay(task);
  const meta = [task.category_specific.duration || 'Flexible', formatJobLocation(task), formatTimeAgo(task.basic_info.createdAt?.seconds)].join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.basic_info.title}, ${pay}, ${meta}${isUrgent ? ', urgent' : ''}${isApplied ? ', applied' : ''}`}
      accessibilityHint="Opens the task details"
      onPress={() => onViewDetails(task)}
      android_ripple={{ color: colors.control }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.priceColumn}>
          <Text numberOfLines={1} style={styles.price}>{pay}</Text>
          <Text numberOfLines={2} style={styles.taskTitle}>{task.basic_info.title}</Text>
        </View>
        <View style={styles.saveSlot}>
          <JobSaveButton jobId={task.id} jobTitle={task.basic_info.title} posterId={task.basic_info.userId} />
        </View>
      </View>

      <View style={styles.metaRow}><Timer size={14} color={colors.mutedText} /><Text numberOfLines={1} style={styles.meta}>{meta}</Text></View>
      <View style={styles.posterRow}>
        <UserAvatar profileImage={task.creator?.profileImage} firstName={posterName} size={28} />
        <View style={styles.flex}><JobPosterLine name={posterName} isVerified={task.creator?.verificationStatus === 'verified'} /></View>
      </View>
      <JobTagRow tags={task.details.skills} />

      <View style={styles.footer}>
        <View style={styles.flex}>
          {isApplied ? <JobStatusPill presentation={{ label: 'Applied', tone: 'success', icon: CheckCircle2 }} />
            : isUrgent ? <JobStatusPill presentation={{ label: urgency === 'critical' ? 'Urgent today' : 'Urgent', tone: 'danger', icon: AlertCircle }} />
              : closing?.isSoon ? <View style={styles.inline}><Clock size={14} color={colors.warningText} /><Text numberOfLines={1} style={styles.closingSoon}>{closing.label}</Text></View>
                : closing ? <Text numberOfLines={1} style={styles.closing}>{closing.label}</Text>
                  : isCreator ? <Text numberOfLines={1} style={styles.closing}>Your task</Text> : null}
        </View>
        <JobShareButton jobId={task.id} jobTitle={task.basic_info.title} />
        {canApply ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Apply for ${task.basic_info.title}`} onPress={() => onApply(task)} hitSlop={4} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.applyButton}>
            <Text numberOfLines={1} style={styles.applyText}>Apply</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Quick task cards (web components/jobs/QuickTasksList.tsx). */
export function QuickTasksList({ jobs, appliedJobIds, onApply, onViewDetails }: JobListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {jobs.filter((job) => job.basic_info.type === 'quickTask').map((task) => (
        <QuickTaskCard
          key={task.id}
          task={task}
          isApplied={appliedJobIds.has(task.id)}
          onApply={onApply}
          onViewDetails={onViewDetails}
        />
      ))}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    list: { gap: 12, paddingHorizontal: 16 },
    flex: { flex: 1, minWidth: 0 },
    card: { overflow: 'hidden', backgroundColor: colors.surface, borderRadius: JOBS_CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    priceColumn: { flex: 1, minWidth: 0, gap: 4 },
    saveSlot: { marginTop: -10, marginRight: -12 },
    price: { color: colors.successText, fontSize: 18, lineHeight: 24, fontWeight: '900' },
    taskTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    meta: { flexShrink: 1, color: colors.mutedText, fontSize: 13, lineHeight: 18, textTransform: 'none' },
    posterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footer: { marginTop: 4, paddingTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    closingSoon: { flexShrink: 1, color: colors.warningText, fontSize: 12, fontWeight: '800' },
    closing: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
    applyButton: { minWidth: 84, height: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    applyText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  });
}
