import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Award, ShieldCheck } from 'lucide-react-native';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { CERTIFICATE_LABEL, formatCertificateDate, missingReasonLabel } from '@/lib/services/LearningDepthRules';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { Certificate, CertificateEligibility, Enrollment } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const MISSING_SHOWN = 6;

type CourseCertificateCardProps = { courseId: string; enrollment: Enrollment };

/**
 * The learner's completion certificate on the course home. Ourlime issues it on the server only after checking the
 * course's completion rules itself; this card asks for it, then shows the certificate (open, share) or what is still
 * missing. It always says it is an Ourlime course completion, not an accredited qualification.
 */
export default function CourseCertificateCard({ courseId, enrollment }: CourseCertificateCardProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [eligibility, setEligibility] = useState<CertificateEligibility | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = enrollment.certificateIssued === true || enrollment.status === 'completed';

  const check = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const result = await learningDepthService.claimCertificate(courseId);
      setCertificate(result.certificate);
      setEligibility(result.eligibility);
    } catch (checkError: unknown) {
      console.error('[CourseCertificateCard.check] Error:', checkError instanceof Error ? checkError.message : 'Unknown error');
      setError(serverMessage(checkError, 'Your certificate could not load. Check your connection and try again.'));
    } finally {
      setIsChecking(false);
    }
  }, [courseId]);

  useEffect(() => { if (finished) void check(); }, [finished, check]);

  const openCertificate = (code: string) => router.push(`/eLearning/certificates/${encodeURIComponent(code)}` as Href);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}><Award size={18} color={colors.warningText} /></View>
        <View style={styles.flexText}>
          <Text accessibilityRole="header" style={styles.title}>Completion certificate</Text>
          <Text style={styles.muted}>{CERTIFICATE_LABEL}.</Text>
        </View>
      </View>

      {isChecking && !certificate ? (
        <View style={styles.row}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Checking your progress…</Text></View>
      ) : certificate ? (
        <View style={styles.block} accessibilityLiveRegion="polite">
          {certificate.status === 'revoked' ? (
            <Text style={styles.revoked}>Revoked {formatCertificateDate(certificate.statusChangedAt)}. {certificate.statusReason}</Text>
          ) : (
            <View style={styles.row}><ShieldCheck size={16} color={colors.successText} /><Text style={styles.issued}>Issued {formatCertificateDate(certificate.issuedAt)}</Text></View>
          )}
          <Text style={styles.body}>{certificate.criteria}</Text>
          <Text style={styles.muted}>Code {certificate.code}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open your certificate" android_ripple={RIPPLE} onPress={() => openCertificate(certificate.code)} style={styles.primary}>
            <Text style={styles.primaryText}>Open certificate</Text>
          </Pressable>
        </View>
      ) : eligibility ? (
        <View style={styles.block}>
          <Text style={styles.body}>
            {eligibility.requiredCount === 0 ? 'This course has no lessons that count yet.' : `${eligibility.completedCount} of ${eligibility.requiredCount} required lessons done. Still to do:`}
          </Text>
          {eligibility.missing.slice(0, MISSING_SHOWN).map((item) => (
            <View key={item.lessonId} style={styles.missingRow}>
              <Text style={[styles.body, styles.flexText]} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.muted}>{missingReasonLabel(item.reason)}</Text>
            </View>
          ))}
          {eligibility.missing.length > MISSING_SHOWN ? <Text style={styles.muted}>and {eligibility.missing.length - MISSING_SHOWN} more</Text> : null}
        </View>
      ) : (
        <Text style={styles.body}>Finish every required lesson, submit each quiz and hand in each assignment. Ourlime then checks your work and issues the certificate.</Text>
      )}

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      {!certificate ? (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isChecking, busy: isChecking }} disabled={isChecking} android_ripple={RIPPLE} onPress={() => void check()} style={styles.secondary}>
          <Text style={styles.secondaryText}>{isChecking ? 'Checking…' : 'Check my certificate'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSurface },
  flexText: { flex: 1, minWidth: 0 },
  block: { gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  issued: { color: colors.successText, fontSize: 14, fontWeight: '700' },
  revoked: { color: colors.destructiveText, fontSize: 14, lineHeight: 20, fontWeight: '600', padding: 10, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  missingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.control },
  error: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden', marginTop: 4 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
  secondaryText: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
});
