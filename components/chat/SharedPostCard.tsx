import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useDeepLinkNavigation } from '@/lib/hooks/useDeepLinkNavigation';
import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';
import type { LinkPreviewData } from '@/lib/services/OpenGraphService';
import { sharedPostPresentationService } from '@/lib/services/SharedPostPresentationService';

type SharedPostCardProps = {
  preview: LinkPreviewData;
  path: string;
  instanceId?: string;
};

export function SharedPostCard({ preview, path, instanceId }: SharedPostCardProps) {
  const { colors } = useAppTheme();
  const { openLink } = useDeepLinkNavigation();
  const post = preview.entity?.post;
  const isUnavailable = preview.entity?.unavailable;
  const playerKey = instanceId ?? path;
  const youtube = post?.youtube;
  const location = post?.location;
  const primaryMedia = sharedPostPresentationService.getHero(preview);
  const initialHero = primaryMedia?.kind === 'image'
    ? primaryMedia.thumbnailUrl || primaryMedia.url
    : primaryMedia?.thumbnailUrl || preview.image;
  const [heroImage, setHeroImage] = useState<string | undefined>(initialHero);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [activePlayerKey, setActivePlayerKey] = useState<string | null>(null);
  const [youtubePlayerFailed, setYoutubePlayerFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const youtubeActive = activePlayerKey === playerKey;
  const mediaCount = (post?.imageCount ?? 0) + (post?.videoCount ?? 0);
  const eventLabel = useMemo(() => {
    if (!post?.event) return '';
    if (post.event.startDate) {
      const startDate = new Date(post.event.startDate);
      if (!Number.isNaN(startDate.getTime())) return startDate.toLocaleString();
    }
    return post.event.category || 'View event details';
  }, [post]);

  const handleOpenPost = (): void => {
    sharedPostPresentationService.deactivateAllPlayers();
    void openLink(path);
  };

  useEffect(() => sharedPostPresentationService.subscribe(setActivePlayerKey), []);

  useEffect(() => {
    setHeroImage(initialHero);
    setThumbnailFailed(false);
    if (initialHero || primaryMedia?.kind !== 'video') return;
    const cachedThumbnail = sharedPostPresentationService.getCachedThumbnail(primaryMedia.url);
    if (cachedThumbnail) {
      setHeroImage(cachedThumbnail);
      return;
    }
    let cancelled = false;
    void limeThumbnailService.createThumbnailAtTime(primaryMedia.url, 0.1)
      .then((thumbnailUrl) => {
        if (cancelled) return;
        sharedPostPresentationService.cacheThumbnail(primaryMedia.url, thumbnailUrl);
        setHeroImage(thumbnailUrl);
      })
      .catch(() => {
        if (!cancelled) setThumbnailFailed(true);
      });
    return () => { cancelled = true; };
  }, [initialHero, primaryMedia]);

  useEffect(() => () => sharedPostPresentationService.deactivatePlayer(playerKey), [playerKey]);

  useEffect(() => {
    setYoutubePlayerFailed(false);
  }, [playerKey, youtube?.videoId]);

  if (isUnavailable) {
    const notice = preview.entity?.unavailableReason === 'admin_taken_down'
      ? 'This post was taken down due to violation of terms and service'
      : 'This post was deleted';
    return (
      <View
        accessibilityLabel="Shared post unavailable"
        style={{ width: 280, maxWidth: '100%', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontStyle: 'italic', color: colors.mutedText, fontSize: 13, textAlign: 'center' }}>{notice}</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Shared Ourlime post"
      style={{ width: 280, maxWidth: '100%', overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <TouchableOpacity activeOpacity={0.88} onPress={handleOpenPost} accessibilityRole="link" accessibilityLabel="Open shared post">
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
          {preview.entity?.creatorImageUrl ? (
            <Image source={{ uri: preview.entity.creatorImageUrl }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.control }} />
          ) : <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.successSurface }} />}
          <View style={{ flex: 1, minWidth: 0, marginLeft: 9 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{preview.entity?.creatorDisplayName ?? 'Ourlime user'}</Text>
            {preview.entity?.creatorUsername ? <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 11 }}>@{preview.entity.creatorUsername}</Text> : null}
          </View>
        </View>

        {primaryMedia ? (
          <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#15171a', alignItems: 'center', justifyContent: 'center' }}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setHeroImage(undefined)} />
            ) : thumbnailFailed ? (
              <Icon name={primaryMedia.kind === 'video' ? 'video' : 'image'} size={38} color={colors.mutedText} />
            ) : (
              <ActivityIndicator size="large" color={colors.accent} />
            )}
            {primaryMedia.kind === 'video' ? <View style={{ position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={24} color="#ffffff" style={{ marginLeft: 3 }} /></View> : null}
            {mediaCount > 1 ? <View style={{ position: 'absolute', right: 8, top: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>1/{mediaCount}</Text></View> : null}
          </View>
        ) : null}

        {post?.excerpt ? <Text numberOfLines={3} style={{ marginHorizontal: 12, marginTop: 11, color: colors.text, fontSize: 14, lineHeight: 19 }}>{post.excerpt}</Text> : null}

        {post?.poll ? (
          <View style={{ marginHorizontal: 12, marginTop: 11, padding: 10, borderRadius: 13, backgroundColor: colors.control }}>
            {post.poll.options.slice(0, 3).map((option) => <View key={option} style={{ marginBottom: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.elevated }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{option}</Text></View>)}
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>{post.poll.totalVotes} votes · {post.poll.ended ? 'Poll ended' : 'Open post to vote'}</Text>
          </View>
        ) : null}

        {post?.event ? <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 11, padding: 10, borderRadius: 12, backgroundColor: colors.control }}><Icon name="calendar" size={16} color={colors.accent} /><Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, fontSize: 12 }}>{eventLabel}</Text></View> : null}
      </TouchableOpacity>

      {youtube ? (
        <View style={{ marginHorizontal: 12, marginTop: 11, height: youtubeActive || !primaryMedia ? undefined : 64, overflow: 'hidden', borderRadius: 13, backgroundColor: '#000000', aspectRatio: youtubeActive || !primaryMedia ? 16 / 9 : undefined }}>
          {youtubeActive && !youtubePlayerFailed ? (
            <>
              <WebView
                source={{
                  uri: sharedPostPresentationService.getYouTubeEmbedUrl(youtube.videoId),
                  headers: sharedPostPresentationService.getYouTubeRequestHeaders(),
                }}
                originWhitelist={['*']}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                androidHardwareAccelerationDisabled={false}
                androidLayerType="hardware"
                userAgent={sharedPostPresentationService.getYouTubeUserAgent()}
                onError={() => setYoutubePlayerFailed(true)}
                onHttpError={() => setYoutubePlayerFailed(true)}
                style={{ flex: 1, backgroundColor: '#000000' }}
              />
              <TouchableOpacity
                onPress={() => setIsFullscreen(true)}
                accessibilityRole="button"
                accessibilityLabel="Full screen YouTube video"
                activeOpacity={0.8}
                style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
              >
                <Icon name="maximize" size={16} color="#ffffff" />
              </TouchableOpacity>
            </>
          ) : youtubePlayerFailed ? (
            <TouchableOpacity
              onPress={() => void sharedPostPresentationService.openYouTube(youtube.videoId)}
              accessibilityRole="link"
              accessibilityLabel="Watch video on YouTube"
              activeOpacity={0.85}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#111827' }}
            >
              <Icon name="youtube" size={42} color="#ef4444" />
              <Text style={{ marginTop: 8, color: '#ffffff', fontSize: 13, fontWeight: '800' }}>Watch on YouTube</Text>
              <Text style={{ marginTop: 3, color: '#9ca3af', fontSize: 11 }}>Open this video in YouTube</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setYoutubePlayerFailed(false);
                sharedPostPresentationService.activatePlayer(playerKey);
              }}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Play YouTube video in chat"
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                flexDirection: primaryMedia ? 'row' : 'column',
                alignItems: primaryMedia ? 'center' : undefined,
                justifyContent: primaryMedia ? undefined : 'center',
              }}
            >
              <Image source={{ uri: youtube.thumbnailUrl }} resizeMode="cover" style={primaryMedia ? { width: 96, height: 64 } : { width: '100%', height: '100%' }} />
              {primaryMedia ? <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 10, color: '#ffffff', fontSize: 12, fontWeight: '800' }}>Watch YouTube video</Text> : null}
              <View style={primaryMedia ? { width: 38, height: 38, marginRight: 10, borderRadius: 19, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' } : { position: 'absolute', top: '50%', left: '50%', width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: 23, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={22} color="#ffffff" style={{ marginLeft: 3 }} /></View>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {location ? (
        <TouchableOpacity onPress={() => void sharedPostPresentationService.openLocation(location)} accessibilityRole="link" accessibilityLabel={location.url ? `Open ${location.name}` : `Get directions to ${location.name}`} style={{ flexDirection: 'row', alignItems: 'center', margin: 12, padding: 10, borderRadius: 13, backgroundColor: colors.successSurface }}>
          <Icon name={location.url ? 'link' : 'map-pin'} size={17} color={colors.accent} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}><Text numberOfLines={1} style={{ color: colors.successText, fontWeight: '800', fontSize: 12 }}>{location.name}</Text>{location.address ? <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 10 }}>{location.address}</Text> : null}</View>
          <Text style={{ color: colors.successText, fontWeight: '800', fontSize: 10 }}>{location.url ? 'Open Link' : 'Directions'}</Text>
        </TouchableOpacity>
      ) : <View style={{ height: 12 }} />}

      {isFullscreen && youtube ? (
        <Modal
          visible={isFullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setIsFullscreen(false)}
          statusBarTranslucent
        >
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <View style={{ position: 'absolute', top: 44, right: 16, zIndex: 50 }}>
              <TouchableOpacity
                onPress={() => setIsFullscreen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close full screen video"
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)' }}
              >
                <Icon name="x" size={18} color="#ffffff" />
                <Text style={{ marginLeft: 6, color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <WebView
              source={{
                uri: sharedPostPresentationService.getYouTubeEmbedUrl(youtube.videoId),
                headers: sharedPostPresentationService.getYouTubeRequestHeaders(),
              }}
              originWhitelist={['*']}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              androidHardwareAccelerationDisabled={false}
              androidLayerType="hardware"
              userAgent={sharedPostPresentationService.getYouTubeUserAgent()}
              style={{ flex: 1, backgroundColor: '#000000' }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
