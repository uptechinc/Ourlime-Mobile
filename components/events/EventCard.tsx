import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Archive, BadgeCheck, Bookmark, CalendarDays, Flag, Heart, MapPin, Pencil, Share2, Trash2, Users } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import { eventService } from '@/lib/services/EventService';
import type { Event } from '@/types/eventTypes';
import { STATUS_BADGES, daysLeftLabel, daysRemaining, formatEventRange } from './eventPresentation';

type EventCardProps = {
  event: Event;
  variant: 'grid' | 'list';
  attendeeCount: number;
  isAttending: boolean;
  waitlistPosition?: number | null;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isTargeted?: boolean;
  isWorking?: boolean;
  /** Owner or staff: shows Edit (owner only), Archive and Cancel. */
  canManage?: boolean;
  canEdit?: boolean;
  /** The upcoming page shows a days-left badge and only the Report action, like the website. */
  showDaysLeft?: boolean;
  compactActions?: boolean;
  onOpen: () => void;
  onAttend?: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onCancel?: () => void;
};

/** An event in a listing: the website's events-page card laid out for phones. */
export default function EventCard({
  event, variant, attendeeCount, isAttending, waitlistPosition, isLiked, isBookmarked, isTargeted, isWorking, canManage, canEdit, showDaysLeft, compactActions,
  onOpen, onAttend, onLike, onBookmark, onShare, onReport, onEdit, onArchive, onCancel,
}: EventCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const status = STATUS_BADGES[eventService.effectiveStatus(event)];
  const location = linkPresentationService.presentLocation(event.location);
  const locationLabel = event.isVirtual ? 'Online event' : location.detail ? `${location.title} · ${location.detail}` : location.title;
  const days = daysRemaining(event.startDate);
  const toneColors = status ? {
    warning: [colors.warningSurface, colors.warningText], info: [colors.control, colors.accentText], danger: [colors.destructiveSurface, colors.destructiveText],
    success: [colors.successSurface, colors.successText], muted: [colors.control, colors.mutedText],
  }[status.tone] : null;
  const isList = variant === 'list';

  const iconButton = (label: string, icon: ReactNode, onPress: (() => void) | undefined, active?: boolean) => onPress ? (
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={[styles.iconButton, active && styles.iconButtonActive]}>
      {icon}
    </TouchableOpacity>
  ) : null;

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.85} onPress={onOpen} style={[styles.card, isList && styles.cardList, isTargeted && styles.cardTargeted]}>
      <View style={isList ? styles.thumbWrap : styles.imageWrap}>
        {event.image ? (
          <Image source={{ uri: event.image }} recyclingKey={`event-${event.id}-${event.image}`} contentFit="cover" style={styles.fill} />
        ) : (
          <View style={[styles.fill, styles.placeholder]}><CalendarDays size={isList ? 26 : 34} color={colors.accent} /></View>
        )}
        {!isList ? (
          <View style={styles.imageBadges}>
            {event.category ? <Text style={styles.categoryBadge} numberOfLines={1}>{event.category}</Text> : null}
            {status && toneColors ? <Text style={[styles.statusBadge, { backgroundColor: toneColors[0], color: toneColors[1] }]}>{status.label}</Text> : null}
          </View>
        ) : null}
        {!isList && showDaysLeft && days >= 0 ? (
          <Text style={[styles.daysBadge, days <= 3 ? styles.daysUrgent : days <= 7 ? styles.daysSoon : null]}>{daysLeftLabel(days)}</Text>
        ) : null}
      </View>
      <View style={styles.body}>
        {isList ? (
          <View style={styles.badgeRow}>
            {event.category ? <Text style={styles.categoryInline} numberOfLines={1}>{event.category}</Text> : null}
            {status && toneColors ? <Text style={[styles.statusBadge, { backgroundColor: toneColors[0], color: toneColors[1] }]}>{status.label}</Text> : null}
            {showDaysLeft && days >= 0 ? <Text style={styles.statusBadge}>{daysLeftLabel(days)}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        {event.organizer?.verified ? (
          <View style={styles.meta}><BadgeCheck size={14} color={colors.successText} /><Text style={styles.verified}>Verified organizer</Text></View>
        ) : null}
        <View style={styles.meta}><CalendarDays size={14} color={colors.accent} /><Text style={styles.metaText} numberOfLines={1}>{formatEventRange(event.startDate, event.endDate)}</Text></View>
        <View style={styles.meta}><MapPin size={14} color={colors.accent} /><Text style={styles.metaText} numberOfLines={1}>{locationLabel}</Text></View>
        <View style={styles.meta}><Users size={14} color={colors.mutedText} /><Text style={styles.metaText}>{attendeeCount} attending</Text></View>
        {!isList && event.summary ? <Text style={styles.summary} numberOfLines={2}>{event.summary}</Text> : null}

        <View style={styles.actions}>
          {onAttend && event.id ? (
            <TouchableOpacity accessibilityRole="button" disabled={isWorking} onPress={onAttend} style={[styles.attend, (isAttending || Boolean(waitlistPosition)) && styles.attending, isWorking && styles.disabled]}>
              <Text style={[styles.attendText, (isAttending || Boolean(waitlistPosition)) && styles.attendingText]}>
                {isWorking ? 'Updating…' : isAttending ? 'Going' : waitlistPosition ? `Waitlist #${waitlistPosition}` : 'Attend'}
              </Text>
            </TouchableOpacity>
          ) : <View style={styles.flex} />}
          <View style={styles.iconRow}>
            {compactActions ? null : iconButton(isLiked ? 'Unlike' : 'Like', <Heart size={17} color={isLiked ? '#ef4444' : colors.icon} fill={isLiked ? '#ef4444' : 'transparent'} />, onLike, isLiked)}
            {compactActions ? null : iconButton(isBookmarked ? 'Remove bookmark' : 'Bookmark', <Bookmark size={17} color={isBookmarked ? '#3b82f6' : colors.icon} fill={isBookmarked ? '#3b82f6' : 'transparent'} />, onBookmark, isBookmarked)}
            {compactActions ? null : iconButton('Share', <Share2 size={17} color={colors.icon} />, onShare)}
            {iconButton('Report', <Flag size={17} color={colors.icon} />, onReport)}
          </View>
        </View>
        {canManage ? (
          <View style={styles.manageRow}>
            {canEdit && onEdit ? <TouchableOpacity accessibilityRole="button" onPress={onEdit} style={styles.manageButton}><Pencil size={14} color={colors.accentText} /><Text style={styles.manageText}>Edit</Text></TouchableOpacity> : null}
            {onArchive ? <TouchableOpacity accessibilityRole="button" onPress={onArchive} style={styles.manageButton}><Archive size={14} color={colors.warningText} /><Text style={[styles.manageText, { color: colors.warningText }]}>Archive</Text></TouchableOpacity> : null}
            {onCancel ? <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.manageButton}><Trash2 size={14} color={colors.destructiveText} /><Text style={[styles.manageText, { color: colors.destructiveText }]}>Cancel event</Text></TouchableOpacity> : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden' },
  cardList: { flexDirection: 'row' },
  cardTargeted: { borderWidth: 2, borderColor: colors.accent },
  imageWrap: { width: '100%', height: 180 },
  thumbWrap: { width: 104, alignSelf: 'stretch', minHeight: 140 },
  fill: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  imageBadges: { position: 'absolute', top: 10, left: 10, right: 90, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryBadge: { backgroundColor: '#01eb53', color: '#000000', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  categoryInline: { color: colors.successText, backgroundColor: colors.successSurface, fontSize: 10, fontWeight: '800', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', maxWidth: 140 },
  statusBadge: { color: colors.secondaryText, backgroundColor: colors.control, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  daysBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#10b981', color: '#ffffff', fontSize: 11, fontWeight: '900', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  daysUrgent: { backgroundColor: '#ef4444' },
  daysSoon: { backgroundColor: '#f97316' },
  body: { flex: 1, padding: 14, gap: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900' },
  verified: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, color: colors.mutedText, fontSize: 12 },
  summary: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  flex: { flex: 1 },
  attend: { flexGrow: 1, minHeight: 40, minWidth: 96, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  attending: { backgroundColor: colors.successSurface },
  attendText: { color: '#ffffff', fontWeight: '900', fontSize: 13 },
  attendingText: { color: colors.successText },
  disabled: { opacity: 0.6 },
  iconRow: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  iconButtonActive: { borderWidth: 1, borderColor: colors.border },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  manageButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.control },
  manageText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
});
