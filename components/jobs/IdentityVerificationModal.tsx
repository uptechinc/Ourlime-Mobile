import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Camera, Clock, IdCard, ShieldAlert, ShieldOff, X, type LucideIcon } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import VerificationUploadModal from '@/components/auth/VerificationUploadModal';
import { JOBS_ACTION_GREEN, getJobToneColors, type JobTone } from '@/components/jobs/JobCardParts';

type VerificationStatus = 'required' | 'pending' | 'rejected' | 'expired';

type IdentityVerificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  verificationStatus?: string | null;
  message?: string;
};

type StatusConfig = {
  Icon: LucideIcon;
  tone: JobTone;
  title: string;
  description: string;
  primaryAction: string;
  showPrimary: boolean;
  secondaryAction: string;
};

const STATUS_CONFIG: { [status in VerificationStatus]: StatusConfig } = {
  required: {
    Icon: ShieldAlert,
    tone: 'warning',
    title: 'Verify your identity',
    description:
      'To apply for jobs or create postings on Ourlime, you must verify your identity. This protects our community from fraud and ensures a safe marketplace for everyone.',
    primaryAction: 'Start verification',
    showPrimary: true,
    secondaryAction: 'Not now',
  },
  pending: {
    Icon: Clock,
    tone: 'info',
    title: 'Verification pending',
    description:
      'Your identity documents have been submitted and are under review. This usually takes 1-2 business days. We will notify you once completed.',
    primaryAction: 'Start verification',
    showPrimary: false,
    secondaryAction: 'Close',
  },
  rejected: {
    Icon: ShieldOff,
    tone: 'danger',
    title: 'Verification not approved',
    description:
      'Your previous verification was not approved. Please submit new, clear identification documents to proceed.',
    primaryAction: 'Resubmit documents',
    showPrimary: true,
    secondaryAction: 'Not now',
  },
  expired: {
    Icon: ShieldOff,
    tone: 'warning',
    title: 'Verification expired',
    description:
      'Your verification has expired. Please restart the verification process to regain full access.',
    primaryAction: 'Restart verification',
    showPrimary: true,
    secondaryAction: 'Not now',
  },
};

/** What the upload step asks for (components/auth/VerificationUploadModal). */
const WHAT_YOU_NEED: { Icon: LucideIcon; text: string }[] = [
  { Icon: IdCard, text: 'A national ID, passport, driver’s licence or student ID' },
  { Icon: Camera, text: 'Clear photos of the ID and one of you holding it' },
];

function resolveStatus(status?: string | null): VerificationStatus {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  return 'required';
}

/**
 * Shown when an action needs a verified identity (jobs, events, blogs, communities). It says why, what the upload
 * needs, and opens the upload; a pending review only explains the wait.
 */
export default function IdentityVerificationModal({ isOpen, onClose, verificationStatus, message }: IdentityVerificationModalProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isOpen && !isUploadModalOpen) return null;

  const currentStatus = resolveStatus(verificationStatus);
  const config = STATUS_CONFIG[currentStatus];
  const tone = getJobToneColors(config.tone, colors, isDark);
  const StatusIcon = config.Icon;

  const handleStartVerification = () => {
    setIsUploadModalOpen(true);
  };

  return (
    <>
      <Modal visible={isOpen && !isUploadModalOpen} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={4} android_ripple={{ color: 'rgba(15,23,42,0.12)', borderless: true }} style={styles.closeButton}>
              <X size={22} color={colors.icon} />
            </Pressable>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
              <View style={[styles.iconContainer, { backgroundColor: tone.surface }]}>
                <StatusIcon size={30} color={tone.text} />
              </View>
              <Text accessibilityRole="header" style={styles.title}>{config.title}</Text>
              <Text style={styles.description}>{message ?? config.description}</Text>
              {config.showPrimary ? (
                <View style={styles.needs}>
                  <Text style={styles.needsTitle}>What you’ll need</Text>
                  {WHAT_YOU_NEED.map((item) => (
                    <View key={item.text} style={styles.needRow}>
                      <item.Icon size={18} color={colors.accentText} />
                      <Text style={styles.needText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.actions}>
              {config.showPrimary ? (
                <Pressable accessibilityRole="button" onPress={handleStartVerification} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.primaryButton}>
                  <Text numberOfLines={1} style={styles.primaryText}>{config.primaryAction}</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={onClose} android_ripple={{ color: 'rgba(15,23,42,0.12)' }} style={styles.secondaryButton}>
                <Text numberOfLines={1} style={styles.secondaryText}>{config.secondaryAction}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <VerificationUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          onClose();
        }}
        onUploaded={() => {
          setIsUploadModalOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.modalScrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
    card: { width: '100%', maxWidth: 400, maxHeight: '100%', overflow: 'hidden', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    closeButton: { position: 'absolute', top: 8, right: 8, zIndex: 1, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8 },
    iconContainer: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
    description: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    needs: { alignSelf: 'stretch', gap: 10, marginTop: 4, padding: 14, borderRadius: 16, backgroundColor: colors.control },
    needsTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
    needRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    needText: { flex: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
    actions: { gap: 8, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
    primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', paddingHorizontal: 16, borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN },
    primaryText: { flexShrink: 1, color: '#ffffff', fontSize: 15, fontWeight: '800' },
    secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  });
}
