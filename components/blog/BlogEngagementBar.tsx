import { Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, Bookmark, MessageSquare, Share2 } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type BlogEngagementBarProps = {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  interactionsReady?: boolean;
  onLikePress: () => void;
  onBookmarkPress: () => void;
  onCommentPress: () => void;
  onSharePress: () => void;
};

export default function BlogEngagementBar({
  likesCount,
  commentsCount,
  isLiked,
  isBookmarked,
  interactionsReady = true,
  onLikePress,
  onBookmarkPress,
  onCommentPress,
  onSharePress,
}: BlogEngagementBarProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? '#1e293be6' : '#ffffffe6',
          borderColor: colors.border,
          shadowColor: '#000',
        },
      ]}
    >
      <TouchableOpacity disabled={!interactionsReady} activeOpacity={0.7} accessibilityLabel="Like blog" accessibilityState={{ selected: isLiked, disabled: !interactionsReady }} onPress={onLikePress} style={styles.actionBtn}>
        <Heart
          size={20}
          color={isLiked ? '#ef4444' : colors.text}
          fill={isLiked ? '#ef4444' : 'transparent'}
        />
        <Text style={[styles.countText, { color: isLiked ? '#ef4444' : colors.text }]}>
          {likesCount}
        </Text>
      </TouchableOpacity>

      <Pressable accessibilityRole="button" accessibilityLabel="Go to responses" onPress={onCommentPress} style={styles.actionBtn}>
        <MessageSquare size={20} color={colors.text} />
        <Text style={[styles.countText, { color: colors.text }]}>{commentsCount}</Text>
      </Pressable>

      <TouchableOpacity disabled={!interactionsReady} activeOpacity={0.7} accessibilityLabel="Save blog" onPress={onBookmarkPress} style={styles.actionBtn}>
        <Bookmark
          size={20}
          color={isBookmarked ? '#10b981' : colors.text}
          fill={isBookmarked ? '#10b981' : 'transparent'}
        />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.7} accessibilityLabel="Share blog" onPress={onSharePress} style={styles.actionBtn}>
        <Share2 size={20} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: 20,
    marginVertical: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
