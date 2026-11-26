import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View, type TextStyle } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminIconButton from '@/components/admin/AdminIconButton';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import { AdminUserContentListSkeleton } from '@/components/admin/AdminSkeletons';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminToolbar from '@/components/admin/AdminToolbar';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import AdminDeletionModal from '@/components/moderation/AdminDeletionModal';
import CachedImage from '@/components/ui/CachedImage';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { adminContentService } from '@/lib/services/AdminContentService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import type { AdminUserContentFilter, AdminUserContentRecord, AdminContentMediaPreview } from '@/lib/types/adminContent';
import type { ModerationDeliveryResult } from '@/lib/types/moderationDelivery';

type AdminUserContentWorkspaceProps = {
  userId: string;
  userDisplayName: string;
  onOpenContent: (content: AdminUserContentRecord) => void;
  /** Bump to reload from the parent (e.g. its pull-to-refresh). */
  refreshSignal?: number;
};

const FILTERS: { id: AdminUserContentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'deleted_by_admin', label: 'Removed' },
];

const THUMB_SIZE = 120;

/** Media viewer chrome sits on dark media in both themes, so it does not follow the app theme. */
const MEDIA_OVERLAY = {
  scrim: 'rgba(0,0,0,0.9)',
  stage: 'black',
  control: 'rgba(15,23,42,0.88)',
  badge: 'rgba(0,0,0,0.62)',
  icon: 'white',
} as const;

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

const getInputStyle = (colors: AppThemeColors): TextStyle => ({
  ...type.body,
  minHeight: 88,
  padding: space.md,
  textAlignVertical: 'top',
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.input,
  color: colors.text,
});

type AdminVideoViewerProps = {
  url: string;
};

function AdminVideoViewer({ url }: AdminVideoViewerProps) {
  return <CustomVideoPlayer url={url} autoPlay={false} />;
}

export default function AdminUserContentWorkspace({
  userId,
  userDisplayName,
  onOpenContent,
  refreshSignal = 0,
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
  // Shown inside the restore dialog: the page-level error banner is hidden behind the open modal.
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
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
      console.error('[AdminUserContentWorkspace.loadContent] Error:', loadError);
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

  // The parent's pull-to-refresh reloads the first page (skips the initial render).
  const lastSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === lastSignalRef.current) return;
    lastSignalRef.current = refreshSignal;
    void loadContent(null, false);
  }, [loadContent, refreshSignal]);

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
    setRestoreError(null);
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
    } catch (restoreFailure: unknown) {
      console.error('[AdminUserContentWorkspace.handleRestore] Error:', restoreFailure);
      void interactionFeedbackService.play('warning');
      setRestoreError(restoreFailure instanceof Error ? restoreFailure.message : 'Content could not be restored.');
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
      console.error('[AdminUserContentWorkspace.handleRetryDelivery] Error:', deliveryError);
      setError(deliveryError instanceof Error ? deliveryError.message : 'Email retry failed.');
    } finally {
      setRestoring(false);
    }
  };

  const renderBody = () => {
    if (loading) return <AdminUserContentListSkeleton />;
    if (visibleContent.length === 0) {
      if (error && content.length === 0) return null;
      return (
        <AdminState
          kind="empty"
          icon="file-text"
          title={filter === 'deleted_by_admin' ? 'No content removed by an administrator.' : 'No content in this view.'}
          filtered={Boolean(search.trim())}
          onClearFilters={() => setSearch('')}
        />
      );
    }
    return visibleContent.map((item) => {
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
      const statusLabel = item.deletedByAdmin ? 'Removed by admin' : item.isDeleted ? 'Deleted by user' : 'Active';
      const statusTone: AdminToneName = item.deletedByAdmin ? 'danger' : item.isDeleted ? 'neutral' : 'positive';
      const danger = getAdminTone(colors, 'danger');
      const overflowItems: AdminOverflowItem[] = !item.isDeleted
        ? [{ key: 'view', label: `Open ${item.contentType === 'lime' ? 'Lime' : 'post'}`, icon: 'external-link', onPress: () => onOpenContent(item) }]
        : [];
      return (
        <View
          key={`${item.contentType}:${item.id}`}
          style={{ overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          {mediaPreviews.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, padding: space.sm }}>
              {mediaPreviews.map((media) => {
                const imageUrl = media.type === 'image' ? media.url : media.thumbnailUrl;
                return (
                  <AdminPressable
                    key={media.id}
                    onPress={() => setMediaTarget(media)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Open preserved ${media.type}`}
                    style={({ pressed }) => ({
                      width: THUMB_SIZE,
                      height: THUMB_SIZE,
                      overflow: 'hidden',
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.control,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    {imageUrl ? (
                      <CachedImage
                        uri={imageUrl}
                        recyclingKey={`${item.contentType}:${item.id}:${media.id}`}
                        accessibilityLabel={`${item.contentType} media preview`}
                        style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                      />
                    ) : <Icon name={media.type === 'video' ? 'play-circle' : 'file'} size={28} color={colors.icon} />}
                    {media.type === 'video' ? (
                      <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: MEDIA_OVERLAY.badge }}>
                        <Icon name="play" size={20} color={MEDIA_OVERLAY.icon} />
                      </View>
                    ) : null}
                  </AdminPressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={{ gap: space.sm, padding: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
              <AdminStatusPill label={statusLabel} tone={statusTone} />
              <Text style={[type.meta, { color: colors.mutedText, textTransform: 'capitalize' }]}>
                {item.contentType} · Created {formatDateTime(item.createdAt)}
              </Text>
            </View>
            <Text numberOfLines={4} style={[type.bodyStrong, { color: colors.text }]}>
              {title}
            </Text>
            <Text selectable style={[type.meta, { color: colors.mutedText }]}>
              {item.contentType === 'lime' ? 'Lime' : 'Post'} ID: {item.id} · {item.visibility}
            </Text>

            {item.deletedByAdmin ? (
              <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: danger.border, backgroundColor: danger.soft }}>
                <Text style={[type.bodyStrong, { color: danger.text }]}>{formatCategory(item.deletionCategory)}</Text>
                <Text style={[type.meta, { color: colors.mutedText }]}>Removed {formatDateTime(item.deletedAt)}</Text>
                <Text style={[type.body, { color: colors.text }]}>{item.deletionReason || 'No deletion reason recorded.'}</Text>
                {item.deletionNotes ? (
                  <Text style={[type.meta, { color: colors.mutedText }]}>Internal note: {item.deletionNotes}</Text>
                ) : null}
                <Text selectable style={[type.meta, { color: colors.mutedText }]}>
                  Removed by {item.adminName || 'Administrator'} · Admin ID: {item.adminId || 'Unavailable'}
                </Text>
                {item.deletionAuditId ? (
                  <Text selectable style={[type.meta, { color: colors.mutedText }]}>Audit ID: {item.deletionAuditId}</Text>
                ) : null}
              </View>
            ) : null}

            {item.deletedByAdmin || !item.isDeleted ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
                {item.deletedByAdmin ? (
                  <AdminButton
                    label="Restore"
                    icon="rotate-ccw"
                    tone="positive"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setRestoreReason('Restored after administrator review.');
                      setRestoreMessage('');
                      setRestoreError(null);
                      setRestoreTarget(item);
                    }}
                  />
                ) : (
                  <AdminButton label="Delete" icon="trash-2" tone="danger" style={{ flex: 1 }} onPress={() => setDeleteTarget(item)} />
                )}
                {overflowItems.length ? <AdminOverflowMenu items={overflowItems} trigger="row" title={title} triggerLabel={`More actions for ${title}`} /> : null}
              </View>
            ) : null}
          </View>
        </View>
      );
    });
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text style={[type.section, { color: colors.text }]}>User content</Text>
        <Text style={[type.body, { color: colors.mutedText }]}>
          Review posts and Limes, audit administrator removals, and restore moderated content.
        </Text>
      </View>

      <AdminToolbar
        segments={{ value: filter, options: FILTERS.map((option) => ({ value: option.id, label: option.label })), onChange: (next) => {
          const nextFilter = FILTERS.find((option) => option.id === next);
          if (nextFilter) setFilter(nextFilter.id);
        } }}
        search={{ value: search, placeholder: 'Search loaded content or audit details', onChange: setSearch }}
      />

      {error ? <AdminState kind="inlineError" message={error} onRetry={() => void loadContent(null, false)} retrying={loading} /> : null}

      {delivery ? (
        <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>
            Notification {delivery.notificationStatus}. Email {delivery.emailStatus}.
          </Text>
          {delivery.emailStatus === 'queued' ? (
            <Text style={[type.meta, { color: colors.mutedText }]}>Automatic retry is scheduled{delivery.nextAttemptAt ? ` for ${new Date(delivery.nextAttemptAt).toLocaleString()}` : ''}.</Text>
          ) : null}
          {delivery.emailStatus === 'failed' ? (
            <AdminButton label="Retry email" icon="refresh-cw" emphasis="ghost" tone="positive" busy={restoring} onPress={() => void handleRetryDelivery()} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </View>
      ) : null}

      {renderBody()}

      {hasMore && !search && !loading ? (
        <AdminButton
          label="Load more content"
          icon="chevron-down"
          tone="neutral"
          fullWidth
          busy={loadingMore}
          disabled={!nextCursor}
          onPress={() => void loadContent(nextCursor, true)}
        />
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

      <AdminDialog
        visible={Boolean(restoreTarget)}
        title={`Restore this ${restoreTarget?.contentType ?? 'content'}?`}
        description="The content will be visible again. Its moderation history remains in the administrator audit log."
        icon="rotate-ccw"
        tone="positive"
        confirmLabel={restoring ? 'Restoring…' : 'Restore'}
        confirmDisabled={!restoreReason.trim()}
        busy={restoring}
        onConfirm={() => void handleRestore()}
        onClose={() => {
          if (!restoring) setRestoreTarget(null);
        }}
      >
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Audit reason (required)</Text>
            <TextInput
              value={restoreReason}
              onChangeText={setRestoreReason}
              maxLength={500}
              multiline
              editable={!restoring}
              accessibilityLabel="Audit reason"
              placeholder="Why is this content being restored?"
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Text style={[type.label, { color: colors.mutedText }]}>Message to the user (optional)</Text>
            <Text style={[type.meta, { color: colors.mutedText }]}>Included in their Ourlime notification and email.</Text>
            <TextInput
              value={restoreMessage}
              onChangeText={setRestoreMessage}
              maxLength={1000}
              multiline
              editable={!restoring}
              accessibilityLabel="Message to the user"
              placeholder="Add any helpful context."
              placeholderTextColor={colors.mutedText}
              style={getInputStyle(colors)}
            />
          </View>
          {restoreError ? <AdminState kind="inlineError" message={restoreError} /> : null}
        </View>
      </AdminDialog>

      <Modal
        visible={Boolean(mediaTarget)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMediaTarget(null)}
      >
        <View style={{ flex: 1, padding: space.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: MEDIA_OVERLAY.scrim }}>
          <AdminIconButton
            icon="x"
            label="Close media preview"
            iconSize={22}
            iconColor={MEDIA_OVERLAY.icon}
            onPress={() => setMediaTarget(null)}
            style={{ position: 'absolute', right: space.lg, top: insets.top + space.sm, zIndex: 2, width: ADMIN_MIN_TOUCH, height: ADMIN_MIN_TOUCH, borderRadius: radius.pill, backgroundColor: MEDIA_OVERLAY.control }}
          />
          <View style={{ width: '100%', height: '78%', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: MEDIA_OVERLAY.stage }}>
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
