import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import EHubSectionNav from '@/components/ehub/EHubSectionNav';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubLayout } from '@/components/ehub/EHubParts';
import { EHubScrollView, useEHubSectionScroll } from '@/components/ehub/EHubScrollView';
import { isEHubTermsSection, type EHubTermsSection } from '@/lib/services/EHubService';

type TermsSectionContent = { id: EHubTermsSection; title: string; points?: string[]; body?: string };

// Same sections and wording as the website's /ehub/terms.
const SECTIONS: TermsSectionContent[] = [
  {
    id: 'seller', title: 'EHub Seller Agreement', points: [
      'You own or are authorized to sell every catalog product.',
      'Product descriptions, prices, inventory, availability, fulfillment details, and store policies must be accurate.',
      'Products must be legal and authentic; unsafe, prohibited, counterfeit, or restricted products are forbidden.',
      'You are responsible for fulfillment and for clearly stated return and refund arrangements.',
      'You must comply with EHub policies and applicable laws and must not misrepresent verification, pricing, availability, or policies.',
      'Ourlime may review, reject, suspend, hide, or remove products or storefronts.',
    ],
  },
  {
    id: 'provider', title: 'Provider Declaration', points: [
      'You are authorized and qualified to offer the services described.',
      'Service scope, availability, areas served, pricing statements, and credentials must be accurate.',
      'Enquiries are not quotes, bookings, contracts, or payment commitments.',
      'You are responsible for lawful delivery, safety, cancellations, and any independently agreed terms.',
    ],
  },
  {
    id: 'catalog', title: 'Catalog and prohibited activity',
    body: 'EHub catalog products belong to an approved storefront. Casual or one-off person-to-person listings belong in Market and are not imported into EHub. Illegal goods, dangerous items, counterfeit goods, deceptive claims, and attempts to evade moderation are prohibited.',
  },
  {
    id: 'buyer', title: 'Buyer acknowledgement', points: [
      'Products and services are offered by independent sellers and providers, who supply their own descriptions and policies.',
      'Review prices, descriptions, fulfillment or service arrangements, seller policies, refund expectations, and provider information before proceeding.',
      'Availability can change. Delivery, pickup, and service arrangements depend on the seller or provider.',
      'Verification and reviews help with discovery but are not guarantees.',
      'Do not use EHub for prohibited or unlawful activity.',
      'Platform protections apply only where explicitly stated. Payments, escrow, booking protection, and platform-managed refunds are not active.',
    ],
  },
  {
    id: 'moderation', title: 'Moderation and safety',
    body: 'Ourlime may restrict accounts and remove storefronts, products, services, or enquiries that are misleading, unsafe, prohibited, unlawful, or inconsistent with these rules.',
  },
];

/** The website's /ehub/terms in the app. ?section=seller|provider|catalog|buyer|moderation opens at that section (the website's #anchors). */
export default function EHubTermsScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const { scrollRef, scrollToSection, onContainerLayout, onSectionLayout } = useEHubSectionScroll<EHubTermsSection>();

  const canReturn = router.canGoBack();
  const handleReturn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/ehub' as Href);
  };

  useEffect(() => {
    if (isEHubTermsSection(section)) scrollToSection(section, false);
  }, [scrollToSection, section]);

  return (
    <View style={styles.screen}>
      <PageHeader title="Terms & safety" onBackPress={() => router.back()} />
      <EHubSectionNav currentLabel="Terms & safety" />
      <EHubScrollView scrollRef={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View onLayout={onContainerLayout} style={[styles.article, { width: layout.contentWidth - layout.gutter * 2 }]}>
          <Text style={styles.eyebrow}>EHub terms & safety</Text>
          <Text style={styles.title}>Seller, provider, catalog, and buyer guidance</Text>
          <Text style={styles.intro}>EHub currently supports discovery, storefront catalogs, and enquiries. It does not provide live payments, escrow, booking protection, formal service contracts, platform-managed refunds, or courier guarantees.</Text>
          {SECTIONS.map((item) => <View key={item.id} onLayout={onSectionLayout(item.id)} style={[styles.section, section === item.id && styles.sectionActive]}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.points ? item.points.map((point) => <View key={point} style={styles.point}><Text style={styles.bullet}>•</Text><Text style={styles.pointText}>{point}</Text></View>) : null}
            {item.body ? <Text style={styles.pointText}>{item.body}</Text> : null}
          </View>)}
          {/* The website's return link: back to the E-Hub page that opened the terms, or the E-Hub home. */}
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={handleReturn} style={styles.returnButton}>
            <ArrowLeft size={16} color="#ffffff" /><Text style={styles.returnText}>{canReturn ? 'Return to previous E-Hub page' : 'Return to E-Hub Home'}</Text>
          </TouchableOpacity>
        </View>
      </EHubScrollView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingTop: 16, paddingBottom: 56, paddingHorizontal: gutter, alignItems: 'center' },
  article: { maxWidth: 900, padding: 22, gap: 6, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { marginTop: 4, color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  intro: { marginTop: 6, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  section: { marginTop: 18, padding: 4, gap: 8, borderRadius: 16 },
  sectionActive: { padding: 12, backgroundColor: colors.successSurface },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  point: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  bullet: { color: colors.mutedText, fontSize: 14, lineHeight: 21 },
  pointText: { flex: 1, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  returnButton: { marginTop: 28, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: '#059669' },
  returnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
