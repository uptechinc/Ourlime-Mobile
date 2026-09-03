import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, UserPlus, UserCheck } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { followService } from '@/lib/relationships/followService';
import type { BlogAuthorSummary } from '@/lib/types/blog';

type BlogAuthorCardProps = {
  author: BlogAuthorSummary;
};

export default function BlogAuthorCard({ author }: BlogAuthorCardProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(author.followersCount ?? 0);

  const isSelf = activeUserId === author.id;

  const handleToggleFollow = async () => {
    if (!activeUserId || !author.id || isSelf || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollowUser(activeUserId, author.id);
        setIsFollowing(false);
        setFollowersCount((count) => Math.max(0, count - 1));
      } else {
        await followService.followUser(activeUserId, author.id);
        setIsFollowing(true);
        setFollowersCount((count) => count + 1);
      }
    } catch (err) {
      console.warn('[BlogAuthorCard] Failed to toggle follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const navigateToProfile = () => {
    if (author.id) {
      router.push(`/profile/${author.id}`);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity activeOpacity={0.7} onPress={navigateToProfile} style={styles.topRow}>
        <UserAvatar profileImage={author.avatar} firstName={author.name} size={54} />
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {author.name}
            </Text>
            {author.isVerified ? <BadgeCheck size={18} color="#10b981" /> : null}
          </View>
          {author.role || author.company ? (
            <Text style={[styles.role, { color: colors.mutedText }]} numberOfLines={1}>
              {[author.role, author.company].filter(Boolean).join(' • ')}
            </Text>
          ) : null}
          <Text style={[styles.followers, { color: colors.mutedText }]}>
            {followersCount} {followersCount === 1 ? 'follower' : 'followers'}
          </Text>
        </View>
      </TouchableOpacity>

      {author.bio ? (
        <Text style={[styles.bio, { color: colors.text }]} numberOfLines={3}>
          {author.bio}
        </Text>
      ) : null}

      {!isSelf && author.id ? (
        <TouchableOpacity
          onPress={handleToggleFollow}
          disabled={followLoading}
          style={[
            styles.followButton,
            isFollowing
              ? { backgroundColor: isDark ? '#334155' : '#f1f5f9', borderWidth: 1, borderColor: colors.border }
              : { backgroundColor: '#10b981' },
          ]}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? colors.text : '#ffffff'} />
          ) : (
            <View style={styles.buttonContent}>
              {isFollowing ? (
                <>
                  <UserCheck size={16} color={colors.text} />
                  <Text style={[styles.buttonText, { color: colors.text }]}>Following</Text>
                </>
              ) : (
                <>
                  <UserPlus size={16} color="#ffffff" />
                  <Text style={[styles.buttonText, { color: '#ffffff' }]}>Follow Author</Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
  },
  role: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  followers: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  followButton: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
