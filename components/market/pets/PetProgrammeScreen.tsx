import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ClipboardCheck, HeartHandshake, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { PETS_HERO } from './PetsScreen';

const STEPS = [
  { icon: ClipboardCheck, title: 'Moderated listings', description: 'Member submissions remain private until an authorised moderator reviews them.' },
  { icon: MessageCircle, title: 'Private enquiries', description: 'Signed-in members can apply through Ourlime without exposing identity documents or public contact details.' },
  { icon: HeartHandshake, title: 'Tracked outcomes', description: 'Carers and the future adoption team can track applications and mark pets adoption pending or adopted.' },
] as const;

/** The website's /market/pets/programme. */
export default function PetProgrammeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Pets for Adoption" onPress={() => router.canGoBack() ? router.back() : router.replace('/market/pets' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.headerTitle}>Adoption Programme</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <ShieldCheck color="#d9f36a" size={38} />
        <Text accessibilityRole="header" style={styles.heroTitle}>Ourlime Adoption Programme</Text>
        <Text style={styles.heroText}>This is the digital foundation for a future member adoption programme. It supports moderated listings and secure applications, but does not represent that Ourlime is currently a licensed adoption agency.</Text>
      </View>
      {STEPS.map(({ icon: Icon, title, description }) => <View key={title} style={styles.step}>
        <Icon color={colors.accentText} size={26} />
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{description}</Text>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { padding: 24, gap: 14, borderRadius: 26, backgroundColor: PETS_HERO },
  heroTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900' },
  heroText: { color: '#ecfdf5', fontSize: 14, lineHeight: 22 },
  step: { padding: 20, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stepTitle: { marginTop: 6, color: colors.text, fontSize: 17, fontWeight: '900' },
  stepText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
});
