import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DollarSign, Eye, MapPin, Users } from 'lucide-react-native';
import { JobCardActions } from './JobCardActions';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { formatJobLocation, formatJobPostedDate, formatJobPrice, getJobCompanyName } from '@/lib/job/JobPresentation';

export type JobListProps = {
  jobs: JobRecord[];
  savedJobIds: Set<string>;
  appliedJobIds: Set<string>;
  onToggleSave: (jobId: string) => void;
  onApply: (job: JobRecord) => void;
  onViewDetails: (job: JobRecord) => void;
};

type ProfessionalJobCardProps = Omit<JobListProps, 'jobs' | 'savedJobIds' | 'appliedJobIds'> & { job: JobRecord; isSaved: boolean; isApplied: boolean };

function ProfessionalJobCard({ job, isSaved, isApplied, onToggleSave, onApply, onViewDetails }: ProfessionalJobCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = auth.currentUser?.uid === job.basic_info.userId;
  const companyName = getJobCompanyName(job);
  const logo = job.creator?.profileImage || job.category_specific.logo;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onViewDetails(job)} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.logoBox}>
          {logo ? <Image source={{ uri: logo }} style={styles.logoImage} /> : <Text style={styles.logoLetter}>{companyName.charAt(0).toUpperCase()}</Text>}
        </View>
        <View style={styles.titleCopy}>
          <Text numberOfLines={2} style={styles.jobTitle}>{job.basic_info.title}</Text>
          <Text numberOfLines={1} style={styles.company}>{companyName}</Text>
        </View>
        <View style={styles.typeBadge}><Text style={styles.typeText}>professional</Text></View>
      </View>

      <View style={styles.pillRow}>
        <View style={styles.greenPill}><MapPin size={12} color={colors.successText} /><Text style={styles.greenPillText}>{formatJobLocation(job)}</Text></View>
        <View style={styles.greenPill}><DollarSign size={12} color={colors.successText} /><Text style={styles.greenPillText}>{formatJobPrice(job)}</Text></View>
        <View style={styles.bluePill}><Users size={12} color="#3b82f6" /><Text style={styles.bluePillText}>0 applicants</Text></View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.inlineMeta}><Calendar size={14} color={colors.mutedText} /><Text style={styles.metaText}>Posted {formatJobPostedDate(job)}</Text></View>
        <View style={styles.viewsPill}><Eye size={12} color="#3b82f6" /><Text style={styles.bluePillText}>0</Text></View>
      </View>

      <View style={styles.actionsRow}>
        <JobCardActions jobId={job.id} jobTitle={job.basic_info.title} isSaved={isSaved} onToggleSave={onToggleSave} />
        {!isCreator ? (
          <View style={styles.buttons}>
            <TouchableOpacity accessibilityRole="button" onPress={() => onViewDetails(job)} style={styles.detailsButton}><Text style={styles.detailsText}>View Details</Text></TouchableOpacity>
            {isApplied ? (
              <View style={styles.appliedBadge}><Text style={styles.appliedText}>Applied</Text></View>
            ) : (
              <TouchableOpacity accessibilityRole="button" onPress={() => onApply(job)} style={styles.applyButton}><Text style={styles.applyText}>Apply Now</Text></TouchableOpacity>
            )}
          </View>
        ) : <Text style={styles.ownerText}>Your listing</Text>}
      </View>
    </TouchableOpacity>
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

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 14, paddingHorizontal: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logoBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: 56, height: 56 },
  logoLetter: { color: colors.onAccent, fontSize: 22, fontWeight: '900' },
  titleCopy: { flex: 1, minWidth: 0, gap: 3 },
  jobTitle: { color: colors.text, fontSize: 17, fontWeight: '900', lineHeight: 22 },
  company: { color: colors.mutedText, fontSize: 13 },
  typeBadge: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { color: colors.successText, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  greenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  greenPillText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  bluePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f61a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bluePillText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  viewsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f61a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  buttons: { flexDirection: 'row', gap: 8 },
  detailsButton: { borderWidth: 2, borderColor: colors.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  detailsText: { color: colors.accentText, fontWeight: '800', fontSize: 13 },
  applyButton: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  applyText: { color: colors.onAccent, fontWeight: '900', fontSize: 13 },
  appliedBadge: { backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  appliedText: { color: colors.mutedText, fontWeight: '800', fontSize: 13 },
  ownerText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
});
