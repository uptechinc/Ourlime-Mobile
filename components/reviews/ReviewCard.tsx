import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { PencilLine, ShieldCheck, Trash2 } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { RatingStars } from './RatingStars';

const CLAMPED_LINES = 5;
export const FALLBACK_REVIEWER_NAME = 'Ourlime member';

/** A review's text clamped to five lines, with "Read more" / "Show less" when it is longer. */
function ClampedText({ text, style, linkStyle }: { text: string; style: object; linkStyle: object }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLong, setIsLong] = useState(false);
  const handleLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!isLong && event.nativeEvent.lines.length > CLAMPED_LINES) setIsLong(true);
  };
  return <View>
    {/* Measured once at full length (hidden) so the clamp knows whether there is more. */}
    {!isLong ? <Text onTextLayout={handleLayout} style={[style, { position: 'absolute', left: 0, right: 0, opacity: 0 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{text}</Text> : null}
    <Text numberOfLines={isExpanded ? undefined : CLAMPED_LINES} style={style}>{text}</Text>
    {isLong ? <Pressable accessibilityRole="button" onPress={() => setIsExpanded((current) => !current)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={linkStyle}>{isExpanded ? 'Show less' : 'Read more'}</Text>
    </Pressable> : null}
  </View>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Mar 2026" (no Intl needed); '' for a missing date. */
export function formatReviewDate(iso: string): string {
  const time = Date.parse(iso);
  if (!iso || Number.isNaN(time) || time <= 0) return '';
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** label: "Reply from the provider", or "Reply from {seller}" on Market. */
type ReviewReply = { label: string; message: string; date: string };

type ReviewCardProps = {
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string | null;
  date: string;
  rating: number;
  title?: string;
  body?: string;
  /** e.g. "Verified order" or "Verified purchase". */
  badge?: string | null;
  /** The member's own review, pinned above the list: "Your rating" or "Your review", with Edit and Delete. */
  ownLabel?: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
  /** When it was last changed: "· Edited" shows when it differs from date. */
  updatedAt?: string;
  /** A moderator hid it (only its author sees it). */
  isHidden?: boolean;
  /** Extra lines between the stars and the comment (service used, criteria). */
  children?: ReactNode;
  reply?: ReviewReply | null;
};

/** One review: avatar, name, date, stars, badge, optional title, details and comment, and the seller's reply. */
export function ReviewCard({ reviewerId, reviewerName, reviewerAvatar, date, rating, title, body, badge, ownLabel = null, onEdit, onDelete, updatedAt, isHidden = false, children, reply }: ReviewCardProps) {
  const isOwn = Boolean(ownLabel);
  const name = reviewerName.trim() || FALLBACK_REVIEWER_NAME;
  const isEdited = Boolean(updatedAt && date && Math.abs(Date.parse(updatedAt) - Date.parse(date)) > 60_000);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shownDate = formatReviewDate(date);
  return <View style={[styles.card, isOwn && styles.cardOwn]}>
    <View style={styles.head}>
      <UserAvatar userId={reviewerId} profileImage={reviewerAvatar ?? null} firstName={name} size={36} backgroundColor={colors.accent} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          {ownLabel ? <View style={styles.ownTag}><Text style={styles.ownTagText}>{ownLabel}</Text></View> : null}
        </View>
        <View style={styles.metaRow}>
          <RatingStars value={rating} size={13} />
          {shownDate ? <Text style={styles.date}>{shownDate}{isEdited ? ' · Edited' : ''}</Text> : null}
        </View>
      </View>
    </View>
    {isHidden ? <Text style={styles.hidden}>Hidden by a moderator. Only you can see it.</Text> : null}
    {badge ? <View style={styles.badge}><ShieldCheck size={13} color={colors.successText} /><Text style={styles.badgeText}>{badge}</Text></View> : null}
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {children}
    {body ? <ClampedText text={body} style={styles.body} linkStyle={styles.readMore} /> : null}
    {reply ? <View style={styles.reply}>
      <View style={styles.replyHead}>
        <Text numberOfLines={1} style={styles.replyAuthor}>{reply.label}</Text>
        {formatReviewDate(reply.date) ? <Text style={styles.date}>{formatReviewDate(reply.date)}</Text> : null}
      </View>
      <Text style={styles.replyText}>{reply.message}</Text>
    </View> : null}
    {isOwn && (onEdit || onDelete) ? <View style={styles.ownActions}>
      {onEdit ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${ownLabel?.toLowerCase() ?? 'your review'}`} onPress={onEdit} style={styles.ownButton}>
        <PencilLine size={16} color={colors.successText} /><Text style={styles.editText}>Edit</Text>
      </Pressable> : null}
      {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${ownLabel?.toLowerCase() ?? 'your review'}`} onPress={onDelete} style={styles.ownButton}>
        <Trash2 size={16} color={colors.destructiveText} /><Text style={styles.deleteText}>Delete</Text>
      </Pressable> : null}
    </View> : null}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { padding: 14, gap: 9, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardOwn: { borderWidth: 1, borderColor: colors.successBorder },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  ownTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface },
  ownTagText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
  metaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { color: colors.mutedText, fontSize: 12 },
  ownActions: { flexDirection: 'row', gap: 10, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  ownButton: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editText: { color: colors.successText, fontSize: 14, fontWeight: '800' },
  deleteText: { color: colors.destructiveText, fontSize: 14, fontWeight: '800' },
  hidden: { padding: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 12, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.successSurface },
  badgeText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  readMore: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  reply: { marginTop: 2, padding: 11, gap: 4, borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 10, backgroundColor: colors.control },
  replyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  replyAuthor: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  replyText: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
});
