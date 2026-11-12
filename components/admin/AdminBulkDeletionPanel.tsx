import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { adminContentService, DELETABLE_CONTENT_TYPES } from '@/lib/services/AdminContentService';
import type { BulkDeletionItem, DeletableContentType, PredefinedDeletionCategory } from '@/lib/types/adminContent';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const REASONS: readonly { value: PredefinedDeletionCategory; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'harassment', label: 'Harassment & Bullying' },
  { value: 'spam', label: 'Spam & Commercial Fraud' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright Infringement' },
  { value: 'safety', label: 'Child Safety' },
  { value: 'tos_violation', label: 'Terms of Service' },
  { value: 'custom', label: 'Custom' },
];

/** The website's "Bulk Actions" moderation tab: delete many items of one type with one mandatory reason. */
export default function AdminBulkDeletionPanel() {
  const { colors } = useAppTheme();
  const [contentType, setContentType] = useState<DeletableContentType>('post');
  const [contentIds, setContentIds] = useState('');
  const [category, setCategory] = useState<PredefinedDeletionCategory>('spam');
  const [customReason, setCustomReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const items = useMemo<BulkDeletionItem[]>(
    () => [...new Set(contentIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))].map((contentId) => ({ contentType, contentId })),
    [contentIds, contentType]
  );
  const canSubmit = !submitting && items.length > 0 && confirmation === 'DELETE' && (category !== 'custom' || Boolean(customReason.trim()));

  const handleBulkDelete = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage('');
    try {
      const result = await adminContentService.bulkDeleteContent(items, category, customReason);
      const failedNote = result.failed.length ? ` ${result.failed.length} failed: ${result.failed.map((failure) => `${failure.contentId} (${failure.error})`).join('; ')}` : '';
      setMessage(`${result.affectedCount} item(s) deleted, audited, and their authors notified.${failedNote}`);
      if (result.failed.length === 0) {
        setContentIds('');
        setConfirmation('');
      } else {
        setContentIds(result.failed.map((failure) => failure.contentId).join('\n'));
      }
    } catch (bulkError: unknown) {
      console.error('[AdminBulkDeletionPanel.handleBulkDelete] Error:', bulkError instanceof Error ? bulkError.message : bulkError);
      setMessage(bulkError instanceof Error ? bulkError.message : 'Bulk deletion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };
  const chip = (label: string, selected: boolean, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} onPress={onPress} style={{ marginRight: 7, marginBottom: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: selected ? colors.accent : colors.control }}>
      <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.elevated }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Icon name="alert-triangle" size={20} color={colors.destructive} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>Bulk content deletion</Text>
          <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>Every item receives the same mandatory reason, individual notification, and audit entry.</Text>
        </View>
      </View>
      {message ? <Text style={{ marginTop: 12, padding: 11, borderRadius: 12, overflow: 'hidden', color: colors.text, backgroundColor: colors.control }}>{message}</Text> : null}

      <Text style={{ marginTop: 14, marginBottom: 6, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>Content type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {DELETABLE_CONTENT_TYPES.map((type) => chip(type, contentType === type, () => setContentType(type), type))}
      </ScrollView>
      <Text style={{ marginTop: 10, marginBottom: 6, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>Reason</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {REASONS.map((reason) => chip(reason.label, category === reason.value, () => setCategory(reason.value), reason.value))}
      </View>
      <Text style={{ marginTop: 10, marginBottom: 6, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>Content IDs (one per line or comma-separated)</Text>
      <TextInput value={contentIds} onChangeText={setContentIds} multiline autoCapitalize="none" autoCorrect={false} style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]} />
      {category === 'custom' ? (
        <>
          <Text style={{ marginTop: 10, marginBottom: 6, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>Custom reason</Text>
          <TextInput value={customReason} onChangeText={setCustomReason} style={inputStyle} />
        </>
      ) : null}
      <View style={{ marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface }}>
        <Text style={{ color: colors.destructiveText, fontSize: 13 }}>
          Type <Text style={{ fontWeight: '900' }}>DELETE</Text> to confirm deletion of {items.length} item(s).
        </Text>
        <TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.mutedText} style={[inputStyle, { marginTop: 8 }]} />
      </View>
      <TouchableOpacity
        disabled={!canSubmit}
        onPress={() => void handleBulkDelete()}
        style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 14, backgroundColor: colors.destructive, opacity: canSubmit ? 1 : 0.5 }}
      >
        {submitting ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name="trash-2" size={16} color="#ffffff" />}
        <Text style={{ marginLeft: 7, color: '#ffffff', fontWeight: '900' }}>{submitting ? 'Deleting…' : `Delete ${items.length} item(s)`}</Text>
      </TouchableOpacity>
    </View>
  );
}
