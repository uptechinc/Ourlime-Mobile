import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, ShieldCheck, ShieldX } from 'lucide-react-native';
import { ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER } from '@/components/eLearning/ELearningParts';
import CustomModal from '@/components/ui/CustomModal';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { CERTIFICATE_LABEL, certificateWebLink, formatCertificateDate } from '@/lib/services/LearningDepthRules';
import { contentShareService } from '@/lib/services/ContentShareService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { PublicCertificate } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const CONTENT_MAX_WIDTH = 720;
type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'found'; certificate: PublicCertificate };

/**
 * An Ourlime completion certificate by its code: the same facts and status anyone can check on the website (course,
 * version, issuer, instructor, criteria, dates and the name the learner chose to show). Share sends the website link;
 * printing or saving a PDF happens on the website. It always says it is not an accredited qualification.
 */
export default function CertificateScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const certificateCode = typeof code === 'string' ? decodeURIComponent(code).toUpperCase() : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const certificate = await learningDepthService.getPublicCertificate(certificateCode);
      setState(certificate ? { kind: 'found', certificate } : { kind: 'missing' });
    } catch (error: unknown) {
      console.error('[CertificateScreen.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      setState({ kind: 'error' });
    }
  }, [certificateCode]);

  useEffect(() => { void load(); }, [load]);

  const handleShare = async (certificate: PublicCertificate) => {
    try {
      await contentShareService.shareExternally({ title: `Ourlime certificate: ${certificate.courseTitle}`, message: `Check my Ourlime course certificate for ${certificate.courseTitle}.`, url: certificateWebLink(certificate.code) });
    } catch (error: unknown) {
      console.error('[CertificateScreen.handleShare] Error:', error instanceof Error ? error.message : 'Unknown error');
      setNotice('Sharing is not available on this device.');
    }
  };

  const handleOpenWeb = async (certificate: PublicCertificate) => {
    try {
      await Linking.openURL(certificateWebLink(certificate.code));
    } catch (error: unknown) {
      console.error('[CertificateScreen.handleOpenWeb] Error:', error instanceof Error ? error.message : 'Unknown error');
      setNotice('The website could not be opened on this device.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Certificate" subtitle={certificateCode || undefined} onBack={() => router.back()} />
      {state.kind === 'loading' ? (
        <View style={styles.centerFill}><ActivityIndicator color={colors.accent} /></View>
      ) : state.kind === 'missing' ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<Award size={40} color={colors.mutedText} />} title="No certificate with this code" hint="Check the code. Ourlime certificate codes look like OLC-ABCD-EFGH-JKMN." />
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<Award size={40} color={colors.mutedText} />} title="The certificate could not be checked" hint="Check your connection and try again." actionLabel="Try again" onAction={() => void load()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <View style={styles.document}>
              <View style={[styles.status, state.certificate.status === 'revoked' ? styles.statusRevoked : styles.statusValid]} accessibilityRole="text">
                {state.certificate.status === 'revoked' ? <ShieldX size={16} color={colors.destructiveText} /> : <ShieldCheck size={16} color={colors.successText} />}
                <Text style={[styles.statusText, { color: state.certificate.status === 'revoked' ? colors.destructiveText : colors.successText }]}>
                  {state.certificate.status === 'revoked' ? `Revoked by the issuer on ${formatCertificateDate(state.certificate.statusChangedAt)}` : 'Valid certificate'}
                </Text>
              </View>
              <Award size={40} color={colors.warningText} />
              <Text style={styles.kicker}>CERTIFICATE OF COMPLETION</Text>
              <Text style={styles.muted}>{state.certificate.learnerName ? 'This certifies that' : 'The learner (name not shown, by their choice) completed the course'}</Text>
              {state.certificate.learnerName ? <Text style={styles.name}>{state.certificate.learnerName}</Text> : null}
              {state.certificate.learnerName ? <Text style={styles.muted}>completed the course</Text> : null}
              <Text accessibilityRole="header" style={styles.courseTitle}>{state.certificate.courseTitle}</Text>
              <Text style={styles.muted}>Course version {state.certificate.courseVersion}</Text>

              <View style={styles.facts}>
                <Fact styles={styles} label="Issued by" value={`Ourlime${state.certificate.instructorName ? `, taught by ${state.certificate.instructorName}` : ''}`} />
                <Fact styles={styles} label="Completed" value={formatCertificateDate(state.certificate.completedAt) || formatCertificateDate(state.certificate.issuedAt)} />
                <Fact styles={styles} label="What it took" value={state.certificate.criteria} />
                <Fact styles={styles} label="Certificate code" value={state.certificate.code} />
                {state.certificate.correctedAt ? <Fact styles={styles} label="Corrected" value={`The issuer corrected this certificate on ${formatCertificateDate(state.certificate.correctedAt)}. The details above are the current ones.`} /> : null}
              </View>
              <Text style={styles.label}>{CERTIFICATE_LABEL}. It shows that the learner finished an Ourlime course; it is not a degree, diploma or professional licence.</Text>
            </View>

            <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => void handleShare(state.certificate)} style={styles.primary}>
              <Text style={styles.primaryText}>Share link</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityHint="Opens the public check on ourlime.com, where you can print it or save a PDF" android_ripple={RIPPLE} onPress={() => void handleOpenWeb(state.certificate)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Open on the website to print or save</Text>
            </Pressable>
            <Text style={styles.muted}>Anyone with the link sees only these facts and whether the certificate is still valid.</Text>
          </View>
        </ScrollView>
      )}
      <CustomModal visible={notice !== null} type="info" title="Certificate" message={notice ?? ''} confirmText="OK" onConfirm={() => setNotice(null)} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

function Fact({ styles, label, value }: { styles: ReturnType<typeof createStyles>; label: string; value: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 12 },
  document: { alignItems: 'center', gap: 6, padding: 20, borderRadius: 20, borderWidth: 3, borderColor: '#047857', backgroundColor: colors.surface },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 6 },
  statusValid: { backgroundColor: colors.successSurface },
  statusRevoked: { backgroundColor: colors.destructiveSurface },
  statusText: { fontSize: 13, fontWeight: '800' },
  kicker: { color: colors.accentText, fontSize: 12, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  name: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  courseTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  facts: { alignSelf: 'stretch', gap: 8, marginTop: 10 },
  fact: { padding: 10, borderRadius: 12, backgroundColor: colors.control },
  factLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 2 },
  label: { color: colors.secondaryText, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center', marginTop: 10, padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#047857', overflow: 'hidden' },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
  secondaryText: { color: colors.accentText, fontSize: 15, fontWeight: '700' },
});
