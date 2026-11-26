import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle, AlertTriangle, Banknote, ChartColumn, Briefcase, CalendarClock, CheckCircle2, CircleCheck, Code, ExternalLink, FileText, Flag,
  GraduationCap, Layers, ListChecks, MapPin, Shield, Sparkles, Timer, Undo2, type LucideIcon,
} from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { JobLogo, JobPosterLine, JobStatusPill, JOBS_CARD_RADIUS, formatJobPay, formatShortDate, formatTimeAgo, getJobClosingInfo, getJobScheduleLabel, getListingStatusPresentation } from './JobCardParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { JobRecord } from '@/lib/job/JobsService';
import { formatJobLocation, getJobCompanyName } from '@/lib/job/JobPresentation';
import { CONTACT_OPTIONS, EDUCATION_OPTIONS, EXPERIENCE_LEVELS, JOB_SAFETY_GUIDANCE, PAYMENT_TIMING_OPTIONS, labelFor } from '@/lib/job/JobFormOptions';

type JobDetailsBodyProps = {
  job: JobRecord;
  onReport?: () => void;
};

type KeyFact = { label: string; value: string; icon: LucideIcon };

const POSTING_SAFETY = [
  "This listing is subject to Ourlime's content and community guidelines.",
  'Identity verification does not guarantee employment, payment, or safety.',
  'Report suspicious, misleading, discriminatory, or unsafe listings to Ourlime.',
];
/** About six lines of body text on a 360dp phone; longer descriptions start collapsed behind "Read more". */
const DESCRIPTION_COLLAPSED_LINES = 6;
const DESCRIPTION_COLLAPSE_CHARS = 320;

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Every section of the website's JobDetailsModal, shared by the details sheet and the /jobs/[id] screen, in the
 * job-page order: header (logo, title, poster, dates), a key-facts grid, the description with Read more, skills and
 * requirements, about the poster, then safety and Report.
 */
export default function JobDetailsBody({ job, onReport }: JobDetailsBodyProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const isQuickTask = job.basic_info.type === 'quickTask';
  const isVerified = job.creator?.verificationStatus === 'verified';
  const companyName = getJobCompanyName(job);
  const posterName = job.creator?.name || 'Anonymous';
  const status = job.basic_info.status ?? 'published';
  const isOpenStatus = status === 'published' || status === 'active';
  const closing = getJobClosingInfo(job);
  const description = job.basic_info.description || 'No detailed description provided.';
  const isLongDescription = description.length > DESCRIPTION_COLLAPSE_CHARS || description.split('\n').length > DESCRIPTION_COLLAPSED_LINES;
  const specificDeliverables = job.category_specific.deliverables ?? [];
  const listDeliverables = job.details.deliverables ?? [];
  const website = job.category_specific.website;
  const logo = isQuickTask ? job.creator?.profileImage : job.category_specific.logo || job.creator?.profileImage;
  const companyMeta = [job.category_specific.industry, job.category_specific.size ? `${job.category_specific.size} employees` : ''].filter(Boolean).join(' · ');

  const keyFacts: KeyFact[] = [
    { label: 'Pay', value: formatJobPay(job), icon: Banknote },
    { label: isQuickTask ? 'Duration' : 'Type', value: getJobScheduleLabel(job), icon: isQuickTask ? Timer : Briefcase },
    { label: 'Location', value: formatJobLocation(job), icon: MapPin },
    ...(!isQuickTask && job.basic_info.experienceLevel ? [{ label: 'Experience', value: labelFor(EXPERIENCE_LEVELS, job.basic_info.experienceLevel), icon: ChartColumn }] : []),
    ...(isQuickTask && job.category_specific.urgency ? [{ label: 'Urgency', value: capitalize(job.category_specific.urgency), icon: AlertCircle }] : []),
    ...(isQuickTask && job.category_specific.complexity ? [{ label: 'Complexity', value: capitalize(job.category_specific.complexity), icon: Layers }] : []),
    ...(closing ? [{ label: closing.isPast ? 'Closed' : 'Closes', value: job.basic_info.closingDate ? formatShortDate(job.basic_info.closingDate.seconds * 1000) : '', icon: CalendarClock }] : []),
    ...(!isQuickTask && job.basic_info.educationRequirement ? [{ label: 'Education', value: labelFor(EDUCATION_OPTIONS, job.basic_info.educationRequirement), icon: GraduationCap }] : []),
  ];
  const otherFacts: { label: string; value: string }[] = [
    ...(job.basic_info.category ? [{ label: 'Category', value: job.basic_info.category }] : []),
    ...(job.basic_info.contactPreference ? [{ label: 'Contact', value: labelFor(CONTACT_OPTIONS, job.basic_info.contactPreference) }] : []),
    ...(isQuickTask && job.category_specific.paymentTiming ? [{ label: 'Payment', value: labelFor(PAYMENT_TIMING_OPTIONS, job.category_specific.paymentTiming) }] : []),
    ...(job.basic_info.location.notes ? [{ label: 'Location notes', value: job.basic_info.location.notes }] : []),
  ];

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <JobLogo uri={logo} name={isQuickTask ? posterName : companyName} size={56} />
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.title}>{job.basic_info.title}</Text>
            <JobPosterLine name={isQuickTask ? posterName : companyName} isVerified={isVerified} />
          </View>
        </View>
        <Text style={styles.datesLine}>
          {isQuickTask ? 'Quick task' : 'Professional'} · Posted {formatTimeAgo(job.basic_info.createdAt?.seconds).toLowerCase()}
          {closing ? <Text style={closing.isSoon ? styles.closingSoon : undefined}> · {closing.label}</Text> : null}
        </Text>
        {!isOpenStatus ? <JobStatusPill presentation={getListingStatusPresentation(status)} /> : null}
      </View>

      <View style={styles.factGrid}>
        {keyFacts.map((fact) => {
          const Icon = fact.icon;
          return <View key={fact.label} accessible accessibilityLabel={`${fact.label}: ${fact.value}`} style={styles.factTile}>
            <View style={styles.factLabelRow}><Icon size={14} color={colors.accentText} /><Text numberOfLines={1} style={styles.factLabel}>{fact.label}</Text></View>
            <Text numberOfLines={2} style={styles.factValue}>{fact.value}</Text>
          </View>;
        })}
      </View>

      <Section styles={styles} title="About the role">
        <Text numberOfLines={isLongDescription && !isDescriptionExpanded ? DESCRIPTION_COLLAPSED_LINES : undefined} style={styles.body}>{description}</Text>
        {isLongDescription ? (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: isDescriptionExpanded }} onPress={() => setIsDescriptionExpanded((expanded) => !expanded)} hitSlop={4} style={styles.textButton}>
            <Text style={styles.textButtonText}>{isDescriptionExpanded ? 'Show less' : 'Read more'}</Text>
          </Pressable>
        ) : null}
      </Section>

      {job.details.skills.length ? (
        <Section styles={styles} title="Skills needed" icon={<Code size={16} color={colors.accentText} />}>
          <View style={styles.chipRow}>{job.details.skills.map((skill) => <View key={skill} style={styles.skillChip}><Text style={styles.skillText}>{skill}</Text></View>)}</View>
        </Section>
      ) : null}

      <BulletSection styles={styles} title="Requirements" icon={<CheckCircle2 size={16} color={colors.accentText} />} items={job.details.requirements ?? []} />
      <BulletSection styles={styles} title="Qualifications" icon={<GraduationCap size={16} color={colors.accentText} />} items={job.details.qualifications ?? []} />
      <BulletSection
        styles={styles}
        title={isQuickTask ? 'Deliverables' : 'Responsibilities'}
        icon={<FileText size={16} color={colors.accentText} />}
        items={[...listDeliverables, ...specificDeliverables.map((deliverable) => `${deliverable.description}${deliverable.quantity ? ` (${deliverable.quantity} ${deliverable.unit})` : ''}`)]}
      />
      <BulletSection styles={styles} title="Acceptance criteria" icon={<ListChecks size={16} color={colors.accentText} />} items={job.category_specific.acceptanceCriteria ?? []} />
      <BulletSection styles={styles} title="Cancellation terms" icon={<Undo2 size={16} color={colors.accentText} />} items={(job.category_specific.cancellationTerms ?? []).map((term) => `${term.trigger}: ${term.refundPercentage}% refund${term.description ? ` — ${term.description}` : ''}`)} />
      <BulletSection styles={styles} title="Safety requirements" icon={<Shield size={16} color={colors.warningText} />} items={job.category_specific.safetyRequirements ?? []} />

      {otherFacts.length ? (
        <Section styles={styles} title="More details">
          {otherFacts.map((fact) => <View key={fact.label} style={styles.detailRow}><Text style={styles.detailLabel}>{fact.label}</Text><Text style={styles.detailValue}>{fact.value}</Text></View>)}
        </Section>
      ) : null}

      <Section styles={styles} title={isQuickTask ? 'About the poster' : 'About the company'}>
        <View style={styles.posterRow}>
          <UserAvatar userId={job.basic_info.userId} profileImage={job.creator?.profileImage} firstName={posterName} size={48} />
          <View style={styles.flex}>
            <JobPosterLine name={posterName} isVerified={isVerified} />
            <Text style={styles.muted}>{isVerified ? 'Identity verified on Ourlime' : job.creator?.verificationStatus ? 'Identity not verified yet' : 'Ourlime member'}</Text>
          </View>
        </View>
        {!isQuickTask && (companyName !== posterName || companyMeta) ? (
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{companyName}</Text>
            {companyMeta ? <Text style={styles.muted}>{companyMeta}</Text> : null}
          </View>
        ) : null}
        {!isQuickTask && job.category_specific.companyDescription ? <Text style={styles.body}>{job.category_specific.companyDescription}</Text> : null}
        {!isQuickTask && job.category_specific.benefits?.length ? (
          <View style={styles.chipRow}>{job.category_specific.benefits.map((benefit) => <View key={benefit} style={styles.benefitChip}><Sparkles size={12} color={colors.accentText} /><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
        ) : null}
        {!isQuickTask && website ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${website}`} onPress={() => void Linking.openURL(/^https?:\/\//i.test(website) ? website : `https://${website}`)} hitSlop={4} style={styles.textButton}>
            <ExternalLink size={14} color={colors.accentText} /><Text numberOfLines={1} style={styles.textButtonText}>{website}</Text>
          </Pressable>
        ) : null}
      </Section>

      <View style={styles.warningCard}>
        <View style={styles.sectionHeader}><AlertTriangle size={16} color={colors.warningText} /><Text style={styles.warningTitle}>Stay safe</Text></View>
        <Text style={styles.warningBody}>Protect yourself when interacting with job posters:</Text>
        {JOB_SAFETY_GUIDANCE.map((item) => <View key={item} style={styles.tipRow}><AlertCircle size={14} color={colors.warningText} /><Text style={styles.warningBody}>{item}</Text></View>)}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><Shield size={16} color={colors.accentText} /><Text style={styles.sectionTitle}>Posting & application safety</Text></View>
        {POSTING_SAFETY.map((item) => <View key={item} style={styles.tipRow}><CircleCheck size={14} color={colors.accentText} /><Text style={styles.smallBody}>{item}</Text></View>)}
      </View>

      {onReport ? (
        <Pressable accessibilityRole="button" onPress={onReport} android_ripple={{ color: colors.control }} style={styles.reportButton}>
          <Flag size={16} color={colors.destructiveText} /><Text style={styles.reportText}>Report this listing</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type BodyStyles = ReturnType<typeof createStyles>;

function Section({ styles, title, icon, children }: { styles: BodyStyles; title: string; icon?: ReactNode; children: ReactNode }) {
  return <View style={styles.card}><View style={styles.sectionHeader}>{icon}<Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text></View>{children}</View>;
}

function BulletSection({ styles, title, icon, items }: { styles: BodyStyles; title: string; icon: ReactNode; items: string[] }) {
  if (!items.length) return null;
  return <Section styles={styles} title={title} icon={icon}>{items.map((item, itemIndex) => <View key={`${title}-${itemIndex}`} style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.body}>{item}</Text></View>)}</Section>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    stack: { gap: 12 },
    flex: { flex: 1, minWidth: 0 },
    card: { gap: 8, padding: 16, borderRadius: JOBS_CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', marginBottom: 4 },
    datesLine: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
    closingSoon: { color: colors.warningText, fontWeight: '800' },
    factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    factTile: { flexBasis: '46%', flexGrow: 1, minWidth: 0, minHeight: 72, gap: 4, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    factLabel: { flexShrink: 1, color: colors.mutedText, fontSize: 12, fontWeight: '700' },
    factValue: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
    body: { flexShrink: 1, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
    smallBody: { flexShrink: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    textButton: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
    textButtonText: { flexShrink: 1, color: colors.accentText, fontSize: 14, fontWeight: '800' },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    bullet: { color: colors.accentText, fontSize: 14, lineHeight: 21, fontWeight: '900' },
    detailRow: { gap: 2, paddingVertical: 4 },
    detailLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
    detailValue: { color: colors.text, fontSize: 14, lineHeight: 20 },
    posterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17, marginTop: 2 },
    companyBlock: { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    companyName: { color: colors.text, fontSize: 15, fontWeight: '800' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillChip: { maxWidth: '100%', backgroundColor: colors.successSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    skillText: { color: colors.successText, fontSize: 13, fontWeight: '700' },
    benefitChip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.control, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    benefitText: { flexShrink: 1, color: colors.secondaryText, fontSize: 12 },
    warningCard: { gap: 8, padding: 16, borderRadius: JOBS_CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.warningText, backgroundColor: colors.warningSurface },
    warningTitle: { color: colors.warningText, fontSize: 16, fontWeight: '900' },
    warningBody: { flexShrink: 1, color: colors.warningText, fontSize: 13, lineHeight: 19 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    reportButton: { minHeight: 48, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    reportText: { color: colors.destructiveText, fontWeight: '800' },
  });
}
