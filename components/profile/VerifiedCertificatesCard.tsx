import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { formatCertificateDate } from '@/lib/services/LearningDepthRules';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { ProfileCertificate } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type VerifiedCertificatesCardProps = { userId: string; isOwnProfile: boolean };

/**
 * The Digital Portfolio's verified part on a profile: Ourlime course certificates the member chose to show. It sits
 * apart from the self-reported Education and Work sections, and each entry opens its certificate check. Nothing shows
 * for other viewers unless the member turned it on in My learning.
 */
export default function VerifiedCertificatesCard({ userId, isOwnProfile }: VerifiedCertificatesCardProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [certificates, setCertificates] = useState<ProfileCertificate[]>([]);

  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    learningDepthService.getProfileCertificates(userId)
      .then((loaded) => { if (isActive) setCertificates(loaded); })
      .catch((error: unknown) => console.warn('[VerifiedCertificatesCard.load] Unavailable:', error instanceof Error ? error.message : 'Unknown error'));
    return () => { isActive = false; };
  }, [userId]);

  if (certificates.length === 0 && !isOwnProfile) return null;
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <BadgeCheck size={18} color={colors.accent} />
        <Text accessibilityRole="header" style={styles.heading}>Verified by Ourlime</Text>
      </View>
      <Text style={styles.muted}>Course completions checked and issued by Ourlime. Not accredited qualifications. Education and work are self-reported.</Text>
      {certificates.length === 0 ? (
        <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => router.push('/eLearning/my-learning' as Href)} style={styles.emptyButton}>
          <Text style={styles.muted}>Nothing shown yet. Your certificates stay private until you choose to show them in My learning.</Text>
        </Pressable>
      ) : certificates.map((certificate) => (
        <Pressable
          key={certificate.code}
          accessibilityRole="button"
          accessibilityLabel={`${certificate.courseTitle}, completed ${formatCertificateDate(certificate.completedAt)}. Open the certificate check`}
          android_ripple={RIPPLE}
          onPress={() => router.push(`/eLearning/certificates/${encodeURIComponent(certificate.code)}` as Href)}
          style={styles.row}
        >
          <View style={styles.flexText}>
            <Text style={styles.title} numberOfLines={2}>{certificate.courseTitle}</Text>
            <Text style={styles.muted}>{[`Completed ${formatCertificateDate(certificate.completedAt)}`, certificate.instructorName ? `taught by ${certificate.instructorName}` : ''].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={styles.check}>Check</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  emptyButton: { minHeight: 44, justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  check: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
});
