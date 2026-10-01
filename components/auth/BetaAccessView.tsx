import { View, Text, TouchableOpacity, StatusBar, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export type BetaAccessState =
  | 'invite_required'
  | 'closed'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'used';

type BetaAccessViewProps = {
  state: BetaAccessState;
};

const messages: Record<BetaAccessState, { title: string; detail: string }> = {
  invite_required: {
    title: 'Registration is currently open to invited members only.',
    detail: 'Registration is invite-only. Ask an Ourlime administrator for a new invitation.',
  },
  closed: {
    title: 'Registration is currently closed.',
    detail: 'New account registration is temporarily unavailable. Existing members can still log in.',
  },
  invalid: {
    title: 'This invitation link is invalid.',
    detail: 'The link may be incomplete or no longer available.',
  },
  expired: {
    title: 'This invitation has expired.',
    detail: 'Ask an Ourlime administrator for a new invitation.',
  },
  revoked: {
    title: 'This invitation has been revoked.',
    detail: 'Contact an Ourlime administrator if you need another invitation.',
  },
  used: {
    title: 'This invitation has already been used.',
    detail: 'Invitation links cannot be reused after registration.',
  },
};

export default function BetaAccessView({ state }: BetaAccessViewProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 540;
  const message = messages[state] ?? messages.invite_required;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Bar: Back to feeds */}
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)')}
        style={{
          position: 'absolute',
          top: 50,
          left: 20,
          zIndex: 10,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
        }}
      >
        <Ionicons name="arrow-back" size={16} color="#ffffff" style={{ marginRight: 6 }} />
        <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Back to feeds</Text>
      </TouchableOpacity>

      {/* Ambient background glow orbs */}
      <View
        style={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(16,185,129,0.12)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -100,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(59,130,246,0.12)',
        }}
      />

      {/* Main Glass Card matching website design */}
      <View
        style={{
          width: '100%',
          maxWidth: 620,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: '#121212',
          paddingHorizontal: isWide ? 44 : 24,
          paddingVertical: 40,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.6,
          shadowRadius: 24,
        }}
      >
        {/* User / Lock Badge */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundColor: 'rgba(16,185,129,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Ionicons
            name={state === 'invite_required' ? 'person-add-outline' : 'lock-closed-outline'}
            size={30}
            color="#10b981"
          />
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: isWide ? 26 : 22,
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: isWide ? 34 : 28,
            maxWidth: 500,
          }}
        >
          {message.title}
        </Text>

        {/* Detail */}
        <Text
          style={{
            fontSize: 15,
            color: '#94a3b8',
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 22,
            maxWidth: 480,
          }}
        >
          {message.detail}
        </Text>

        {/* Action Buttons: Side-by-Side on wide screens, stacked on small mobile */}
        <View
          style={{
            width: '100%',
            marginTop: 32,
            flexDirection: isWide ? 'row' : 'column',
            gap: 12,
            justifyContent: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{
              flex: isWide ? 1 : undefined,
              width: isWide ? undefined : '100%',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              backgroundColor: 'rgba(255,255,255,0.03)',
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
              Login for Existing Users
            </Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}
