import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BookOpen, CheckCircle2, Star } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { Course, Enrollment } from '@/lib/types/course';

/**
 * Fill for primary E-Learning buttons (same as E-Hub): brand #10b981 under white text is only ~2.5:1, so filled
 * buttons use the darker emerald (5.5:1). The theme accent stays for progress bars, borders and selected states.
 */
export const ELEARNING_ACTION_GREEN = '#047857';
export const ELEARNING_GUTTER = 16;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** "Free", "$25" or "$19.99". */
export function formatCoursePrice(price: number): string {
  if (price <= 0) return 'Free';
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

/** "45m", "3h" or "3h 20m" from minutes. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/** The one muted meta line on cards and the course hero: "Beginner · 12 lessons · 3h". Empty parts are left out. */
export function courseMetaLine(course: Course, lessonCount?: number): string {
  return [
    capitalize(course.level),
    lessonCount ? `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}` : null,
    course.duration > 0 ? formatMinutes(course.duration * 60) : null,
  ].filter(Boolean).join(' · ');
}

/** Whole-number progress clamped to 0–100 (enrollments store floats such as 33.33). */
export const roundProgress = (value: number | undefined): number => Math.max(0, Math.min(100, Math.round(value ?? 0)));

type ProgressBarProps = { value: number; height?: number; accessibilityLabel?: string };

/** A thin accent bar on the control track. The percentage is always shown as text next to it by the caller. */
export function ProgressBar({ value, height = 6, accessibilityLabel }: ProgressBarProps) {
  const { colors } = useAppTheme();
  const progress = roundProgress(value);
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: progress }} style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: colors.control }}>
    <View style={{ width: `${progress}%`, height, borderRadius: height / 2, backgroundColor: colors.accent }} />
  </View>;
}

type RatingProps = { rating: number; count: number };

/** "★ 4.7 (128)", or nothing when the course has no ratings yet (an empty 0.0 reads as a bad score). */
export function CourseRating({ rating, count }: RatingProps) {
  const { colors } = useAppTheme();
  if (count <= 0) return null;
  return <View accessible accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`} style={sharedStyles.ratingRow}>
    <Star size={13} color="#f59e0b" fill="#f59e0b" />
    <Text style={[sharedStyles.ratingValue, { color: colors.text }]}>{rating.toFixed(1)}</Text>
    <Text style={[sharedStyles.ratingCount, { color: colors.mutedText }]}>({count})</Text>
  </View>;
}

type HeaderProps = { title: string; subtitle?: string; onBack: () => void; right?: ReactNode };

/**
 * The E-Learning screen bar: 44dp back button, a left-aligned one-line title (with an optional muted line under it)
 * and up to one or two 44dp actions. Put it inside a SafeAreaView with the top edge.
 */
export function ELearningHeader({ title, subtitle, onBack, right }: HeaderProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} android_ripple={{ ...RIPPLE, borderless: true }} style={styles.iconButton}>
      <ArrowLeft size={22} color={colors.icon} />
    </Pressable>
    <View style={styles.headerCopy}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
    {right ?? <View style={styles.iconSpacer} />}
  </View>;
}

type HeaderButtonProps = { accessibilityLabel: string; onPress: () => void; disabled?: boolean; children: ReactNode };

/** A 44dp round icon button for ELearningHeader's right slot. */
export function ELearningHeaderButton({ accessibilityLabel, onPress, disabled = false, children }: HeaderButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} android_ripple={{ ...RIPPLE, borderless: true }} style={styles.iconButton}>
    {children}
  </Pressable>;
}

type ChipProps = { label: string; isSelected: boolean; onPress: () => void };

/** A filter chip: 36 tall with hit slop to 44, selected = filled accent with white text. */
export function ELearningChip({ label, isSelected, onPress }: ChipProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={onPress} hitSlop={4} android_ripple={RIPPLE} style={[styles.chip, isSelected && styles.chipSelected]}>
    <Text numberOfLines={1} style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

type CardAction = { label: string; accessibilityLabel: string; onPress: () => void; isBusy?: boolean; isDisabled?: boolean };

type CourseCardProps = {
  course: Course;
  /** Card width in pixels: the thumbnail gets an explicit 16:9 size from it (percentages fail on expo-image here). */
  width: number;
  onOpen: (courseId: string) => void;
  /** Enrolled: the price is replaced by the progress bar and "45% · Continue". */
  enrollment?: Enrollment | null;
  lessonCount?: number;
  /** A secondary action under the card (catalog quick enroll); it sits outside the card's own press area. */
  action?: CardAction;
};

/**
 * A course card in the catalog order (Coursera/Udemy, Baymard): 16:9 thumbnail with at most one badge ("Enrolled"),
 * two-line title, instructor, rating with count only when rated, one muted meta line, then the price or "Free" — or the
 * progress bar for an enrolled course. The whole card opens the course.
 */
export function CourseCard({ course, width, onOpen, enrollment, lessonCount, action }: CourseCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const image = course.thumbnail || course.image;
  const imageHeight = Math.round(width * 9 / 16);
  const isEnrolled = Boolean(enrollment);
  const progress = roundProgress(enrollment?.progress);
  const meta = courseMetaLine(course, lessonCount);
  const price = formatCoursePrice(course.price);
  const label = [course.title, `by ${course.instructor.name}`, isEnrolled ? `enrolled, ${progress}% complete` : price].join(', ');
  return <View style={[styles.card, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onOpen(course.id)} android_ripple={RIPPLE}>
      <View style={[styles.thumb, { width, height: imageHeight }]}>
        {image ? <CachedImage uri={image} style={{ width, height: imageHeight }} /> : <BookOpen size={32} color={colors.mutedText} />}
        {isEnrolled ? <View style={styles.badge}><CheckCircle2 size={12} color="#ffffff" /><Text style={styles.badgeText}>Enrolled</Text></View> : null}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{course.title}</Text>
        <Text numberOfLines={1} style={styles.instructor}>{course.instructor.name}</Text>
        <CourseRating rating={course.rating} count={course.totalRatings} />
        {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
        {isEnrolled ? <View style={styles.progressBlock}>
          <ProgressBar value={progress} accessibilityLabel={`${course.title} progress`} />
          <Text numberOfLines={1} style={styles.progressText}>{progress}% · {progress >= 100 ? 'Review' : progress > 0 ? 'Continue' : 'Start'}</Text>
        </View> : <Text numberOfLines={1} style={[styles.price, course.price <= 0 && styles.priceFree]}>{price}</Text>}
      </View>
    </Pressable>
    {action ? <View style={styles.footer}>
      <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} accessibilityState={{ disabled: Boolean(action.isDisabled), busy: Boolean(action.isBusy) }} disabled={action.isDisabled || action.isBusy} onPress={action.onPress} android_ripple={RIPPLE} style={[styles.actionButton, action.isDisabled && styles.actionDisabled]}>
        {action.isBusy ? <ActivityIndicator size="small" color={colors.accentText} /> : <Text numberOfLines={1} style={styles.actionText}>{action.label}</Text>}
      </Pressable>
    </View> : null}
  </View>;
}

type EmptyStateProps = { icon: ReactNode; title: string; hint?: string; actionLabel?: string; onAction?: () => void };

/** One line, a hint and a call to action (NN/g actionable empty state). */
export function ELearningEmptyState({ icon, title, hint, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.empty}>
    {icon}
    <Text style={styles.emptyTitle}>{title}</Text>
    {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} android_ripple={RIPPLE} style={styles.emptyButton}>
      <Text numberOfLines={1} style={styles.emptyButtonText}>{actionLabel}</Text>
    </Pressable> : null}
  </View>;
}

const sharedStyles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontSize: 13, fontWeight: '700' },
  ratingCount: { fontSize: 12 },
});

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    header: { height: 56, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    iconSpacer: { width: 48 },
    headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
    headerSubtitle: { color: colors.mutedText, fontSize: 12, marginTop: 1 },

    chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
    chipSelected: { backgroundColor: ELEARNING_ACTION_GREEN, borderColor: ELEARNING_ACTION_GREEN },
    chipText: { color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
    chipTextSelected: { color: '#ffffff' },

    card: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    thumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
    badge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: ELEARNING_ACTION_GREEN },
    badgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    body: { padding: 12, gap: 4 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 21 },
    instructor: { color: colors.mutedText, fontSize: 13 },
    meta: { color: colors.mutedText, fontSize: 12 },
    price: { marginTop: 4, color: colors.text, fontSize: 16, fontWeight: '800' },
    priceFree: { color: colors.accentText },
    progressBlock: { marginTop: 6, gap: 6 },
    progressText: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
    footer: { paddingHorizontal: 12, paddingBottom: 12 },
    actionButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
    actionDisabled: { opacity: 0.5 },
    actionText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },

    empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 8 },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    emptyHint: { color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
    emptyButton: { marginTop: 8, minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
    emptyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  });
}
