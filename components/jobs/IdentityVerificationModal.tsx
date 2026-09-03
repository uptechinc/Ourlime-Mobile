import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import {
  ShieldAlert,
  ShieldOff,
  Clock,
  X,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type VerificationStatus = 'required' | 'pending' | 'rejected' | 'expired';

type IdentityVerificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  verificationStatus?: string | null;
};

const STATUS_CONFIG: Record<
  VerificationStatus,
  {
    Icon: typeof ShieldAlert;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    primaryAction: string;
    showPrimary: boolean;
    secondaryAction: string;
  }
> = {
  required: {
    Icon: ShieldAlert,
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    title: 'Identity Verification Required',
    description:
      'To apply for jobs or create postings on Ourlime, you must verify your identity. This protects our community from fraud and ensures a safe marketplace for everyone.',
    primaryAction: 'Start Verification',
    showPrimary: true,
    secondaryAction: 'Continue Browsing',
  },
  pending: {
    Icon: Clock,
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    title: 'Verification Pending',
    description:
      'Your identity documents have been submitted and are under review. This usually takes 1-2 business days. We will notify you once completed.',
    primaryAction: 'Start Verification',
    showPrimary: false,
    secondaryAction: 'Close',
  },
  rejected: {
    Icon: ShieldOff,
    iconBg: '#fef2f2',
    iconColor: '#dc2626',
    title: 'Verification Rejected',
    description:
      'Your previous verification was not approved. Please submit new, clear identification documents to proceed.',
    primaryAction: 'Resubmit Documents',
    showPrimary: true,
    secondaryAction: 'Continue Browsing',
  },
  expired: {
    Icon: ShieldOff,
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    title: 'Verification Expired',
    description:
      'Your verification has expired. Please restart the verification process to regain full access.',
    primaryAction: 'Restart Verification',
    showPrimary: true,
    secondaryAction: 'Continue Browsing',
  },
};

function resolveStatus(status?: string | null): VerificationStatus {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  return 'required';
}

export default function IdentityVerificationModal({
  isOpen,
  onClose,
  verificationStatus,
}: IdentityVerificationModalProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  if (!isOpen) return null;

  const currentStatus = resolveStatus(verificationStatus);
  const config = STATUS_CONFIG[currentStatus];
  const StatusIcon = config.Icon;

  const handleStartVerification = () => {
    onClose();
    router.push('/profile' as Href);
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.mutedText} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
            <StatusIcon size={32} color={config.iconColor} />
          </View>

          {/* Texts */}
          <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
          <Text style={[styles.description, { color: colors.mutedText }]}>
            {config.description}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {config.showPrimary ? (
              <TouchableOpacity
                onPress={handleStartVerification}
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
              >
                <Text style={styles.primaryBtnText}>{config.primaryAction}</Text>
                <ArrowRight size={16} color="#ffffff" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.secondaryBtn,
                { borderColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc' },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                {config.secondaryAction}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
