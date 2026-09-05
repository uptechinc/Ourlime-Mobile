import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { openGraphService, extractDomain, type LinkPreviewData } from '@/lib/services/OpenGraphService';
import { useDeepLinkNavigation } from '@/lib/hooks/useDeepLinkNavigation';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';
import { SharedPostCard } from '@/components/chat/SharedPostCard';
import { sharedPostPresentationService } from '@/lib/services/SharedPostPresentationService';

type LinkPreviewMessageProps = {
  url: string;
  isOwn?: boolean;
  messageId?: string;
  instanceId?: string;
};

const videoThumbnailCache = new Map<string, string>();

/**
 * LinkPreviewMessage — Card shown inside chat bubbles for messages containing links.
 */
export function LinkPreviewMessage({
  url,
  isOwn = false,
  messageId,
  instanceId,
}: LinkPreviewMessageProps) {
  const { openLink } = useDeepLinkNavigation();
  const { colors } = useAppTheme();
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedVideoThumbnail, setResolvedVideoThumbnail] = useState<string | null>(null);
  const [videoThumbnailFailed, setVideoThumbnailFailed] = useState(false);
  const [thumbnailFailureVersion, setThumbnailFailureVersion] = useState(0);
  const failedThumbnailUrlRef = useRef<string | null>(null);
  const sharedContent = useMemo(() => sharedContentMessageService.parse(url), [url]);
  const effectiveInstanceId = instanceId || messageId || (sharedContent ? `${sharedContent.mobileRoute}:${url}` : url);

  const handleOpenLink = (destination: string): void => {
    sharedPostPresentationService.deactivateAllPlayers();
    void openLink(destination);
  };

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    openGraphService.fetchPreview(url).then((data) => {
      if (isMounted) {
        failedThumbnailUrlRef.current = null;
        setThumbnailFailureVersion(0);
        setPreview(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  useEffect(() => {
    const entity = preview?.entity;
    setVideoThumbnailFailed(false);
    if (entity?.kind !== 'lime') {
      setResolvedVideoThumbnail(null);
      return;
    }
    if (entity.thumbnailUrl && failedThumbnailUrlRef.current !== entity.thumbnailUrl) {
      setResolvedVideoThumbnail(entity.thumbnailUrl);
      return;
    }
    if (!entity.videoUrl) {
      setResolvedVideoThumbnail(null);
      return;
    }
    const cachedThumbnail = videoThumbnailCache.get(entity.videoUrl);
    if (cachedThumbnail) {
      setResolvedVideoThumbnail(cachedThumbnail);
      return;
    }

    let cancelled = false;
    setResolvedVideoThumbnail(null);
    void limeThumbnailService.createThumbnailAtTime(entity.videoUrl, 0.1)
      .then((thumbnailUri) => {
        if (cancelled) return;
        videoThumbnailCache.set(entity.videoUrl ?? '', thumbnailUri);
        setResolvedVideoThumbnail(thumbnailUri);
      })
      .catch(() => {
        if (!cancelled) setVideoThumbnailFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, thumbnailFailureVersion]);

  const handleMediaImageError = (): void => {
    const failedUrl = resolvedVideoThumbnail;
    if (!failedUrl) return;
    if (failedUrl.startsWith('file:') || failedUrl.startsWith('content:')) {
      setResolvedVideoThumbnail(null);
      setVideoThumbnailFailed(true);
      return;
    }
    failedThumbnailUrlRef.current = failedUrl;
    setResolvedVideoThumbnail(null);
    setThumbnailFailureVersion((currentVersion) => currentVersion + 1);
  };

  const domain = preview?.domain ?? extractDomain(url);
  const entityKind = preview?.entity?.kind ?? sharedContent?.kind;
  const isLime = entityKind === 'lime';
  const isSharedPost = entityKind === 'post';
  const isMediaCard = isLime;
  const mediaImage = resolvedVideoThumbnail || preview?.image;
  const canResolveVideoThumbnail = preview?.entity?.kind === 'lime'
    && Boolean(preview.entity.thumbnailUrl || preview.entity.videoUrl);
  const isResolvingVideoThumbnail = isMediaCard
    && canResolveVideoThumbnail
    && !mediaImage
    && !videoThumbnailFailed;
  const fallbackTitle = sharedContent?.summary ?? url;
  const cardBackground = isOwn ? 'rgba(255,255,255,0.14)' : colors.elevated;
  const cardBorder = isOwn ? 'rgba(255,255,255,0.25)' : colors.border;
  const primaryText = isOwn ? '#ffffff' : colors.text;
  const secondaryText = isOwn ? 'rgba(255,255,255,0.76)' : colors.mutedText;

  if (preview?.entity?.unavailable) {
    const isLimeCard = isLime || preview.entity.kind === 'lime';
    const notice = preview.entity.unavailableReason === 'admin_taken_down'
      ? `This ${isLimeCard ? 'Lime' : 'post'} was removed by an admin.`
      : `This ${isLimeCard ? 'Lime' : 'post'} was deleted.`;
    return (
      <View
        accessibilityLabel={`Shared ${isLimeCard ? 'Lime' : 'post'} unavailable`}
        style={{ width: 280, maxWidth: '100%', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontStyle: 'italic', color: colors.mutedText, fontSize: 13, textAlign: 'center' }}>{notice}</Text>
      </View>
    );
  }

  if (isSharedPost) {
    if (isLoading) {
      return <View accessibilityLabel="Loading shared post" style={{ width: 280, height: 300, maxWidth: '100%', borderRadius: 20, backgroundColor: colors.control }} />;
    }
    if (preview?.entity?.post) return <SharedPostCard preview={preview} path={sharedContent?.mobileRoute ?? preview.entity.path ?? url} instanceId={effectiveInstanceId} />;
    return (
      <View
        accessibilityLabel="Shared post unavailable"
        style={{ width: 280, maxWidth: '100%', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontStyle: 'italic', color: colors.mutedText, fontSize: 13, textAlign: 'center' }}>This post was deleted.</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => handleOpenLink(url)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={sharedContent ? `Open shared ${sharedContent.kind}` : `Open ${domain}`}
      style={{
        marginTop: 6,
        borderRadius: isMediaCard ? 22 : 18,
        overflow: 'hidden',
        backgroundColor: isMediaCard ? 'transparent' : cardBackground,
        borderWidth: isMediaCard ? 0 : 1,
        borderColor: isMediaCard ? 'transparent' : cardBorder,
        minWidth: 220,
      }}
    >
      {isMediaCard ? (
        <View style={{ width: 230, height: isLime ? 355 : 300, borderRadius: 22, overflow: 'hidden', backgroundColor: '#15171a', alignItems: 'center', justifyContent: 'center' }}>
          {mediaImage ? (
            <Image
              source={{ uri: mediaImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={handleMediaImageError}
            />
          ) : isLoading || isResolvingVideoThumbnail ? (
            <ActivityIndicator size="large" color="#10b981" />
          ) : (
            <Icon name="video" size={42} color="#10b981" />
          )}
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          <View style={{ position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
          </View>
          <View style={{ position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center' }}>
            {preview?.entity?.creatorImageUrl ? (
              <Image source={{ uri: preview.entity.creatorImageUrl }} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#27272a' }} />
            ) : null}
            <View style={{ flex: 1, marginLeft: preview?.entity?.creatorImageUrl ? 8 : 0 }}>
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                {preview?.entity?.creatorDisplayName ?? preview?.title ?? 'Ourlime Lime'}
              </Text>
              {preview?.entity?.creatorUsername ? (
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                  @{preview.entity.creatorUsername}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          style={{ width: '100%', height: 145, backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : colors.control }}
          resizeMode="cover"
        />
      ) : null}

      {!isMediaCard ? <View style={{ padding: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Icon name="globe" size={11} color={isOwn ? 'rgba(255,255,255,0.8)' : '#10b981'} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: isOwn ? 'rgba(255,255,255,0.85)' : '#10b981', marginLeft: 4, textTransform: 'lowercase' }}>
            {sharedContent?.summary ?? preview?.siteName ?? domain}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? '#ffffff' : '#10b981'} style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
        ) : (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: primaryText,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {preview?.title ?? fallbackTitle}
          </Text>
        )}

        {preview?.description && (
          <Text
            style={{
              fontSize: 11,
              color: secondaryText,
              marginTop: 3,
              lineHeight: 15,
            }}
            numberOfLines={2}
          >
            {preview.description}
          </Text>
        )}
      </View> : null}
    </TouchableOpacity>
  );
}

type LinkInputBannerProps = {
  url: string;
  onDismiss: () => void;
};

/**
 * LinkInputBanner — Live card banner shown above input box when user types a link.
 */
export function LinkInputBanner({ url, onDismiss }: LinkInputBannerProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sharedContent = useMemo(() => sharedContentMessageService.parse(url), [url]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    openGraphService.fetchPreview(url).then((data) => {
      if (isMounted) {
        setPreview(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderTopWidth: 2,
        borderTopColor: '#10b981',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 10,
      }}
    >
      {/* Thumbnail */}
      {preview?.image ? (
        <Image source={{ uri: preview.image }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#f1f5f9' }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="link" size={20} color="#10b981" />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Link Preview · {preview?.siteName ?? extractDomain(url)}
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#10b981" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
        ) : (
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
            {preview?.title ?? sharedContent?.summary ?? url}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={onDismiss} style={{ padding: 6 }}>
        <Icon name="x" size={18} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}
