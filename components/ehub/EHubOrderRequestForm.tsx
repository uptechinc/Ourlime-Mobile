import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, Send, Store, Truck } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useEHubOrderRequestOptions } from '@/lib/hooks/useEHub';
import { eHubService, getEHubTermsRoute } from '@/lib/services/EHubService';
import { EHubNotice, formatEHubPrice } from '@/components/ehub/EHubParts';
import { COURIER_SPEED_LABELS, COURIER_VEHICLE_LABELS } from '@/lib/types/couriers';
import type { EHubCartSellerGroup } from '@/lib/types/ehubCommerce';
import type { EHubEnquiry, EHubOrderCourierOption, EHubOrderFulfilment } from '@/lib/types/ehubDiscovery';

type EHubOrderRequestFormProps = {
  group: EHubCartSellerGroup;
  onBack: () => void;
  /** Called once the seller has the request; the cart removes these lines. */
  onSent: (enquiry: EHubEnquiry) => void;
  /** Closes the cart (before leaving for sign in or the terms). */
  onClose: () => void;
};

type LabelMap = { readonly [key: string]: string };

const MAXIMUM_AREAS_SHOWN = 4;

function labelList(values: string[], labels: LabelMap): string {
  return values.map((value) => labels[value] ?? value).join(', ');
}

function describeAreas(courier: EHubOrderCourierOption): string {
  if (courier.islandWide) return 'Island-wide';
  const shown = courier.serviceAreas.slice(0, MAXIMUM_AREAS_SHOWN).join(', ');
  const hidden = courier.serviceAreas.length - MAXIMUM_AREAS_SHOWN;
  return hidden > 0 ? `${shown} +${hidden} more` : shown;
}

/** Cheapest listed starting price first; couriers without a price come last. */
function sortCouriersByPrice(couriers: EHubOrderCourierOption[]): EHubOrderCourierOption[] {
  return [...couriers].sort((first, second) => (first.startingPrice ?? Number.POSITIVE_INFINITY) - (second.startingPrice ?? Number.POSITIVE_INFINITY));
}

/**
 * The order request for one seller's lines in the E-Hub cart: items and subtotal, pickup or delivery, a courier from
 * the seller's preferred couriers (or "Seller arranges delivery"), an optional message and the buyer acknowledgement.
 * It is delivered like an enquiry; nothing is paid or reserved.
 */
export default function EHubOrderRequestForm({ group, onBack, onSent, onClose }: EHubOrderRequestFormProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = usePageAccess();
  const options = useEHubOrderRequestOptions(group.sellerId);
  const [fulfilment, setFulfilment] = useState<EHubOrderFulfilment>(group.pickupAvailable ? 'pickup' : 'delivery');
  const [courierId, setCourierId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const couriers = useMemo(() => sortCouriersByPrice(options.data?.couriers ?? []), [options.data]);
  const canSend = Boolean(profile) && isAcknowledged && !isSending;

  const handleFulfilmentChange = (nextFulfilment: EHubOrderFulfilment) => {
    setFulfilment(nextFulfilment);
    if (nextFulfilment === 'pickup') setCourierId(null);
    setSendError(null);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setSendError(null);
    try {
      const enquiry = await eHubService.createOrderRequest({
        storeId: group.sellerId,
        items: group.items.map((item) => ({
          productId: item.productId, quantity: item.quantity,
          selectedVariant: item.selectedVariant, selectedSize: item.selectedSize, selectedColour: item.selectedColour,
        })),
        fulfilment,
        courierId: fulfilment === 'delivery' ? courierId : null,
        message: message.trim(),
        buyerAcknowledgementAccepted: true,
      });
      onSent(enquiry);
    } catch (error: unknown) {
      console.error('[EHubOrderRequestForm.handleSend] Error:', error instanceof Error ? error.message : 'Unknown error');
      setSendError(error instanceof Error && error.message ? error.message : 'Unable to send the order request.');
    } finally {
      setIsSending(false);
    }
  };

  const renderCourier = (courier: EHubOrderCourierOption | null) => {
    const id = courier?.id ?? null;
    const isSelected = courierId === id;
    return <Pressable key={id ?? 'seller'} accessibilityRole="radio" accessibilityState={{ checked: isSelected }} onPress={() => setCourierId(id)} style={[styles.option, isSelected && styles.optionSelected]}>
      <View style={[styles.radio, isSelected && styles.radioSelected]}>{isSelected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.flex}>
        <View style={styles.optionTop}>
          <Text style={styles.optionTitle}>{courier ? courier.name : 'Seller arranges delivery'}</Text>
          {courier ? <Text style={styles.optionPrice}>{courier.startingPrice !== null ? `From ${formatEHubPrice(courier.startingPrice)}` : 'Price on request'}</Text> : null}
        </View>
        {courier ? <>
          <Text style={styles.optionMeta}>{describeAreas(courier)}</Text>
          <Text style={styles.optionMeta}>{[labelList(courier.vehicles, COURIER_VEHICLE_LABELS), labelList(courier.speeds, COURIER_SPEED_LABELS)].filter(Boolean).join(' · ')}</Text>
        </> : <Text style={styles.optionMeta}>The seller chooses how to deliver and tells you the fee.</Text>}
      </View>
    </Pressable>;
  };

  return <View style={styles.form}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to the cart" onPress={onBack} hitSlop={6} style={styles.backButton}>
      <ChevronLeft size={18} color={colors.text} /><Text style={styles.backText}>Cart</Text>
    </Pressable>
    <View>
      <Text style={styles.eyebrow}>Order request</Text>
      <Text style={styles.title}>{options.data?.storeName ?? group.sellerName}</Text>
      <Text style={styles.muted}>The seller confirms stock, the final price and any delivery fee in your enquiries. Nothing is paid or reserved through E-Hub.</Text>
    </View>

    <View style={styles.section}>
      {group.items.map((item) => {
        const itemOptions = [item.selectedVariant, item.selectedSize, item.selectedColour].filter(Boolean).join(' · ');
        return <View key={item.id} style={styles.itemRow}>
          <View style={styles.flex}>
            <Text numberOfLines={2} style={styles.itemTitle}>{item.quantity} × {item.title}</Text>
            {itemOptions ? <Text style={styles.optionMeta}>{itemOptions}</Text> : null}
          </View>
          <Text style={styles.itemPrice}>{formatEHubPrice(item.price * item.quantity)}</Text>
        </View>;
      })}
      <View style={styles.subtotalRow}><Text style={styles.subtotalText}>Estimated subtotal</Text><Text style={styles.subtotalText}>{formatEHubPrice(group.subtotal)}</Text></View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How do you want it?</Text>
      <View accessibilityRole="radiogroup" style={styles.fulfilmentRow}>
        {(['pickup', 'delivery'] as const).map((value) => {
          const isAvailable = value === 'pickup' ? group.pickupAvailable : group.deliveryAvailable;
          const isSelected = fulfilment === value;
          return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: isSelected, disabled: !isAvailable }} disabled={!isAvailable} onPress={() => handleFulfilmentChange(value)} style={[styles.fulfilment, isSelected && styles.optionSelected, !isAvailable && styles.disabled]}>
            {value === 'pickup' ? <Store size={18} color={isSelected ? colors.accentText : colors.icon} /> : <Truck size={18} color={isSelected ? colors.accentText : colors.icon} />}
            <Text style={[styles.fulfilmentText, isSelected && { color: colors.accentText }]}>{value === 'pickup' ? 'Pickup' : 'Delivery'}</Text>
          </Pressable>;
        })}
      </View>
      {!group.deliveryAvailable ? <Text style={styles.optionMeta}>Delivery is not offered for every item from this seller.</Text> : null}
      {!group.pickupAvailable ? <Text style={styles.optionMeta}>Pickup is not offered for every item from this seller.</Text> : null}
    </View>

    {fulfilment === 'delivery' ? <View style={styles.section}>
      <Text style={styles.sectionTitle}>Courier</Text>
      <Text style={styles.optionMeta}>Couriers this seller works with, cheapest starting price first. The seller books the courier and confirms the fee.</Text>
      {options.isLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} />
        : options.error ? <EHubNotice tone="error" text={options.error} actionLabel="Try again" onAction={() => void options.refresh()} />
          : <View accessibilityRole="radiogroup" style={styles.options}>{[renderCourier(null), ...couriers.map((courier) => renderCourier(courier))]}</View>}
    </View> : null}

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Message to the seller (optional)</Text>
      <TextInput value={message} onChangeText={setMessage} multiline maxLength={1500} textAlignVertical="top" placeholder="Address area, preferred time, questions…" placeholderTextColor={colors.mutedText} accessibilityLabel="Message to the seller" style={styles.input} />
    </View>

    <View style={styles.acknowledgement}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isAcknowledged }} onPress={() => setIsAcknowledged((current) => !current)} style={styles.acknowledgementRow}>
        <View style={[styles.checkbox, isAcknowledged && styles.checkboxChecked]}>{isAcknowledged ? <Check size={14} color="#ffffff" /> : null}</View>
        <Text style={styles.acknowledgementText}>I understand this is an order request, not a purchase: this independent seller confirms stock, price and delivery, availability may change, and E-Hub currently provides no payment, escrow, refund, or delivery guarantee.</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => { onClose(); router.push(getEHubTermsRoute('buyer') as Href); }} style={styles.termsLink}><Text style={styles.termsText}>Read the buyer terms</Text></Pressable>
    </View>

    {sendError ? <EHubNotice tone="error" text={sendError} /> : null}
    {profile ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => void handleSend()} style={[styles.submit, !canSend && styles.disabled]}>
      {isSending ? <ActivityIndicator color="#ffffff" /> : <Send size={17} color="#ffffff" />}
      <Text style={styles.submitText}>{isSending ? 'Sending…' : 'Send order request'}</Text>
    </Pressable> : <EHubNotice tone="warning" text="Sign in to send an order request." actionLabel="Sign in" onAction={() => { onClose(); router.push('/(auth)/login'); }} />}
  </View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    disabled: { opacity: 0.45 },
    form: { gap: 14 },
    backButton: { alignSelf: 'flex-start', minHeight: 44, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
    title: { marginTop: 3, color: colors.text, fontSize: 20, fontWeight: '900' },
    muted: { marginTop: 4, color: colors.mutedText, fontSize: 12, lineHeight: 18 },
    section: { padding: 13, gap: 9, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    itemTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
    itemPrice: { color: colors.text, fontSize: 13, fontWeight: '800' },
    subtotalRow: { marginTop: 2, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
    subtotalText: { color: colors.text, fontSize: 14, fontWeight: '900' },
    fulfilmentRow: { flexDirection: 'row', gap: 10 },
    fulfilment: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: colors.border },
    fulfilmentText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    options: { gap: 8 },
    option: { minHeight: 44, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border },
    optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
    optionTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    optionTitle: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
    optionPrice: { color: colors.accentText, fontSize: 12, fontWeight: '900' },
    optionMeta: { marginTop: 2, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
    radio: { width: 20, height: 20, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 2, borderColor: colors.mutedText },
    radioSelected: { borderColor: colors.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    loader: { paddingVertical: 14 },
    input: { minHeight: 90, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 },
    acknowledgement: { padding: 13, gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
    acknowledgementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    checkbox: { width: 22, height: 22, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 2, borderColor: colors.mutedText },
    checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
    acknowledgementText: { flex: 1, color: colors.secondaryText, fontSize: 12, lineHeight: 18 },
    termsLink: { marginLeft: 33, minHeight: 44, justifyContent: 'center' },
    termsText: { color: colors.accentText, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
    submit: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#047857' },
    submitText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  });
}
