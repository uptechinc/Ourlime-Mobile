import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courierService } from '@/lib/services/CourierService';
import type { Courier } from '@/lib/types/couriers';
import CourierCard from './CourierCard';

type SellerCouriersPanelProps = {
  sellerId?: string;
};

/**
 * The website's SellerCouriersPanel: the seller's preferred couriers on a product page, with a link to the full
 * directory so buyers can use the courier they know instead.
 */
export default function SellerCouriersPanel({ sellerId }: SellerCouriersPanelProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [couriers, setCouriers] = useState<Courier[]>([]);

  useEffect(() => {
    if (!sellerId) return;
    let isCurrent = true;
    courierService.fetchSellerCouriers(sellerId)
      .then((sellerCouriers) => { if (isCurrent) setCouriers(sellerCouriers); })
      .catch(() => { if (isCurrent) setCouriers([]); });
    return () => { isCurrent = false; };
  }, [sellerId]);

  return <View accessibilityLabel="Delivery couriers" style={styles.panel}>
    <View style={styles.header}>
      <View style={styles.titleRow}><Truck color={colors.accentText} size={16} /><Text style={styles.title}>{couriers.length ? 'Seller\'s preferred couriers' : 'Delivery couriers'}</Text></View>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/market/couriers' as Href)}><Text style={styles.link}>All couriers ›</Text></Pressable>
    </View>
    {couriers.length
      ? couriers.map((courier) => <CourierCard key={courier.id} courier={courier} compact />)
      : <Text style={styles.hint}>Want it delivered by a courier you know? Pick one from Ourlime&apos;s approved couriers.</Text>}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  panel: { padding: 14, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  link: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
});
