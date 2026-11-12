import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, AlertTriangle, BadgeCheck, Building2, CheckCircle2, CircleCheck, Clock, Code, DollarSign, FileText, Flag, GraduationCap, ListChecks, MapPin, Shield, Sparkles, Undo2 } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { JobRecord } from '@/lib/job/JobsService';
import { formatJobLocation, formatJobPrice, getJobCompanyName } from '@/lib/job/JobPresentation';
import { CONTACT_OPTIONS, EDUCATION_OPTIONS, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_SAFETY_GUIDANCE, PAYMENT_TIMING_OPTIONS, labelFor } from '@/lib/job/JobFormOptions';

type JobDetailsBodyProps = {
  job: JobRecord;
  onReport?: () => void;
};

const POSTING_SAFETY = [
  "This listing is subject to Ourlime's content and community guidelines.",
  'Identity verification does not guarantee employment, payment, or safety.',
  'Report suspicious, misleading, discriminatory, or unsafe listings to Ourlime.',
];

/** Every section of the website's JobDetailsModal, shared by the details sheet and the /jobs/[id] screen. */
export default function JobDetailsBody({ job, onReport }: JobDetailsBodyProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isQuickTask = job.basic_info.type === 'quickTask';
  const isVerified = job.creator?.verificationStatus === 'verified';
  const companyName = getJobCompanyName(job);
  const status = job.basic_info.status ?? 'published';
  const deadline = job.basic_info.closingDate ? new Date(job.basic_info.closingDate.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const postedDate = job.basic_info.createdAt ? new Date(job.basic_info.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';
  const schedule = isQuickTask ? (job.category_specific.duration || 'Flexible') : (labelFor(EMPLOYMENT_TYPES, job.basic_info.employmentType) || job.basic_info.jobType || job.category_specific.type || 'Flexible');
  const specificDeliverables = job.category_specific.deliverables ?? [];
  const listDeliverables = job.details.deliverables ?? [];
  const website = job.category_specific.website;

  const facts: { label: string; value: string }[] = [
    ...(job.basic_info.category ? [{ label: 'Category', value: job.basic_info.category }] : []),
    ...(job.basic_info.experienceLevel ? [{ label: 'Experience', value: labelFor(EXPERIENCE_LEVELS, job.basic_info.experienceLevel) }] : []),
    ...(job.basic_info.educationRequirement ? [{ label: 'Education', value: labelFor(EDUCATION_OPTIONS, job.basic_info.educationRequirement) }] : []),
    ...(job.basic_info.contactPreference ? [{ label: 'Contact', value: labelFor(CONTACT_OPTIONS, job.basic_info.contactPreference) }] : []),
    ...(isQuickTask && job.category_specific.urgency ? [{ label: 'Urgency', value: job.category_specific.urgency }] : []),
    ...(isQuickTask && job.category_specific.complexity ? [{ label: 'Complexity', value: job.category_specific.complexity }] : []),
    ...(isQuickTask && job.category_specific.paymentTiming ? [{ label: 'Payment', value: labelFor(PAYMENT_TIMING_OPTIONS, job.category_specific.paymentTiming) }] : []),
    ...(job.basic_info.location.notes ? [{ label: 'Location notes', value: job.basic_info.location.notes }] : []),
  ];

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.posterRow}>
          <UserAvatar profileImage={job.creator?.profileImage} firstName={job.creator?.name || companyName} size={52} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.posterName}>{job.creator?.name || 'Anonymous'}</Text>
              {isVerified ? (
                <View style={styles.verifiedBadge}><BadgeCheck size={12} color={colors.successText} /><Text style={styles.verifiedText}>Verified</Text></View>
              ) : job.creator?.verificationStatus ? (
                <View style={styles.unverifiedBadge}><Text style={styles.unverifiedText}>Not verified</Text></View>
              ) : null}
            </View>
            <Text style={styles.muted}>Posted {postedDate}</Text>
          </View>
        </View>
        <View style={styles.metaWrap}>
          <Meta styles={styles} icon={<DollarSign size={14} color={colors.icon} />} text={formatJobPrice(job)} />
          <Meta styles={styles} icon={<MapPin size={14} color={colors.icon} />} text={formatJobLocation(job)} />
          <Meta styles={styles} icon={<Clock size={14} color={colors.icon} />} text={schedule} />
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{isQuickTask ? 'Quick Task' : 'Professional'}</Text></View>
          <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</Text></View>
          {deadline ? <View style={styles.deadlineBadge}><Clock size={12} color={colors.secondaryText} /><Text style={styles.deadlineText}>Deadline: {deadline}</Text></View> : null}
        </View>
      </View>

      <Section styles={styles} title="Description">
        <Text style={styles.body}>{job.basic_info.description || 'No detailed description provided.'}</Text>
      </Section>

      {facts.length ? (
        <Section styles={styles} title="Details">
          {facts.map((fact) => <Text key={fact.label} style={styles.body}><Text style={styles.factLabel}>{fact.label}: </Text>{fact.value}</Text>)}
        </Section>
      ) : null}

      {!isQuickTask && (companyName || job.category_specific.industry) ? (
        <Section styles={styles} title="Company" icon={<Building2 size={16} color={colors.accent} />}>
          <View style={styles.companyRow}>
            {job.category_specific.logo ? <Image source={{ uri: job.category_specific.logo }} style={styles.logo} /> : null}
            <View style={styles.flex}>
              <Text style={styles.companyName}>{companyName}</Text>
              {[job.category_specific.industry, job.category_specific.size ? `${job.category_specific.size} employees` : ''].filter(Boolean).length ? (
                <Text style={styles.muted}>{[job.category_specific.industry, job.category_specific.size ? `${job.category_specific.size} employees` : ''].filter(Boolean).join(' · ')}</Text>
              ) : null}
              {website ? <TouchableOpacity onPress={() => void Linking.openURL(/^https?:\/\//i.test(website) ? website : `https://${website}`)}><Text style={styles.link}>{website}</Text></TouchableOpacity> : null}
            </View>
          </View>
          {job.category_specific.companyDescription ? <Text style={styles.body}>{job.category_specific.companyDescription}</Text> : null}
          {job.category_specific.benefits?.length ? (
            <View style={styles.chipRow}>{job.category_specific.benefits.map((benefit) => <View key={benefit} style={styles.benefitChip}><Sparkles size={12} color={colors.accentText} /><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
          ) : null}
        </Section>
      ) : null}

      {job.details.skills.length ? (
        <Section styles={styles} title="Skills needed" icon={<Code size={16} color={colors.accent} />}>
          <View style={styles.chipRow}>{job.details.skills.map((skill) => <View key={skill} style={styles.skillChip}><Text style={styles.skillText}>{skill}</Text></View>)}</View>
        </Section>
      ) : null}

      <BulletSection styles={styles} title="Requirements" icon={<CheckCircle2 size={16} color={colors.accent} />} items={job.details.requirements ?? []} />
      <BulletSection styles={styles} title="Qualifications" icon={<GraduationCap size={16} color={colors.accent} />} items={job.details.qualifications ?? []} />
      <BulletSection
        styles={styles}
        title={isQuickTask ? 'Deliverables' : 'Responsibilities / Deliverables'}
        icon={<FileText size={16} color={colors.accent} />}
        items={[...listDeliverables, ...specificDeliverables.map((deliverable) => `${deliverable.description}${deliverable.quantity ? ` (${deliverable.quantity} ${deliverable.unit})` : ''}`)]}
      />
      <BulletSection styles={styles} title="Acceptance criteria" icon={<ListChecks size={16} color={colors.accent} />} items={job.category_specific.acceptanceCriteria ?? []} />
      <BulletSection styles={styles} title="Cancellation terms" icon={<Undo2 size={16} color={colors.accent} />} items={(job.category_specific.cancellationTerms ?? []).map((term) => `${term.trigger}: ${term.refundPercentage}% refund${term.description ? ` — ${term.description}` : ''}`)} />
      <BulletSection styles={styles} title="Safety requirements" icon={<Shield size={16} color={colors.warningText} />} items={job.category_specific.safetyRequirements ?? []} />

      <View style={styles.warningCard}>
        <View style={styles.sectionHeader}><AlertTriangle size={16} color={colors.warningText} /><Text style={styles.warningTitle}>Safety guidance</Text></View>
        <Text style={styles.warningBody}>Protect yourself when interacting with job posters. Follow these guidelines:</Text>
        {JOB_SAFETY_GUIDANCE.map((item) => <View key={item} style={styles.tipRow}><AlertCircle size={14} color={colors.warningText} /><Text style={styles.warningBody}>{item}</Text></View>)}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><Shield size={16} color={colors.accent} /><Text style={styles.sectionTitle}>Posting & application safety</Text></View>
        {POSTING_SAFETY.map((item) => <View key={item} style={styles.tipRow}><CircleCheck size={14} color={colors.accent} /><Text style={styles.body}>{item}</Text></View>)}
      </View>

      {onReport ? (
        <TouchableOpacity accessibilityRole="button" onPress={onReport} style={styles.reportButton}>
          <Flag size={16} color={colors.destructiveText} /><Text style={styles.reportText}>Report listing</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type BodyStyles = ReturnType<typeof createStyles>;

function Meta({ styles, icon, text }: { styles: BodyStyles; icon: ReactNode; text: string }) {
  return <View style={styles.meta}>{icon}<Text style={styles.metaText}>{text}</Text></View>;
}

function Section({ styles, title, icon, children }: { styles: BodyStyles; title: string; icon?: ReactNode; children: ReactNode }) {
  return <View style={styles.card}><View style={styles.sectionHeader}>{icon}<Text style={styles.sectionTitle}>{title}</Text></View>{children}</View>;
}

function BulletSection({ styles, title, icon, items }: { styles: BodyStyles; title: string; icon: ReactNode; items: string[] }) {
  if (!items.length) return null;
  return <Section styles={styles} title={title} icon={icon}>{items.map((item, index) => <Text key={`${title}-${index}`} style={styles.body}>• {item}</Text>)}</Section>;
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  stack: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  card: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  posterName: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  verifiedText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
  unverifiedBadge: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  unverifiedText: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 12 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.secondaryText, fontSize: 13 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  typeBadge: { backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  statusBadge: { backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  deadlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  deadlineText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  factLabel: { color: colors.text, fontWeight: '800', textTransform: 'none' },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  companyName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  link: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: { backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  skillText: { color: colors.successText, fontSize: 13, fontWeight: '700' },
  benefitChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  benefitText: { color: colors.secondaryText, fontSize: 12 },
  warningCard: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.warningText, backgroundColor: colors.warningSurface },
  warningTitle: { color: colors.warningText, fontSize: 15, fontWeight: '900' },
  warningBody: { color: colors.warningText, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  reportText: { color: colors.destructiveText, fontWeight: '800' },
});
