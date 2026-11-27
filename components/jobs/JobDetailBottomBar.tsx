import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Lock, Send, Settings2 } from 'lucide-react-native';
import { JobSaveButton } from './JobCardActions';
import { JOBS_ACTION_GREEN } from './JobCardParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type JobDetailBottomBarProps = {
  jobId: string;
  jobTitle: string;
  isCreator: boolean;
  isApplied: boolean;
  isOpenForApplications: boolean;
  /** Shows Save for members other than the poster (default true). */
  canSave?: boolean;
  onApply: () => void;
  /** After applying the button reads "Applied · View status" and opens My applications. */
  onViewStatus: () => void;
  /** The poster's own listing: "Manage listing". Without it the bar just says it is their listing. */
  onManage?: () => void;
};

/**
 * The job page's sticky bar inside the bottom safe area: Save (48dp) and one full-width primary action that always
 * says what it does — Apply now, Applied · View status, Manage listing, or a clearly disabled "Applications closed".
 */
export function JobDetailBottomBar({ jobId, jobTitle, isCreator, isApplied, isOpenForApplications, canSave = true, onApply, onViewStatus, onManage }: JobDetailBottomBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderPrimary = () => {
    if (isCreator) {
      return onManage
        ? <Pressable accessibilityRole="button" onPress={onManage} android_ripple={{ color: colors.control }} style={[styles.primary, styles.outline]}><Settings2 size={18} color={colors.accentText} /><Text numberOfLines={1} style={[styles.primaryText, styles.outlineText]}>Manage listing</Text></Pressable>
        : <View style={[styles.primary, styles.muted]}><Text numberOfLines={1} style={styles.mutedText}>This is your listing</Text></View>;
    }
    if (isApplied) {
      return <Pressable accessibilityRole="button" accessibilityLabel="Applied. View your application status" onPress={onViewStatus} android_ripple={{ color: colors.control }} style={[styles.primary, styles.applied]}>
        <CheckCircle2 size={18} color={colors.successText} /><Text numberOfLines={1} style={[styles.primaryText, styles.appliedText]}>Applied · View status</Text>
      </Pressable>;
    }
    if (isOpenForApplications) {
      return <Pressable accessibilityRole="button" accessibilityLabel={`Apply for ${jobTitle}`} onPress={onApply} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.primary}>
        <Send size={18} color="#ffffff" /><Text numberOfLines={1} style={styles.primaryText}>Apply now</Text>
      </Pressable>;
    }
    return <View accessible accessibilityLabel="Applications are closed for this listing" style={[styles.primary, styles.muted]}><Lock size={16} color={colors.disabledText} /><Text numberOfLines={1} style={styles.mutedText}>Applications closed</Text></View>;
  };

  return <SafeAreaView /* discipline-exempt safe-area-edges: bottom bar or sheet, must not pad its top */ edges={['bottom', 'left', 'right']} style={styles.bar}>
    <View style={styles.row}>
      {canSave && !isCreator ? <JobSaveButton jobId={jobId} jobTitle={jobTitle} variant="outlined" /> : null}
      {renderPrimary()}
    </View>
  </SafeAreaView>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    bar: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    row: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    primary: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    primaryText: { flexShrink: 1, color: '#ffffff', fontSize: 15, fontWeight: '800' },
    outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
    outlineText: { color: colors.accentText },
    applied: { backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.accent },
    appliedText: { color: colors.successText },
    muted: { backgroundColor: colors.disabled },
    mutedText: { flexShrink: 1, color: colors.disabledText, fontSize: 15, fontWeight: '800' },
  });
}
