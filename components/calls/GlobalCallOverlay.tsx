import Constants from 'expo-constants';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CachedImage from '@/components/ui/CachedImage';
import { useCallCoordinator } from '@/lib/contexts/CallContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { useCallStore } from '@/lib/store/useCallStore';

type CallControlProps = { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; destructive?: boolean; onPress: () => void };

type AgoraVideoViewsProps = { remoteUid: number | null; showLocal: boolean };

function AgoraVideoViews({ remoteUid, showLocal }: AgoraVideoViewsProps) {
  if (Constants.appOwnership === 'expo') return null;
  // Native surfaces are resolved only inside a development/production build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Agora = require('react-native-agora') as typeof import('react-native-agora');
  const SurfaceView = Agora.RtcSurfaceView;
  return <View style={{ position: 'absolute', inset: 0, backgroundColor: '#000000' }}>
    {remoteUid ? <SurfaceView canvas={{ uid: remoteUid, sourceType: Agora.VideoSourceType.VideoSourceRemote }} style={{ flex: 1 }} /> : null}
    {showLocal ? <SurfaceView canvas={{ uid: 0, sourceType: Agora.VideoSourceType.VideoSourceCamera }} zOrderMediaOverlay style={{ position: 'absolute', right: 18, top: 78, width: 118, height: 168, borderRadius: 18, overflow: 'hidden' }} /> : null}
  </View>;
}

function CallControl({ icon, label, active = false, destructive = false, onPress }: CallControlProps) {
  const { colors } = useAppTheme();
  const backgroundColor = destructive ? colors.destructive : active ? colors.accent : colors.control;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ alignItems: 'center', gap: 8 }}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={26} color={destructive || active ? colors.onAccent : colors.text} /></View><Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text></Pressable>;
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
  if (isMinimized) return <Pressable onPress={coordinator.restore} style={{ position: 'absolute', right: 16, top: 72, zIndex: 1000, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={session.type === 'video' ? 'videocam' : 'call'} size={18} color={colors.onAccent} /><Text style={{ color: colors.onAccent, fontWeight: '800' }}>{peer.displayName}</Text></Pressable>;
  const nativeUnavailable = Constants.appOwnership === 'expo';
  return <Modal visible transparent={false} animationType="slide" onRequestClose={coordinator.minimize}>
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 24 }}>
      {session.type === 'video' && connectionStatus !== 'ringing' ? <AgoraVideoViews remoteUid={remoteUid} showLocal={!isVideoMuted} /> : null}
      <Pressable onPress={coordinator.minimize} style={{ alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-down" size={24} color={colors.text} /></Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {peer.profilePicture ? <CachedImage uri={peer.profilePicture} style={{ width: 116, height: 116, borderRadius: 58 }} accessibilityLabel={`${peer.displayName} profile picture`} /> : <View style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onAccent, fontSize: 44, fontWeight: '800' }}>{peer.displayName.charAt(0).toUpperCase()}</Text></View>}
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' }}>{peer.displayName}</Text>
        <Text style={{ color: colors.mutedText, fontSize: 17 }}>{errorMessage ?? (isIncoming ? `Incoming ${session.type} call` : connectionStatus === 'active' ? (remoteUid ? 'Connected' : 'Waiting for the other person…') : connectionStatus === 'connecting' ? 'Connecting…' : 'Ringing…')}</Text>
        {nativeUnavailable && <Text style={{ color: colors.warningText, backgroundColor: colors.warningSurface, borderRadius: 12, padding: 12, textAlign: 'center' }}>System calling and Agora require an Ourlime development build. Expo Go cannot load the native call modules.</Text>}
      </View>
      {isIncoming ? <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}><CallControl icon="call" label="Answer" active onPress={() => void coordinator.answerCall()} /><CallControl icon="call" label="Decline" destructive onPress={() => void coordinator.declineCall()} /></View>
      : <View style={{ gap: 30 }}><View style={{ flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', rowGap: 18 }}><CallControl icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} onPress={coordinator.toggleMute} /><CallControl icon={isSpeakerEnabled ? 'volume-high' : 'volume-medium'} label="Speaker" active={isSpeakerEnabled} onPress={coordinator.toggleSpeaker} />{session.type === 'video' && <CallControl icon={isVideoMuted ? 'videocam-off' : 'videocam'} label="Camera" active={isVideoMuted} onPress={coordinator.toggleVideo} />}{session.type === 'video' && <CallControl icon="camera-reverse" label="Flip" onPress={coordinator.switchCamera} />}</View><View style={{ alignItems: 'center' }}><CallControl icon="call" label="End" destructive onPress={() => void coordinator.endCall()} /></View></View>}
    </SafeAreaView>
  </Modal>;
}
