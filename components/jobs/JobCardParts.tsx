import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Archive, BadgeCheck, Ban, CheckCircle2, Circle, Clock, Eye, FilePen, Hourglass, MessageSquare, PauseCircle, Send, Sparkles, XCircle, type LucideIcon,
} from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { JobRecord } from '@/lib/job/JobsService';
import type { JobApplicationStatus } from '@/lib/services/JobApplicationService';
import { EMPLOYMENT_TYPES, labelFor } from '@/lib/job/JobFormOptions';

/**
 * Shared pieces of the Jobs cards and pages, in the E-Hub style: 16 radius, hairline borders, 44dp targets and
 * status colour always paired with text and an icon.
 */

/** Fill for primary Jobs buttons: brand #10b981 under white text is only ~2.5:1, so fills use the darker emerald (5.5:1) like E-Hub. */
export const JOBS_ACTION_GREEN = '#047857';
export const JOBS_CARD_RADIUS = 16;
/** A listing closing within this many days shows "Closes in n days" in warning colour. */
export const JOBS_CLOSING_SOON_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIOD_SUFFIX: { [period: string]: string } = { hourly: '/hr', daily: '/day', weekly: '/wk', monthly: '/mo', yearly: '/yr', fixed: ' fixed' };

const withThousands = (amount: number): string => {
  const rounded = Math.round(amount * 100) / 100;
  const [whole, cents] = String(rounded).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${cents ? `.${cents.padEnd(2, '0')}` : ''}`;
};

/** "TT$4,000–5,500/mo", "$300 fixed" or "Pay negotiable" when no amount was given. */
export function formatJobPay(job: JobRecord): string {
  const { from, to } = job.basic_info.priceRange;
  if (!from && !to) return 'Pay negotiable';
  const currency = job.basic_info.currency || job.category_specific.currency || '';
  const symbol = currency === 'TTD' ? 'TT$' : !currency || currency === 'USD' ? '$' : `${currency} `;
  const period = PERIOD_SUFFIX[job.basic_info.paymentPeriod || job.category_specific.paymentPeriod || ''] ?? '';
  const amount = !to || from === to ? withThousands(from || to) : `${withThousands(from)}–${withThousands(to)}`;
  return `${symbol}${amount}${period}`;
}

/** "Today", "3d ago", "2w ago", "4mo ago", or "Recently" without a date. */
export function formatTimeAgo(seconds: number | undefined): string {
  if (!seconds) return 'Recently';
  const days = Math.floor((Date.now() - seconds * 1000) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** "12 Dec" (this year) or "12 Dec 2027". */
export function formatShortDate(ms: number): string {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

export type JobClosingInfo = { label: string; isSoon: boolean; isPast: boolean };

/** The listing's closing date as "Closes 12 Dec" / "Closes in 2 days" / "Closes today" / "Closed 3 Dec", or null. */
export function getJobClosingInfo(job: JobRecord): JobClosingInfo | null {
  const seconds = job.basic_info.closingDate?.seconds;
  if (!seconds) return null;
  const closesAt = seconds * 1000;
  const daysLeft = Math.ceil((closesAt - Date.now()) / DAY_MS);
  if (closesAt < Date.now()) return { label: `Closed ${formatShortDate(closesAt)}`, isSoon: false, isPast: true };
  if (daysLeft <= 1) return { label: 'Closes today', isSoon: true, isPast: false };
  if (daysLeft <= JOBS_CLOSING_SOON_DAYS) return { label: `Closes in ${daysLeft} days`, isSoon: true, isPast: false };
  return { label: `Closes ${formatShortDate(closesAt)}`, isSoon: false, isPast: false };
}

/** Employment type for a professional job ("Full-time"), the duration for a quick task. */
export function getJobScheduleLabel(job: JobRecord): string {
  if (job.basic_info.type === 'quickTask') return job.category_specific.duration || 'Flexible';
  return labelFor(EMPLOYMENT_TYPES, job.basic_info.employmentType || job.category_specific.employmentType) || job.basic_info.jobType || job.category_specific.type || 'Professional';
}

export type JobTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';
export type JobToneColors = { surface: string; text: string };

/** Surface and text for a status tone; blue is not in the app theme, so it is picked per light/dark here. */
export function getJobToneColors(tone: JobTone, colors: AppThemeColors, isDark: boolean): JobToneColors {
  if (tone === 'success') return { surface: colors.successSurface, text: colors.successText };
  if (tone === 'warning') return { surface: colors.warningSurface, text: colors.warningText };
  if (tone === 'danger') return { surface: colors.destructiveSurface, text: colors.destructiveText };
  if (tone === 'info') return isDark ? { surface: '#172554', text: '#93c5fd' } : { surface: '#eff6ff', text: '#1d4ed8' };
  return { surface: colors.control, text: colors.secondaryText };
}

export type JobStatusPresentation = { label: string; tone: JobTone; icon: LucideIcon };

/**
 * An application's status as text, tone and icon. Applicants see "Submitted" and "Not selected"; posters see the
 * workflow names (Pending, Rejected).
 */
export function getApplicationStatusPresentation(status: JobApplicationStatus, audience: 'applicant' | 'poster'): JobStatusPresentation {
  const isApplicant = audience === 'applicant';
  switch (status) {
    case 'pending': return { label: isApplicant ? 'Submitted' : 'Pending', tone: 'neutral', icon: Send };
    case 'reviewing': return { label: isApplicant ? 'In review' : 'Reviewing', tone: 'info', icon: Eye };
    case 'interviewing': return { label: 'Interview', tone: 'warning', icon: MessageSquare };
    case 'offer': return { label: 'Offer', tone: 'warning', icon: Sparkles };
    case 'accepted': return { label: 'Accepted', tone: 'success', icon: CheckCircle2 };
    case 'rejected': return { label: isApplicant ? 'Not selected' : 'Rejected', tone: 'danger', icon: XCircle };
    case 'withdrawn': return { label: 'Withdrawn', tone: 'neutral', icon: Ban };
    case 'job_withdrawn': return { label: isApplicant ? 'Listing removed' : 'Job withdrawn', tone: 'neutral', icon: Archive };
    default: return { label: String(status), tone: 'neutral', icon: Circle };
  }
}

/** A listing's publication status as text, tone and icon (poster's dashboard and the job page). */
export function getListingStatusPresentation(status: string): JobStatusPresentation {
  switch (status) {
    case 'published': case 'active': return { label: 'Open', tone: 'success', icon: CheckCircle2 };
    case 'pending_review': return { label: 'In review', tone: 'info', icon: Hourglass };
    case 'paused': return { label: 'Paused', tone: 'warning', icon: PauseCircle };
    case 'draft': return { label: 'Draft', tone: 'neutral', icon: FilePen };
    case 'closed': case 'expired': return { label: 'Closed', tone: 'neutral', icon: Clock };
    case 'archived': return { label: 'Archived', tone: 'neutral', icon: Archive };
    case 'rejected': return { label: 'Not approved', tone: 'danger', icon: XCircle };
    default: return { label: status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), tone: 'neutral', icon: Circle };
  }
}

type JobStatusPillProps = { presentation: JobStatusPresentation; size?: 'small' | 'regular' };

/** A status pill: icon + text on a tonal surface, never colour alone. */
export function JobStatusPill({ presentation, size = 'regular' }: JobStatusPillProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tone = getJobToneColors(presentation.tone, colors, isDark);
  const Icon = presentation.icon;
  return <View accessible accessibilityLabel={`Status: ${presentation.label}`} style={[styles.pill, size === 'small' && styles.pillSmall, { backgroundColor: tone.surface }]}>
    <Icon size={size === 'small' ? 12 : 14} color={tone.text} />
    <Text numberOfLines={1} style={[styles.pillText, size === 'small' && styles.pillTextSmall, { color: tone.text }]}>{presentation.label}</Text>
  </View>;
}

type JobLogoProps = { uri?: string; name: string; size?: number };

/** Company logo or poster photo at an explicit pixel size (expo-image percentages fail inside Pressables), or the initial. */
export function JobLogo({ uri, name, size = 44 }: JobLogoProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hasFailed, setHasFailed] = useState(false);
  const radius = Math.round(size * 0.27);
  return <View style={[styles.logo, { width: size, height: size, borderRadius: radius }]}>
    {uri && !hasFailed
      ? <CachedImage uri={uri} style={{ width: size, height: size }} accessibilityLabel={`${name} logo`} onError={() => setHasFailed(true)} />
      : <Text style={[styles.logoLetter, { fontSize: Math.round(size * 0.4) }]}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>}
  </View>;
}

type JobPosterLineProps = { name: string; isVerified: boolean };

/** "Company name ✓": one muted line that truncates, with the verified tick kept visible. */
export function JobPosterLine({ name, isVerified }: JobPosterLineProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.posterLine}>
    <Text numberOfLines={1} style={styles.posterName}>{name}</Text>
    {isVerified ? <BadgeCheck size={14} color={colors.accentText} accessibilityLabel="Verified poster" /> : null}
  </View>;
}

type JobTagRowProps = { tags: string[]; max?: number };

/** Up to `max` tags then "+n", so a card never wraps into a block of chips. */
export function JobTagRow({ tags, max = 2 }: JobTagRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (!uniqueTags.length) return null;
  const hiddenCount = uniqueTags.length - max;
  return <View style={styles.tagRow}>
    {uniqueTags.slice(0, max).map((tag) => <View key={tag} style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{tag}</Text></View>)}
    {hiddenCount > 0 ? <View style={styles.tagMore}><Text style={styles.tagMoreText}>+{hiddenCount}</Text></View> : null}
  </View>;
}

type JobChipProps = { label: string; isSelected: boolean; onPress: () => void; accessibilityLabel?: string };

/** A 40-tall selectable chip (filters, categories), with a 4dp hit slop to reach 48. */
export function JobChip({ label, isSelected, onPress, accessibilityLabel }: JobChipProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: isSelected }} onPress={onPress} hitSlop={4} android_ripple={{ color: colors.control }} style={[styles.chip, isSelected && styles.chipSelected]}>
    {isSelected ? <CheckCircle2 size={14} color={colors.successText} /> : null}
    <Text numberOfLines={1} style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    pill: { flexShrink: 1, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    pillSmall: { paddingHorizontal: 8, paddingVertical: 3 },
    pillText: { flexShrink: 1, fontSize: 12, fontWeight: '800' },
    pillTextSmall: { fontSize: 11 },
    logo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    logoLetter: { color: colors.successText, fontWeight: '900' },
    posterLine: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    posterName: { flexShrink: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '600' },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    tag: { flexShrink: 1, maxWidth: 140, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.control },
    tagText: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
    tagMore: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.control },
    tagMoreText: { color: colors.mutedText, fontSize: 12, fontWeight: '800' },
    chip: { minHeight: 40, maxWidth: 220, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    chipSelected: { backgroundColor: colors.successSurface, borderColor: colors.accent },
    chipText: { flexShrink: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    chipTextSelected: { color: colors.successText, fontWeight: '800' },
  });
}
