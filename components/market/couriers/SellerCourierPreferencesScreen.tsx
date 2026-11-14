import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Check, MapPin } from 'lucide-react-native';
import { PetsButton, PetsErrorText } from '@/components/market/pets/PetsSheet';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courierService } from '@/lib/services/CourierService';
import { withCleanup } from '@/lib/utils/withCleanup';
import { MAX_SELLER_COURIERS, type Courier } from '@/lib/types/couriers';
import { courierAreasText } from './CourierCard';
import { CourierCardsSkeleton } from './CouriersSkeletons';

/**
 * The website's SellerCourierPreferencesCard as a screen: a seller picks up to five approved couriers they prefer.
 * Their choice shows on their Lime Market and E-Hub products and is offered first at checkout.
 */
export default function SellerCourierPreferencesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    // withCleanup, not .finally(): the runtime Promise can lack finally (lib/utils/withCleanup.ts).
    withCleanup(Promise.all([courierService.fetchCouriers(), courierService.fetchOwnPreferences()]), () => setIsLoading(false))
      .then(([approvedCouriers, ownPreferences]) => {
        setCouriers(approvedCouriers);
        const availableIds = ownPreferences.couriers.map((courier) => courier.id);
        setSelectedIds(availableIds);
        setSavedIds(availableIds);
      })
      .catch((error: unknown) => setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load couriers.' }));
  }, []);

  const hasChanges = selectedIds.join() !== savedIds.join();

  const handleToggle = (courierId: string) => {
    setMessage(null);
    if (selectedIds.includes(courierId)) { setSelectedIds(selectedIds.filter((selectedId) => selectedId !== courierId)); return; }
    if (selectedIds.length >= MAX_SELLER_COURIERS) { setMessage({ tone: 'error', text: `Choose up to ${MAX_SELLER_COURIERS} couriers.` }); return; }
    setSelectedIds([...selectedIds, courierId]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await courierService.saveOwnPreferences(selectedIds);
      const availableIds = result.couriers.map((courier) => courier.id);
      setSelectedIds(availableIds);
      setSavedIds(availableIds);
      setMessage({ tone: 'success', text: availableIds.length ? 'Your preferred couriers are saved.' : 'Preferred couriers cleared.' });
    } catch (error: unknown) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save your couriers.' });
    } finally {
      setIsSaving(false);
    }
  };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/market/seller' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.headerTitle}>Preferred couriers</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Optional. Pick up to {MAX_SELLER_COURIERS} couriers you trust. Buyers see them on your Lime Market and E-Hub products and can still choose another courier.</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/market/couriers' as Href)}><Text style={styles.link}>Browse all couriers ›</Text></Pressable>
      {isLoading ? <CourierCardsSkeleton count={2} />
        : couriers.length ? couriers.map((courier) => {
          const isSelected = selectedIds.includes(courier.id);
          return <Pressable key={courier.id} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} accessibilityLabel={courier.businessName} onPress={() => handleToggle(courier.id)} style={[styles.row, isSelected && styles.rowSelected]}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>{isSelected ? <Check color="#ffffff" size={14} strokeWidth={3} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.rowTitle}>{courier.businessName}</Text>
              <View style={styles.rowArea}><MapPin color={colors.mutedText} size={13} /><Text numberOfLines={1} style={styles.rowAreaText}>{courierAreasText(courier)}</Text></View>
            </View>
          </Pressable>;
        })
        : <Text style={styles.empty}>No couriers are approved yet. Once couriers register and are approved, you can pick them here.</Text>}
      {message ? message.tone === 'error' ? <PetsErrorText message={message.text} /> : <Text accessibilityRole="text" style={styles.success}>{message.text}</Text> : null}
    </ScrollView>
    {couriers.length ? <View style={styles.footer}><PetsButton label="Save couriers" onPress={() => void handleSave()} disabled={!hasChanges} busy={isSaving} /></View> : null}
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  intro: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  link: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  row: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: colors.border },
  checkboxSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowArea: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowAreaText: { flex: 1, color: colors.mutedText, fontSize: 12 },
  empty: { padding: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.control, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  success: { color: colors.successText, fontSize: 14, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.canvas },
});
