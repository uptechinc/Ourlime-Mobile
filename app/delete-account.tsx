import type { ReactNode } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import PolicyPageHeader from '@/components/policies/PolicyPageHeader';

const LOGO = require('@/assets/transparentLogo.png');
const ADMIN_EMAIL = 'ourlimeadmin@gmail.com';
const DELETION_REQUEST_EMAIL = `mailto:${ADMIN_EMAIL}?subject=Ourlime%20account%20deletion%20request&body=Username%3A%20%0AAccount%20email%3A%20%0A%0AI%20request%20deletion%20of%20my%20Ourlime%20account%20and%20associated%20data.`;

const SIGNED_IN_STEPS: readonly ReactNode[] = [
  'Sign in to your Ourlime account.',
  <>Open <Bold>Profile</Bold>, then select <Bold>Settings</Bold>.</>,
  <>Go to the <Bold>Danger Zone</Bold> and select <Bold>Delete Account</Bold>.</>,
  <>Enter your password, confirm that you understand the deletion is permanent, and select <Bold>Permanently Delete My Account</Bold>.</>,
];

const DELETED_DATA: readonly string[] = [
  'Your account credentials, profile information, contact details, and preferences.',
  'Your posts, comments, uploaded photos and videos, messages, saved items, and other content.',
  'Your friendships, follows, community memberships, notifications, events, listings, and other account activity.',
  'Files associated with your account in Ourlime\'s active cloud storage.',
];

function Bold({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: '800' }}>{children}</Text>;
}

function openMail(url: string): void {
  Linking.openURL(url).catch((error: unknown) => console.error('[DeleteAccountRoute.openMail] Error:', error));
}

/** The website's /delete-account page: how to delete an Ourlime account in the app or by email. */
export default function DeleteAccountRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const bodyStyle = { color: colors.secondaryText, fontSize: 15, lineHeight: 23 };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PolicyPageHeader title="Delete Your Account" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={{ overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.successSurface }}>
            <TouchableOpacity accessibilityRole="link" accessibilityLabel="Go to Ourlime home" onPress={() => router.replace('/')} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 18 }}>
              <Image source={LOGO} style={{ width: 36, height: 36 }} resizeMode="contain" />
              <Text style={{ marginLeft: 8, color: colors.accentText, fontSize: 18, fontWeight: '800' }}>Ourlime</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' }}>Account and data controls</Text>
            <Text style={{ marginTop: 6, color: colors.text, fontSize: 26, fontWeight: '900', lineHeight: 31 }}>Delete your Ourlime account</Text>
            <Text style={{ marginTop: 8, color: colors.secondaryText, fontSize: 15, lineHeight: 22 }}>You can permanently delete your Ourlime Communities Network account and the personal data associated with it.</Text>
          </View>

          <View style={{ padding: 18, gap: 26 }}>
            <Section title="Delete your account while signed in" colors={colors}>
              {SIGNED_IN_STEPS.map((step, stepIndex) => (
                <View key={stepIndex} style={{ flexDirection: 'row' }}>
                  <Text style={[bodyStyle, { width: 22, color: colors.accentText, fontWeight: '800' }]}>{stepIndex + 1}.</Text>
                  <Text style={[bodyStyle, { flex: 1 }]}>{step}</Text>
                </View>
              ))}
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13, backgroundColor: colors.accent }}>
                <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Open account settings</Text>
              </TouchableOpacity>
            </Section>

            <Section title="Request deletion without signing in" colors={colors}>
              <Text style={bodyStyle}>If you cannot access your account, email us from the address associated with it. Include your Ourlime username and account email so we can verify ownership. We may request additional information solely to confirm your identity before deletion.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => openMail(DELETION_REQUEST_EMAIL)} style={{ alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.accent }}>
                <Text style={{ color: colors.accentText, fontWeight: '800' }}>Email a deletion request</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.mutedText, fontSize: 13 }}>
                Contact:{' '}
                <Text accessibilityRole="link" onPress={() => openMail(`mailto:${ADMIN_EMAIL}`)} style={{ color: colors.accentText, fontWeight: '700', textDecorationLine: 'underline' }}>{ADMIN_EMAIL}</Text>
              </Text>
            </Section>

            <Section title="Data that is deleted" colors={colors}>
              {DELETED_DATA.map((item) => (
                <View key={item} style={{ flexDirection: 'row', paddingLeft: 4 }}>
                  <View style={{ width: 6, height: 6, marginTop: 9, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={[bodyStyle, { flex: 1, marginLeft: 10 }]}>{item}</Text>
                </View>
              ))}
            </Section>

            <Section title="Processing time and limited retention" colors={colors}>
              <Text style={bodyStyle}>In-app deletion begins immediately. Email requests are normally completed within 30 days after ownership is verified. Encrypted backup copies may remain for up to 90 days before being overwritten through the normal backup cycle.</Text>
              <Text style={bodyStyle}>Ourlime may retain limited transaction, security, fraud-prevention, or legal records when required by law or necessary to resolve disputes. These records are kept only for the period required for those purposes and are not used to continue operating your deleted account.</Text>
            </Section>

            <Text style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, color: colors.mutedText, fontSize: 13 }}>
              For more information, read our{' '}
              <Text accessibilityRole="link" onPress={() => router.push('/privacy-policy')} style={{ color: colors.accentText, fontWeight: '700', textDecorationLine: 'underline' }}>Privacy Policy</Text>.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionProps = { title: string; colors: AppThemeColors; children: ReactNode };
function Section({ title, colors, children }: SectionProps) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{title}</Text>
      {children}
    </View>
  );
}
