import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courierService } from '@/lib/services/CourierService';
import type { Courier } from '@/lib/types/couriers';
import { courierAreasText } from './CourierCard';

type CheckoutCourierPickerProps = {
  sellerIds: string[];
  value: string;
  onChange: (courierId: string) => void;
};

/**
 * The website's CheckoutCourierPicker: an optional courier for a shipped order, the sellers' preferred couriers first
 * and then every other approved courier. "No preference" leaves delivery to the seller.
 */
export default function CheckoutCourierPicker({ sellerIds, value, onChange }: CheckoutCourierPickerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [preferredCouriers, setPreferredCouriers] = useState<Courier[]>([]);
  const [allCouriers, setAllCouriers] = useState<Courier[]>([]);
  const sellerKey = [...new Set(sellerIds)].sort().join(',');

  useEffect(() => {
    let isCurrent = true;
    const uniqueSellerIds = sellerKey ? sellerKey.split(',') : [];
    Promise.all([
      courierService.fetchCouriers().catch(() => []),
      Promise.all(uniqueSellerIds.map((sellerId) => courierService.fetchSellerCouriers(sellerId).catch(() => []))),
    ]).then(([approvedCouriers, sellerCourierLists]) => {
      if (!isCurrent) return;
      setPreferredCouriers([...new Map(sellerCourierLists.flat().map((courier) => [courier.id, courier])).values()]);
      setAllCouriers(approvedCouriers);
    });
    return () => { isCurrent = false; };
  }, [sellerKey]);

  const otherCouriers = useMemo(() => allCouriers.filter((courier) => !preferredCouriers.some((preferred) => preferred.id === courier.id)), [allCouriers, preferredCouriers]);
  if (!preferredCouriers.length && !otherCouriers.length) return null;

  const option = (courierId: string, title: string, subtitle: string) => {
    const selected = value === courierId;
    return <Pressable key={courierId || 'none'} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={title} onPress={() => onChange(courierId)} style={[styles.option, selected && styles.optionSelected]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Check color="#ffffff" size={12} strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.optionTitle}>{title}</Text><Text numberOfLines={1} style={styles.optionText}>{subtitle}</Text></View>
    </Pressable>;
  };

  return <View accessibilityRole="radiogroup" accessibilityLabel="Courier" style={styles.box}>
    <Text style={styles.title}>Courier <Text style={styles.optional}>(optional)</Text></Text>
    <Text style={styles.hint}>Pick a courier you know, or leave it to the seller.</Text>
    {option('', 'No preference', 'The seller arranges delivery')}
    {preferredCouriers.length ? <Text style={styles.groupLabel}>Seller&apos;s preferred couriers</Text> : null}
    {preferredCouriers.map((courier) => option(courier.id, courier.businessName, courierAreasText(courier)))}
    {otherCouriers.length ? <Text style={styles.groupLabel}>{preferredCouriers.length ? 'Other couriers' : 'Approved couriers'}</Text> : null}
    {otherCouriers.map((courier) => option(courier.id, courier.businessName, courierAreasText(courier)))}
    <Pressable accessibilityRole="link" onPress={() => router.push('/market/couriers' as Href)}><Text style={styles.link}>See all couriers ›</Text></Pressable>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  box: { padding: 12, gap: 8, borderRadius: 14, backgroundColor: colors.control },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  optional: { color: colors.mutedText, fontWeight: '500' },
  hint: { color: colors.mutedText, fontSize: 12 },
  groupLabel: { marginTop: 4, color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  option: { minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
  radioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  optionText: { marginTop: 1, color: colors.mutedText, fontSize: 12 },
  link: { marginTop: 2, color: colors.accentText, fontSize: 13, fontWeight: '800' },
});
