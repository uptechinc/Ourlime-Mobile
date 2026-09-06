import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ALL_COUNTRIES, type CountryEntry } from '@/lib/constants/countries';

export type CountryPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectCountry: (countryCode: string) => void;
  selectedCountries?: string[];
  title?: string;
};

export default function CountryPickerModal({
  visible,
  onClose,
  onSelectCountry,
  selectedCountries = [],
  title = 'Select Country',
}: CountryPickerModalProps) {
  const { colors, isDark } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return ALL_COUNTRIES;
    }
    return ALL_COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(trimmed) ||
        country.code.toLowerCase().includes(trimmed)
    );
  }, [searchQuery]);

  const handleSelect = useCallback(
    (code: string) => {
      onSelectCountry(code);
      setSearchQuery('');
      onClose();
    },
    [onClose, onSelectCountry]
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const renderCountryItem = useCallback(
    ({ item }: { item: CountryEntry }) => {
      const isSelected = selectedCountries.includes(item.code);

      return (
        <TouchableOpacity
          onPress={() => handleSelect(item.code)}
          activeOpacity={0.7}
          style={[
            styles.countryItem,
            {
              borderBottomColor: colors.border,
              backgroundColor: isSelected
                ? isDark
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(16, 185, 129, 0.08)'
                : 'transparent',
            },
          ]}
        >
          <Text style={styles.flagEmoji}>{item.flag}</Text>
          <View style={styles.countryInfo}>
            <Text
              style={[
                styles.countryName,
                { color: isSelected ? '#10b981' : colors.text },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.countryCode, { color: colors.mutedText }]}>
              {item.code}
            </Text>
          </View>
          {isSelected ? (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
          )}
        </TouchableOpacity>
      );
    },
    [colors.border, colors.mutedText, colors.text, handleSelect, isDark, selectedCountries]
  );

  const keyExtractor = useCallback((item: CountryEntry) => item.code, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[
          styles.container,
          { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="globe-outline" size={20} color="#10b981" />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.closeButton, { backgroundColor: colors.control }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.control,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={colors.mutedText} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by country name or code..."
              placeholderTextColor={colors.mutedText}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={colors.mutedText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results Counter */}
        <View style={styles.counterRow}>
          <Text style={[styles.counterText, { color: colors.mutedText }]}>
            {filteredCountries.length} countries found
          </Text>
        </View>

        {/* Country List */}
        <FlatList
          data={filteredCountries}
          keyExtractor={keyExtractor}
          renderItem={renderCountryItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={25}
          windowSize={10}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  counterRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 32,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  flagEmoji: {
    fontSize: 26,
    width: 34,
    textAlign: 'center',
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontWeight: '600',
  },
  countryCode: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
});
