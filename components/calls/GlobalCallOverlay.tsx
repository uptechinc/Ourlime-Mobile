import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '@/components/ui/UserAvatar';
import { useCallCoordinator } from '@/lib/contexts/CallContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { useCallStore } from '@/lib/store/useCallStore';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import CallPatternBackground from './CallPatternBackground';

type RoundButtonTone = 'default' | 'active' | 'danger' | 'accept';

type RoundButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  tone?: RoundButtonTone;
  size?: number;
  label?: string;
  isHangUp?: boolean;
};

type VideoFeed = 'local' | 'remote';

type AgoraVideoViewsProps = {
  primary: VideoFeed | null;
  pip: VideoFeed | null;
  remoteUid: number | null;
  pipStyle: ViewStyle;
  onSwapFocus: () => void;
  onToggleControls: () => void;
};

type CallDurationProps = { connectedAt: number };

// WhatsApp-style dark call palette.
const CALL_PANEL = 'rgba(17,27,33,0.94)';
const CALL_SUBTLE_TEXT = '#d1d7db';
const PICTURE_IN_PICTURE_SMALL_STYLE: ViewStyle = { position: 'absolute', right: 8, bottom: 8, width: '34%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden' };
const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } as const;

const TONE_STYLES: Record<RoundButtonTone, { background: string; icon: string }> = {
  default: { background: 'rgba(255,255,255,0.14)', icon: '#ffffff' },
  active: { background: '#ffffff', icon: '#111b21' },
  danger: { background: '#ea0038', icon: '#ffffff' },
  accept: { background: '#10b981', icon: '#ffffff' },
};

function SafeExpoCameraView() {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      void requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  if (!permission?.granted) {
    return null;
  }

  return <CameraView facing="front" style={StyleSheet.absoluteFill} />;
}

function AgoraVideoViews({ primary, pip, remoteUid, pipStyle, onSwapFocus, onToggleControls }: AgoraVideoViewsProps) {
  if (!platformEnvironmentService.isNativeCallingSupported()) {
    return primary === 'local' ? <SafeExpoCameraView /> : null;
  }
  // Native surfaces are resolved only inside a development/production build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Agora = require('react-native-agora') as typeof import('react-native-agora');
  const SurfaceView = Agora.RtcSurfaceView;
  // A TextureView draws inside the Modal's animated (swipe-to-minimize) layer; a full-screen SurfaceView there often
  // stays black. TextureView is Android-only, so iOS keeps the SurfaceView.
  const FullScreenView = Platform.OS === 'android' ? Agora.RtcTextureView : Agora.RtcSurfaceView;
  const canvasFor = (kind: VideoFeed) => (kind === 'local'
    ? { uid: 0, sourceType: Agora.VideoSourceType.VideoSourceCamera }
    : { uid: remoteUid ?? 0, sourceType: Agora.VideoSourceType.VideoSourceRemote });
  if (!primary && !pip) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {primary ? <FullScreenView key={`${primary}-full`} canvas={canvasFor(primary)} style={{ flex: 1 }} /> : null}
    {/* Tapping the video shows/hides the controls. */}
    <Pressable accessibilityLabel="Show or hide call controls" onPress={onToggleControls} style={StyleSheet.absoluteFill} />
    {/* Remount on swap so the overlay surface re-applies its z-order above the full-screen one. */}
    {pip ? <SurfaceView key={`${pip}-pip`} canvas={canvasFor(pip)} zOrderMediaOverlay style={pipStyle} /> : null}
    {pip ? <Pressable accessibilityRole="button" accessibilityLabel="Swap video focus" onPress={onSwapFocus} style={[pipStyle, { zIndex: 5 }]} /> : null}
  </View>;
}

/** Running m:ss (h:mm:ss after an hour) since the call connected. */
function CallDuration({ connectedAt }: CallDurationProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const totalSeconds = Math.max(0, Math.floor((now - connectedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const label = hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  return <Text style={[{ color: CALL_SUBTLE_TEXT, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'center' }, TEXT_SHADOW]}>{label}</Text>;
}

function RoundButton({ icon, accessibilityLabel, onPress, tone = 'default', size = 56, label, isHangUp = false }: RoundButtonProps) {
  const colors = TONE_STYLES[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={Math.round(size * 0.44)} color={colors.icon} style={isHangUp ? { transform: [{ rotate: '135deg' }] } : undefined} />
      </View>
      {label ? <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>{label}</Text> : null}
    </Pressable>
  );
}

export default function GlobalCallOverlay() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const coordinator = useCallCoordinator();
  const session = useCallStore((state) => state.session);
  const connectionStatus = useCallStore((state) => state.connectionStatus);
  const remoteUid = useCallStore((state) => state.remoteUid);
  const isMuted = useCallStore((state) => state.isMuted);
  const isVideoMuted = useCallStore((state) => state.isVideoMuted);
  const isSpeakerEnabled = useCallStore((state) => state.isSpeakerEnabled);
  const isMinimized = useCallStore((state) => state.isMinimized);
  const errorMessage = useCallStore((state) => state.errorMessage);
  const isLocalPreviewReady = useCallStore((state) => state.isLocalPreviewReady);
  const isLocalPrimary = useCallStore((state) => state.isLocalPrimary);
  const isRemoteVideoReady = useCallStore((state) => state.isRemoteVideoReady);
  const connectedAt = useCallStore((state) => state.connectedAt);
  const isPictureInPicture = useCallStore((state) => state.isPictureInPicture);
  const [areControlsVisible, setControlsVisible] = useState(true);

  const isRemoteVideoOnScreen = remoteUid !== null && isRemoteVideoReady;
  // Controls can only be hidden while the peer's video fills the screen.
  useEffect(() => {
    if (!isRemoteVideoOnScreen) setControlsVisible(true);
  }, [isRemoteVideoOnScreen]);

  if (!session) return null;
  const isVideo = session.type === 'video';
  const isIncoming = session.callee.userId === auth.currentUser?.uid && session.state === 'ringing';
  const peer = session.caller.userId === auth.currentUser?.uid ? session.callee : session.caller;
  const peerName = peer.displayName || peer.userName || 'Ourlime User';

  const nativeUnavailable = !platformEnvironmentService.isNativeCallingSupported();
  const isActive = connectionStatus === 'active' && !errorMessage;
  const isConnected = isActive && remoteUid !== null;
  const isLocalOn = isVideo && !isVideoMuted && isLocalPreviewReady;
  const isRemoteOn = isVideo && isConnected && isRemoteVideoOnScreen;
  // WhatsApp rules: the peer's video fills the screen; my camera is the small box. Before the call connects my own
  // camera fills the screen. If the peer's camera is off, their avatar shows on the sticker wallpaper instead of a
  // frozen frame. Tapping the small box swaps the two when both cameras are on.
  let primary: VideoFeed | null = null;
  let pip: VideoFeed | null = null;
  if (isRemoteOn && isLocalOn) {
    primary = isLocalPrimary ? 'local' : 'remote';
    pip = isLocalPrimary ? 'remote' : 'local';
  } else if (isRemoteOn) {
    primary = 'remote';
  } else if (isLocalOn) {
    if (isConnected) pip = 'local';
    else primary = 'local';
  }
  const showAvatar = primary === null || isIncoming;
  const showChrome = areControlsVisible || !isRemoteOn;
  const pipStyle: ViewStyle = { position: 'absolute', right: 16, bottom: insets.bottom + (showChrome ? 112 : 24), width: 108, height: 160, borderRadius: 14, overflow: 'hidden' };
  const handleToggleControls = () => { if (isRemoteOn) setControlsVisible((visible) => !visible); };

  // Android picture-in-picture (Home pressed during a video call): the whole app window is the small floating
  // window, so draw a compact, control-free call view in the main window instead of the Modal.
  if (isPictureInPicture) {
    const pictureInPicturePrimary: VideoFeed | null = isRemoteOn ? 'remote' : (!isConnected && isLocalOn ? 'local' : null);
    const pictureInPictureSmall: VideoFeed | null = isLocalOn && pictureInPicturePrimary !== 'local' ? 'local' : null;
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 10000, elevation: 10000, backgroundColor: '#0b141a' }]}>
        {pictureInPicturePrimary === null ? <CallPatternBackground /> : null}
        {isVideo ? (
          <AgoraVideoViews
            primary={pictureInPicturePrimary}
            pip={pictureInPictureSmall}
            remoteUid={remoteUid}
            pipStyle={PICTURE_IN_PICTURE_SMALL_STYLE}
            onSwapFocus={() => undefined}
            onToggleControls={() => undefined}
          />
        ) : null}
        {pictureInPicturePrimary === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
            <UserAvatar profileImage={peer.profilePicture} firstName={peerName} size={64} />
            <Text numberOfLines={1} style={[{ color: '#ffffff', fontSize: 14, fontWeight: '700' }, TEXT_SHADOW]}>{peerName}</Text>
            {isActive && connectedAt ? <CallDuration connectedAt={connectedAt} /> : null}
          </View>
        ) : null}
      </View>
    );
  }

  if (isMinimized) {
    return (
      <Pressable onPress={coordinator.restore} style={{ position: 'absolute', right: 16, top: 72, zIndex: 1000, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6 }}>
        <Ionicons name={isVideo ? 'videocam' : 'call'} size={18} color={colors.onAccent} />
        <Text style={{ color: colors.onAccent, fontWeight: '800' }}>{peer.displayName}</Text>
      </Pressable>
    );
  }


  const subtitle = errorMessage
    ?? (connectionStatus === 'ending' || session.state === 'ended' ? 'Call ended'
      : isIncoming ? `Ourlime ${isVideo ? 'video' : 'voice'} call`
        : isActive && connectedAt ? null
          : connectionStatus === 'connecting' ? 'Connecting…' : 'Ringing…');

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={coordinator.minimize}>
      <SwipeDismissSurface visible onDismiss={coordinator.minimize} handleColor="rgba(255,255,255,0.35)" accessibilityLabel="Swipe down to minimize call" style={{ flex: 1, backgroundColor: '#0b141a' }}>
        {primary === null ? <CallPatternBackground /> : null}
        {isVideo ? <AgoraVideoViews primary={primary} pip={pip} remoteUid={remoteUid} pipStyle={pipStyle} onSwapFocus={coordinator.swapVideoFocus} onToggleControls={handleToggleControls} /> : null}
        {/* Dim my own camera behind the incoming-call screen so the caller's details stay readable. */}
        {isIncoming && primary !== null ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} /> : null}

        <SafeAreaView pointerEvents="box-none" edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          {/* Top: minimize, name + status/timer, flip camera */}
          {showChrome ? (
            <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <RoundButton icon="contract" accessibilityLabel="Minimize call" size={44} onPress={coordinator.minimize} />
              <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingTop: 2, gap: 2 }}>
                <Text numberOfLines={1} style={[{ color: '#ffffff', fontSize: 20, fontWeight: '700' }, TEXT_SHADOW]}>{peerName}</Text>
                {subtitle !== null
                  ? <Text numberOfLines={2} style={[{ color: errorMessage ? '#fca5a5' : CALL_SUBTLE_TEXT, fontSize: 15, fontWeight: '500', textAlign: 'center' }, TEXT_SHADOW]}>{subtitle}</Text>
                  : connectedAt ? <CallDuration connectedAt={connectedAt} /> : null}
              </View>
              {isVideo && !isIncoming
                ? <RoundButton icon="camera-reverse" accessibilityLabel="Flip camera" size={44} onPress={coordinator.switchCamera} />
                : <View style={{ width: 44 }} />}
            </View>
          ) : <View />}

          {/* Middle: avatar (voice calls, ringing, or video before any picture) */}
          <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {showAvatar ? <UserAvatar profileImage={peer.profilePicture} firstName={peerName} size={isIncoming && primary !== null ? 120 : 200} /> : null}
            {nativeUnavailable ? (
              <Text style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, padding: 12, textAlign: 'center', fontSize: 12, marginHorizontal: 16 }}>
                System calling and Agora require an Ourlime build. Expo Go cannot load native WebRTC modules.
              </Text>
            ) : null}
          </View>

          {/* Bottom controls */}
          {isIncoming ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 24 }}>
              <RoundButton icon="call" accessibilityLabel="Decline call" label="Decline" tone="danger" size={68} isHangUp onPress={() => void coordinator.declineCall()} />
              <RoundButton icon={isVideo ? 'videocam' : 'call'} accessibilityLabel="Accept call" label="Accept" tone="accept" size={68} onPress={() => void coordinator.answerCall()} />
            </View>
          ) : !showChrome ? null : isVideo ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CALL_PANEL, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 10 }}>
              <RoundButton icon={isVideoMuted ? 'videocam-off' : 'videocam'} accessibilityLabel={isVideoMuted ? 'Turn camera on' : 'Turn camera off'} tone={isVideoMuted ? 'active' : 'default'} onPress={coordinator.toggleVideo} />
              <RoundButton icon="volume-high" accessibilityLabel={isSpeakerEnabled ? 'Turn speaker off' : 'Turn speaker on'} tone={isSpeakerEnabled ? 'active' : 'default'} onPress={coordinator.toggleSpeaker} />
              <RoundButton icon={isMuted ? 'mic-off' : 'mic'} accessibilityLabel={isMuted ? 'Unmute' : 'Mute'} tone={isMuted ? 'active' : 'default'} onPress={coordinator.toggleMute} />
              <RoundButton icon="call" accessibilityLabel="End call" tone="danger" isHangUp onPress={() => void coordinator.endCall()} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', backgroundColor: CALL_PANEL, borderRadius: 32, paddingHorizontal: 12, paddingTop: 24, paddingBottom: 20 }}>
              <RoundButton icon="volume-high" accessibilityLabel={isSpeakerEnabled ? 'Turn speaker off' : 'Turn speaker on'} label="Speaker" size={64} tone={isSpeakerEnabled ? 'active' : 'default'} onPress={coordinator.toggleSpeaker} />
              <RoundButton icon={isMuted ? 'mic-off' : 'mic'} accessibilityLabel={isMuted ? 'Unmute' : 'Mute'} label={isMuted ? 'Unmute' : 'Mute'} size={64} tone={isMuted ? 'active' : 'default'} onPress={coordinator.toggleMute} />
              <RoundButton icon="call" accessibilityLabel="End call" label="End" size={64} tone="danger" isHangUp onPress={() => void coordinator.endCall()} />
            </View>
          )}
        </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}
