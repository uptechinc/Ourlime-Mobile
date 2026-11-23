import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Inbox, Lock, MessageSquareReply, Store, Trash2, Truck, XCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import EHubSectionNav from '@/components/ehub/EHubSectionNav';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useEHubEnquiries } from '@/lib/hooks/useEHub';
import { EHubEmptyState, EHubNotice, formatEHubPrice, useEHubLayout } from '@/components/ehub/EHubParts';
import { EHubEnquiryInboxSkeleton, EHubEnquiryListSkeleton } from '@/components/ehub/EHubSkeletons';
import type { EHubEnquiry, EHubEnquiryMode, EHubManageableEnquiryStatus, EHubOrderRequest } from '@/lib/types/ehubDiscovery';

const MODES: { value: EHubEnquiryMode; label: string }[] = [
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
];
const TYPE_LABELS: { [type in EHubEnquiry['type']]: string } = { service: 'Service', availability: 'Availability', product: 'Product', general: 'General', order: 'Order request' };

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.toDateString()} · ${date.toTimeString().slice(0, 5)}`;
}

type OrderDetailsProps = { order: EHubOrderRequest; mode: EHubEnquiryMode; styles: ReturnType<typeof createStyles>; iconColor: string };

/** An order request's items, subtotal, pickup or delivery, and the courier the buyer chose (as sent; nothing was paid). */
function OrderDetails({ order, mode, styles, iconColor }: OrderDetailsProps) {
  const fulfilmentText = order.fulfilment === 'pickup' ? 'Pickup' : order.courier ? `Delivery with ${order.courier.name}` : 'Delivery (seller arranges the courier)';
  return <View style={styles.order}>
    {order.items.map((item, index) => {
      const itemOptions = [item.selectedVariant, item.selectedSize, item.selectedColour].filter(Boolean).join(' · ');
      return <View key={`${item.productId}-${index}`} style={styles.orderRow}>
        <View style={styles.flex}>
          <Text style={styles.orderItem}>{item.quantity} × {item.title}</Text>
          {itemOptions ? <Text style={styles.orderMeta}>{itemOptions}</Text> : null}
        </View>
        <Text style={styles.orderItem}>{formatEHubPrice(item.lineTotal)}</Text>
      </View>;
    })}
    <View style={[styles.orderRow, styles.orderTotal]}><Text style={styles.orderTotalText}>Subtotal</Text><Text style={styles.orderTotalText}>{formatEHubPrice(order.subtotal)}</Text></View>
    <View style={styles.orderFulfilment}>
      {order.fulfilment === 'pickup' ? <Store size={16} color={iconColor} /> : <Truck size={16} color={iconColor} />}
      <View style={styles.flex}>
        <Text style={styles.orderItem}>{fulfilmentText}</Text>
        {order.courier ? <Text style={styles.orderMeta}>{order.courier.startingPrice !== null ? `Courier's starting price ${formatEHubPrice(order.courier.startingPrice)}` : 'Courier price on request'}</Text> : null}
      </View>
    </View>
    <Text style={styles.orderMeta}>{mode === 'received' ? 'Prices as listed when sent. Reply to confirm stock, the final price and any delivery fee. No payment was taken.' : 'Prices as listed when sent. The seller confirms stock, the final price and any delivery fee. No payment was taken.'}</Text>
  </View>;
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
  const [deleteTarget, setDeleteTarget] = useState<EHubEnquiry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await enquiries.remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error: unknown) {
      console.error('[EHubEnquiryInboxScreen.handleDelete] Error:', error instanceof Error ? error.message : 'Unknown error');
      setActionError(error instanceof Error && error.message ? error.message : 'Unable to delete enquiry.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };
  // The tab is kept in the route, so Back and shared links return to the same tab.
  const handleModeChange = (nextMode: EHubEnquiryMode) => { setMode(nextMode); setReplyingTo(null); setActionError(null); router.setParams({ mode: nextMode }); };

  const header = <><PageHeader title="My enquiries" onBackPress={() => router.back()} /><EHubSectionNav currentLabel="My enquiries" /></>;
  if (!profile) {
    return <View style={styles.screen}>{header}<View style={[styles.body, { width: layout.contentWidth }]}>
      {profileLoading ? <EHubEnquiryInboxSkeleton mode={mode} /> : <EHubEmptyState icon={<Lock size={38} color={colors.mutedText} />} title="Sign in to manage enquiries" actionLabel="Sign in" onAction={() => router.push('/(auth)/login')} />}
    </View></View>;
  }

  const list = enquiries.data ?? [];
  return (
    <View style={styles.screen}>
      {header}
      <KeyboardSafeView style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={enquiries.isRefreshing} onRefresh={() => void enquiries.refresh()} tintColor={colors.accent} />} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.body, { width: layout.contentWidth }]}>
            <View>
              <Text style={styles.eyebrow}>E-Hub</Text>
              <Text style={styles.title}>My enquiries</Text>
              <Text style={styles.muted}>{mode === 'sent' ? 'Enquiries you sent to providers, and their replies.' : 'Enquiries people sent to your storefront or services. Reply, or close them when done.'}</Text>
            </View>
            <View accessibilityRole="tablist" style={styles.segmented}>
              {MODES.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: mode === option.value }} onPress={() => handleModeChange(option.value)} style={[styles.segment, mode === option.value && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === option.value && styles.segmentTextActive]}>{option.label}</Text>
              </Pressable>)}
            </View>
            {enquiries.error ? <EHubNotice tone="error" text={enquiries.error} actionLabel="Try again" onAction={() => void enquiries.refresh()} /> : null}
            {actionError ? <EHubNotice tone="error" text={actionError} /> : null}
            {enquiries.isLoading ? <EHubEnquiryListSkeleton mode={mode} />
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
                    {enquiry.type === 'order' && enquiry.order ? <>
                      <OrderDetails order={enquiry.order} mode={mode} styles={styles} iconColor={colors.accentText} />
                      {enquiry.order.buyerMessage ? <Text style={styles.message}>{enquiry.order.buyerMessage}</Text> : null}
                    </> : <Text style={styles.message}>{enquiry.message}</Text>}
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
                    {mode === 'sent' && enquiry.status === 'new' ? <View style={styles.actions}>
                      <Pressable accessibilityRole="button" onPress={() => setDeleteTarget(enquiry)} style={styles.dangerButton}><Trash2 size={16} color={colors.destructiveText} /><Text style={styles.dangerText}>Delete before it is read</Text></Pressable>
                    </View> : null}
                  </View>;
                })}</View>}
          </View>
        </ScrollView>
      </KeyboardSafeView>
      <CustomModal visible={deleteTarget !== null} type="danger" title="Delete this enquiry?" message="You can delete a sent enquiry only while it is still unread. This cannot be undone." confirmText="Delete enquiry" cancelText="Cancel"
        isLoading={isDeleting} onConfirm={() => void handleDelete()} onCancel={() => setDeleteTarget(null)} onClose={() => { if (!isDeleting) setDeleteTarget(null); }} />
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
  title: { marginTop: 4, color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: '900' },
  segmented: { alignSelf: 'flex-start', flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control },
  segment: { minHeight: 44, minWidth: 104, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.mutedText, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: colors.text },
  list: { gap: 14 },
  card: { padding: 16, gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
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
  order: { padding: 13, gap: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  orderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderItem: { color: colors.text, fontSize: 14, fontWeight: '700' },
  orderMeta: { marginTop: 2, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  orderTotal: { paddingTop: 8, justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
  orderTotalText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  orderFulfilment: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 10, borderRadius: 12, backgroundColor: colors.successSurface },
  response: { padding: 13, gap: 4, borderRadius: 15, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.successSurface },
  responseLabel: { color: colors.successText, fontSize: 13, fontWeight: '900' },
  responseText: { color: colors.successText, fontSize: 14, lineHeight: 21 },
  replyForm: { gap: 10 },
  replyInput: { minHeight: 110, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: '#047857' },
  primaryText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dangerButton: { minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  dangerText: { color: colors.destructiveText, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
