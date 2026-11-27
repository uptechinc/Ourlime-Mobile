import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, MessageSquareText, PencilLine, Star } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { Skeleton } from '@/components/ui/Skeleton';

type WriteReviewButtonProps = { label: string; onPress: () => void; icon?: 'star' | 'edit' };

/** "Rate this provider", "Write a review", "Sign in to rate"…: a full-width 48pt outline button under the summary. */
export function WriteReviewButton({ label, onPress, icon = 'star' }: WriteReviewButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = icon === 'edit' ? PencilLine : Star;
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.writeButton}>
    <Icon size={18} color={colors.successText} />
    <Text numberOfLines={1} style={styles.writeText}>{label}</Text>
  </Pressable>;
}

type ReviewNoticeProps = { text: string; actionLabel?: string; onAction?: () => void; tone?: 'info' | 'error' };

/** Why the member cannot rate yet (or why reviews did not load), with one action. */
export function ReviewNotice({ text, actionLabel, onAction, tone = 'info' }: ReviewNoticeProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isError = tone === 'error';
  return <View accessibilityLiveRegion="polite" style={[styles.notice, isError && styles.noticeError]}>
    <View style={styles.noticeRow}>
      <Info size={16} color={isError ? colors.destructiveText : colors.secondaryText} />
      <Text style={[styles.noticeText, isError && { color: colors.destructiveText }]}>{text}</Text>
    </View>
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.noticeAction}>
      <Text style={styles.noticeActionText}>{actionLabel}</Text>
    </Pressable> : null}
  </View>;
}

type ReviewsEmptyProps = { title: string; body?: string };

export function ReviewsEmpty({ title, body }: ReviewsEmptyProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.empty}>
    <MessageSquareText size={28} color={colors.mutedText} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
  </View>;
}

type ShowMoreProps = { label: string; isLoading: boolean; onPress: () => void };

export function ShowMoreReviews({ label, isLoading, onPress }: ShowMoreProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: isLoading }} disabled={isLoading} onPress={onPress} style={styles.more}>
    {isLoading ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
    <Text style={styles.moreText}>{isLoading ? 'Loading…' : label}</Text>
  </Pressable>;
}

/** Placeholder summary and two review cards while the first page loads. */
export function ReviewsSkeleton() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View accessibilityLabel="Loading reviews" style={styles.skeleton}>
    <View style={styles.skeletonRow}>
      <Skeleton width={84} height={70} borderRadius={12} />
      <View style={styles.skeletonBars}>{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} width="100%" height={8} borderRadius={4} />)}</View>
    </View>
    {[0, 1].map((index) => <Skeleton key={index} width="100%" height={92} borderRadius={14} />)}
  </View>;
}

/** The section's heading row: title (and an optional subtitle) on the left, an optional small link on the right. */
export function ReviewsHeading({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.heading}>
    <View style={styles.headingTextBlock}>
      <Text accessibilityRole="header" style={styles.headingText}>{title}</Text>
      {subtitle ? <Text style={styles.headingSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>;
}

const FIRST_PAGE = 5;
const NEXT_PAGE = 10;

/**
 * Reviews shown five first, then ten more per "Show more"; asks the server for its next page when the loaded ones
 * run out. Returns how many to show, whether a "Show more" applies, and its handler.
 */
export function useReviewPaging(loadedCount: number, hasMoreOnServer: boolean, loadMore: () => Promise<void>) {
  const [shown, setShown] = useState(FIRST_PAGE);
  const showMore = () => {
    const next = shown + NEXT_PAGE;
    setShown(next);
    if (next > loadedCount && hasMoreOnServer) void loadMore();
  };
  return { shown, canShowMore: loadedCount > shown || hasMoreOnServer, showMore };
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  writeButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  writeText: { flexShrink: 1, color: colors.successText, fontSize: 15, fontWeight: '800' },
  notice: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: colors.control },
  noticeError: { backgroundColor: colors.destructiveSurface },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  noticeAction: { alignSelf: 'flex-start', minHeight: 44, marginLeft: 24, justifyContent: 'center' },
  noticeActionText: { color: colors.accentText, fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  empty: { paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyBody: { maxWidth: 320, color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  more: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moreText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  skeleton: { gap: 12 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  skeletonBars: { flex: 1, gap: 7 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingTextBlock: { flex: 1, gap: 3 },
  headingText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  headingSubtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
});
