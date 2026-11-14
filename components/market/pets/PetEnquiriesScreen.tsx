import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { petsService } from '@/lib/services/PetsService';
import type { PetEnquiry, PetEnquiryStatus } from '@/lib/types/pets';
import { PetEnquiriesSkeleton } from './PetsSkeletons';

const ACTIONS: readonly { status: Exclude<PetEnquiryStatus, 'withdrawn'>; label: string }[] = [
  { status: 'reviewing', label: 'Reviewing' }, { status: 'accepted', label: 'Accept' }, { status: 'declined', label: 'Decline' },
];
const STATUS_LABELS: Readonly<Record<PetEnquiryStatus, string>> = { new: 'New', reviewing: 'Reviewing', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn' };

/** The website's /profile/pets/adoption: enquiries sent for pets the member submitted, with status actions. */
export default function PetEnquiriesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<PetEnquiry[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadEnquiries = useCallback(async () => {
    try {
      const loaded = await petsService.fetchEnquiries();
      setEnquiries([...loaded].sort((first, second) => second.createdAt.localeCompare(first.createdAt)));
      setError('');
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load enquiries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadEnquiries(); }, [loadEnquiries]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEnquiries();
    setIsRefreshing(false);
  };

  const handleStatus = async (enquiryId: string, status: Exclude<PetEnquiryStatus, 'withdrawn'>) => {
    setUpdatingId(enquiryId);
    setError('');
    try {
      await petsService.updateEnquiryStatus(enquiryId, status);
      setEnquiries((current) => current.map((enquiry) => enquiry.id === enquiryId ? { ...enquiry, status } : enquiry));
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the enquiry.');
    } finally {
      setUpdatingId(null);
    }
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to adoption listings" onPress={() => router.canGoBack() ? router.back() : router.replace('/market/pets' as Href)} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.headerTitle}>Adoption enquiries</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={colors.accent} colors={[colors.accent]} />}>
      <View style={styles.intro}>
        <View style={styles.introIcon}><Inbox color={colors.accentText} size={20} /></View>
        <Text style={styles.introText}>Review applications sent for pets you submitted.</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {isLoading ? <PetEnquiriesSkeleton />
        : enquiries.length ? enquiries.map((enquiry) => <View key={enquiry.id} style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.petName}>{enquiry.petName}</Text>
              <Text style={styles.name}>{enquiry.name}</Text>
              <Text selectable style={styles.contact}>{enquiry.contact}</Text>
            </View>
            <Text style={styles.statusPill}>{STATUS_LABELS[enquiry.status]}</Text>
          </View>
          <Text selectable style={styles.message}>{enquiry.message}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACTIONS.map((action) => <Pressable key={action.status} accessibilityRole="button" accessibilityState={{ selected: enquiry.status === action.status, disabled: updatingId === enquiry.id }}
              disabled={updatingId === enquiry.id} onPress={() => void handleStatus(enquiry.id, action.status)}
              style={[styles.action, enquiry.status === action.status && styles.actionActive]}>
              <Text style={[styles.actionText, enquiry.status === action.status && styles.actionTextActive]}>{action.label}</Text>
            </Pressable>)}
          </View>
        </View>)
        : <View style={styles.empty}><Text style={styles.emptyText}>No adoption enquiries yet.</Text></View>}
    </ScrollView>
  </SafeAreaView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface },
  introText: { flex: 1, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  error: { padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.destructiveSurface, color: colors.destructiveText, fontSize: 13 },
  card: { padding: 16, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  petName: { color: colors.accentText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  name: { marginTop: 3, color: colors.text, fontSize: 17, fontWeight: '900' },
  contact: { marginTop: 2, color: colors.mutedText, fontSize: 13 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 11, fontWeight: '800' },
  message: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  action: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  actionActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  actionText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  actionTextActive: { color: colors.accentText },
  empty: { padding: 36, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyText: { color: colors.mutedText, fontSize: 14 },
});
