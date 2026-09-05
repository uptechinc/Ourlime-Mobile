import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { usePostSubmissionStore } from '@/lib/store/usePostSubmissionStore';
import { postSubmissionService } from '@/lib/services/PostSubmissionService';

type PostUploadProgressBannerProps = { userId: string };

export default function PostUploadProgressBanner({ userId }: PostUploadProgressBannerProps) {
  const { colors } = useAppTheme();
  const submission = usePostSubmissionStore((state) => state.submission);
  if (!submission || submission.userId !== userId) return null;
  const running = submission.status === 'running';
  const failed = submission.status === 'failed';
  const completed = submission.status === 'completed';
  const dismissed = submission.status === 'cancelled';
  const description = postSubmissionService.describe(submission);
  return (
    <View testID="post-upload-progress" style={{ padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {submission.thumbnailUri ? <Image source={{ uri: submission.thumbnailUri }} style={{ width: 42, height: 52, borderRadius: 8 }} /> :
          <Icon name={failed ? 'alert-circle' : completed ? 'check-circle' : 'upload-cloud'} size={28} color={failed ? colors.destructive : colors.accent} />}
        <View style={{ flex: 1 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: failed ? colors.destructiveText : colors.text, fontWeight: '700' }}>{submission.message}</Text>
          {running ? <Text style={{ color: colors.secondaryText, fontSize: 12, marginTop: 3 }}>{description}</Text> : null}
          {(failed || dismissed) && !running ? <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 3 }}>You can dismiss this message.</Text> : null}
        </View>
        {running ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        {running && submission.canCancel ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel post upload" onPress={() => postSubmissionService.cancel()} style={{ padding: 10 }}>
            <Text style={{ color: colors.destructiveText }}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
        {!running ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {submission.canRetry ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Retry post upload"
                onPress={() => postSubmissionService.retry()}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.accent, borderRadius: 16 }}
              >
                <Icon name="refresh-cw" size={14} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 13 }}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss upload status" onPress={() => postSubmissionService.dismiss()} style={{ padding: 8 }}>
              <Icon name="x" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {running ? <View accessibilityRole="progressbar" accessibilityLabel="Media upload progress" accessibilityValue={{ min: 0, max: 100, now: submission.percentage, text: description }} style={{ height: 4, marginTop: 9, backgroundColor: colors.control, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${submission.percentage}%`, backgroundColor: colors.accent }} />
      </View> : null}
      {running && submission.isSlow ? <Text accessibilityLiveRegion="polite" style={{ marginTop: 6, color: colors.warningText, fontSize: 12 }}>No new progress for 30 seconds. Your connection or processing may be slow; the upload has not been confirmed complete.</Text> : null}
    </View>
  );
}
