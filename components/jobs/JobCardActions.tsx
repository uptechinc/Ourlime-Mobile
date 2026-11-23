import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, Share2 } from 'lucide-react-native';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { auth } from '@/lib/firebaseConfig';

type JobSaveButtonProps = {
  jobId: string;
  jobTitle: string;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
  /** 'plain' is a borderless 44dp icon (top-right of a card); 'outlined' is the 48dp bordered square of the job page bar. */
  variant?: 'plain' | 'outlined';
};

/** Bookmark toggle; useJobsViewer.toggleSave shows the "Job saved" toast. */
export function JobSaveButton({ jobId, jobTitle, isSaved, onToggleSave, variant = 'plain' }: JobSaveButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={isSaved ? `Remove ${jobTitle} from saved` : `Save ${jobTitle}`}
    accessibilityState={{ selected: isSaved }}
    onPress={() => onToggleSave(jobId)}
    hitSlop={4}
    android_ripple={{ color: colors.control, borderless: variant === 'plain' }}
    style={[variant === 'plain' ? styles.plain : styles.outlined, variant === 'outlined' && isSaved && styles.outlinedActive]}
  >
    <Bookmark size={20} color={isSaved ? colors.accentText : colors.icon} fill={isSaved ? colors.accentText : 'transparent'} />
  </Pressable>;
}

type JobShareButtonProps = { jobId: string; jobTitle: string; variant?: 'plain' | 'outlined' };

/** Opens the share sheet with the job's ourlime.com link (ShareContentSheet → contentShareService). */
export function JobShareButton({ jobId, jobTitle, variant = 'plain' }: JobShareButtonProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Share ${jobTitle}`} onPress={() => setIsShareOpen(true)} hitSlop={4} android_ripple={{ color: colors.control, borderless: variant === 'plain' }} style={variant === 'plain' ? styles.plain : styles.outlined}>
      <Share2 size={19} color={colors.icon} />
    </Pressable>
    {isShareOpen ? (
      <ShareContentSheet
        visible
        currentUserId={auth.currentUser?.uid ?? ''}
        contentLabel="Job"
        title={jobTitle}
        message={`Check out this opportunity on Ourlime: ${jobTitle}`}
        url={deepLinkService.getJobShareUrl(jobId)}
        onClose={() => setIsShareOpen(false)}
      />
    ) : null}
  </>;
}

type JobCardActionsProps = {
  jobId: string;
  jobTitle: string;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
};

/** Save and Share side by side (web components/jobs/JobCardActions.tsx). */
export function JobCardActions({ jobId, jobTitle, isSaved, onToggleSave }: JobCardActionsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.row}>
    <JobSaveButton jobId={jobId} jobTitle={jobTitle} isSaved={isSaved} onToggleSave={onToggleSave} />
    <JobShareButton jobId={jobId} jobTitle={jobTitle} />
  </View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 4 },
    plain: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    outlined: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    outlinedActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  });
}
