import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bookmark, Clock, FileText, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { stripHtml } from '@/lib/utils/htmlUtils';
import type { BlogListItem } from '@/lib/types/blog';

type BlogListCardProps = {
  blog: BlogListItem;
  isLiked: boolean;
  isSaved: boolean;
  likesCount: number;
  onPress: () => void;
  onLikePress: () => void;
  onSavePress: () => void;
  onSharePress: () => void;
};

/** Mirrors Ourlime-Web components/blog/BlogCard.tsx. */
export default function BlogListCard({ blog, isLiked, isSaved, likesCount, onPress, onLikePress, onSavePress, onSharePress }: BlogListCardProps) {
  const { colors } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const dateLabel = blog.createdAtMs ? new Date(blog.createdAtMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={stripHtml(blog.title)}>
      <View style={styles.coverWrap}>
        {blog.coverImage && !coverFailed ? (
          <Image source={{ uri: blog.coverImage }} style={styles.cover} contentFit="cover" onError={() => setCoverFailed(true)} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}><FileText size={36} color="#ffffff" /></View>
        )}
        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{blog.categoryName || 'General'}</Text></View>
        <Pressable onPress={onSavePress} hitSlop={8} style={[styles.bookmarkButton, { backgroundColor: isSaved ? '#10b981' : 'rgba(255,255,255,0.92)' }]} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark'}>
          <Bookmark size={16} color={isSaved ? '#ffffff' : '#0f172a'} fill={isSaved ? '#ffffff' : 'transparent'} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{stripHtml(blog.title)}</Text>
        {blog.excerpt ? <Text style={[styles.excerpt, { color: colors.secondaryText }]} numberOfLines={3}>{stripHtml(blog.excerpt)}</Text> : null}

        <View style={styles.authorRow}>
          <UserAvatar profileImage={blog.author.avatar} firstName={blog.author.name} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>{blog.author.name}</Text>
            <View style={styles.metaRow}>
              {dateLabel ? <Text style={[styles.meta, { color: colors.mutedText }]}>{dateLabel}</Text> : null}
              <Clock size={11} color={colors.mutedText} />
              <Text style={[styles.meta, { color: colors.mutedText }]}>{blog.readTime || 1} min read</Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable onPress={onLikePress} hitSlop={8} style={styles.action} accessibilityRole="button" accessibilityLabel={isLiked ? 'Unlike' : 'Like'}>
            <Heart size={16} color={isLiked ? '#ef4444' : colors.mutedText} fill={isLiked ? '#ef4444' : 'transparent'} />
            <Text style={[styles.actionText, { color: isLiked ? '#ef4444' : colors.mutedText }]}>{likesCount}</Text>
          </Pressable>
          <View style={styles.action}>
            <MessageCircle size={16} color={colors.mutedText} />
            <Text style={[styles.actionText, { color: colors.mutedText }]}>{blog.commentsCount}</Text>
          </View>
          <Pressable onPress={onSharePress} hitSlop={8} style={[styles.action, { marginLeft: 'auto' }]} accessibilityRole="button" accessibilityLabel="Share">
            <Share2 size={16} color={colors.mutedText} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', aspectRatio: 1200 / 630 },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981' },
  categoryBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#10b981', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  bookmarkButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  excerpt: { fontSize: 13, lineHeight: 19 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  authorName: { fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
