import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN_THEME = '#10b981';
const GREEN_BRIGHT = '#01eb53';

export type LocationPickerItem = {
  label: string;
  value: string;
  subtitle?: string;
};

export type LocationPickerModalProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  items: LocationPickerItem[];
  selectedValue?: string;
  loading?: boolean;
  emptyText?: string;
  allowCustomEntry?: boolean;
  onSelect: (item: LocationPickerItem) => void;
  onClose: () => void;
};

export default function LocationPickerModal({
  visible,
  title,
  placeholder = 'Search...',
  items,
  selectedValue = '',
  loading = false,
  emptyText = 'No items found.',
  allowCustomEntry = true,
  onSelect,
  onClose,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(trimmed) ||
        item.value.toLowerCase().includes(trimmed) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(trimmed))
    );
  }, [items, searchQuery]);

  const handleSelect = (item: LocationPickerItem) => {
    setSearchQuery('');
    onSelect(item);
    onClose();
  };

  const handleCustomSelect = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearchQuery('');
    onSelect({ label: trimmed, value: trimmed });
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color="#e2e8f0" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && Platform.OS === 'android' ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#64748b" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Loading Indicator */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={GREEN_THEME} />
              <Text style={styles.loadingText}>Loading options...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected =
                  selectedValue.toLowerCase() === item.value.toLowerCase() ||
                  selectedValue.toLowerCase() === item.label.toLowerCase();
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item)}
                    style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                        {item.label}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={GREEN_BRIGHT} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{emptyText}</Text>
                  {allowCustomEntry && searchQuery.trim().length > 0 ? (
                    <TouchableOpacity
                      onPress={handleCustomSelect}
                      style={styles.customButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={GREEN_BRIGHT} />
                      <Text style={styles.customButtonText}>
                        Use &ldquo;{searchQuery.trim()}&rdquo;
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              }
              ListFooterComponent={
                allowCustomEntry && searchQuery.trim().length > 0 && filteredItems.length > 0 ? (
                  <TouchableOpacity
                    onPress={handleCustomSelect}
                    style={styles.customFooterButton}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={18} color={GREEN_BRIGHT} />
                    <Text style={styles.customFooterButtonText}>
                      Use custom: &ldquo;{searchQuery.trim()}&rdquo;
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  itemRowSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  itemLabel: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  itemLabelSelected: {
    color: GREEN_BRIGHT,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(1, 235, 83, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(1, 235, 83, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  customButtonText: {
    color: GREEN_BRIGHT,
    fontSize: 14,
    fontWeight: '600',
  },
  customFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 14,
  },
  customFooterButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
});
