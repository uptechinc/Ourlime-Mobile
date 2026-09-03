import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  BadgeCheck,
  Shield,
  Send,
  Sparkles,
} from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import JobApplicationModal from '@/components/jobs/applyJobs/JobApplicationModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { AuthService } from '@/lib/services/AuthService';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';

const jobsService = JobsService.getInstance();
const authService = AuthService.getInstance();

const SAFETY_GUIDANCE = [
  'Never pay an application, interview, training, or equipment fee.',
  'Never share banking passwords, one-time codes, or sensitive identity documents.',
  'Confirm compensation, responsibilities, and employer identity before starting work.',
  'Keep agreements and communications recorded within the platform.',
];

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = id as string;
  const { colors, isDark } = useAppTheme();

  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const jobs = await jobsService.fetchJobs(50);
      const matched = jobs.find((item) => item.id === jobId);
      if (matched) {
        setJob(matched);
      } else {
        setError('Job posting not found or has expired.');
      }
    } catch (err) {
      console.error('[JobDetailScreen.loadJob]', err);
      setError('Could not load job details.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const currentUserId = authService.getCurrentUser()?.uid;
  const isCreator = Boolean(job && currentUserId === job.basic_info.userId);
  const isQuickTask = job?.basic_info.type === 'quickTask';

  const companyName = job?.category_specific.name || job?.creator?.name || 'Independent Employer';
  const location =
    job?.basic_info.location.type === 'remote'
      ? 'Remote'
      : [job?.basic_info.location.city, job?.basic_info.location.country].filter(Boolean).join(', ') ||
        'Location Flexible';

  const priceFormatted = job ? `$${job.basic_info.priceRange.from} – $${job.basic_info.priceRange.to}` : '';

  const postedDate = job?.basic_info.createdAt?.seconds
    ? new Date(job.basic_info.createdAt.seconds * 1000).toLocaleDateString()
    : 'Recently';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {job?.basic_info.title || 'Job Opportunity'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={[styles.statusText, { color: colors.mutedText }]}>Loading job details...</Text>
        </View>
      ) : error || !job ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Job not found.'}</Text>
          <TouchableOpacity onPress={() => router.push('/jobs')} style={styles.backToJobsBtn}>
            <Text style={styles.backToJobsBtnText}>Browse All Jobs</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Employer Card */}
          <View style={[styles.employerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <UserAvatar profileImage={job.creator?.profileImage} firstName={companyName} size={58} />
            <View style={styles.employerInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>
                  {companyName}
                </Text>
                {job.creator?.verificationStatus === 'verified' ? (
                  <BadgeCheck size={18} color="#10b981" />
                ) : null}
              </View>
              {job.category_specific.industry ? (
                <Text style={[styles.industryText, { color: colors.mutedText }]}>
                  {job.category_specific.industry}
                </Text>
              ) : null}
              <Text style={[styles.postedText, { color: colors.mutedText }]}>Posted {postedDate}</Text>
            </View>
          </View>

          {/* Job Overview */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.jobTitle, { color: colors.text }]}>{job.basic_info.title}</Text>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: isDark ? '#064e3b33' : '#ecfdf5', borderColor: '#10b981' }]}>
                <Text style={styles.badgeText}>
                  {isQuickTask ? 'Quick Task' : job.basic_info.jobType || 'Professional'}
                </Text>
              </View>
              {job.basic_info.category ? (
                <View style={[styles.badge, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.border }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{job.basic_info.category}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <MapPin size={18} color="#10b981" />
                <Text style={[styles.metaValue, { color: colors.text }]}>{location}</Text>
              </View>
              <View style={styles.metaItem}>
                <DollarSign size={18} color="#10b981" />
                <Text style={[styles.metaValue, { color: colors.text }]}>{priceFormatted}</Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={18} color="#10b981" />
                <Text style={[styles.metaValue, { color: colors.text }]}>
                  {job.category_specific.urgency ? `Urgency: ${job.category_specific.urgency}` : 'Standard schedule'}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>About this role</Text>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              {job.basic_info.description || 'No detailed description provided.'}
            </Text>
          </View>

          {/* Skills Required */}
          {job.details.skills && job.details.skills.length > 0 ? (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Required Skills & Expertise</Text>
              <View style={styles.chipCloud}>
                {job.details.skills.map((skill) => (
                  <View
                    key={skill}
                    style={[
                      styles.skillChip,
                      { backgroundColor: isDark ? '#064e3b33' : '#ecfdf5', borderColor: '#10b981' },
                    ]}
                  >
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Deliverables for Quick Tasks */}
          {job.category_specific.deliverables && job.category_specific.deliverables.length > 0 ? (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Task Deliverables</Text>
              <View style={styles.deliverablesList}>
                {job.category_specific.deliverables.map((item, idx) => (
                  <View key={`del-${idx}`} style={styles.deliverableItem}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <Text style={[styles.deliverableText, { color: colors.text }]}>
                      {item.description} ({item.quantity} {item.unit})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Company Benefits */}
          {job.category_specific.benefits && job.category_specific.benefits.length > 0 ? (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Perks & Benefits</Text>
              <View style={styles.chipCloud}>
                {job.category_specific.benefits.map((benefit) => (
                  <View
                    key={benefit}
                    style={[
                      styles.benefitChip,
                      { backgroundColor: isDark ? '#1e3a8a33' : '#eff6ff', borderColor: '#3b82f6' },
                    ]}
                  >
                    <Sparkles size={13} color="#3b82f6" />
                    <Text style={styles.benefitChipText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Safety Notice */}
          <View
            style={[
              styles.safetyCard,
              { backgroundColor: isDark ? '#78350f22' : '#fffbeb', borderColor: '#f59e0b' },
            ]}
          >
            <View style={styles.safetyHeader}>
              <Shield size={18} color="#f59e0b" />
              <Text style={[styles.safetyTitle, { color: '#f59e0b' }]}>Ourlime Safety Tips</Text>
            </View>
            {SAFETY_GUIDANCE.map((tip, tIdx) => (
              <View key={`tip-${tIdx}`} style={styles.tipRow}>
                <Text style={{ color: '#f59e0b', fontWeight: '800' }}>•</Text>
                <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Bottom CTA Bar */}
      {job && !isCreator ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.priceColumn}>
            <Text style={[styles.priceLabel, { color: colors.mutedText }]}>Compensation</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>{priceFormatted}</Text>
          </View>
          <TouchableOpacity onPress={() => setApplyModalOpen(true)} style={styles.applyBtn}>
            <Send size={16} color="#ffffff" />
            <Text style={styles.applyBtnText}>Apply Now</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Apply Modal */}
      {job && applyModalOpen ? (
        <JobApplicationModal
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          job={job}
          jobType={isQuickTask ? 'quickTask' : 'professional'}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  statusText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  backToJobsBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backToJobsBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 14,
  },
  employerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  employerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '800',
  },
  industryText: {
    fontSize: 13,
    marginTop: 2,
  },
  postedText: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  metaGrid: {
    marginTop: 4,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  skillChipText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  benefitChipText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  deliverablesList: {
    gap: 8,
  },
  deliverableItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  deliverableText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  safetyCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  safetyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  priceColumn: {},
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
