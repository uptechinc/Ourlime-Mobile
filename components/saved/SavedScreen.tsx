import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AlertCircle, Bookmark, EyeOff, Search } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useSavedItemsList } from '@/lib/hooks/useSavedItems';
import { useSavedStore } from '@/lib/store/useSavedStore';
import { SavedItemCatalog } from '@/lib/services/SavedItemCatalog';
import { SAVED_ITEM_TYPES, SAVED_TYPE_LABELS, type ResolvedSavedItem, type SavedItemType, type SavedItemUnavailableReason } from '@/lib/types/saved';

const UNAVAILABLE_COPY: { [reason in SavedItemUnavailableReason]: string } = {
  deleted: 'This item was removed or is no longer available.',
  private: 'This item is private or no longer shared with you.',
  blocked: 'Unavailable because of a block between you and its owner.',
  hidden: "The owner's account is not active right now.",
};

function formatSavedDate(savedAtMs: number): string {
  return savedAtMs ? new Date(savedAtMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/** The Saved screen (website /saved): newest first, type tabs, title search, unsave, unavailable rows. */
export default function SavedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeType, setActiveType] = useState<SavedItemType | null>(null);
  const [search, setSearch] = useState('');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { items, isLoading, isLoadingMore, error, hasMore, isSignedIn, refresh, fetchMore } = useSavedItemsList(activeType);
  const toggle = useSavedStore((state) => state.toggle);
  const visibleItems = useMemo(() => items.filter((item) => SavedItemCatalog.matchesSearch(item, search)), [items, search]);
  const tabs: { id: SavedItemType | null; label: string }[] = [{ id: null, label: 'All' }, ...SAVED_ITEM_TYPES.map((type) => ({ id: type, label: SAVED_TYPE_LABELS[type] }))];

  const handleRemove = async (item: ResolvedSavedItem) => {
    setRemovingIds((current) => new Set(current).add(item.id));
    await toggle({ type: item.type, itemId: item.itemId, snapshot: item.snapshot });
    setRemovingIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  };

  const handleOpen = (item: ResolvedSavedItem) => {
    if (item.available && item.href) router.push(item.href as Href);
  };

  const renderItem = ({ item }: { item: ResolvedSavedItem }) => {
    const isRemoving = removingIds.has(item.id);
    const subtitle = item.available
      ? [item.snapshot.subtitle, formatSavedDate(item.savedAtMs) ? `Saved ${formatSavedDate(item.savedAtMs)}` : ''].filter(Boolean).join(' · ')
      : UNAVAILABLE_COPY[item.unavailableReason ?? 'deleted'];
    return (
      <View style={[styles.row, !item.available && styles.rowUnavailable]}>
        <Pressable
          accessibilityRole={item.available ? 'link' : 'text'}
          accessibilityLabel={item.available ? `Open ${item.snapshot.title}` : `${item.snapshot.title}, unavailable`}
          accessibilityState={{ disabled: !item.available }}
          disabled={!item.available}
          onPress={() => handleOpen(item)}
          style={styles.rowMain}
        >
          <View style={styles.thumb}>
            {item.available && item.snapshot.thumbnail
              ? <CachedImage uri={item.snapshot.thumbnail} style={StyleSheet.absoluteFill} accessibilityLabel="" />
              : item.available ? <Bookmark size={22} color={colors.mutedText} /> : <EyeOff size={22} color={colors.mutedText} />}
          </View>
          <View style={styles.rowText}>
            <Text style={styles.typeLabel}>{SAVED_TYPE_LABELS[item.type]}</Text>
            <Text numberOfLines={2} style={[styles.title, !item.available && styles.titleUnavailable]}>{item.snapshot.title}</Text>
            {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.snapshot.title} from Saved`}
          accessibilityState={{ busy: isRemoving }}
          disabled={isRemoving}
          onPress={() => void handleRemove(item)}
          hitSlop={6}
          style={styles.unsave}
        >
          {isRemoving ? <ActivityIndicator size="small" color={colors.accent} /> : <Bookmark size={20} color={colors.accent} fill={colors.accent} />}
        </Pressable>
      </View>
    );
  };

  const emptyState = () => {
    if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;
    if (!isSignedIn) return <View style={styles.centered}><Text style={styles.emptyTitle}>Sign in to see your saved items.</Text></View>;
    if (error) {
      return (
        <View style={styles.centered}>
          <AlertCircle size={30} color={colors.destructive} />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Bookmark size={30} color={colors.accent} />
        <Text style={styles.emptyTitle}>{search.trim() ? 'No saved items match your search.' : activeType ? `No saved ${SAVED_TYPE_LABELS[activeType].toLowerCase()} yet.` : 'Nothing saved yet.'}</Text>
        <Text style={styles.emptyBody}>{search.trim() && hasMore ? 'Older saves are not loaded yet. Scroll down to load more.' : 'Tap the bookmark on posts, jobs, events, products and more to keep them here.'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Saved" onBackPress={() => router.back()} />
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const isActive = tab.id === activeType;
            return (
              <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: isActive }} onPress={() => setActiveType(tab.id)} style={[styles.tab, isActive && styles.tabActive]}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.mutedText} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search by title" placeholderTextColor={colors.mutedText} style={styles.searchInput} accessibilityLabel="Search saved items" returnKeyType="search" />
        </View>
      </View>
      <FlatList
        data={isLoading ? [] : visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={emptyState}
        contentContainerStyle={styles.list}
        onEndReached={() => { if (hasMore) void fetchMore(); }}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.accent} />}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} /> : null}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  controls: { paddingTop: 10, gap: 10, backgroundColor: colors.canvas },
  tabs: { paddingHorizontal: 16, gap: 8 },
  tab: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.secondaryText, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.onAccent },
  searchBox: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowUnavailable: { borderStyle: 'dashed', backgroundColor: colors.control },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  rowText: { flex: 1, minWidth: 0 },
  typeLabel: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  titleUnavailable: { color: colors.mutedText, textDecorationLine: 'line-through' },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2 },
  unsave: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 4, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  retryText: { color: colors.text, fontWeight: '700' },
  footer: { marginVertical: 16 },
});
