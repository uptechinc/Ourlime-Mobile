import { ActivityIndicator, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { MentionCandidate } from '@/lib/services/MentionService';
import UserAvatar from '@/components/ui/UserAvatar';

type MentionSuggestionListProps = {
  suggestions: MentionCandidate[];
  isSearching?: boolean;
  /** Rows shown before the list scrolls (default: 4 on a normal phone, fewer on a small one). */
  maxVisibleRows?: number;
  onSelect: (person: MentionCandidate) => void;
};

const ROW_HEIGHT = 54;
/**
 * Rows shown before the list scrolls. Based on the screen's height (not the window, which shrinks when the keyboard
 * opens): 4 rows on a normal phone, fewer on a small one so the keyboard, the list and the input all still fit.
 */
const screenHeight = Dimensions.get('screen').height;
const DEFAULT_VISIBLE_ROWS = screenHeight < 700 ? 2 : screenHeight < 800 ? 3 : 4;

/** The "@" picker: avatar, name and @username per row, scrolls after four rows. Sits directly above (or below) the input. */
export default function MentionSuggestionList({ suggestions, isSearching = false, maxVisibleRows, onSelect }: MentionSuggestionListProps) {
  const { colors } = useAppTheme();
  const visibleRows = Math.max(1, Math.min(maxVisibleRows ?? DEFAULT_VISIBLE_ROWS, DEFAULT_VISIBLE_ROWS));
  if (suggestions.length === 0 && !isSearching) return null;

  return (
    <View
      accessibilityLabel="People you can mention"
      style={{
        marginBottom: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        maxHeight: ROW_HEIGHT * visibleRows,
      }}
    >
      <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled showsVerticalScrollIndicator={suggestions.length > visibleRows}>
        {suggestions.map((person, index) => {
          const fullName = `${person.firstName} ${person.lastName}`.trim() || person.userName;
          return (
            <TouchableOpacity
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${fullName}, @${person.userName}`}
              onPress={() => onSelect(person)}
              activeOpacity={0.7}
              style={{
                height: ROW_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <UserAvatar profileImage={person.profileImage} firstName={person.firstName || person.userName} size={34} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{fullName}</Text>
                <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 12 }}>@{person.userName}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {isSearching ? (
          <View style={{ height: suggestions.length === 0 ? ROW_HEIGHT : 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={{ marginLeft: 8, color: colors.mutedText, fontSize: 12 }}>Searching…</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
