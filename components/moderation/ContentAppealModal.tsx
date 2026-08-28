import { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { adminContentService } from '@/lib/services/AdminContentService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type { DeletableContentType } from '@/lib/types/adminContent';

export type ContentAppealModalProps = {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  contentType: DeletableContentType;
  contentTitle?: string;
  deletionReason?: string;
  onSubmitted?: () => void;
};

export default function ContentAppealModal({
  visible,
  onClose,
  contentId,
  contentType,
  contentTitle,
  deletionReason,
  onSubmitted,
}: ContentAppealModalProps) {
  const { colors, isDark } = useAppTheme();
  const [appealReason, setAppealReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!appealReason.trim()) {
      setError('Please explain why your content should be restored.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      void interactionFeedbackService.play('post');

      const result = await adminContentService.submitAppeal({
        contentId,
        contentType,
        deletionReason: deletionReason || 'Policy Violation',
        appealReason: appealReason.trim(),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit appeal');
      }

      setSubmitted(true);
      void interactionFeedbackService.play('success');
      if (onSubmitted) onSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit appeal');
      void interactionFeedbackService.play('warning');
    } finally {
      setLoading(false);
    }
  }, [appealReason, contentId, contentType, deletionReason, onSubmitted]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View
          style={{ backgroundColor: colors.surface }}
          className="rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 max-h-[85%] overflow-hidden"
        >
          <View className="w-full items-center pt-3 pb-1">
            <View className="w-10 h-1.5 rounded-full bg-zinc-400/40" />
          </View>

          <View className="flex-row items-center justify-between px-5 pb-3 pt-1 border-b border-zinc-200 dark:border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <Ionicons name="scale-outline" size={20} color={colors.accent} />
              <Text style={{ color: colors.text }} className="text-base font-bold">
                Content Restoration Appeal
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={22} color={colors.mutedText} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View className="p-8 items-center space-y-3">
              <View className="w-14 h-14 rounded-full bg-emerald-500/10 items-center justify-center mb-2">
                <Ionicons name="checkmark-circle" size={36} color="#10b981" />
              </View>
              <Text style={{ color: colors.text }} className="text-base font-bold text-center">
                Appeal Submitted
              </Text>
              <Text style={{ color: colors.mutedText }} className="text-xs text-center px-4 leading-relaxed">
                Our moderation team has received your restoration request. You will be notified when your appeal is reviewed.
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="mt-6 px-8 py-3 rounded-2xl bg-emerald-600 items-center"
              >
                <Text className="text-white text-xs font-bold">Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView className="p-5 space-y-4" keyboardShouldPersistTaps="handled">
              <View
                style={{ backgroundColor: isDark ? '#450a0a' : '#fef2f2' }}
                className="p-3.5 rounded-2xl border border-red-500/20 mb-3"
              >
                <Text className="text-red-500 text-xs font-bold uppercase tracking-wider">
                  Removed Item: {contentType}
                </Text>
                {contentTitle && (
                  <Text style={{ color: colors.text }} className="text-xs italic mt-0.5">
                    "{contentTitle}"
                  </Text>
                )}
                {deletionReason && (
                  <Text className="text-red-500 text-xs mt-1">
                    <Text className="font-bold">Reason:</Text> {deletionReason}
                  </Text>
                )}
              </View>

              {error && (
                <View className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                  <Text className="text-red-500 text-xs font-medium">{error}</Text>
                </View>
              )}

              <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
                Why should this content be restored? *
              </Text>
              <TextInput
                value={appealReason}
                onChangeText={setAppealReason}
                placeholder="Explain why you believe this content complies with our community guidelines..."
                placeholderTextColor={colors.mutedText}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                  color: colors.text,
                  borderColor: isDark ? '#27272a' : '#e4e4e7',
                }}
                className="p-3.5 rounded-2xl border text-xs min-h-[90px]"
              />

              <View className="flex-row items-center justify-end space-x-3 pb-8 pt-4">
                <TouchableOpacity
                  onPress={onClose}
                  disabled={loading}
                  style={{ backgroundColor: isDark ? '#27272a' : '#e4e4e7' }}
                  className="px-4 py-2.5 rounded-xl mr-2"
                >
                  <Text style={{ color: colors.text }} className="text-xs font-semibold">
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 flex-row items-center space-x-1.5 shadow-lg shadow-emerald-600/30"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white text-xs font-bold">Submit Appeal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}