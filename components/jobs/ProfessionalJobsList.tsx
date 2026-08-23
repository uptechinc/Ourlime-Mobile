import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bookmark, BriefcaseBusiness, Building2, Clock, DollarSign, MapPin, Users } from 'lucide-react-native';
import JobApplicationModal from './applyJobs/JobApplicationModal';
import UserAvatar from '@/components/ui/UserAvatar';
import type { JobRecord } from '@/lib/job/JobsService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { AuthService } from '@/lib/services/AuthService';

type ProfessionalJobsListProps = {
  jobs: JobRecord[];
};

type ProfessionalJobCardProps = {
  job: JobRecord;
  onApply: (job: JobRecord) => void;
};

const authService = AuthService.getInstance();

function ProfessionalJobCard({ job, onApply }: ProfessionalJobCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCreator = authService.getCurrentUser()?.uid === job.basic_info.userId;
  const companyName = job.category_specific.name || job.creator?.name || 'Independent employer';
  const industry = job.category_specific.industry || 'Professional services';
  const employeeCount = job.category_specific.size ? `${job.category_specific.size} employees` : 'Company profile';
  const location = job.basic_info.location.type === 'remote'
    ? 'Remote'
    : [job.basic_info.location.city, job.basic_info.location.country].filter(Boolean).join(', ') || 'Location flexible';

  return (
    <View style={styles.card}>
      <View style={styles.companyPanel}>
        <UserAvatar profileImage={job.creator?.profileImage} firstName={companyName} size={76} />
        <Text numberOfLines={1} style={styles.companyName}>{companyName}</Text>
        <Text numberOfLines={1} style={styles.industry}>{industry}</Text>
        <View style={styles.companyMeta}>
          <Building2 size={14} color={colors.icon} />
          <Text style={styles.metaText}>{employeeCount}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.jobTitle}>{job.basic_info.title}</Text>
            <View style={styles.metadataRow}>
              <View style={styles.inlineMeta}><MapPin size={16} color={colors.icon} /><Text numberOfLines={1} style={styles.metaText}>{location}</Text></View>
              <View style={styles.inlineMeta}><DollarSign size={16} color={colors.icon} /><Text style={styles.metaText}>${job.basic_info.priceRange.from}–{job.basic_info.priceRange.to}</Text></View>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.bookmarkButton} accessibilityLabel="Save job"><Bookmark size={20} color={colors.icon} /></TouchableOpacity>
            {!isCreator ? <TouchableOpacity onPress={() => onApply(job)} style={styles.applyButton}><Text style={styles.applyText}>Apply</Text></TouchableOpacity> : null}
          </View>
        </View>

        {job.details.skills.length ? <View style={styles.chipRow}>{job.details.skills.map((skill) => <View key={skill} style={styles.skillChip}><Text style={styles.skillText}>{skill}</Text></View>)}</View> : null}

        {job.category_specific.benefits?.length ? (
          <View style={styles.benefitsSection}>
            <Text style={styles.sectionLabel}>Company Benefits</Text>
            <View style={styles.chipRow}>{job.category_specific.benefits.map((benefit) => <View key={benefit} style={styles.benefitChip}><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.inlineMeta}><Clock size={16} color={colors.icon} /><Text style={styles.metaText}>Posted {job.basic_info.createdAt?.seconds ? new Date(job.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}</Text></View>
          <View style={styles.inlineMeta}><Users size={16} color={colors.icon} /><Text style={styles.metaText}>0 applicants</Text></View>
        </View>
      </View>
    </View>
  );
}

export function ProfessionalJobsList({ jobs }: ProfessionalJobsListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const professionalJobs = jobs.filter((job) => job.basic_info.type === 'professional');
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);

  const handleApply = (job: JobRecord) => {
    setSelectedJob(job);
  };

  const handleCloseApplication = () => {
    setSelectedJob(null);
  };

  if (!professionalJobs.length) {
    return <View style={styles.emptyState}><BriefcaseBusiness size={30} color={colors.mutedText} /><Text style={styles.emptyText}>No professional jobs available.</Text></View>;
  }

  return (
    <>
      <View style={styles.list}>{professionalJobs.map((job) => <ProfessionalJobCard key={job.id} job={job} onApply={handleApply} />)}</View>
      {selectedJob ? <JobApplicationModal isOpen onClose={handleCloseApplication} job={selectedJob} jobType="professional" /> : null}
    </>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { gap: 16, paddingHorizontal: 18 },
  emptyState: { alignItems: 'center', gap: 9, paddingVertical: 42 },
  emptyText: { color: colors.mutedText },
  card: { backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  companyPanel: { backgroundColor: colors.control, alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  companyName: { marginTop: 10, color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  industry: { marginTop: 2, color: colors.mutedText, fontSize: 12 },
  companyMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  cardBody: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  titleCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  jobTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  metadataRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.mutedText, fontSize: 12 },
  cardActions: { alignItems: 'center', gap: 6 },
  bookmarkButton: { padding: 6 },
  applyButton: { minWidth: 82, alignItems: 'center', backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999 },
  applyText: { color: colors.onAccent, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  skillText: { color: colors.secondaryText, fontSize: 12 },
  benefitsSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 },
  sectionLabel: { color: colors.secondaryText, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  benefitChip: { backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  benefitText: { color: colors.successText, fontSize: 12 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});
