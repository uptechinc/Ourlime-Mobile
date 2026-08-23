import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type PrivacyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
};

export default function PrivacyModal({ isOpen, onClose, onAccept }: PrivacyModalProps) {
  if (!isOpen) return null;

  const handleAccept = () => {
    onAccept?.();
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <SwipeDismissSurface visible={isOpen} onDismiss={onClose} handleColor="#475569" accessibilityLabel="Swipe down to close privacy policy" style={{ width: '100%', maxWidth: 540, maxHeight: '85%', backgroundColor: '#090d16', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="shield-checkmark" size={24} color="#10b981" />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>Privacy Policy</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
            <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '700', marginBottom: 12 }}>Effective Date: December 7th, 2024</Text>
            <Text style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 22, marginBottom: 16 }}>
              At Ourlime Communities Network (OCN), your privacy and trust are our top priorities. This Privacy Policy explains how we collect, use, protect, and share your information when you use our platform.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>1. Our Commitment to Your Privacy</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              We are committed to providing you with as much control and privacy as possible while ensuring a secure experience. All personal information remains confidential and protected.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>2. Information We Collect</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              We collect profile information you provide (such as name, username, email), interaction data, and uploaded media to personalize your experience.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>3. How We Use Information</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 12 }}>
              Your information is used strictly to operate the platform, authenticate your session, deliver notifications, and improve community safety.
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 12, marginBottom: 6 }}>4. Data Protection and Sharing</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 16 }}>
              We never sell your personal data. Data is shared only when required by law or with your explicit consent.
            </Text>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
            {onAccept && (
              <TouchableOpacity onPress={handleAccept} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Accept Policy</Text>
              </TouchableOpacity>
            )}
          </View>
        </SwipeDismissSurface>
      </View>
    </Modal>
  );
}
