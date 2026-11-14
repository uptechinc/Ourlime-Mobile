import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { PetsButton, PetsErrorText, PetsField, PetsLabel, PetsToggleRow } from '@/components/market/pets/PetsSheet';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { courierService } from '@/lib/services/CourierService';
import { withCleanup } from '@/lib/utils/withCleanup';
import {
  COURIER_SERVICE_AREAS,
  COURIER_SPEED_LABELS,
  COURIER_SPEEDS,
  COURIER_STATUS_LABELS,
  COURIER_VEHICLE_LABELS,
  COURIER_VEHICLES,
  type Courier,
  type CourierProfileInput,
} from '@/lib/types/couriers';

type CourierForm = Omit<CourierProfileInput, 'startingPrice' | 'whatsapp' | 'email'> & { whatsapp: string; email: string; startingPrice: string };

const EMPTY_FORM: CourierForm = {
  businessName: '', contactName: '', phone: '', whatsapp: '', email: '', description: '',
  serviceAreas: [], islandWide: false, vehicles: [], speeds: [], startingPrice: '',
};

const formFromCourier = (courier: Courier): CourierForm => ({
  businessName: courier.businessName,
  contactName: courier.contactName,
  phone: courier.phone,
  whatsapp: courier.whatsapp ?? '',
  email: courier.email ?? '',
  description: courier.description,
  serviceAreas: courier.islandWide ? [] : courier.serviceAreas,
  islandWide: courier.islandWide,
  vehicles: courier.vehicles,
  speeds: courier.speeds,
  startingPrice: courier.startingPrice === undefined ? '' : String(courier.startingPrice),
});

type MultiChoiceRowProps<TValue extends string> = {
  label: string;
  options: readonly TValue[];
  labels?: Readonly<Record<TValue, string>>;
  values: TValue[];
  onChange: (values: TValue[]) => void;
};

/** Wrapping chips where any number can be on (the website's ToggleChip rows). */
function MultiChoiceRow<TValue extends string>({ label, options, labels, values, onChange }: MultiChoiceRowProps<TValue>) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 6 }}>
    <PetsLabel label={label} />
    <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const selected = values.includes(option);
        return <Pressable key={option} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => onChange(selected ? values.filter((value) => value !== option) : [...values, option])}
          style={{ minHeight: 38, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }}>
          <Text style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{labels ? labels[option] : option}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

/** The website's /market/couriers/register: register a courier service, or edit it (which sends it back for review). */
export default function CourierRegisterScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const { profile, loading: isAccessLoading } = usePageAccess();
  const [form, setForm] = useState<CourierForm>(EMPTY_FORM);
  const [existingCourier, setExistingCourier] = useState<Courier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedCourier, setSavedCourier] = useState<Courier | null>(null);

  useEffect(() => {
    if (isAccessLoading) return;
    if (!profile?.uid) { router.replace('/(auth)/login' as Href); return; }
    // withCleanup, not .finally(): the runtime Promise can lack finally (lib/utils/withCleanup.ts).
    withCleanup(courierService.fetchOwnCourier(), () => setIsLoading(false))
      .then((courier) => {
        setExistingCourier(courier);
        if (courier) setForm(formFromCourier(courier));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load your courier service.'));
  }, [isAccessLoading, profile?.uid, router]);

  const update = <TKey extends keyof CourierForm>(key: TKey, value: CourierForm[TKey]) => setForm((current) => ({ ...current, [key]: value }));
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/market/couriers' as Href);

  const handleSubmit = async () => {
    const missing = !form.businessName.trim() ? 'Business name is required.'
      : !form.contactName.trim() ? 'Contact name is required.'
      : !form.phone.trim() ? 'Phone number is required.'
      : !form.description.trim() ? 'Tell buyers and sellers about your service.'
      : !form.islandWide && !form.serviceAreas.length ? 'Choose at least one area you deliver to.'
      : !form.vehicles.length ? 'Choose at least one vehicle.'
      : !form.speeds.length ? 'Choose at least one delivery option.' : '';
    if (missing) { setError(missing); return; }
    const price = form.startingPrice.trim();
    if (price && !Number.isFinite(Number(price))) { setError('Enter the starting price as a number, e.g. 40.'); return; }
    setIsSaving(true);
    setError('');
    try {
      setSavedCourier(await courierService.saveOwnCourier({
        ...form,
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        startingPrice: price ? Number(price) : undefined,
      }));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your courier service.');
    } finally {
      setIsSaving(false);
    }
  };

  const header = <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to couriers" onPress={goBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
    <Text style={styles.headerTitle}>{existingCourier ? 'Edit your courier service' : 'Register a courier service'}</Text>
  </View>;

  if (savedCourier) {
    return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {header}
      <View style={styles.doneCard}>
        <CheckCircle2 color={colors.successText} size={48} />
        <Text accessibilityRole="header" style={styles.doneTitle}>Sent for review</Text>
        <Text style={styles.doneText}>An Ourlime administrator will review {savedCourier.businessName}. Once approved it appears in the courier directory, and sellers and buyers can choose it.</Text>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}><PetsButton label="Back to couriers" onPress={goBack} /></View>
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    {header}
    <KeyboardSafeView style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Offer deliveries to Lime Market and E-Hub buyers and sellers. Ourlime reviews every courier before it is listed{existingCourier ? ', and reviews it again after any change' : ''}.</Text>
        {existingCourier ? <Text style={styles.statusLine}><Text style={{ fontWeight: '900' }}>Status: </Text>{COURIER_STATUS_LABELS[existingCourier.status]}{existingCourier.rejectionReason && existingCourier.status !== 'approved' ? ` — ${existingCourier.rejectionReason}` : ''}</Text> : null}
        {isLoading ? <View style={{ gap: 12 }}>{[0, 1, 2, 3, 4].map((index) => <SkeletonBox key={index} width="100%" height={70} borderRadius={12} />)}</View> : <>
          <PetsField label="Business name" value={form.businessName} onChangeText={(value) => update('businessName', value)} maxLength={100} />
          <PetsField label="Contact name" value={form.contactName} onChangeText={(value) => update('contactName', value)} maxLength={100} />
          <PetsField label="Phone number" value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" placeholder="e.g. 868 555 1234" maxLength={30} />
          <PetsField label="WhatsApp number" optional value={form.whatsapp} onChangeText={(value) => update('whatsapp', value)} keyboardType="phone-pad" maxLength={30} />
          <PetsField label="Email" optional value={form.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" maxLength={200} />
          <PetsField label="Starting price (TTD)" optional value={form.startingPrice} onChangeText={(value) => update('startingPrice', value)} keyboardType="decimal-pad" placeholder="Your lowest delivery fee" maxLength={10} />
          <PetsField label="About your service" multiline value={form.description} onChangeText={(value) => update('description', value)} placeholder="What you deliver, opening hours, and how to book you" maxLength={1000} />
          <View style={{ gap: 8 }}>
            <PetsLabel label="Areas you deliver to" />
            <PetsToggleRow label="Island-wide: anywhere in Trinidad and Tobago" value={form.islandWide} onValueChange={(value) => update('islandWide', value)} />
          </View>
          {!form.islandWide ? <MultiChoiceRow label="Towns and regions" options={COURIER_SERVICE_AREAS} values={form.serviceAreas} onChange={(values) => update('serviceAreas', values)} /> : null}
          <MultiChoiceRow label="Vehicles" options={COURIER_VEHICLES} labels={COURIER_VEHICLE_LABELS} values={form.vehicles} onChange={(values) => update('vehicles', values)} />
          <MultiChoiceRow label="Delivery options" options={COURIER_SPEEDS} labels={COURIER_SPEED_LABELS} values={form.speeds} onChange={(values) => update('speeds', values)} />
          {error ? <PetsErrorText message={error} /> : null}
          <View style={{ flexDirection: 'row', marginTop: 4 }}><PetsButton label={existingCourier ? 'Save and send for review' : 'Submit for review'} onPress={() => void handleSubmit()} busy={isSaving} /></View>
        </>}
      </ScrollView>
    </KeyboardSafeView>
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDark ? colors.canvas : '#f7f7f2' },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  intro: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  statusLine: { padding: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  doneCard: { margin: 16, padding: 24, alignItems: 'center', gap: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  doneText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
