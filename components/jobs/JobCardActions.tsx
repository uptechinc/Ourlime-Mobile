import { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Bookmark, Share2 } from 'lucide-react-native';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { auth } from '@/lib/firebaseConfig';

type JobCardActionsProps = {
  jobId: string;
  jobTitle: string;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
};

/** Save and Share buttons on a job card (web components/jobs/JobCardActions.tsx). */
export function JobCardActions({ jobId, jobTitle, isSaved, onToggleSave }: JobCardActionsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareUrl = deepLinkService.getJobShareUrl(jobId);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isSaved ? 'Remove from saved' : 'Save job'}
        accessibilityState={{ selected: isSaved }}
        onPress={() => onToggleSave(jobId)}
        style={[styles.button, isSaved && styles.buttonActive]}
      >
        <Bookmark size={18} color={isSaved ? colors.accent : colors.icon} fill={isSaved ? colors.accent : 'transparent'} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share job" onPress={() => setIsShareOpen(true)} style={styles.button}>
        <Share2 size={18} color={colors.icon} />
      </TouchableOpacity>
      {isShareOpen ? (
        <ShareContentSheet
          visible
          currentUserId={auth.currentUser?.uid ?? ''}
          contentLabel="Job"
          title={jobTitle}
          message={`Check out this opportunity on Ourlime: ${jobTitle}`}
          url={shareUrl}
          onClose={() => setIsShareOpen(false)}
        />
      ) : null}
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  buttonActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
});
