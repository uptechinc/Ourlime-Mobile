import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { JobSaveButton, JobShareButton } from './JobCardActions';
import { JOBS_ACTION_GREEN, JOBS_CARD_RADIUS, JobLogo, JobPosterLine, JobStatusPill, JobTagRow, formatJobPay, formatTimeAgo, getJobClosingInfo, getJobScheduleLabel } from './JobCardParts';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { formatJobLocation, getJobCompanyName } from '@/lib/job/JobPresentation';

export type JobListProps = {
  jobs: JobRecord[];
  savedJobIds: Set<string>;
  appliedJobIds: Set<string>;
  onToggleSave: (jobId: string) => void;
  onApply: (job: JobRecord) => void;
  onViewDetails: (job: JobRecord) => void;
};

type ProfessionalJobCardProps = Omit<JobListProps, 'jobs' | 'savedJobIds' | 'appliedJobIds'> & { job: JobRecord; isSaved: boolean; isApplied: boolean };

/**
 * A job card in the LinkedIn/Indeed order: the whole card opens the details; logo beside a two-line title and the
 * poster with a verified tick; Save top-right; pay as the strongest line; one muted line of location · type ·
 * posted; at most two skills and "+n"; then a footer with the one state that matters (Applied or closing soon) and
 * Share + Apply.
 */
function ProfessionalJobCard({ job, isSaved, isApplied, onToggleSave, onApply, onViewDetails }: ProfessionalJobCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = auth.currentUser?.uid === job.basic_info.userId;
  const companyName = getJobCompanyName(job);
  const logo = job.category_specific.logo || job.creator?.profileImage;
  const isVerified = job.creator?.verificationStatus === 'verified';
  const pay = formatJobPay(job);
  const location = formatJobLocation(job);
  const closing = getJobClosingInfo(job);
  const canApply = !isCreator && !isApplied && !closing?.isPast;
  const meta = [location, getJobScheduleLabel(job), formatTimeAgo(job.basic_info.createdAt?.seconds)].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.basic_info.title}, ${companyName}, ${pay}, ${meta}${isApplied ? ', applied' : ''}`}
      accessibilityHint="Opens the job details"
      onPress={() => onViewDetails(job)}
      android_ripple={{ color: colors.control }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <JobLogo uri={logo} name={companyName} size={44} />
        <View style={styles.titleCopy}>
          <Text numberOfLines={2} style={styles.jobTitle}>{job.basic_info.title}</Text>
          <JobPosterLine name={companyName} isVerified={isVerified} />
        </View>
        <View style={styles.saveSlot}>
          <JobSaveButton jobId={job.id} jobTitle={job.basic_info.title} isSaved={isSaved} onToggleSave={onToggleSave} />
        </View>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.pay}>{pay}</Text>
        <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
        <JobTagRow tags={job.details.skills} />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerState}>
          {isApplied ? <JobStatusPill presentation={{ label: 'Applied', tone: 'success', icon: CheckCircle2 }} />
            : closing?.isSoon ? <View style={styles.inline}><Clock size={14} color={colors.warningText} /><Text numberOfLines={1} style={styles.closingSoon}>{closing.label}</Text></View>
              : closing ? <Text numberOfLines={1} style={styles.closing}>{closing.label}</Text>
                : isCreator ? <Text numberOfLines={1} style={styles.closing}>Your listing</Text> : null}
        </View>
        <JobShareButton jobId={job.id} jobTitle={job.basic_info.title} />
        {canApply ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Apply for ${job.basic_info.title}`} onPress={() => onApply(job)} hitSlop={4} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.applyButton}>
            <Text numberOfLines={1} style={styles.applyText}>Apply</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Professional job cards (web components/jobs/ProfessionalJobsList.tsx). */
export function ProfessionalJobsList({ jobs, savedJobIds, appliedJobIds, onToggleSave, onApply, onViewDetails }: JobListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {jobs.filter((job) => job.basic_info.type === 'professional').map((job) => (
        <ProfessionalJobCard
          key={job.id}
          job={job}
          isSaved={savedJobIds.has(job.id)}
          isApplied={appliedJobIds.has(job.id)}
          onToggleSave={onToggleSave}
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
    card: { overflow: 'hidden', backgroundColor: colors.surface, borderRadius: JOBS_CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    titleCopy: { flex: 1, minWidth: 0, gap: 4 },
    // The save button's 44dp box overhangs into the padding so the bookmark lines up with the card's edge.
    saveSlot: { marginTop: -10, marginRight: -12 },
    jobTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
    body: { marginTop: 12, gap: 4 },
    pay: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '900' },
    meta: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginBottom: 4 },
    footer: { marginTop: 12, paddingTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    footerState: { flex: 1, minWidth: 0 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    closingSoon: { flexShrink: 1, color: colors.warningText, fontSize: 12, fontWeight: '800' },
    closing: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
    applyButton: { minWidth: 84, height: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    applyText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  });
}
