import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type TermsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
};

export default function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  if (!isOpen) return null;

  const handleAccept = () => {
    onAccept?.();
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <SwipeDismissSurface visible={isOpen} onDismiss={onClose} handleColor="#475569" accessibilityLabel="Swipe down to close terms" style={{ width: '100%', maxWidth: 540, maxHeight: '85%', backgroundColor: '#090d16', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text" size={24} color="#10b981" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>Terms and Conditions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
            <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '700', marginBottom: 12 }}>Effective Date: December 7th, 2024</Text>
            <Text style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 22, marginBottom: 16 }}>
              Welcome to Ourlime Communities Network (OCN)! These Terms and Conditions govern your access to and use of OCN, including our mobile application and related services. By accessing or using OCN, you agree to comply with these Terms.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>1. Eligibility</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              You must be 13 years or older to create an account or use OCN. If you are between 13 and 18, you confirm you have obtained parental or guardian consent.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>2. Account Creation and Security</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>3. User Conduct and Content</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              You retain ownership of the content you post, but grant OCN a license to display and distribute it. Harassment, hate speech, bullying, and illegal content are strictly prohibited.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>4. Privacy and Security</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 16 }}>
              Your use of OCN is also governed by our Privacy Policy. We do not sell your personal data to third parties.
            </Text>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
            {onAccept && (
              <TouchableOpacity onPress={handleAccept} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Accept Terms</Text>
              </TouchableOpacity>
            )}
          </View>
        </SwipeDismissSurface>
      </View>
    </Modal>
  );
}
