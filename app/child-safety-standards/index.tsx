import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ExternalLink, Flag, Mail, ShieldCheck } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { policyDocumentService } from '@/lib/services/PolicyDocumentService';
import PolicyPageHeader from '@/components/policies/PolicyPageHeader';
import PolicySectionContent from '@/components/policies/PolicySectionContent';
import { PolicyScrollView, usePolicyAnchorScroll } from '@/components/policies/PolicyScrollView';

const CHILD_SAFETY_EMAIL = 'ourlimechildsafety@gmail.com';
const CHILDRENS_AUTHORITY_URL = 'https://ttchildren.org/report-child-abuse/';

function openExternal(url: string): void {
  Linking.openURL(url).catch((error: unknown) => console.error('[ChildSafetyStandardsRoute.openExternal] Error:', error));
}

/** The website's /child-safety-standards page: the full public Child Safety Standards Policy. */
export default function ChildSafetyStandardsRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const policy = policyDocumentService.getChildSafetyPolicy();
  const { scrollRef, scrollToAnchor, onAnchorLayout } = usePolicyAnchorScroll();

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PolicyPageHeader title="Child Safety Standards" />
      <PolicyScrollView scrollRef={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View onLayout={onAnchorLayout('policy-card')} style={{ overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.successSurface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color={colors.successText} />
              <Text style={{ color: colors.successText, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' }}>Public child safety standards</Text>
            </View>
            <Text style={{ marginTop: 12, color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 30 }}>{policy.title}</Text>
            <Text style={{ marginTop: 8, color: colors.secondaryText, fontWeight: '700' }}>Operated by Uptech Incorporated Ltd.</Text>
            <Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 13 }}>Effective: {policy.effectiveDate} · Last updated: {policy.lastUpdated}</Text>
          </View>

          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.destructiveSurface }}>
            <Text style={{ color: colors.destructiveText, fontSize: 17, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' }}>Zero tolerance for CSAE and CSAM</Text>
            <Text style={{ marginTop: 8, color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 24 }}>
              Ourlime Communities Network strictly prohibits Child Sexual Abuse and Exploitation (CSAE) and Child Sexual Abuse Material (CSAM) throughout the platform.
            </Text>
          </View>

          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Policy sections</Text>
            <View style={{ marginTop: 6 }}>
              {policy.sections.map((section) => (
                <TouchableOpacity key={section.number} onPress={() => scrollToAnchor(`section-${section.number}`)} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: colors.accentText, fontWeight: '600', lineHeight: 20 }}>{section.number} {section.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View onLayout={onAnchorLayout('policy-body', 'policy-card')} style={{ padding: 18, gap: 28 }}>
            {policy.sections.map((section) => (
              <View key={section.number} onLayout={onAnchorLayout(`section-${section.number}`, 'policy-body')} style={{ gap: 10 }}>
                <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', lineHeight: 25 }}>{section.number} {section.title}</Text>
                <PolicySectionContent section={section} colors={colors} />
              </View>
            ))}
          </View>

          <View style={{ padding: 18, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.control }}>
            <TouchableOpacity accessibilityRole="link" onPress={() => openExternal(`mailto:${CHILD_SAFETY_EMAIL}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Mail size={18} color={colors.accentText} />
              <Text style={{ color: colors.accentText, fontWeight: '800' }}>{CHILD_SAFETY_EMAIL}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
              <TouchableOpacity accessibilityRole="link" onPress={() => router.push('/policies')}>
                <Text style={{ color: colors.secondaryText, textDecorationLine: 'underline' }}>All Ourlime policies</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="link" onPress={() => openExternal(CHILDRENS_AUTHORITY_URL)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.secondaryText, textDecorationLine: 'underline' }}>Children&apos;s Authority reporting</Text>
                <ExternalLink size={13} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/help/child-safety/report')} style={{ marginTop: 16, minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.accent }}>
          <Flag size={18} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Report a Child Safety Concern</Text>
        </TouchableOpacity>
      </PolicyScrollView>
    </SafeAreaView>
  );
}
