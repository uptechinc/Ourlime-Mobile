import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Icon from 'react-native-vector-icons/Feather';
import CachedImage from '@/components/ui/CachedImage';
import AdminDeletionModal from '@/components/moderation/AdminDeletionModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { adminContentService } from '@/lib/services/AdminContentService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type {
  AdminUserContentFilter,
  AdminUserContentRecord,
  AdminContentMediaPreview,
} from '@/lib/types/adminContent';
import type { ModerationDeliveryResult } from '@/lib/types/moderationDelivery';

type AdminUserContentWorkspaceProps = {
  userId: string;
  userDisplayName: string;
  onOpenContent: (content: AdminUserContentRecord) => void;
};

const FILTERS: { id: AdminUserContentFilter; label: string }[] = [
  { id: 'all', label: 'All content' },
  { id: 'active', label: 'Active' },
  { id: 'deleted_by_admin', label: 'Deleted by admin' },
];

const formatDateTime = (value: string | null): string => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
};

const formatCategory = (value: string | null): string => {
  if (!value) return 'Uncategorized';
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

type AdminVideoViewerProps = {
  url: string;
};

function AdminVideoViewer({ url }: AdminVideoViewerProps) {
  const player = useVideoPlayer(url, (videoPlayer) => {
    videoPlayer.loop = false;
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

export default function AdminUserContentWorkspace({
  userId,
  userDisplayName,
  onOpenContent,
}: AdminUserContentWorkspaceProps) {
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<AdminUserContentFilter>('all');
  const [content, setContent] = useState<AdminUserContentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserContentRecord | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminUserContentRecord | null>(null);
  const [restoreReason, setRestoreReason] = useState('Restored after administrator review.');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<AdminContentMediaPreview | null>(null);
  const [delivery, setDelivery] = useState<ModerationDeliveryResult | null>(null);

  const loadContent = useCallback(async (cursor: string | null, append: boolean): Promise<void> => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await adminContentService.getUserContent(userId, filter, cursor, 20);
      setContent((current) => append
        ? Array.from(new Map(
          [...current, ...page.items].map((item) => [`${item.contentType}:${item.id}`, item])
        ).values())
        : page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'User content could not be loaded.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, userId]);

  useEffect(() => {
    setContent([]);
    setSearch('');
    setNextCursor(null);
    setHasMore(false);
    void loadContent(null, false);
  }, [loadContent]);

  const visibleContent = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return content;
    return content.filter((item) => [
      item.caption,
      item.description,
      item.id,
      item.deletionReason,
      item.deletionCategory,
      item.adminName,
      item.adminId,
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [content, search]);

  const handleRestore = async (): Promise<void> => {
    if (!restoreTarget || restoring || !restoreReason.trim()) return;
    setRestoring(true);
    setError(null);
    try {
      const result = await adminContentService.restoreContent({
        contentType: restoreTarget.contentType,
        contentId: restoreTarget.id,
        restoreReason: restoreReason.trim(),
        message: restoreMessage.trim() || undefined,
      });
      if (!result.success) throw new Error(result.error || 'Content could not be restored.');
      setDelivery(result.delivery ?? null);
      void interactionFeedbackService.play('success');
      setRestoreTarget(null);
      setRestoreMessage('');
      await loadContent(null, false);
    } catch (restoreError: unknown) {
      void interactionFeedbackService.play('warning');
      setError(restoreError instanceof Error ? restoreError.message : 'Content could not be restored.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRetryDelivery = async (): Promise<void> => {
    if (!delivery || restoring) return;
    setRestoring(true);
    try {
      setDelivery(await adminContentService.retryDelivery(delivery.eventId));
    } catch (deliveryError: unknown) {
      setError(deliveryError instanceof Error ? deliveryError.message : 'Email retry failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
            User content
          </Text>
          <Text style={{ marginTop: 4, color: colors.mutedText, lineHeight: 18 }}>
            Review posts and Limes, audit administrator removals, and restore moderated content.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void loadContent(null, false)}
          disabled={loading}
          accessibilityLabel="Refresh user content"
          style={{
            marginLeft: 10,
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.control,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {loading ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon name="refresh-cw" size={17} color={colors.icon} />}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, flexGrow: 0 }}>
        {FILTERS.map((option) => {
          const selected = filter === option.id;
          const destructive = option.id === 'deleted_by_admin';
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => setFilter(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                marginRight: 8,
                borderRadius: 999,
                paddingHorizontal: 13,
                paddingVertical: 9,
                backgroundColor: selected
                  ? destructive ? colors.destructiveSurface : colors.successSurface
                  : colors.control,
                borderWidth: 1,
                borderColor: selected
                  ? destructive ? colors.destructiveText : colors.successText
                  : colors.border,
              }}
            >
              <Text style={{
                color: selected
                  ? destructive ? colors.destructiveText : colors.successText
                  : colors.secondaryText,
                fontSize: 12,
                fontWeight: '900',
              }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 13,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.input,
        paddingHorizontal: 11,
      }}>
        <Icon name="search" size={16} color={colors.icon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search loaded content or audit details"
          placeholderTextColor={colors.mutedText}
          style={{ flex: 1, padding: 11, color: colors.text, fontSize: 13 }}
        />
      </View>

      {error ? (
        <View style={{ marginTop: 12, borderRadius: 13, padding: 12, backgroundColor: colors.destructiveSurface }}>
          <Text style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text>
          <TouchableOpacity onPress={() => void loadContent(null, false)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.destructiveText, fontWeight: '900' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {delivery ? (
        <View style={{ marginTop: 12, borderRadius: 13, padding: 12, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            Notification {delivery.notificationStatus}. Email {delivery.emailStatus}.
          </Text>
          {delivery.emailStatus === 'queued' ? (
            <Text style={{ marginTop: 4, color: colors.mutedText }}>Automatic retry is scheduled{delivery.nextAttemptAt ? ` for ${new Date(delivery.nextAttemptAt).toLocaleString()}` : ''}.</Text>
          ) : null}
          {delivery.emailStatus === 'failed' ? (
            <TouchableOpacity onPress={() => void handleRetryDelivery()} disabled={restoring} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.accent, fontWeight: '900' }}>Retry email</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 44, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 9, color: colors.mutedText }}>Loading user content…</Text>
        </View>
      ) : visibleContent.length === 0 ? (
        <View style={{ marginTop: 14, padding: 24, alignItems: 'center', borderRadius: 15, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }}>
          <Icon name="file-text" size={25} color={colors.icon} />
          <Text style={{ marginTop: 8, color: colors.text, fontWeight: '900', textAlign: 'center' }}>
            {search ? 'No loaded content matches your search.' : filter === 'deleted_by_admin' ? 'No content deleted by an administrator.' : 'No content in this view.'}
          </Text>
        </View>
      ) : visibleContent.map((item) => {
        const title = item.caption || item.description || `Untitled ${item.contentType}`;
        const mediaPreviews = Array.isArray(item.mediaPreviews) && item.mediaPreviews.length > 0
          ? item.mediaPreviews
          : item.mediaPreviewUrl
            ? [{
                id: `${item.id}:legacy`,
                url: item.mediaPreviewUrl,
                type: item.mediaPreviewType === 'image' ? 'image' as const : item.mediaPreviewType === 'video' ? 'video' as const : 'media' as const,
                thumbnailUrl: null,
              }]
            : [];
        const statusLabel = item.deletedByAdmin ? 'Deleted by admin' : item.isDeleted ? 'Deleted by user' : 'Active';
        return (
          <View
            key={`${item.contentType}:${item.id}`}
            style={{
              marginTop: 13,
              overflow: 'hidden',
              borderRadius: 16,
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {mediaPreviews.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8 }}>
                {mediaPreviews.map((media) => {
                  const imageUrl = media.type === 'image' ? media.url : media.thumbnailUrl;
                  return (
                    <TouchableOpacity
                      key={media.id}
                      onPress={() => setMediaTarget(media)}
                      accessibilityLabel={`Open preserved ${media.type}`}
                      style={{
                        width: 138,
                        height: 138,
                        marginRight: 8,
                        overflow: 'hidden',
                        borderRadius: 13,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.control,
                      }}
                    >
                      {imageUrl ? (
                        <CachedImage
                          uri={imageUrl}
                          recyclingKey={`${item.contentType}:${item.id}:${media.id}`}
                          accessibilityLabel={`${item.contentType} media preview`}
                          style={{ width: 138, height: 138 }}
                        />
                      ) : <Icon name={media.type === 'video' ? 'play-circle' : 'file'} size={30} color={colors.icon} />}
                      {media.type === 'video' ? (
                        <View style={{ position: 'absolute', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' }}>
                          <Icon name="play" size={20} color="#ffffff" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <View style={{
                  marginRight: 7,
                  marginBottom: 5,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: item.deletedByAdmin
                    ? colors.destructiveSurface
                    : item.isDeleted ? colors.control : colors.successSurface,
                }}>
                  <Text style={{
                    color: item.deletedByAdmin
                      ? colors.destructiveText
                      : item.isDeleted ? colors.mutedText : colors.successText,
                    fontSize: 10,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                  }}>
                    {statusLabel}
                  </Text>
                </View>
                <Text style={{ marginBottom: 5, color: colors.mutedText, fontSize: 11, textTransform: 'capitalize' }}>
                  {item.contentType} · Created {formatDateTime(item.createdAt)}
                </Text>
              </View>
              <Text numberOfLines={4} style={{ marginTop: 4, color: colors.text, fontWeight: '800', lineHeight: 20 }}>
                {title}
              </Text>
              <Text selectable style={{ marginTop: 5, color: colors.mutedText, fontSize: 10 }}>
                {item.contentType === 'lime' ? 'Lime' : 'Post'} ID: {item.id} · {item.visibility}
              </Text>

              {item.deletedByAdmin ? (
                <View style={{ marginTop: 11, padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface }}>
                  <Text style={{ color: colors.destructiveText, fontWeight: '900' }}>
                    {formatCategory(item.deletionCategory)}
                  </Text>
                  <Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>
                    Deleted {formatDateTime(item.deletedAt)}
                  </Text>
                  <Text style={{ marginTop: 7, color: colors.text, lineHeight: 18 }}>
                    {item.deletionReason || 'No deletion reason recorded.'}
                  </Text>
                  {item.deletionNotes ? (
                    <Text style={{ marginTop: 5, color: colors.mutedText, fontSize: 12 }}>
                      Internal note: {item.deletionNotes}
                    </Text>
                  ) : null}
                  <Text selectable style={{ marginTop: 7, color: colors.mutedText, fontSize: 11 }}>
                    Removed by {item.adminName || 'Administrator'} · Admin ID: {item.adminId || 'Unavailable'}
                  </Text>
                  {item.deletionAuditId ? (
                    <Text selectable style={{ marginTop: 2, color: colors.mutedText, fontSize: 10 }}>
                      Audit ID: {item.deletionAuditId}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={{ marginTop: 12, flexDirection: 'row' }}>
                {!item.isDeleted ? (
                  <TouchableOpacity
                    onPress={() => onOpenContent(item)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Icon name="external-link" size={14} color={colors.icon} />
                    <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '800' }}>View</Text>
                  </TouchableOpacity>
                ) : null}
                {item.deletedByAdmin ? (
                  <TouchableOpacity
                    onPress={() => {
                      setRestoreReason('Restored after administrator review.');
                      setRestoreMessage('');
                      setRestoreTarget(item);
                    }}
                    style={{ flex: 1, marginLeft: item.isDeleted ? 0 : 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.successSurface }}
                  >
                    <Icon name="rotate-ccw" size={14} color={colors.successText} />
                    <Text style={{ marginLeft: 6, color: colors.successText, fontWeight: '900' }}>Restore</Text>
                  </TouchableOpacity>
                ) : !item.isDeleted ? (
                  <TouchableOpacity
                    onPress={() => setDeleteTarget(item)}
                    style={{ flex: 1, marginLeft: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.destructiveSurface }}
                  >
                    <Icon name="trash-2" size={14} color={colors.destructiveText} />
                    <Text style={{ marginLeft: 6, color: colors.destructiveText, fontWeight: '900' }}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {hasMore && !search ? (
        <TouchableOpacity
          disabled={loadingMore || !nextCursor}
          onPress={() => void loadContent(nextCursor, true)}
          style={{ marginTop: 14, alignItems: 'center', borderRadius: 13, padding: 12, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border, opacity: loadingMore ? 0.65 : 1 }}
        >
          {loadingMore ? <ActivityIndicator size="small" color={colors.accent} /> : (
            <Text style={{ color: colors.text, fontWeight: '900' }}>Load more content</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <AdminDeletionModal
        visible={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        contentType={deleteTarget?.contentType ?? 'post'}
        contentId={deleteTarget?.id ?? ''}
        contentTitle={deleteTarget?.caption || deleteTarget?.description || 'Content'}
        authorName={userDisplayName}
        onDeleted={() => {
          setDeleteTarget(null);
          void loadContent(null, false);
        }}
      />
      <Modal
        visible={Boolean(restoreTarget)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!restoring) setRestoreTarget(null);
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(2,6,23,0.72)' }}>
          <View style={{ maxHeight: '88%', overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
                    Restore this {restoreTarget?.contentType ?? 'content'}?
                  </Text>
                  <Text style={{ marginTop: 7, color: colors.mutedText, lineHeight: 20 }}>
                    The content will be visible again. Its moderation history remains in the administrator audit log.
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityLabel="Close restore form"
                  disabled={restoring}
                  onPress={() => setRestoreTarget(null)}
                  hitSlop={10}
                  style={{ marginLeft: 12, padding: 4 }}
                >
                  <Icon name="x" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>

              <Text style={{ marginTop: 20, color: colors.text, fontWeight: '800' }}>Audit reason (required)</Text>
              <TextInput
                value={restoreReason}
                onChangeText={setRestoreReason}
                maxLength={500}
                multiline
                textAlignVertical="top"
                placeholder="Why is this content being restored?"
                placeholderTextColor={colors.mutedText}
                style={{ minHeight: 90, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 13, color: colors.text, backgroundColor: colors.control }}
              />

              <Text style={{ marginTop: 16, color: colors.text, fontWeight: '800' }}>Message to the user (optional)</Text>
              <Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 12 }}>Included in their Ourlime notification and email.</Text>
              <TextInput
                value={restoreMessage}
                onChangeText={setRestoreMessage}
                maxLength={1000}
                multiline
                textAlignVertical="top"
                placeholder="Add any helpful context."
                placeholderTextColor={colors.mutedText}
                style={{ minHeight: 100, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 13, color: colors.text, backgroundColor: colors.control }}
              />

              <View style={{ marginTop: 20, flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  disabled={restoring}
                  onPress={() => setRestoreTarget(null)}
                  style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }}
                >
                  <Text style={{ color: colors.text, fontWeight: '900' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={restoring || !restoreReason.trim()}
                  onPress={() => void handleRestore()}
                  style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.accent, opacity: restoring || !restoreReason.trim() ? 0.55 : 1 }}
                >
                  {restoring ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name="rotate-ccw" size={17} color="#ffffff" />}
                  <Text style={{ color: '#ffffff', fontWeight: '900' }}>{restoring ? 'Restoring…' : 'Restore'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(mediaTarget)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMediaTarget(null)}
      >
        <View style={{ flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <TouchableOpacity
            onPress={() => setMediaTarget(null)}
            accessibilityLabel="Close media preview"
            style={{ position: 'absolute', right: 18, top: 52, zIndex: 2, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.88)' }}
          >
            <Icon name="x" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={{ width: '100%', height: '78%', overflow: 'hidden', borderRadius: 16, backgroundColor: '#000000' }}>
            {mediaTarget?.type === 'video' ? (
              <AdminVideoViewer url={mediaTarget.url} />
            ) : mediaTarget ? (
              <CachedImage
                uri={mediaTarget.url}
                recyclingKey={`admin-media-viewer:${mediaTarget.id}`}
                accessibilityLabel="Preserved content media"
                style={{ width: '100%', height: '100%' }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
