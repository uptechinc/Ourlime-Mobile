import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { X, Flag } from 'lucide-react-native';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';

const REPORT_REASONS = [
  'Spam',
  'Inappropriate content',
  'Violence',
  'Misinformation',
  'Harassment',
  'Other',
];

type ReportLimeModalProps = {
  visible: boolean;
  reelId: string;
  reportedUserId: string;
  reportType: 'lime' | 'user';
  onClose: () => void;
};

export default function ReportLimeModal({
  visible,
  reelId,
  reportedUserId,
  reportType,
  onClose,
}: ReportLimeModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setSelectedReason(null);
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const currentUserId = AuthService.getInstance().getCurrentUser()?.uid ?? '';
      await limeService.reportLime(reelId, reportedUserId, reportType, selectedReason, currentUserId);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedReason(null);
        onClose();
      }, 1600);
    } catch {
      // ignore silently
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop} />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Flag size={18} color="#ef4444" />
          <Text style={styles.title}>
            {reportType === 'user' ? 'Report User' : 'Report Lime'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {submitted ? (
          <View style={styles.successState}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Report submitted. Thank you!</Text>
            <Text style={styles.successSubtext}>We'll review this and take action if needed.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>Why are you reporting this?</Text>

            <View style={styles.reasonGrid}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  style={[styles.reasonChip, selectedReason === reason && styles.reasonChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => void handleSubmit()}
              disabled={!selectedReason || isSubmitting}
              style={[styles.submitBtn, (!selectedReason || isSubmitting) && styles.submitBtnDisabled]}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 14,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reasonChipActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  reasonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#ef4444',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  successState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  successIcon: {
    fontSize: 36,
  },
  successText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  successSubtext: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
