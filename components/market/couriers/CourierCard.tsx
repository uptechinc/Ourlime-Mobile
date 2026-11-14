import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mail, MapPin, MessageCircle, Phone, Truck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { COURIER_SPEED_LABELS, COURIER_VEHICLE_LABELS, type Courier } from '@/lib/types/couriers';

/** A WhatsApp chat link from a phone number (a local seven-digit number gets Trinidad and Tobago's +1 868). */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 7 ? `1868${digits}` : digits}`;
}

/** The areas a courier covers, as one line. */
export function courierAreasText(courier: Courier): string {
  return courier.islandWide ? 'Island-wide' : courier.serviceAreas.join(', ');
}

const openLink = (url: string) => { Linking.openURL(url).catch((error: unknown) => console.error('[CourierCard.openLink] Error:', error instanceof Error ? error.message : 'Unknown error')); };

type CourierCardProps = {
  courier: Courier;
  /** Compact cards (product pages) show the areas on one line and hide the description. */
  compact?: boolean;
};

/** The website's CourierCard: an approved courier with areas, delivery options, vehicles and contact buttons. */
export default function CourierCard({ courier, compact = false }: CourierCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.icon}><Truck color={colors.accentText} size={20} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.name}>{courier.businessName}</Text>
        <Text style={styles.meta}>{courier.contactName}{courier.startingPrice !== undefined ? ` · From $${courier.startingPrice.toFixed(2)} TTD` : ''}</Text>
      </View>
    </View>
    <View style={styles.areaRow}><MapPin color={colors.accentText} size={15} /><Text numberOfLines={compact ? 1 : undefined} style={styles.areaText}>{courierAreasText(courier)}</Text></View>
    {!compact ? <Text numberOfLines={3} style={styles.description}>{courier.description}</Text> : null}
    <View style={styles.tags}>
      {courier.speeds.map((speed) => <Text key={speed} style={[styles.tag, styles.speedTag]}>{COURIER_SPEED_LABELS[speed]}</Text>)}
      {courier.vehicles.map((vehicle) => <Text key={vehicle} style={styles.tag}>{COURIER_VEHICLE_LABELS[vehicle]}</Text>)}
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Call ${courier.businessName}`} onPress={() => openLink(`tel:${courier.phone.replace(/[^\d+]/g, '')}`)} style={[styles.action, styles.primaryAction]}><Phone color="#ffffff" size={15} /><Text style={styles.primaryActionText}>Call</Text></Pressable>
      {courier.whatsapp ? <Pressable accessibilityRole="button" accessibilityLabel={`WhatsApp ${courier.businessName}`} onPress={() => openLink(whatsappLink(courier.whatsapp ?? ''))} style={styles.action}><MessageCircle color={colors.accentText} size={15} /><Text style={styles.actionText}>WhatsApp</Text></Pressable> : null}
      {courier.email ? <Pressable accessibilityRole="button" accessibilityLabel={`Email ${courier.businessName}`} onPress={() => openLink(`mailto:${courier.email}`)} style={styles.action}><Mail color={colors.secondaryText} size={15} /><Text style={[styles.actionText, { color: colors.secondaryText }]}>Email</Text></Pressable> : null}
    </View>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  meta: { marginTop: 1, color: colors.mutedText, fontSize: 13 },
  areaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  areaText: { flex: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  description: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 11, fontWeight: '800' },
  speedTag: { backgroundColor: colors.successSurface, color: colors.successText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  action: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  primaryAction: { borderColor: '#047857', backgroundColor: '#047857' },
  actionText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  primaryActionText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
