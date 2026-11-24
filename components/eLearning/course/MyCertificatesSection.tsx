import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Award } from 'lucide-react-native';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { CERTIFICATE_LABEL, formatCertificateDate, NAME_DISPLAY_OPTIONS } from '@/lib/services/LearningDepthRules';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { Certificate, CertificateNameDisplay } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type MyCertificatesSectionProps = { reloadKey: number };

/**
 * The learner's verified certificates with their two privacy choices: how their name shows on the public check, and
 * whether the certificate shows on their Ourlime profile (off by default; a younger learner sees why before turning it
 * on and never shows more than their first name and initial).
 */
export default function MyCertificatesSection({ reloadKey }: MyCertificatesSectionProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCertificates(await learningDepthService.getMyCertificates());
    } catch (loadError: unknown) {
      console.error('[MyCertificatesSection.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your certificates could not load.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const save = async (certificate: Certificate, preferences: { nameDisplay?: CertificateNameDisplay; showOnProfile?: boolean }) => {
    setSavingId(certificate.id);
    setError(null);
    try {
      const updated = await learningDepthService.setCertificatePreferences(certificate.id, preferences);
      setCertificates((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (saveError: unknown) {
      console.error('[MyCertificatesSection.save] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setError(serverMessage(saveError, 'Your choice could not be saved. Please try again.'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>My certificates</Text>
      <Text style={styles.muted}>Verified by Ourlime when you finish a course. Choose how your name shows and whether each one appears on your profile.</Text>
      {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      {!isLoading && certificates.length === 0 && !error ? <Text style={styles.empty}>No certificates yet. Finish a course and Ourlime issues one after checking your work.</Text> : null}
      {certificates.map((certificate) => {
        const isSaving = savingId === certificate.id;
        const options = certificate.isMinor ? NAME_DISPLAY_OPTIONS.filter((option) => option.value !== 'name') : NAME_DISPLAY_OPTIONS;
        return (
          <View key={certificate.id} style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open certificate for ${certificate.courseTitle}`} android_ripple={RIPPLE} onPress={() => router.push(`/eLearning/certificates/${encodeURIComponent(certificate.code)}` as Href)} style={styles.top}>
              <Award size={20} color={colors.warningText} />
              <View style={styles.flexText}>
                <Text style={styles.title} numberOfLines={2}>{certificate.courseTitle}</Text>
                <Text style={styles.muted}>{[`Issued ${formatCertificateDate(certificate.issuedAt)}`, certificate.status === 'revoked' ? 'Revoked' : null].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.small}>{CERTIFICATE_LABEL}</Text>
              </View>
            </Pressable>
            {certificate.status === 'revoked' && certificate.statusReason ? <Text style={styles.revoked}>{certificate.statusReason}</Text> : null}

            <Text style={styles.label}>Name on the public check</Text>
            <View style={styles.chips}>
              {options.map((option) => {
                const isSelected = certificate.nameDisplay === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: isSaving }}
                    disabled={isSaving}
                    android_ripple={RIPPLE}
                    onPress={() => void save(certificate, { nameDisplay: option.value })}
                    style={[styles.chip, isSelected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.muted}>Shows as: {certificate.learnerName || 'no name'}</Text>

            <View style={styles.toggleRow}>
              <View style={styles.flexText}>
                <Text style={styles.title}>Show on my profile</Text>
                <Text style={styles.muted}>
                  {certificate.isMinor
                    ? 'Off unless you turn it on. Signed-in Ourlime members who open your profile would see the course and date, marked "Verified by Ourlime". Talk to a parent or guardian first.'
                    : 'Signed-in members who open your profile see the course and date, marked "Verified by Ourlime".'}
                </Text>
              </View>
              <Switch
                accessibilityLabel={`Show ${certificate.courseTitle} on my profile`}
                value={certificate.showOnProfile}
                disabled={isSaving || certificate.status === 'revoked'}
                onValueChange={(value) => void save(certificate, { showOnProfile: value })}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  section: { gap: 10, marginTop: 24 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  small: { color: colors.mutedText, fontSize: 12, lineHeight: 16 },
  empty: { color: colors.mutedText, fontSize: 14, lineHeight: 20, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  error: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  card: { padding: 14, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  top: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 10, overflow: 'hidden', borderRadius: 12 },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  revoked: { color: colors.destructiveText, fontSize: 13, lineHeight: 18, padding: 10, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.successText, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: colors.control },
});
