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
import type { DeletableContentType, PredefinedDeletionCategory, DeletionCategoryOption } from '@/lib/types/adminContent';

export type AdminDeletionModalProps = {
  visible: boolean;
  onClose: () => void;
  contentType: DeletableContentType;
  contentId: string;
  contentTitle?: string;
  authorName?: string;
  onDeleted?: () => void;
};

const CATEGORIES: DeletionCategoryOption[] = [
  { id: 'inappropriate', label: 'Inappropriate Content', description: 'Nudity, sexual violence, or graphic imagery' },
  { id: 'harassment', label: 'Harassment & Bullying', description: 'Hate speech, personal attacks, or intimidation' },
  { id: 'spam', label: 'Spam & Commercial Fraud', description: 'Scams, affiliate spam, misleading commerce, or bots' },
  { id: 'misinformation', label: 'Misinformation', description: 'Harmful falsehoods or manipulated media' },
  { id: 'copyright', label: 'Copyright Infringement', description: 'Unauthorized intellectual property use' },
  { id: 'safety', label: 'Child Safety Violation', description: 'Child exploitation, danger, or harm' },
  { id: 'tos_violation', label: 'Terms of Service Violation', description: 'General platform rules breach' },
  { id: 'custom', label: 'Custom / Other Reason', description: 'Specify a custom reason in the field below' },
];

export default function AdminDeletionModal({
  visible,
  onClose,
  contentType,
  contentId,
  contentTitle,
  authorName,
  onDeleted,
}: AdminDeletionModalProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState<PredefinedDeletionCategory>('inappropriate');
  const [customReason, setCustomReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (selectedCategory === 'custom' && !customReason.trim()) {
      setError('Please type a specific reason for custom deletion.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      void interactionFeedbackService.play('post');

      const result = await adminContentService.deleteContent({
        contentType,
        contentId,
        category: selectedCategory,
        customReason: customReason.trim(),
        additionalNotes: additionalNotes.trim(),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete content');
      }

      void interactionFeedbackService.play('success');
      onClose();
      if (onDeleted) onDeleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete content');
      void interactionFeedbackService.play('warning');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, customReason, additionalNotes, contentType, contentId, onClose, onDeleted]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View
          style={{ backgroundColor: colors.surface }}
          className="rounded-t-3xl border-t border-red-500/30 max-h-[90%] overflow-hidden"
        >
          <View className="w-full items-center pt-3 pb-1">
            <View className="w-10 h-1.5 rounded-full bg-zinc-400/40" />
          </View>

          <View className="flex-row items-center justify-between px-5 pb-3 pt-1 border-b border-zinc-200 dark:border-zinc-800">
            <View className="flex-row items-center space-x-2.5">
              <View className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center">
                <Ionicons name="shield-checkmark" size={18} color="#ef4444" />
              </View>
              <View>
                <Text style={{ color: colors.text }} className="text-base font-bold">
                  Admin Deletion
                </Text>
                <Text style={{ color: colors.mutedText }} className="text-xs capitalize">
                  Removing {contentType}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading} className="p-1">
              <Ionicons name="close" size={22} color={colors.mutedText} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5 space-y-4" keyboardShouldPersistTaps="handled">
            {authorName && (
              <View
                style={{ backgroundColor: isDark ? '#27272a' : '#f4f4f5' }}
                className="p-3 rounded-xl mb-3"
              >
                <Text style={{ color: colors.text }} className="text-xs font-semibold">
                  Author: {authorName}
                </Text>
                <Text style={{ color: colors.mutedText }} className="text-[11px] mt-0.5">
                  The user will receive an in-app notification with this removal reason and an appeal button.
                </Text>
              </View>
            )}

            {error && (
              <View className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                <Text className="text-red-500 text-xs font-medium">{error}</Text>
              </View>
            )}

            <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Mandatory Deletion Reason *
            </Text>
            <View className="space-y-2 mb-3">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={{
                      backgroundColor: isSelected
                        ? (isDark ? '#450a0a' : '#fef2f2')
                        : (isDark ? '#18181b' : '#fafafa'),
                      borderColor: isSelected ? '#ef4444' : (isDark ? '#27272a' : '#e4e4e7'),
                    }}
                    className="flex-row items-center p-3 rounded-2xl border"
                  >
                    <View
                      className={`w-4 h-4 rounded-full border items-center justify-center mr-3 ${
                        isSelected ? 'border-red-500 bg-red-500' : 'border-zinc-400'
                      }`}
                    >
                      {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ color: isSelected ? '#ef4444' : colors.text }}
                        className="text-xs font-bold"
                      >
                        {cat.label}
                      </Text>
                      <Text style={{ color: colors.mutedText }} className="text-[11px]">
                        {cat.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCategory === 'custom' && (
              <View className="mb-3">
                <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
                  Custom Reason Explanation *
                </Text>
                <TextInput
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Specify reason for removal..."
                  placeholderTextColor={colors.mutedText}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                    color: colors.text,
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                  }}
                  className="p-3 rounded-xl border text-xs min-h-[65px]"
                />
              </View>
            )}

            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
                Internal Moderator Notes (Optional)
              </Text>
              <TextInput
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                placeholder="Logged in audit records only..."
                placeholderTextColor={colors.mutedText}
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: isDark ? '#18181b' : '#f4f4f5',
                  color: colors.text,
                  borderColor: isDark ? '#27272a' : '#e4e4e7',
                }}
                className="p-3 rounded-xl border text-xs min-h-[50px]"
              />
            </View>

            <View className="flex-row items-center justify-end space-x-3 pb-8 pt-2">
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
                onPress={handleConfirm}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-red-600 flex-row items-center space-x-1.5 shadow-lg shadow-red-600/30"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={14} color="#ffffff" />
                    <Text className="text-white text-xs font-bold">Delete as Admin</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}