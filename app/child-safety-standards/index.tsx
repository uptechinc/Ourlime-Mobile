import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type SafetySection = {
  title: string;
  paragraphs: readonly string[];
};

const SAFETY_SECTIONS: readonly SafetySection[] = [
  { title: 'Prohibited conduct', paragraphs: ['Ourlime prohibits child sexual abuse and exploitation (CSAE), suspected child sexual abuse material (CSAM), grooming, predatory behaviour, sexualisation of minors, sextortion, solicitation, trafficking, threats, and inappropriate adult-to-minor communication.', 'Bullying, harassment, exposure of a child\'s private information, and suspicious account behaviour involving minors are also prohibited.'] },
  { title: 'Reporting inside Ourlime', paragraphs: ['Use Report on the relevant profile, post, media, comment, reply, message, conversation, Lime, community, event, Marketplace listing, course, or blog. Select a Child Safety concern so it enters the restricted safety workflow.', 'Ourlime automatically captures the original target identifier. Never download, copy, forward, email, upload, or redistribute suspected CSAM.'] },
  { title: 'Immediate danger', paragraphs: ['An Ourlime report does not replace emergency services. If a child is in immediate danger, contact the appropriate local emergency or law-enforcement authority as soon as it is safe to do so.'] },
  { title: 'Confidential review', paragraphs: ['Child-safety reports are not publicly readable. They are available only to administrators and explicitly granted Child Safety reviewers through authenticated server APIs. Ordinary clients and moderators cannot query the restricted case collections.', 'The identity of a reporter is not disclosed to the reported person. Ourlime may contact the reporter only when permission was provided and more information is needed.'] },
  { title: 'Enforcement and preservation', paragraphs: ['Authorized reviewers can assign, prioritize, escalate, document, preserve, and resolve cases, record moderation actions, and record a human referral to an appropriate authority.', 'Public content can be hidden while restricted identifiers, audit history, and legally permitted evidence references remain preserved. Ourlime does not automatically submit reports to authorities or automatically delete retained safety records.'] },
  { title: 'Compliance responsibilities', paragraphs: ['Ourlime maintains published standards, an in-app reporting mechanism, restricted response procedures, and a designated Child Safety contact. Software alone does not establish legal or Google Play compliance; trained operations, legal review, mandatory reporting procedures, and Play Console declarations remain required.'] },
];

export default function ChildSafetyStandardsRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.navigation }}>
      <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 6 }}><Ionicons name="chevron-back" size={26} color={colors.icon} /></TouchableOpacity>
      <Text style={{ flex: 1, marginLeft: 7, color: colors.text, fontSize: 20, fontWeight: '900' }}>Child Safety Standards</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 42 }}>
      <View style={{ padding: 18, borderRadius: 21, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructiveSurface }}>
        <Ionicons name="shield-checkmark" size={31} color={colors.destructiveText} />
        <Text style={{ marginTop: 10, color: colors.destructiveText, fontSize: 21, fontWeight: '900' }}>Zero tolerance for CSAE and CSAM</Text>
        <Text style={{ marginTop: 7, color: colors.destructiveText, lineHeight: 21 }}>Ourlime Communities Network, operated by Uptech Incorporated Ltd., strictly prohibits conduct or material that sexually abuses, exploits, grooms, traffics, sexualises, or otherwise endangers children.</Text>
      </View>
      <Text style={{ marginTop: 14, color: colors.mutedText, fontSize: 12, fontWeight: '700' }}>Public standards - Updated August 23, 2026</Text>
      <View style={{ marginTop: 4 }}>{SAFETY_SECTIONS.map((section) => <SafetySectionCard key={section.title} section={section} colors={colors} />)}</View>
      <View style={{ marginTop: 15, gap: 9 }}>
        <TouchableOpacity onPress={() => router.push('/help')} style={{ minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '900' }}>Report a Child Safety Concern</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => void Linking.openURL('mailto:ourlimechildsafety@gmail.com')} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Ionicons name="mail" size={19} color={colors.accent} /><Text style={{ marginLeft: 8, color: colors.accentText, fontWeight: '900' }}>ourlimechildsafety@gmail.com</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/policies')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontWeight: '800', textDecorationLine: 'underline' }}>Policies & Community Guidelines</Text></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

type SafetySectionCardProps = { section: SafetySection; colors: AppThemeColors };
function SafetySectionCard({ section, colors }: SafetySectionCardProps) {
  return <View style={{ marginTop: 11, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{section.title}</Text>{section.paragraphs.map((paragraph) => <Text key={paragraph} style={{ marginTop: 7, color: colors.secondaryText, lineHeight: 21 }}>{paragraph}</Text>)}</View>;
}
