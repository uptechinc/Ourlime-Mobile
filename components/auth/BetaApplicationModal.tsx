import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ApiService } from '@/lib/services/ApiService';
import { Ionicons } from '@expo/vector-icons';

type BetaApplicationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function BetaApplicationModal({ isOpen, onClose }: BetaApplicationModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const submitApplication = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await ApiService.getInstance().request<{ success?: boolean; error?: string }>('/api/beta/apply', {
        method: 'POST',
        body: { fullName: fullName.trim(), email: email.trim(), invitedBy: invitedBy.trim() },
      });
      if (response && response.success === false) {
        throw new Error(response.error || 'Unable to submit your application');
      }
      setSubmitted(true);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFullName('');
    setEmail('');
    setInvitedBy('');
    setError('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
      >
        <View style={{ width: '100%', maxWidth: 500, backgroundColor: '#090d16', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>Apply to Be a Beta Tester</Text>
              <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>Tell us who you are and how to contact you.</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={{ padding: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-circle" size={40} color="#10b981" />
              </View>
              <Text style={{ fontSize: 15, color: '#cbd5e1', textAlign: 'center', lineHeight: 22 }}>
                Thank you for applying to become an OurLime beta tester. We will email you if your application is approved.
              </Text>
              <TouchableOpacity onPress={handleClose} style={{ marginTop: 24, width: '100%', backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Full Name */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 6 }}>
                  Full Name <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  placeholderTextColor="#64748b"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 15 }}
                />
              </View>

              {/* Email Address */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 6 }}>
                  Email Address <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="john@example.com"
                  placeholderTextColor="#64748b"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 15 }}
                />
              </View>

              {/* Invited By */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 6 }}>
                  Invited By <Text style={{ fontSize: 12, fontWeight: '400', color: '#64748b' }}>(optional)</Text>
                </Text>
                <TextInput
                  value={invitedBy}
                  onChangeText={setInvitedBy}
                  placeholder="Referrer name or code"
                  placeholderTextColor="#64748b"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff', fontSize: 15 }}
                />
              </View>

              {error ? (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: '#fca5a5', fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={submitApplication}
                disabled={submitting}
                style={{ backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 14, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
