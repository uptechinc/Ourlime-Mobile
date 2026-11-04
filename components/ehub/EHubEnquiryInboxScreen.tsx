import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Inbox, Lock, MessageSquareReply, XCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useEHubEnquiries } from '@/lib/hooks/useEHub';
import { EHubEmptyState, EHubNotice, useEHubLayout } from '@/components/ehub/EHubParts';
import type { EHubEnquiry, EHubEnquiryMode, EHubManageableEnquiryStatus } from '@/lib/types/ehubDiscovery';

const MODES: { value: EHubEnquiryMode; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'sent', label: 'Sent' },
];
const TYPE_LABELS: { [type in EHubEnquiry['type']]: string } = { service: 'Service', availability: 'Availability', product: 'Product', general: 'General' };

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.toDateString()} · ${date.toTimeString().slice(0, 5)}`;
}

/** The website's /profile/ehub/enquiries: enquiries a member sent, and enquiries their business received (read, reply, close). */
export default function EHubEnquiryInboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useAppTheme();
  const { profile, loading: profileLoading } = usePageAccess();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors, layout.gutter), [colors, layout.gutter]);
  const [mode, setMode] = useState<EHubEnquiryMode>(params.mode === 'sent' ? 'sent' : 'received');
  const enquiries = useEHubEnquiries(profile?.uid ?? null, mode);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleUpdate = async (enquiryId: string, status: EHubManageableEnquiryStatus, reply?: string) => {
    setPendingId(enquiryId);
    setActionError(null);
    try {
      await enquiries.update(enquiryId, status, reply);
      if (status === 'replied') { setReplyingTo(null); setResponseMessage(''); }
    } catch (error: unknown) {
      console.error('[EHubEnquiryInboxScreen.handleUpdate] Error:', error instanceof Error ? error.message : 'Unknown error');
      setActionError(error instanceof Error && error.message ? error.message : 'Unable to update enquiry.');
    } finally {
      setPendingId(null);
    }
  };
  const handleModeChange = (nextMode: EHubEnquiryMode) => { setMode(nextMode); setReplyingTo(null); setActionError(null); };

  const header = <PageHeader title="Enquiries" onBackPress={() => router.back()} />;
  if (!profile) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {profileLoading ? <Skeleton height={200} borderRadius={22} /> : <EHubEmptyState icon={<Lock size={38} color={colors.mutedText} />} title="Sign in to manage enquiries" actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />}
    </View></View>;
  }

  const list = enquiries.data ?? [];
  return (
    <View style={styles.screen}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={enquiries.isRefreshing} onRefresh={() => void enquiries.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.body, { width: layout.contentWidth }]}>
            <View>
              <Text style={styles.eyebrow}>E-Hub presence</Text>
              <Text style={styles.title}>Business enquiries</Text>
              <Text style={styles.muted}>A lightweight inbox for genuine discovery enquiries. Quotes and bookings are not enabled.</Text>
            </View>
            <View accessibilityRole="tablist" style={styles.segmented}>
              {MODES.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: mode === option.value }} onPress={() => handleModeChange(option.value)} style={[styles.segment, mode === option.value && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === option.value && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>)}
            </View>
            {enquiries.error ? <EHubNotice tone="error" text={enquiries.error} actionLabel="Try again" onAction={() => void enquiries.refresh()} /> : null}
            {actionError ? <EHubNotice tone="error" text={actionError} /> : null}
            {enquiries.isLoading ? <View style={styles.list}><Skeleton height={170} borderRadius={22} /><Skeleton height={170} borderRadius={22} /></View>
              : list.length === 0 ? (!enquiries.error ? <EHubEmptyState icon={<Inbox size={42} color={colors.mutedText} />} title={`No enquiries ${mode}`} body={mode === 'received' ? 'New enquiries from your public provider profile will appear here.' : 'Enquiries you send to providers will appear here.'} actionLabel={mode === 'sent' ? 'Find providers' : undefined} onAction={mode === 'sent' ? () => router.push('/ehub/discover' as Href) : undefined} /> : null)
                : <View style={styles.list}>{list.map((enquiry) => {
                  const isPending = pendingId === enquiry.id;
                  return <View key={enquiry.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.flex}>
                        <Text style={styles.type}>{TYPE_LABELS[enquiry.type] ?? enquiry.type}</Text>
                        {mode === 'sent' ? <Pressable accessibilityRole="link" onPress={() => router.push(`/ehub/providers/${encodeURIComponent(enquiry.providerId)}` as Href)}><Text style={[styles.counterpart, styles.counterpartLink]}>{enquiry.providerName}</Text></Pressable> : <Text style={styles.counterpart}>{enquiry.senderName}</Text>}
                        <Text style={styles.date}>{formatDate(enquiry.createdAt)}</Text>
                      </View>
                      <View style={[styles.status, enquiry.status === 'replied' && styles.statusReplied, enquiry.status === 'new' && styles.statusNew]}><Text style={[styles.statusText, enquiry.status === 'replied' && { color: colors.successText }]}>{enquiry.status}</Text></View>
                    </View>
                    <Text style={styles.message}>{enquiry.message}</Text>
                    {enquiry.responseMessage ? <View style={styles.response}><Text style={styles.responseLabel}>{mode === 'received' ? 'Your response:' : 'Provider response:'}</Text><Text style={styles.responseText}>{enquiry.responseMessage}</Text></View> : null}
                    {mode === 'received' ? (replyingTo === enquiry.id ? <View style={styles.replyForm}>
                      <TextInput value={responseMessage} onChangeText={setResponseMessage} multiline maxLength={1500} textAlignVertical="top" placeholder="Write a response…" placeholderTextColor={colors.mutedText} accessibilityLabel="Your response" style={styles.replyInput} />
                      <View style={styles.actions}>
                        <Pressable accessibilityRole="button" onPress={() => setReplyingTo(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={isPending || responseMessage.trim().length < 2} onPress={() => void handleUpdate(enquiry.id, 'replied', responseMessage.trim())} style={[styles.primaryButton, (isPending || responseMessage.trim().length < 2) && styles.disabled]}><Text style={styles.primaryText}>{isPending ? 'Sending…' : 'Send response'}</Text></Pressable>
                      </View>
                    </View> : <View style={styles.actions}>
                      {enquiry.status === 'new' ? <Pressable accessibilityRole="button" disabled={isPending} onPress={() => void handleUpdate(enquiry.id, 'read')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Mark read</Text></Pressable> : null}
                      <Pressable accessibilityRole="button" disabled={isPending} onPress={() => { setReplyingTo(enquiry.id); setResponseMessage(''); }} style={styles.primaryButton}><MessageSquareReply size={16} color="#ffffff" /><Text style={styles.primaryText}>Reply</Text></Pressable>
                      {enquiry.status !== 'closed' ? <Pressable accessibilityRole="button" disabled={isPending} onPress={() => void handleUpdate(enquiry.id, 'closed')} style={styles.secondaryButton}><XCircle size={16} color={colors.text} /><Text style={styles.secondaryText}>Close</Text></Pressable> : null}
                    </View>) : null}
                  </View>;
                })}</View>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  muted: { marginTop: 4, color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  body: { maxWidth: 820, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 18, gap: 16 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { marginTop: 4, color: colors.text, fontSize: 27, fontWeight: '900' },
  segmented: { alignSelf: 'flex-start', flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control },
  segment: { minHeight: 40, minWidth: 104, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  list: { gap: 14 },
  card: { padding: 17, gap: 12, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  type: { color: colors.accentText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  counterpart: { marginTop: 3, color: colors.text, fontSize: 16, fontWeight: '900' },
  counterpartLink: { textDecorationLine: 'underline' },
  date: { marginTop: 2, color: colors.mutedText, fontSize: 12 },
  status: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control },
  statusNew: { backgroundColor: colors.warningSurface },
  statusReplied: { backgroundColor: colors.successSurface },
  statusText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  message: { padding: 13, borderRadius: 15, backgroundColor: colors.control, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  response: { padding: 13, gap: 4, borderRadius: 15, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  responseLabel: { color: colors.successText, fontSize: 13, fontWeight: '900' },
  responseText: { color: colors.successText, fontSize: 14, lineHeight: 21 },
  replyForm: { gap: 10 },
  replyInput: { minHeight: 110, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { minHeight: 42, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: '#059669' },
  primaryText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 42, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
