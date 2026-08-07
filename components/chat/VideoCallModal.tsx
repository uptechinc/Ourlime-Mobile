import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { CameraView, Camera } from 'expo-camera';
import UserAvatar from '@/components/ui/UserAvatar';
import type { UserProfile } from '@/lib/services/AuthService';

type CallType = 'audio' | 'video';

type CallState = 'calling' | 'ringing' | 'connected' | 'ended';

type VideoCallModalProps = {
  visible: boolean;
  friend: UserProfile | null;
  callType: CallType;
  isIncoming?: boolean;
  onEnd: () => void;
};

export function VideoCallModal({ visible, friend, callType, isIncoming = false, onEnd }: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

  const [callSeconds, setCallSeconds] = useState(0);
  const [callState, setCallState] = useState<CallState>('calling');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request Camera & Microphone Permissions on mount / visibility
  useEffect(() => {
    if (!visible) return;

    const requestPermissions = async () => {
      try {
        const cameraStatus = await Camera.requestCameraPermissionsAsync();
        const micStatus = await Camera.requestMicrophonePermissionsAsync();

        if (cameraStatus.status !== 'granted' || micStatus.status !== 'granted') {
          setHasPermissions(false);
          Alert.alert(
            'Permissions Required',
            'Ourlime needs access to your camera and microphone to make voice and video calls.',
            [{ text: 'OK' }]
          );
        } else {
          setHasPermissions(true);
        }
      } catch (err) {
        console.warn('[VideoCallModal] Permission error:', err);
        setHasPermissions(true);
      }
    };

    void requestPermissions();
  }, [visible]);

  // Handle call progression & timer
  useEffect(() => {
    if (!visible) {
      setCallState('calling');
      setCallSeconds(0);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsSpeakerOn(false);
      setFacing('front');
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
      return;
    }

    if (isIncoming) {
      setCallState('ringing');
    } else {
      // Step 1: Start on 'calling...'
      setCallState('calling');

      // Step 2: Transition to 'ringing...' after 1.8s
      ringingTimeoutRef.current = setTimeout(() => {
        setCallState('ringing');
      }, 1800);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    };
  }, [visible, isIncoming]);

  // Answer call handler
  const handleAnswer = () => {
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    setCallState('connected');
    setCallSeconds(0);

    // Timer starts ONLY when the call is answered / connected
    intervalRef.current = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
  };

  const handleEnd = () => {
    setCallState('ended');
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ringingTimeoutRef.current) clearTimeout(ringingTimeoutRef.current);
    setTimeout(onEnd, 600);
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'front' ? 'back' : 'front'));
  };

  const formatCallTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVideoCall = callType === 'video';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleEnd}>
      <StatusBar barStyle="light-content" backgroundColor="#0b141a" />
      <View style={{ flex: 1, backgroundColor: '#0b141a', position: 'relative' }}>

        {/* ── Live Front Camera Viewfinder for Video Calls (Calling, Ringing, & Active) ── */}
        {isVideoCall && !isVideoOff && hasPermissions === true ? (
          <CameraView
            key={`camera_${facing}_${hasPermissions}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            facing={facing}
            mute={isMuted}
          />
        ) : null}

        {/* Dark WhatsApp Overlay Gradient for Contrast */}
        <View style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: isVideoCall && !isVideoOff ? 'rgba(11, 20, 26, 0.45)' : '#0b141a',
        }} />

        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name={isVideoCall ? 'video' : 'phone'} size={20} color="#10b981" />
              <Text style={{ marginLeft: 8, color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                {isVideoCall ? 'Ourlime Video Call' : 'Ourlime Voice Call'}
              </Text>
            </View>

            {/* Flip Camera button for Video calls */}
            {isVideoCall && !isVideoOff && (
              <TouchableOpacity
                onPress={toggleCameraFacing}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="refresh-cw" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Main Content Area */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {/* User Avatar with Ring */}
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 3.5,
              borderColor: callState === 'connected' ? '#10b981' : callState === 'ringing' ? '#059669' : '#334155',
              overflow: 'hidden',
              marginBottom: 18,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: callState === 'connected' ? 0.4 : 0,
              shadowRadius: 10,
              backgroundColor: '#1e293b',
            }}>
              <UserAvatar
                profileImage={friend?.profilePicture}
                firstName={friend?.firstName ?? 'U'}
                size={120}
              />
            </View>

            {/* Name & Username */}
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 4, textAlign: 'center' }}>
              {friend?.firstName} {friend?.lastName}
            </Text>
            <Text style={{ fontSize: 15, color: '#cbd5e1' }}>
              @{friend?.userName}
            </Text>

            {/* Status / Timer — Time ONLY displays when callState === 'connected'! */}
            <View style={{ marginTop: 16 }}>
              {callState === 'calling' && (
                <Text style={{ fontSize: 16, color: '#e2e8f0', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
                  Calling...
                </Text>
              )}
              {callState === 'ringing' && (
                <Text style={{ fontSize: 16, color: '#10b981', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
                  Ringing...
                </Text>
              )}
              {callState === 'connected' && (
                <Text style={{ fontSize: 22, color: '#10b981', fontWeight: '800', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
                  {formatCallTime(callSeconds)}
                </Text>
              )}
              {callState === 'ended' && (
                <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: '700' }}>
                  Call Ended
                </Text>
              )}
            </View>
          </View>

          {/* Controls Footer */}
          <View style={{ paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 48 }}>
            {callState !== 'connected' && isIncoming ? (
              /* Incoming Call Controls: Answer (Green) or Decline (Red) */
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handleEnd}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: '#dc2626',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#dc2626',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <Icon name="phone-off" size={26} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 8, fontWeight: '600' }}>Decline</Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handleAnswer}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: '#10b981',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#10b981',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <Icon name="phone" size={26} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#10b981', fontSize: 12, marginTop: 8, fontWeight: '700' }}>Answer</Text>
                </View>
              </View>
            ) : (
              /* Outgoing or Active Call Controls */
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                {/* Mute Mic */}
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setIsMuted((m) => !m)}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={isMuted ? 'mic-off' : 'mic'} size={22} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 6, fontWeight: '500' }}>
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Text>
                </View>

                {/* Video Toggle (For Video Calls) */}
                {isVideoCall && (
                  <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => setIsVideoOff((v) => !v)}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isVideoOff ? '#ef4444' : 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={isVideoOff ? 'video-off' : 'video'} size={22} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 6, fontWeight: '500' }}>
                      {isVideoOff ? 'Cam Off' : 'Cam On'}
                    </Text>
                  </View>
                )}

                {/* End Call */}
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handleEnd}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: '#dc2626',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#dc2626',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <Icon name="phone-off" size={26} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 6, fontWeight: '600' }}>End Call</Text>
                </View>

                {/* Speaker */}
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setIsSpeakerOn((s) => !s)}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: isSpeakerOn ? '#10b981' : 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={isSpeakerOn ? 'volume-2' : 'volume-x'} size={22} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 6, fontWeight: '500' }}>Speaker</Text>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
