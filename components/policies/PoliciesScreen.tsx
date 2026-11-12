import { useEffect, useState } from 'react';
import { Image, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowUp, ChevronDown, ChevronRight, ExternalLink, Link2, ShieldCheck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { policyDocumentService, type PolicyDocument } from '@/lib/services/PolicyDocumentService';
import PolicyPageHeader from '@/components/policies/PolicyPageHeader';
import PolicySectionContent from '@/components/policies/PolicySectionContent';
import { PolicyScrollView, usePolicyAnchorScroll } from '@/components/policies/PolicyScrollView';

const LOGO = require('@/assets/transparentLogo.png');
const GREEN = '#10b981';

type PoliciesScreenProps = {
  /** A policy id or a section id (the website's #anchor) to open at. */
  initialAnchor?: string;
  title?: string;
};

/**
 * The website's /policies page (also served at /privacy-policy): every Ourlime policy in full, a "Jump to a policy"
 * list with each policy's sections, and a shareable link for every policy and section heading.
 */
export default function PoliciesScreen({ initialAnchor, title = 'Policies & Guidelines' }: PoliciesScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const policies = policyDocumentService.getAll();
  const { scrollRef, scrollToAnchor, onAnchorLayout, scrollToTop } = usePolicyAnchorScroll();
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [showTopButton, setShowTopButton] = useState(false);

  useEffect(() => {
    if (initialAnchor) scrollToAnchor(initialAnchor, false);
  }, [initialAnchor, scrollToAnchor]);

  const handleShare = (anchorId: string, label: string): void => {
    const url = policyDocumentService.getShareUrl(anchorId);
    Share.share({ message: `${label}\n${url}`, url }).catch((error: unknown) => console.error('[PoliciesScreen.handleShare] Error:', error));
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PolicyPageHeader title={title} />
      <PolicyScrollView
        scrollRef={scrollRef}
        scrollEventThrottle={64}
        onScroll={(event) => setShowTopButton(event.nativeEvent.contentOffset.y > 900)}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <View style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.successSurface }}>
          <TouchableOpacity accessibilityRole="link" accessibilityLabel="Go to Ourlime home" onPress={() => router.replace('/')} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
            <Image source={LOGO} style={{ width: 36, height: 36 }} resizeMode="contain" />
            <Text style={{ marginLeft: 8, color: colors.accentText, fontSize: 18, fontWeight: '800' }}>Ourlime</Text>
          </TouchableOpacity>
          <Text style={{ marginTop: 16, color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' }}>Trust, safety, and accountability</Text>
          <Text style={{ marginTop: 6, color: colors.text, fontSize: 26, fontWeight: '900', lineHeight: 31 }}>Policies and Community Standards</Text>
          <Text style={{ marginTop: 10, color: colors.secondaryText, fontSize: 15, lineHeight: 22 }}>Use the list below to jump to any policy or section. Every heading has a direct, shareable link.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/child-safety-standards')} style={{ marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, backgroundColor: '#047857' }}>
            <ShieldCheck size={17} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontWeight: '800' }}>View Child Safety Standards</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>Jump to a policy</Text>
          <View style={{ marginTop: 8 }}>
            {policies.map((policy) => (
              <PolicyNavigationItem
                key={policy.id}
                policy={policy}
                expanded={expandedPolicyId === policy.id}
                colors={colors}
                onToggle={() => setExpandedPolicyId((current) => (current === policy.id ? null : policy.id))}
                onJump={scrollToAnchor}
              />
            ))}
          </View>
          <TouchableOpacity accessibilityRole="link" onPress={() => router.push('/terms-and-conditions')} style={{ marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Terms and Conditions</Text>
            <ExternalLink size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>

        {policies.map((policy) => (
          <View key={policy.id} onLayout={onAnchorLayout(policy.id)} style={{ marginTop: 18, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.control }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 28 }}>{policy.title}</Text>
                <Text style={{ marginTop: 6, color: colors.mutedText, fontSize: 13 }}>Effective: {policy.effectiveDate} · Last updated: {policy.lastUpdated}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Share the direct link to ${policy.title}`} onPress={() => handleShare(policy.id, policy.title)} style={{ padding: 8 }}>
                <Link2 size={19} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <View onLayout={onAnchorLayout(`${policy.id}__body`, policy.id)} style={{ padding: 18, gap: 26 }}>
              {policy.sections.map((section, sectionIndex) => {
                const sectionId = policyDocumentService.getSectionId(policy.id, section, sectionIndex);
                return (
                  <View key={sectionId} onLayout={onAnchorLayout(sectionId, `${policy.id}__body`)} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 24 }}>{section.number} {section.title}</Text>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Share the direct link to ${section.number} ${section.title}`} onPress={() => handleShare(sectionId, `${policy.title}: ${section.number} ${section.title}`)} style={{ padding: 6, marginTop: -2 }}>
                        <Link2 size={16} color={colors.mutedText} />
                      </TouchableOpacity>
                    </View>
                    <PolicySectionContent section={section} colors={colors} />
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </PolicyScrollView>
      {showTopButton ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to the policy list" onPress={scrollToTop} style={{ position: 'absolute', right: 18, bottom: 28, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          <ArrowUp size={22} color="#ffffff" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

type PolicyNavigationItemProps = {
  policy: PolicyDocument;
  expanded: boolean;
  colors: AppThemeColors;
  onToggle: () => void;
  onJump: (anchorId: string) => void;
};

function PolicyNavigationItem({ policy, expanded, colors, onToggle, onJump }: PolicyNavigationItemProps) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 }}>{policy.title}</Text>
        {expanded ? <ChevronDown size={18} color={colors.icon} /> : <ChevronRight size={18} color={colors.icon} />}
      </TouchableOpacity>
      {expanded ? (
        <View style={{ marginBottom: 10, marginLeft: 4, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.border }}>
          <TouchableOpacity onPress={() => onJump(policy.id)} style={{ paddingVertical: 7 }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>Policy overview</Text>
          </TouchableOpacity>
          {policy.sections.map((section, sectionIndex) => {
            const sectionId = policyDocumentService.getSectionId(policy.id, section, sectionIndex);
            return (
              <TouchableOpacity key={sectionId} onPress={() => onJump(sectionId)} style={{ paddingVertical: 7 }}>
                <Text style={{ color: colors.secondaryText, lineHeight: 20 }}>{section.number} {section.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
