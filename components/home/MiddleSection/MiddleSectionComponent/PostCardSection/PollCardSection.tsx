import { useMemo, useState, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PostService, type PostItem } from '@/lib/services/PostService';
import ImageAndVideoPostSection from './ImageAndVideoPostSection/ImageAndVideoPostSection';
import UserAvatar from '@/components/ui/UserAvatar';
import PostOptionsSheet from './PostOptionsSheet';
import { feedCardContainerStyle } from './feedCardStyles';
import PostLinkPreview from './PostLinkPreview';
import { YouTubePostPreview } from './YouTubePostPreview';
import { findFirstUrl } from '@/lib/services/OpenGraphService';
import CustomModal from '@/components/ui/CustomModal';
import LikesModal from './LikesModal';
import IdentityBadges from './IdentityBadges';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useCountdownTicker } from '@/lib/hooks/useCountdownTicker';
import RichTextContent from '@/components/ui/RichTextContent';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';

type PollCardSectionProps = {
  post: PostItem;
  isVisible?: boolean;
  onCommentClick: (postId: string) => void;
  onPostDelete: (postId: string) => void;
  onAuthorBlocked: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
};

const postService = PostService.getInstance();

const getTimeRemaining = (nowMs: number, endTime?: string, createdAt?: string, pollDuration?: number): string => {
  let targetMs: number | null = null;
  if (endTime) {
    targetMs = new Date(endTime).getTime();
  }
  if ((!targetMs || isNaN(targetMs)) && createdAt) {
    const durationHours = typeof pollDuration === 'number' && pollDuration > 0 ? pollDuration : 24;
    targetMs = new Date(createdAt).getTime() + durationHours * 3600 * 1000;
  }
  if (!targetMs || isNaN(targetMs)) return 'Active poll';
  const difference = targetMs - nowMs;
  if (difference <= 0) return 'Poll ended';
  const days = Math.floor(difference / (24 * 3600 * 1000));
  const hours = Math.floor((difference % (24 * 3600 * 1000)) / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  const seconds = Math.floor((difference % 60_000) / 1000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
};

export default function PollCardSection({ post, isVisible = false, onCommentClick, onPostDelete, onAuthorBlocked, onPostUpdate }: PollCardSectionProps) {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const { activeUserId: currentUserId } = useAppData();
  const postUrl = findFirstUrl(`${post.caption} ${post.description}`);
  const locationPresentation = useMemo(
    () => post.location ? linkPresentationService.presentLocation(post.location.name, post.location.address) : null,
    [post.location],
  );
  const [isLiked, setIsLiked] = useState(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  const [hasShared, setHasShared] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [likesVisible, setLikesVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState(currentUserId ? post.pollVotes?.[currentUserId] : undefined);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(
    Object.fromEntries((post.pollOptions ?? []).map((option) => [option.id, option.votes]))
  );

  const nowMs = useCountdownTicker(isVisible);

  useEffect(() => {
    setIsLiked(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
    setSelectedOptionId(currentUserId ? post.pollVotes?.[currentUserId] : undefined);
  }, [currentUserId, post.likedUserIds, post.pollVotes]);

  useEffect(() => {
    setLikeCount(post.stats.likes);
  }, [post.stats.likes]);

  const timeRemaining = useMemo(
    () => getTimeRemaining(nowMs, post.pollEndTime, post.createdAt, post.pollDuration),
    [post.pollEndTime, post.createdAt, post.pollDuration, nowMs]
  );
  const pollEnded = timeRemaining === 'Poll ended';
  const totalVotes = useMemo(() => Object.values(voteCounts).reduce((total, votes) => total + votes, 0), [voteCounts]);

  const handleNavigateProfile = () => {
    if (post.user.userName) {
      router.push({ pathname: '/profile/[username]', params: { username: post.user.userName } });
    }
  };

  const handleLike = async () => {
    if (!currentUserId) return setFeedback({ title: 'Sign in required', message: 'Sign in to like posts.' });
    const previousLiked = isLiked;
    setIsLiked(!previousLiked);
    setLikeCount((count) => Math.max(0, count + (previousLiked ? -1 : 1)));
    try {
      const result = await postService.toggleLike(post, currentUserId, !previousLiked);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      const likedUserIds = result.liked
        ? Array.from(new Set([...post.likedUserIds, currentUserId]))
        : post.likedUserIds.filter((userId) => userId !== currentUserId);
      onPostUpdate({ ...post, stats: { ...post.stats, likes: result.likeCount }, likedUserIds });
    } catch (error: unknown) {
      setIsLiked(previousLiked);
      setLikeCount((count) => Math.max(0, count + (previousLiked ? 1 : -1)));
      console.error('[PollCardSection.handleLike]', error);
    }
  };

  const handleVote = async (optionId: string) => {
    if (!currentUserId) return setFeedback({ title: 'Sign in required', message: 'Sign in to vote in polls.' });
    if (pollEnded || selectedOptionId === optionId) return;
    const previousOptionId = selectedOptionId;
    setSelectedOptionId(optionId);
    setVoteCounts((current) => ({
      ...current,
      ...(previousOptionId ? { [previousOptionId]: Math.max(0, (current[previousOptionId] ?? 1) - 1) } : {}),
      [optionId]: (current[optionId] ?? 0) + 1,
    }));
    try {
      const result = await postService.voteOnPoll(post.id, currentUserId, optionId);
      setSelectedOptionId(result.selectedOptionId);
      setVoteCounts(result.counts);
      onPostUpdate({ ...post, pollVotes: { ...(post.pollVotes ?? {}), [currentUserId]: result.selectedOptionId } });
    } catch (error: unknown) {
      setSelectedOptionId(previousOptionId);
      setVoteCounts((current) => ({
        ...current,
        [optionId]: Math.max(0, (current[optionId] ?? 1) - 1),
        ...(previousOptionId ? { [previousOptionId]: (current[previousOptionId] ?? 0) + 1 } : {}),
      }));
      console.error('[PollCardSection.handleVote]', error);
    }
  };

  const handleShared = async (): Promise<void> => {
    if (hasShared) return;
    try {
      const result = await postService.recordShare(post.id);
      setShareCount(result.shareCount);
      setHasShared(true);
      onPostUpdate({ ...post, stats: { ...post.stats, shares: result.shareCount } });
    } catch (error: unknown) {
      setFeedback({ title: 'Share count not updated', message: error instanceof Error ? error.message : 'Your poll was shared, but its count could not be refreshed.' });
    }
  };

  return (
    <>
    <View style={[feedCardContainerStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={handleNavigateProfile} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UserAvatar profileImage={post.user.profileImage} firstName={post.user.firstName || post.user.userName} size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{post.user.firstName} {post.user.lastName}</Text><IdentityBadges user={post.user} /></View>
              <Text style={{ marginTop: 2, color: colors.mutedText, fontSize: 13 }}>@{post.user.userName} · Poll</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 8 }}><Icon name="more-horizontal" size={21} color={colors.icon} /></TouchableOpacity>
        </View>

        {locationPresentation ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><Icon name={locationPresentation.isOnline ? 'link' : 'map-pin'} size={14} color="#10b981" /><Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, marginLeft: 5, color: colors.mutedText }}>{locationPresentation.detail ? `${locationPresentation.title} · ${locationPresentation.detail}` : locationPresentation.title}</Text></View> : null}
        {post.caption ? <RichTextContent content={post.caption} style={{ marginTop: 15, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' }} /> : null}
        {post.description && post.description !== post.caption ? <RichTextContent content={post.description} style={{ marginTop: 7, color: colors.mutedText, lineHeight: 21 }} /> : null}
        {postUrl ? <PostLinkPreview url={postUrl} /> : null}
        <YouTubePostPreview text={`${post.caption} ${post.description}`} postId={post.id} />
      </View>

      {post.media && post.media.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <ImageAndVideoPostSection media={post.media} isParentVisible={isVisible} onLike={() => void handleLike()} />
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ marginTop: 16 }}>
          {(post.pollOptions ?? []).map((option) => {
            const votes = voteCounts[option.id] ?? 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isSelected = selectedOptionId === option.id;
            return (
              <TouchableOpacity key={option.id} onPress={() => void handleVote(option.id)} disabled={pollEnded} style={{ marginBottom: 10, padding: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: isSelected ? '#10b981' : colors.border, backgroundColor: colors.elevated }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`, backgroundColor: isDark ? '#065f46' : '#d1fae5' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: isSelected ? '700' : '600' }}>{option.text}</Text>
                  <Text style={{ color: colors.mutedText, fontSize: 13 }}>{percentage}% · {votes}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
          <Text style={{ color: colors.mutedText, fontSize: 13 }}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
          <Text style={{ color: pollEnded ? '#c64d53' : '#059669', fontSize: 13, fontWeight: '600' }}>{timeRemaining}</Text>
        </View>
        {post.hashtags.length > 0 ? <Text style={{ marginTop: 12, color: '#059669', fontWeight: '600' }}>{post.hashtags.map((tag) => `#${tag}`).join(' ')}</Text> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AnimatedActionButton feedback="like" accessibilityLabel={isLiked ? 'Unlike poll' : 'Like poll'} onPress={() => void handleLike()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={23} color={isLiked ? '#ef4444' : colors.icon} /></AnimatedActionButton><TouchableOpacity onPress={() => setLikesVisible(true)} disabled={likeCount === 0} style={{ marginLeft: 7, marginRight: 22, paddingVertical: 6 }}><Text style={{ color: isLiked ? '#ef4444' : colors.mutedText, fontWeight: '600' }}>{likeCount}</Text></TouchableOpacity>
            <AnimatedActionButton feedback="comment" accessibilityLabel="Open poll comments" onPress={() => onCommentClick(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 22, paddingVertical: 6 }}><Icon name="message-circle" size={22} color={colors.icon} /><Text style={{ marginLeft: 7, color: colors.mutedText, fontWeight: '600' }}>{post.stats.comments}</Text></AnimatedActionButton>
            <AnimatedActionButton feedback="share" accessibilityLabel="Share poll" onPress={() => setShareVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Icon name="share-2" size={22} color={colors.icon} /><Text style={{ marginLeft: 7, color: colors.mutedText, fontWeight: '600' }}>{shareCount}</Text></AnimatedActionButton>
          </View>

          {likeCount > 0 ? (
            <TouchableOpacity
              onPress={() => setLikesVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`View ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
            >
              {post.likedUsers && post.likedUsers.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {post.likedUsers.slice(0, 3).map((likedUser, idx) => (
                    <View
                      key={likedUser.id}
                      style={{
                        marginLeft: idx > 0 ? -10 : 0,
                        borderWidth: 2,
                        borderColor: colors.surface,
                        borderRadius: 12,
                        zIndex: 3 - idx,
                      }}
                    >
                      <UserAvatar
                        profileImage={likedUser.profileImage}
                        firstName={likedUser.firstName || likedUser.userName}
                        size={22}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={{ fontSize: 13, color: colors.mutedText, fontWeight: '600' }}>
                {likeCount === 1 ? '1 like' : `${likeCount} likes`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <PostOptionsSheet visible={optionsVisible} post={post} currentUserId={currentUserId ?? null} onClose={() => setOptionsVisible(false)} onDelete={onPostDelete} onBlock={onAuthorBlocked} onPostUpdate={onPostUpdate} />
      <LikesModal visible={likesVisible} postId={post.id} origin={post.origin} onClose={() => setLikesVisible(false)} />
    </View>
    <CustomModal visible={feedback !== null} type="danger" title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    <ShareContentSheet
      visible={shareVisible}
      currentUserId={currentUserId ?? ''}
      contentLabel="poll"
      title={post.caption || post.description || `Poll from @${post.user.userName}`}
      message={`${post.caption || post.description || `Vote in @${post.user.userName}'s poll on Ourlime`}\n\n${postService.getPostUrl(post.id)}`}
      url={postService.getPostUrl(post.id)}
      onClose={() => setShareVisible(false)}
      onShared={() => void handleShared()}
    />
    </>
  );
}
