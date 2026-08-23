import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { CheckCircle, ChevronLeft, ChevronRight, X, Flag, ShieldAlert } from 'lucide-react-native';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import { CHILD_SAFETY_REASON_CATEGORY, REPORT_REASONS, type ReportReasonCategory } from '@/lib/services/ModerationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ReportReasonCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const handleClose = () => {
    setSelectedReason(null);
    setSelectedCategory(null);
    setSubmitted(false);
    onClose();
  };
  const swipeDismiss = useSwipeDismiss({ visible, onDismiss: handleClose, disabled: isSubmitting });

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const currentUserId = AuthService.getInstance().getCurrentUser()?.uid ?? '';
      await limeService.reportLime(reelId, reportedUserId, reportType, selectedReason, currentUserId, selectedCategory);
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <View style={styles.backdrop} />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
        <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close Lime report" />

        <View style={styles.header}>
          {selectedCategory ? <TouchableOpacity onPress={() => { setSelectedCategory(null); setSelectedReason(null); }} style={styles.closeBtn}><ChevronLeft size={20} color={colors.icon} /></TouchableOpacity> : null}
          <Flag size={18} color={colors.destructive} />
          <Text style={styles.title}>
            {reportType === 'user' ? 'Report User' : 'Report Lime'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {submitted ? (
          <View style={styles.successState}>
            <CheckCircle size={42} color={colors.successText} />
            <Text style={styles.successText}>Report submitted. Thank you!</Text>
            <Text style={styles.successSubtext}>We'll review this and take action if needed.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>{selectedCategory ? 'Why are you reporting this?' : 'What type of issue is this?'}</Text>

            <View style={styles.reasonGrid}>
              {!selectedCategory ? (Object.entries(REPORT_REASONS) as [ReportReasonCategory, (typeof REPORT_REASONS)[ReportReasonCategory]][]).map(([category, group]) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.categoryRow, category === CHILD_SAFETY_REASON_CATEGORY && styles.childSafetyRow]}
                  activeOpacity={0.7}
                >
                  {category === CHILD_SAFETY_REASON_CATEGORY ? <ShieldAlert size={18} color={colors.destructiveText} /> : <Flag size={17} color={colors.icon} />}
                  <Text style={[styles.categoryText, category === CHILD_SAFETY_REASON_CATEGORY && styles.childSafetyText]}>{group.label}</Text>
                  <ChevronRight size={18} color={colors.icon} />
                </TouchableOpacity>
              )) : REPORT_REASONS[selectedCategory].reasons.map((reason) => (
                <TouchableOpacity key={reason} onPress={() => setSelectedReason(reason)} style={[styles.reasonChip, selectedReason === reason && styles.reasonChipActive]} activeOpacity={0.7}>
                  <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextActive]}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedCategory === CHILD_SAFETY_REASON_CATEGORY ? <View style={styles.childSafetyNotice}><Text style={styles.childSafetyNoticeTitle}>Do not attach or redistribute suspected CSAM.</Text><Text style={styles.childSafetyNoticeText}>The original Lime identifier is sent securely to Ourlime&apos;s Child Safety Unit.</Text></View> : null}

            {selectedCategory ? <TouchableOpacity
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
            </TouchableOpacity> : null}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
    marginBottom: 14,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  categoryRow: { width: '100%', minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  categoryText: { flex: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  childSafetyRow: { borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  childSafetyText: { color: colors.destructiveText },
  childSafetyNotice: { marginBottom: 18, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  childSafetyNoticeTitle: { color: colors.destructiveText, fontWeight: '800', fontSize: 13 },
  childSafetyNoticeText: { marginTop: 5, color: colors.destructiveText, fontSize: 12, lineHeight: 18 },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.control,
  },
  reasonChipActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  reasonText: {
    color: colors.mutedText,
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
  successText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  successSubtext: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: 'center',
  },
});
