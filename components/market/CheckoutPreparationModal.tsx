import { Picker } from '@react-native-picker/picker';
import { ALL_COUNTRIES } from '@/lib/constants/countries';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import MarketFormModal, { MarketButton, MarketField } from './MarketFormModal';
import { marketplaceService, type CheckoutLineReview } from '@/lib/services/MarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CartLine } from '@/lib/types/reliability';
import type { CheckoutContact } from '@/lib/types/ehub';

type CheckoutPreparationModalProps = { ownerId: string; lines: CartLine[]; onClose: () => void; onAcceptPrice: (line: CartLine) => Promise<void> };
const fields = [ ['name', 'Full name'], ['email', 'Email'], ['phone', 'International phone (+country code)'], ['country', 'Country code (e.g. CA, TT, US)'], ['address', 'Delivery address'], ['city', 'City or locality'], ['postalCode', 'Postal code (where applicable)'] ] as const;
export default function CheckoutPreparationModal({ ownerId, lines, onClose, onAcceptPrice }: CheckoutPreparationModalProps) {
  const { colors } = useAppTheme();
  const [contact, setContact] = useState<CheckoutContact>({ name: '', email: '', phone: '', country: '', address: '', city: '', postalCode: '' });
  const [reviews, setReviews] = useState<CheckoutLineReview[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const edited = useRef(false);
  useEffect(() => {
    let active = true;
    void marketplaceService.contact(ownerId).then((saved) => { if (active && saved && !edited.current) setContact(saved); }).catch(() => { if (active) setError('Saved contact details could not be restored. You can retry or enter them here.'); });
    return () => { active = false; };
  }, [ownerId]);
  const review = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      marketplaceService.validateContact(contact);
      await marketplaceService.contact(ownerId, contact);
      setReviews(await marketplaceService.review(ownerId, lines));
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Review failed. Your cart is retained.'); }
    finally { setBusy(false); }
  };
  const subtotals = new Map<string, number>();
  lines.filter((line) => !line.removed && line.currency).forEach((line) => subtotals.set(line.currency, (subtotals.get(line.currency) ?? 0) + line.price * line.quantity));
  return <MarketFormModal visible busy={busy} title="Prepare checkout" onClose={onClose}>
    <Text style={{ color: colors.warningText }}>Payments are unavailable. You can save contact details and review items, but cannot place an order. Stock is not reserved.</Text>
    {[...subtotals].map(([currency, subtotal]) => <Text key={currency} style={{ color: colors.text }}>Item subtotal: {currency} {subtotal.toFixed(2)}. Shipping and tax have not been calculated.</Text>)}
    {fields.map(([key, label]) => key === 'country' ? <Picker key={key} accessibilityLabel="Delivery country" enabled={!busy} selectedValue={contact.country} style={{ color: colors.text }} onValueChange={(value: string) => { edited.current = true; setContact((current) => ({ ...current, country: value })); setReviews(null); }}><Picker.Item label="Select delivery country" value="" />{ALL_COUNTRIES.map((country) => <Picker.Item key={country.code} label={country.name} value={country.code} />)}</Picker> : <MarketField key={key} label={label} value={contact[key]} onChangeText={(value) => { edited.current = true; setContact((current) => ({ ...current, [key]: value })); setReviews(null); }} />)}
    {reviews?.map((item) => <Text key={item.line.id} style={{ color: item.reason ? colors.destructive : colors.text }}>{item.line.title}: {item.reason || (item.priceChanged ? `Price changed to ${item.line.currency} ${item.currentPrice?.toFixed(2)}. Acceptance required.` : 'Available at the checked price. Stock is not reserved.')}</Text>)}
    {reviews?.filter((item) => item.priceChanged && !item.reason).map((item) => <MarketButton key={item.line.id} label={`Accept updated price for ${item.line.title}`} onPress={() => {
      void onAcceptPrice(item.line).then(() => setReviews(null)).catch(() => setError('Price acceptance failed. Retry.'));
    }} />)}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
    <MarketButton label={busy ? 'Checking…' : 'Save contact and review items'} disabled={busy} onPress={() => void review()} />
  </MarketFormModal>;
}
