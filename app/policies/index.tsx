import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PrivacyModal from '@/components/auth/PrivacyModal';
import TermsModal from '@/components/auth/TermsModal';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type Guideline = {
  title: string;
  detail: string;
  icon: 'heart' | 'shield-checkmark' | 'lock-closed' | 'flag' | 'people';
};

const GUIDELINES: readonly Guideline[] = [
  { title: 'Treat people with dignity', detail: 'Harassment, bullying, hate speech, threats, stalking, and targeted humiliation are not permitted.', icon: 'heart' },
  { title: 'Protect children', detail: 'Child sexual abuse or exploitation, grooming, trafficking, sextortion, sexualisation, and suspected CSAM are strictly prohibited.', icon: 'shield-checkmark' },
  { title: 'Respect privacy and consent', detail: 'Do not expose private information, impersonate others, or share intimate or sensitive material without consent.', icon: 'lock-closed' },
  { title: 'Report responsibly', detail: 'Use the report action on the relevant profile, post, comment, message, Lime, community, or other content. Submit reports in good faith.', icon: 'flag' },
  { title: 'Keep communities authentic', detail: 'Avoid scams, deceptive promotion, spam, coordinated manipulation, and content that violates applicable law.', icon: 'people' },
];

export default function PoliciesRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.navigation }}>
      <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 6 }}><Ionicons name="chevron-back" size={26} color={colors.icon} /></TouchableOpacity>
      <Text style={{ marginLeft: 7, color: colors.text, fontSize: 20, fontWeight: '900' }}>Policies & Guidelines</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 42 }}>
      <View style={{ padding: 18, borderRadius: 21, backgroundColor: colors.successSurface }}>
        <Ionicons name="people" size={30} color={colors.accent} />
        <Text style={{ marginTop: 9, color: colors.text, fontSize: 22, fontWeight: '900' }}>Community Guidelines</Text>
        <Text style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 21 }}>Ourlime is built for safe, useful, and respectful communities. These standards apply to profiles, posts, comments, messages, Limes, communities, events, listings, courses, and blogs.</Text>
      </View>
      <View style={{ marginTop: 14, gap: 10 }}>{GUIDELINES.map((guideline) => <GuidelineCard key={guideline.title} guideline={guideline} colors={colors} />)}</View>
      <View style={{ marginTop: 18, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>How reports are handled</Text>
        <Text style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 21 }}>Ordinary reports enter Ourlime moderation. A child-safety reason is separated into the restricted Child Safety system for administrators and explicitly granted reviewers. The reported person is not shown the reporter&apos;s identity.</Text>
        <Text style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 21 }}>Content may be hidden or accounts restricted while identifiers and an auditable action history are preserved where legally permitted or required.</Text>
      </View>
      <View style={{ marginTop: 14, gap: 9 }}>
        <PolicyLink title="Child Safety Standards" detail="Read Ourlime's public child protection commitments" icon="shield-checkmark" onPress={() => router.push('/child-safety-standards')} colors={colors} />
        <PolicyLink title="Privacy Policy" detail="How Ourlime collects, uses, and protects information" icon="lock-closed" onPress={() => setPrivacyOpen(true)} colors={colors} />
        <PolicyLink title="Terms and Conditions" detail="Rules governing access to and use of Ourlime" icon="document-text" onPress={() => setTermsOpen(true)} colors={colors} />
        <PolicyLink title="Help & Support" detail="Reporting guidance and safety resources" icon="help-circle" onPress={() => router.push('/help')} colors={colors} />
      </View>
    </ScrollView>
    <PrivacyModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
  </SafeAreaView>;
}

type GuidelineCardProps = { guideline: Guideline; colors: AppThemeColors };
function GuidelineCard({ guideline, colors }: GuidelineCardProps) {
  return <View style={{ flexDirection: 'row', padding: 15, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Ionicons name={guideline.icon} size={22} color={colors.accent} /><View style={{ flex: 1, marginLeft: 11 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{guideline.title}</Text><Text style={{ marginTop: 4, color: colors.secondaryText, lineHeight: 20 }}>{guideline.detail}</Text></View></View>;
}

type PolicyLinkProps = { title: string; detail: string; icon: 'shield-checkmark' | 'lock-closed' | 'document-text' | 'help-circle'; onPress: () => void; colors: AppThemeColors };
function PolicyLink({ title, detail, icon, onPress, colors }: PolicyLinkProps) {
  return <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Ionicons name={icon} size={22} color={colors.accent} /><View style={{ flex: 1, marginLeft: 11 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text><Text style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.icon} /></TouchableOpacity>;
}
