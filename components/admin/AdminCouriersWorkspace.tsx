import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import { courierAreasText } from '@/components/market/couriers/CourierCard';
import { courierService } from '@/lib/services/CourierService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { COURIER_SPEED_LABELS, COURIER_STATUS_LABELS, COURIER_VEHICLE_LABELS, type Courier, type CourierStatus } from '@/lib/types/couriers';

const FILTERS: { value: CourierStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'all', label: 'All' },
];

const statusColors = (status: CourierStatus, colors: AppThemeColors): { text: string; surface: string } => {
  if (status === 'approved') return { text: colors.successText, surface: colors.successSurface };
  if (status === 'pending') return { text: colors.warningText, surface: colors.warningSurface };
  return { text: colors.destructiveText, surface: colors.destructiveSurface };
};

/** The website's /profile/admin/couriers: approve courier registrations, decline them with a reason, or suspend. */
export default function AdminCouriersWorkspace() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<CourierStatus | 'all'>('pending');
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCourierId, setActiveCourierId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ [courierId: string]: string }>({});
  // A refused decision is shown on its own card; the page-level error is only for loading the list.
  const [decisionErrors, setDecisionErrors] = useState<{ [courierId: string]: string }>({});

  const loadCouriers = useCallback(async () => {
    try {
      setCouriers(await courierService.fetchModerationCouriers(filter === 'all' ? undefined : filter));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load courier services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); void loadCouriers(); }, [loadCouriers]);

  const handleDecision = async (courier: Courier, status: Exclude<CourierStatus, 'pending'>) => {
    const reason = reasons[courier.id]?.trim() ?? '';
    if (status !== 'approved' && !reason) return;
    setActiveCourierId(courier.id);
    setDecisionErrors((current) => ({ ...current, [courier.id]: '' }));
    try {
      const updatedCourier = await courierService.updateCourierStatus(courier.id, status, reason || undefined);
      setCouriers((current) => (filter === 'all'
        ? current.map((entry) => (entry.id === courier.id ? updatedCourier : entry))
        : current.filter((entry) => entry.id !== courier.id)));
    } catch (decisionError: unknown) {
      setDecisionErrors((current) => ({ ...current, [courier.id]: decisionError instanceof Error ? decisionError.message : 'Could not save the decision.' }));
    } finally {
      setActiveCourierId(null);
    }
  };

  return <AdminWorkspaceShell title="Courier services" subtitle="Review registrations before they are listed" loading={loading} refreshing={refreshing} error={error} onRefresh={() => { setRefreshing(true); void loadCouriers(); }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {FILTERS.map((option) => {
        const selected = filter === option.value;
        return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFilter(option.value)} style={[styles.filter, selected && styles.filterSelected]}>
          <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
    {couriers.length ? couriers.map((courier) => {
      const tone = statusColors(courier.status, colors);
      const isBusy = activeCourierId === courier.id;
      const canDecline = courier.status === 'pending' || courier.status === 'approved';
      return <View key={courier.id} style={styles.card}>
        <Text style={[styles.status, { color: tone.text, backgroundColor: tone.surface }]}>{COURIER_STATUS_LABELS[courier.status]}</Text>
        <Text style={styles.name}>{courier.businessName}</Text>
        <Text style={styles.meta}>{courier.contactName}{courier.startingPrice !== undefined ? ` · From $${courier.startingPrice.toFixed(2)} TTD` : ''}</Text>
        <Text style={styles.body}>{courier.description}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Areas: </Text>{courierAreasText(courier)}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Vehicles: </Text>{courier.vehicles.map((vehicle) => COURIER_VEHICLE_LABELS[vehicle]).join(', ')} · <Text style={styles.strong}>Options: </Text>{courier.speeds.map((speed) => COURIER_SPEED_LABELS[speed]).join(', ')}</Text>
        <Text style={styles.body}><Text style={styles.strong}>Phone: </Text>{courier.phone}{courier.whatsapp ? ` · WhatsApp ${courier.whatsapp}` : ''}{courier.email ? ` · ${courier.email}` : ''}</Text>
        {courier.rejectionReason && courier.status !== 'approved' ? <Text style={[styles.body, { color: colors.destructiveText }]}><Text style={styles.strong}>Reason: </Text>{courier.rejectionReason}</Text> : null}
        {courier.status !== 'approved' ? <TouchableOpacity accessibilityRole="button" disabled={isBusy} onPress={() => void handleDecision(courier, 'approved')} style={[styles.button, { backgroundColor: colors.successSurface, opacity: isBusy ? 0.5 : 1 }]}>
          <Icon name="check" size={16} color={colors.successText} /><Text style={[styles.buttonText, { color: colors.successText }]}>Approve</Text>
        </TouchableOpacity> : null}
        {canDecline ? <>
          <TextInput accessibilityLabel={courier.status === 'approved' ? 'Suspension reason' : 'Reason for declining'} value={reasons[courier.id] ?? ''} onChangeText={(text) => setReasons((current) => ({ ...current, [courier.id]: text }))}
            placeholder={courier.status === 'approved' ? 'Suspension reason' : 'Reason for declining'} placeholderTextColor={colors.mutedText} multiline style={styles.reason} />
          <TouchableOpacity accessibilityRole="button" disabled={isBusy || !reasons[courier.id]?.trim()} onPress={() => void handleDecision(courier, courier.status === 'approved' ? 'suspended' : 'rejected')}
            style={[styles.button, { backgroundColor: colors.destructiveSurface, opacity: isBusy || !reasons[courier.id]?.trim() ? 0.5 : 1 }]}>
            <Icon name={courier.status === 'approved' ? 'slash' : 'x'} size={16} color={colors.destructiveText} /><Text style={[styles.buttonText, { color: colors.destructiveText }]}>{courier.status === 'approved' ? 'Suspend' : 'Decline'}</Text>
          </TouchableOpacity>
        </> : null}
        {decisionErrors[courier.id] ? <Text accessibilityRole="alert" style={styles.decisionError}>{decisionErrors[courier.id]}</Text> : null}
      </View>;
    }) : <Text style={styles.empty}>{filter === 'pending' ? 'No courier services are waiting for review.' : 'No courier services here.'}</Text>}
  </AdminWorkspaceShell>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  filters: { gap: 8, paddingBottom: 12 },
  filter: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  filterText: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: colors.successText },
  card: { marginBottom: 12, padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  status: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { color: colors.mutedText, fontSize: 13 },
  body: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '800', color: colors.text },
  reason: { minHeight: 64, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 14, textAlignVertical: 'top' },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  decisionError: { color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  empty: { padding: 24, textAlign: 'center', color: colors.mutedText, fontSize: 14 },
});
