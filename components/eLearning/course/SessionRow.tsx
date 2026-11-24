import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Flag, Radio, Video } from 'lucide-react-native';
import { StatusPill } from '@/components/eLearning/ELearningParts';
import { openExternalLink } from '@/components/eLearning/course/workspaceHelpers';
import { formatSessionTime, sessionKindLabel } from '@/lib/services/AssignmentPolicy';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseSession } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type SessionRowProps = {
  session: CourseSession;
  /** Staff actions (edit and cancel); learners get only Join. */
  onEdit?: () => void;
  onCancel?: () => void;
  onOpenError?: () => void;
};

/**
 * One scheduled session: what it is, when (in the device's time zone), which class, whether it is recorded and why, and
 * a Join button that opens the external meeting link. Cancelled sessions say so and lose their link.
 */
export default function SessionRow({ session, onEdit, onCancel, onOpenError }: SessionRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCancelled = session.status === 'cancelled';
  const Icon = session.kind === 'deadline' ? Flag : session.kind === 'office_hours' ? CalendarClock : Video;
  const canJoin = !isCancelled && session.kind !== 'deadline' && Boolean(session.joinUrl);
  const when = formatSessionTime(session.startsAt, session.endsAt);

  return (
    <View style={[styles.row, isCancelled && styles.cancelled]}>
      <View style={styles.icon}><Icon size={18} color={colors.accentText} /></View>
      <View style={styles.body}>
        <View style={styles.pills}>
          <StatusPill label={sessionKindLabel(session.kind)} tone="info" />
          {isCancelled ? <StatusPill label="Cancelled" tone="danger" /> : null}
          {session.recording === 'recorded' && !isCancelled ? <StatusPill label="Recorded" tone="warning" icon={<Radio size={12} color={colors.warningText} />} /> : null}
        </View>
        <Text style={[styles.title, isCancelled && styles.struck]}>{session.title}</Text>
        <Text style={styles.meta}>{when}{session.cohortName ? ` · ${session.cohortName}` : ' · Whole course'}</Text>
        {session.description ? <Text style={styles.description}>{session.description}</Text> : null}
        {session.recording === 'recorded' && session.recordingNote ? <Text style={styles.meta}>Recording: {session.recordingNote}</Text> : null}
        {canJoin || onEdit || onCancel ? (
          <View style={styles.actions}>
            {canJoin ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Join ${session.title}`} accessibilityHint="Opens the meeting link outside Ourlime" android_ripple={{ color: 'rgba(255,255,255,0.2)' }} onPress={() => void openExternalLink(session.joinUrl).then((opened) => { if (!opened) onOpenError?.(); })} style={styles.join}>
                <Text style={styles.joinText}>Join</Text>
              </Pressable>
            ) : null}
            {onEdit && !isCancelled ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${session.title}`} android_ripple={RIPPLE} onPress={onEdit} style={styles.secondary}><Text style={styles.secondaryText}>Edit</Text></Pressable> : null}
            {onCancel && !isCancelled ? <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${session.title}`} android_ripple={RIPPLE} onPress={onCancel} style={styles.secondary}><Text style={[styles.secondaryText, { color: colors.destructiveText }]}>Cancel session</Text></Pressable> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cancelled: { opacity: 0.75 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  body: { flex: 1, minWidth: 0, gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  struck: { textDecorationLine: 'line-through' },
  meta: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  description: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  join: { minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden' },
  joinText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
