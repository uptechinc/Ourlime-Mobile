import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminDialog from './AdminDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminContentService, DELETABLE_CONTENT_TYPES } from '@/lib/services/AdminContentService';
import { adminUserService } from '@/lib/services/AdminUserService';
import type { DeletableContentType, DeletedContentRecord } from '@/lib/types/adminContent';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const TYPE_LABELS: { [type in DeletableContentType]: string } = {
  post: 'Posts',
  comment: 'Comments',
  product: 'Products',
  blog: 'Blogs',
  project: 'Projects',
  community: 'Communities',
  lime: 'Limes',
};
const DEFAULT_RESTORE_REASON = 'Restored after administrator review.';

/** The website's "Deleted Content" moderation tab: every current admin deletion, with restore and ban-author actions. */
export default function AdminDeletedContentPanel() {
  const { colors } = useAppTheme();
  const [records, setRecords] = useState<DeletedContentRecord[]>([]);
  const [selectedType, setSelectedType] = useState<'all' | DeletableContentType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DeletedContentRecord | null>(null);
  const [restoreReason, setRestoreReason] = useState(DEFAULT_RESTORE_REASON);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [banTarget, setBanTarget] = useState<DeletedContentRecord | null>(null);
  const [banReason, setBanReason] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchDeletedContent = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await adminContentService.getDeletedContent());
      setError('');
    } catch (loadError: unknown) {
      console.error('[AdminDeletedContentPanel.fetchDeletedContent] Error:', loadError instanceof Error ? loadError.message : loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load deleted content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeletedContent();
  }, [fetchDeletedContent]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (selectedType !== 'all' && record.contentType !== selectedType) return false;
      if (!normalizedQuery) return true;
      return [record.contentTitle, record.reason, record.authorId, record.contentId].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [records, searchQuery, selectedType]);

  const handleRestore = async (): Promise<void> => {
    if (!restoreTarget || !restoreReason.trim() || processing) return;
    setProcessing(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = await adminContentService.restoreContent({
        contentType: restoreTarget.contentType,
        contentId: restoreTarget.contentId,
        restoreReason: restoreReason.trim(),
        message: restoreMessage.trim() || undefined,
      });
      if (!result.success) throw new Error(result.error || 'Unable to restore content');
      const restoredId = restoreTarget.id;
      setRecords((current) => current.filter((record) => record.id !== restoredId));
      setRestoreTarget(null);
      setRestoreMessage('');
      setSuccessMessage('Content restored. The user was notified in Ourlime and by email.');
    } catch (restoreError: unknown) {
      console.error('[AdminDeletedContentPanel.handleRestore] Error:', restoreError instanceof Error ? restoreError.message : restoreError);
      setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore content');
    } finally {
      setProcessing(false);
    }
  };

  const handleBanAuthor = async (): Promise<void> => {
    if (!banTarget?.authorId || !banReason.trim()) {
      setError('A user and ban reason are required.');
      return;
    }
    if (processing) return;
    setProcessing(true);
    setError('');
    setSuccessMessage('');
    try {
      await adminUserService.updateAccountStatus(banTarget.authorId, 'banned', banReason.trim(), null);
      const bannedAuthorId = banTarget.authorId;
      setRecords((current) => current.map((record) => (record.authorId === bannedAuthorId ? { ...record, authorStatus: 'banned', isAuthorBanned: true } : record)));
      setSuccessMessage('Author banned successfully. Their account is now blocked.');
      setBanTarget(null);
      setBanReason('');
    } catch (banError: unknown) {
      console.error('[AdminDeletedContentPanel.handleBanAuthor] Error:', banError instanceof Error ? banError.message : banError);
      setError(banError instanceof Error ? banError.message : 'Unable to ban the author');
    } finally {
      setProcessing(false);
    }
  };

  const textAreaStyle = { minHeight: 80, textAlignVertical: 'top' as const, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text };

  return (
    <View>
      <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="shield" size={17} color={colors.destructive} />
              <Text style={{ marginLeft: 7, color: colors.text, fontWeight: '900', fontSize: 15 }}>All Deleted Content</Text>
            </View>
            <Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 12 }}>Every current deletion appears here, even when no appeal was submitted.</Text>
          </View>
          <TouchableOpacity onPress={() => void fetchDeletedContent()} accessibilityLabel="Refresh deleted content" style={{ padding: 6 }}>
            <Icon name="refresh-cw" size={17} color={colors.icon} />
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 11 }}>
          <Icon name="search" size={16} color={colors.mutedText} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search title, reason, user, or content ID" placeholderTextColor={colors.mutedText} style={{ flex: 1, padding: 10, color: colors.text }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {(['all', ...DELETABLE_CONTENT_TYPES] as const).map((type) => (
            <TouchableOpacity key={type} onPress={() => setSelectedType(type)} style={{ marginRight: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: selectedType === type ? colors.accent : colors.control }}>
              <Text style={{ color: selectedType === type ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{type === 'all' ? 'All types' : TYPE_LABELS[type]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? <Text style={{ marginBottom: 10, padding: 11, borderRadius: 12, overflow: 'hidden', color: colors.destructiveText, backgroundColor: colors.destructiveSurface }}>{error}</Text> : null}
      {successMessage ? <Text style={{ marginBottom: 10, padding: 11, borderRadius: 12, overflow: 'hidden', color: colors.successText, backgroundColor: colors.successSurface }}>{successMessage}</Text> : null}

      {loading ? (
        [0, 1, 2].map((rowIndex) => (
          <View key={rowIndex} style={{ marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated }}>
            <Skeleton width={120} height={11} />
            <Skeleton width="70%" height={15} style={{ marginTop: 10 }} />
            <Skeleton width="90%" height={12} style={{ marginTop: 8 }} />
            <Skeleton width="55%" height={11} style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Skeleton width={90} height={32} borderRadius={11} />
              <Skeleton width={110} height={32} borderRadius={11} style={{ marginLeft: 8 }} />
            </View>
          </View>
        ))
      ) : filteredRecords.length === 0 ? (
        <Text style={{ padding: 30, textAlign: 'center', color: colors.mutedText }}>No deleted content matches these filters.</Text>
      ) : (
        filteredRecords.map((record) => (
          <View key={record.id} style={{ marginBottom: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: colors.destructiveText, backgroundColor: colors.destructiveSurface }}>{record.contentType}</Text>
              <Text style={{ marginLeft: 8, color: colors.mutedText, fontSize: 11 }}>{record.deletedAt ? new Date(record.deletedAt).toLocaleString() : 'Unknown deletion date'}</Text>
            </View>
            <Text style={{ marginTop: 8, color: colors.text, fontWeight: '900', fontSize: 15 }}>{record.contentTitle}</Text>
            <Text style={{ marginTop: 4, color: colors.secondaryText, fontSize: 13 }}>{record.reason}</Text>
            <Text selectable style={{ marginTop: 6, color: colors.mutedText, fontSize: 11 }}>Author: {record.authorId || 'Unknown'} · Removed by {record.adminName}</Text>
            <Text selectable style={{ marginTop: 2, color: colors.mutedText, fontSize: 11 }}>Content ID: {record.contentId}</Text>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity
                disabled={processing}
                onPress={() => { setRestoreTarget(record); setRestoreReason(DEFAULT_RESTORE_REASON); setRestoreMessage(''); }}
                style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.successSurface }}
              >
                <Icon name="rotate-ccw" size={14} color={colors.successText} />
                <Text style={{ marginLeft: 6, color: colors.successText, fontWeight: '800', fontSize: 12 }}>Restore</Text>
              </TouchableOpacity>
              {record.isAuthorBanned ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.control }}>
                  <Icon name="slash" size={14} color={colors.mutedText} />
                  <Text style={{ marginLeft: 6, color: colors.mutedText, fontWeight: '800', fontSize: 12 }}>Author Banned</Text>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={!record.authorId || processing}
                  onPress={() => { setBanTarget(record); setBanReason(`Repeated or serious violation connected to deleted ${record.contentType}: ${record.reason}`); }}
                  style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.destructiveSurface, opacity: record.authorId ? 1 : 0.5 }}
                >
                  <Icon name="slash" size={14} color={colors.destructiveText} />
                  <Text style={{ marginLeft: 6, color: colors.destructiveText, fontWeight: '800', fontSize: 12 }}>Ban Author</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}

      <AdminDialog
        visible={Boolean(restoreTarget)}
        title="Restore content"
        description={restoreTarget ? `Restore "${restoreTarget.contentTitle}"? The author is notified in Ourlime and by email.` : ''}
        confirmLabel={processing ? 'Restoring…' : 'Confirm Restore'}
        busy={processing}
        confirmDisabled={!restoreReason.trim()}
        onConfirm={() => void handleRestore()}
        onClose={() => { setRestoreTarget(null); setRestoreMessage(''); }}
      >
        <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '700' }}>Audit reason (required)</Text>
        <TextInput value={restoreReason} onChangeText={setRestoreReason} maxLength={500} multiline style={textAreaStyle} />
        <Text style={{ marginTop: 12, marginBottom: 6, color: colors.text, fontWeight: '700' }}>Message to the user <Text style={{ color: colors.mutedText, fontWeight: '400' }}>(optional)</Text></Text>
        <TextInput value={restoreMessage} onChangeText={setRestoreMessage} maxLength={1000} multiline placeholder="Included in their Ourlime notification and email." placeholderTextColor={colors.mutedText} style={textAreaStyle} />
      </AdminDialog>

      <AdminDialog
        visible={Boolean(banTarget)}
        title="Ban author"
        description={banTarget ? `Ban the author of "${banTarget.contentTitle}"? Their account is blocked.` : ''}
        confirmLabel={processing ? 'Banning…' : 'Confirm Ban'}
        tone="danger"
        busy={processing}
        confirmDisabled={!banReason.trim()}
        onConfirm={() => void handleBanAuthor()}
        onClose={() => { setBanTarget(null); setBanReason(''); }}
      >
        <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '700' }}>Required ban reason</Text>
        <TextInput value={banReason} onChangeText={setBanReason} multiline style={textAreaStyle} />
      </AdminDialog>
    </View>
  );
}
