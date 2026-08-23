import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '@/components/ui/UserAvatar';
import { useCallCoordinator } from '@/lib/contexts/CallContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { useCallStore } from '@/lib/store/useCallStore';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type CallControlProps = { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; destructive?: boolean; onPress: () => void };

type AgoraVideoViewsProps = { remoteUid: number | null; showLocal: boolean };

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

function AgoraVideoViews({ remoteUid, showLocal }: AgoraVideoViewsProps) {
  if (!platformEnvironmentService.isNativeCallingSupported()) {
    return showLocal ? <SafeExpoCameraView /> : null;
  }
  // Native surfaces are resolved only inside a development/production build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Agora = require('react-native-agora') as typeof import('react-native-agora');
  const SurfaceView = Agora.RtcSurfaceView;
  return <View style={{ position: 'absolute', inset: 0, backgroundColor: '#000000' }}>
    {remoteUid ? <SurfaceView canvas={{ uid: remoteUid, sourceType: Agora.VideoSourceType.VideoSourceRemote }} style={{ flex: 1 }} /> : null}
    {showLocal ? <SurfaceView canvas={{ uid: 0, sourceType: Agora.VideoSourceType.VideoSourceCamera }} zOrderMediaOverlay style={{ position: 'absolute', right: 18, top: 78, width: 118, height: 168, borderRadius: 18, overflow: 'hidden' }} /> : null}
  </View>;
}

function CallControl({ icon, label, active = false, destructive = false, isAnswer = false, onPress }: CallControlProps & { isAnswer?: boolean }) {
  const { colors } = useAppTheme();
  const backgroundColor = isAnswer ? '#10b981' : destructive ? '#ef4444' : active ? colors.accent : colors.control;
  const iconColor = isAnswer || destructive || active ? '#ffffff' : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor, alignItems: 'center', justifyContent: 'center', shadowColor: isAnswer ? '#10b981' : destructive ? '#ef4444' : '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}>
        <Ionicons name={icon} size={30} color={iconColor} />
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function GlobalCallOverlay() {
  const { colors } = useAppTheme();
  const coordinator = useCallCoordinator();
  const session = useCallStore((state) => state.session);
  const connectionStatus = useCallStore((state) => state.connectionStatus);
  const remoteUid = useCallStore((state) => state.remoteUid);
  const isMuted = useCallStore((state) => state.isMuted);
  const isVideoMuted = useCallStore((state) => state.isVideoMuted);
  const isSpeakerEnabled = useCallStore((state) => state.isSpeakerEnabled);
  const isMinimized = useCallStore((state) => state.isMinimized);
  const errorMessage = useCallStore((state) => state.errorMessage);

  if (!session) return null;
  const isIncoming = session.callee.userId === auth.currentUser?.uid && session.state === 'ringing';
  const peer = session.caller.userId === auth.currentUser?.uid ? session.callee : session.caller;

  if (isMinimized) {
    return (
      <Pressable onPress={coordinator.restore} style={{ position: 'absolute', right: 16, top: 72, zIndex: 1000, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6 }}>
        <Ionicons name={session.type === 'video' ? 'videocam' : 'call'} size={18} color={colors.onAccent} />
        <Text style={{ color: colors.onAccent, fontWeight: '800' }}>{peer.displayName}</Text>
      </Pressable>
    );
  }

  const nativeUnavailable = !platformEnvironmentService.isNativeCallingSupported();

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={coordinator.minimize}>
      <SwipeDismissSurface visible onDismiss={coordinator.minimize} handleColor="#475569" accessibilityLabel="Swipe down to minimize call" style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 16 }}>
        {session.type === 'video' ? <AgoraVideoViews remoteUid={remoteUid} showLocal={!isVideoMuted} /> : null}

        {/* Top Header Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={coordinator.minimize} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={24} color="#ffffff" />
          </Pressable>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Ourlime {session.type === 'video' ? 'Video' : 'Voice'} Call
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Center Caller Info */}
        <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: isIncoming ? '#10b981' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.1)' }}>
            <UserAvatar
              profileImage={peer.profilePicture}
              firstName={peer.displayName || peer.userName || 'User'}
              size={124}
            />
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '800', textAlign: 'center' }}>{peer.displayName}</Text>
            {peer.userName ? <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '500' }}>@{peer.userName}</Text> : null}
          </View>

          <Text style={{ color: isIncoming ? '#34d399' : '#cbd5e1', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            {errorMessage ?? (isIncoming ? `Incoming ${session.type} call...` : connectionStatus === 'active' ? (remoteUid ? 'Connected' : 'Waiting for answer…') : connectionStatus === 'connecting' ? 'Connecting…' : 'Ringing…')}
          </Text>

          {nativeUnavailable && (
            <Text style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, padding: 12, textAlign: 'center', fontSize: 12, marginHorizontal: 16 }}>
              System calling and Agora require an Ourlime build. Expo Go cannot load native WebRTC modules.
            </Text>
          )}
        </View>

        {/* Bottom Call Controls */}
        {isIncoming ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 24 }}>
            <CallControl icon="call" label="Decline" destructive onPress={() => void coordinator.declineCall()} />
            <CallControl icon="call" label="Answer" isAnswer onPress={() => void coordinator.answerCall()} />
          </View>
        ) : (
          <View style={{ gap: 28, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', rowGap: 16 }}>
              <CallControl icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} onPress={coordinator.toggleMute} />
              <CallControl icon={isSpeakerEnabled ? 'volume-high' : 'volume-medium'} label="Speaker" active={isSpeakerEnabled} onPress={coordinator.toggleSpeaker} />
              {session.type === 'video' && <CallControl icon={isVideoMuted ? 'videocam-off' : 'videocam'} label="Camera" active={isVideoMuted} onPress={coordinator.toggleVideo} />}
              {session.type === 'video' && <CallControl icon="camera-reverse" label="Flip" onPress={coordinator.switchCamera} />}
            </View>
            <View style={{ alignItems: 'center' }}>
              <CallControl icon="call" label="End Call" destructive onPress={() => void coordinator.endCall()} />
            </View>
          </View>
        )}
      </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}
