import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Plus, Store } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { EHUB_MAX_STORES_PER_OWNER, EHUB_NEW_STORE_ID, type EHubSellerWorkspace } from '@/lib/types/ehubSeller';

type EHubSellerStoreSwitcherProps = {
  workspace: EHubSellerWorkspace;
  isWorking: boolean;
  canAddStore: boolean;
  onSelect: (storeId: string) => void;
};

/**
 * The owner's storefronts under their one business account, like the website's Seller Center. Each storefront has
 * its own products, drafts and public page; "New storefront" opens an empty setup that becomes a separate storefront
 * when it is published, so the storefronts already running are never edited by mistake.
 */
export default function EHubSellerStoreSwitcher({ workspace, isWorking, canAddStore, onSelect }: EHubSellerStoreSwitcherProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isNewStore = workspace.selectedStoreId === EHUB_NEW_STORE_ID;
  const hasRoom = workspace.stores.length < EHUB_MAX_STORES_PER_OWNER;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Your storefronts</Text>
      <Text style={styles.hint}>Each storefront has its own products, drafts and public page.</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {workspace.stores.map((store) => {
          const isSelected = workspace.selectedStoreId === store.id;
          return <Pressable key={store.id} accessibilityRole="radio" accessibilityState={{ checked: isSelected, disabled: isWorking }} accessibilityLabel={store.storeName || 'Untitled storefront'}
            disabled={isWorking} onPress={() => onSelect(store.id)} style={[styles.chip, isSelected ? styles.chipSelected : null, isWorking ? styles.disabled : null]}>
            {store.logoUrl ? <CachedImage uri={store.logoUrl} style={styles.logo} /> : <Store size={16} color={isSelected ? colors.accentText : colors.icon} />}
            <Text numberOfLines={1} style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{store.storeName || 'Untitled storefront'}</Text>
            {isSelected ? <Check size={16} color={colors.accentText} /> : null}
          </Pressable>;
        })}
        {isNewStore ? <View style={[styles.chip, styles.chipNew, styles.chipSelected]}>
          <Plus size={16} color={colors.accentText} /><Text style={[styles.chipText, styles.chipTextSelected]}>New storefront</Text>
        </View> : canAddStore && hasRoom ? <Pressable accessibilityRole="button" accessibilityLabel="Set up a new storefront" disabled={isWorking} onPress={() => onSelect(EHUB_NEW_STORE_ID)}
          style={[styles.chip, styles.chipNew, isWorking ? styles.disabled : null]}>
          <Plus size={16} color={colors.icon} /><Text style={styles.chipText}>New storefront</Text>
        </Pressable> : null}
      </View>
      {isNewStore ? <Text style={styles.newNote}>You are setting up a new storefront. Your other storefronts stay as they are. Publish it here, then add its products.</Text> : null}
      {!hasRoom && !isNewStore ? <Text style={styles.hint}>You can run up to {EHUB_MAX_STORES_PER_OWNER} storefronts.</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 14, gap: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  label: { color: colors.secondaryText, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  chips: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  chipNew: { borderStyle: 'dashed' },
  chipText: { flexShrink: 1, color: colors.secondaryText, fontSize: 14, fontWeight: '800' },
  chipTextSelected: { color: colors.accentText },
  logo: { width: 24, height: 24, borderRadius: 6 },
  disabled: { opacity: 0.6 },
  newNote: { marginTop: 6, padding: 10, borderRadius: 12, overflow: 'hidden', color: colors.accentText, backgroundColor: colors.successSurface, fontSize: 13, lineHeight: 19 },
});
