import { useEffect, useMemo, useState } from 'react';
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

type LinkPreviewMessageProps = {
  url: string;
  isOwn?: boolean;
};

const limeThumbnailCache = new Map<string, string>();

/**
 * LinkPreviewMessage — Card shown inside chat bubbles for messages containing links.
 */
export function LinkPreviewMessage({ url, isOwn = false }: LinkPreviewMessageProps) {
  const { openLink } = useDeepLinkNavigation();
  const { colors } = useAppTheme();
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedLimeThumbnail, setResolvedLimeThumbnail] = useState<string | null>(null);
  const [limeThumbnailFailed, setLimeThumbnailFailed] = useState(false);
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

  useEffect(() => {
    const entity = preview?.entity;
    setLimeThumbnailFailed(false);
    if (entity?.kind !== 'lime') {
      setResolvedLimeThumbnail(null);
      return;
    }
    if (entity.thumbnailUrl) {
      setResolvedLimeThumbnail(entity.thumbnailUrl);
      return;
    }
    if (!entity.videoUrl) {
      setResolvedLimeThumbnail(null);
      setLimeThumbnailFailed(true);
      return;
    }
    const cachedThumbnail = limeThumbnailCache.get(entity.videoUrl);
    if (cachedThumbnail) {
      setResolvedLimeThumbnail(cachedThumbnail);
      return;
    }

    let cancelled = false;
    setResolvedLimeThumbnail(null);
    void limeThumbnailService.createThumbnail(entity.videoUrl, 1)
      .then((thumbnailUri) => {
        if (cancelled) return;
        limeThumbnailCache.set(entity.videoUrl ?? '', thumbnailUri);
        setResolvedLimeThumbnail(thumbnailUri);
      })
      .catch(() => {
        if (!cancelled) setLimeThumbnailFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const domain = preview?.domain ?? extractDomain(url);
  const entityKind = preview?.entity?.kind ?? sharedContent?.kind;
  const isLime = entityKind === 'lime';
  const limeImage = resolvedLimeThumbnail || (limeThumbnailFailed ? preview?.image : undefined);
  const canResolveLimeThumbnail = preview?.entity?.kind === 'lime'
    && Boolean(preview.entity.thumbnailUrl || preview.entity.videoUrl);
  const isResolvingLimeThumbnail = isLime
    && canResolveLimeThumbnail
    && !limeImage
    && !limeThumbnailFailed;
  const fallbackTitle = sharedContent?.summary ?? url;
  const cardBackground = isOwn ? 'rgba(255,255,255,0.14)' : colors.elevated;
  const cardBorder = isOwn ? 'rgba(255,255,255,0.25)' : colors.border;
  const primaryText = isOwn ? '#ffffff' : colors.text;
  const secondaryText = isOwn ? 'rgba(255,255,255,0.76)' : colors.mutedText;

  return (
    <TouchableOpacity
      onPress={() => void openLink(url)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={sharedContent ? `Open shared ${sharedContent.kind}` : `Open ${domain}`}
      style={{
        marginTop: 6,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: cardBackground,
        borderWidth: 1,
        borderColor: cardBorder,
        minWidth: 220,
      }}
    >
      {isLime ? (
        <View style={{ width: 240, height: 310, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
          {limeImage ? (
            <Image source={{ uri: limeImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : isLoading || isResolvingLimeThumbnail ? (
            <ActivityIndicator size="large" color="#10b981" />
          ) : (
            <Icon name="video" size={42} color="#10b981" />
          )}
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          <View style={{ position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
          </View>
          <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
              {preview?.entity?.creatorDisplayName ?? preview?.title ?? 'Ourlime Lime'}
            </Text>
            {preview?.entity?.creatorUsername ? (
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                @{preview.entity.creatorUsername}
              </Text>
            ) : null}
          </View>
        </View>
      ) : preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          style={{ width: '100%', height: 145, backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : colors.control }}
          resizeMode="cover"
        />
      ) : null}

      <View style={{ padding: 10 }}>
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
      </View>
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
