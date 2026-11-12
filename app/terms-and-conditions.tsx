import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import PolicyPageHeader from '@/components/policies/PolicyPageHeader';

type TermsSection = { title: string; intro?: string; paragraphs?: readonly string[]; bullets?: readonly string[]; outro?: string };

/** Same text as the website's /terms-and-conditions page (sections 1 to 4; section 5 links to the Privacy Policy). */
const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: '1. Eligibility',
    paragraphs: [
      'You must be 13 years or older to create an account or use OCN. By using the platform, you affirm that you meet this age requirement.',
      'If you are between 13 and 18 years old, you confirm that you have obtained parental or guardian consent to use our services.',
      'OCN reserves the right to terminate accounts if users are found to be under the minimum age requirement.',
    ],
  },
  {
    title: '2. Account Creation and Security',
    bullets: [
      'You are responsible for maintaining the confidentiality of your account information, including your username and password.',
      'You agree to provide accurate, current, and complete information during registration.',
      'You are solely responsible for activities that occur under your account. Notify us immediately if you suspect unauthorized access.',
    ],
  },
  {
    title: '3. Community Guidelines',
    intro: 'By using OCN, you agree to adhere to the following guidelines:',
    bullets: [
      'Be respectful: No hate speech, bullying, harassment, or abusive language.',
      'Do not post or share illegal, obscene, or harmful content.',
      'Protect privacy: Do not share personal information of yourself or others without consent.',
      'Avoid spamming or promoting unauthorized commercial content.',
    ],
    outro: 'Violation of these guidelines may result in account suspension or termination.',
  },
  {
    title: '4. Prohibited Activities',
    intro: 'You agree not to:',
    bullets: [
      'Use OCN for any illegal purposes.',
      'Attempt to hack, disrupt, or gain unauthorized access to the platform.',
      'Post content that infringes intellectual property rights.',
      'Use automated systems (e.g., bots) to interact with the platform without prior authorization.',
    ],
  },
];

/** The website's /terms-and-conditions page. */
export default function TermsAndConditionsRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PolicyPageHeader title="Terms & Conditions" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>Terms and Conditions</Text>
          <Text style={{ marginTop: 6, color: colors.mutedText }}>Effective Date: 7th December 2024</Text>
          {TERMS_SECTIONS.map((section) => <TermsSectionBlock key={section.title} section={section} colors={colors} />)}
          <SectionTitle colors={colors}>5. Privacy and Data Use</SectionTitle>
          <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 23 }}>
            OCN collects and processes personal data in accordance with our{' '}
            <Text accessibilityRole="link" onPress={() => router.push('/privacy-policy')} style={{ color: '#3b82f6', textDecorationLine: 'underline' }}>Privacy Policy</Text>
            . By using OCN, you consent to such processing.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionTitleProps = { colors: AppThemeColors; children: ReactNode };
function SectionTitle({ colors, children }: SectionTitleProps) {
  return <Text style={{ marginTop: 22, marginBottom: 8, color: colors.text, fontSize: 19, fontWeight: '800' }}>{children}</Text>;
}

type TermsSectionBlockProps = { section: TermsSection; colors: AppThemeColors };
function TermsSectionBlock({ section, colors }: TermsSectionBlockProps) {
  const bodyStyle = { color: colors.secondaryText, fontSize: 15, lineHeight: 23 };
  return (
    <View>
      <SectionTitle colors={colors}>{section.title}</SectionTitle>
      <View style={{ gap: 8 }}>
        {section.intro ? <Text style={bodyStyle}>{section.intro}</Text> : null}
        {section.paragraphs?.map((paragraph) => <Text key={paragraph} style={bodyStyle}>{paragraph}</Text>)}
        {section.bullets?.map((bullet) => (
          <View key={bullet} style={{ flexDirection: 'row', paddingLeft: 4 }}>
            <View style={{ width: 6, height: 6, marginTop: 9, borderRadius: 3, backgroundColor: colors.secondaryText }} />
            <Text style={[bodyStyle, { flex: 1, marginLeft: 10 }]}>{bullet}</Text>
          </View>
        ))}
        {section.outro ? <Text style={bodyStyle}>{section.outro}</Text> : null}
      </View>
    </View>
  );
}
