import { useMemo, useState, useEffect } from 'react';
import { Share, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { AuthService } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import ImageAndVideoPostSection from './ImageAndVideoPostSection/ImageAndVideoPostSection';
import UserAvatar from '@/components/ui/UserAvatar';
import PostOptionsSheet from './PostOptionsSheet';
import { feedCardContainerStyle } from './feedCardStyles';
import PostLinkPreview from './PostLinkPreview';
import { findFirstUrl } from '@/lib/services/OpenGraphService';
import CustomModal from '@/components/ui/CustomModal';
import LikesModal from './LikesModal';
import IdentityBadges from './IdentityBadges';

type PollCardSectionProps = {
  post: PostItem;
  onCommentClick: (postId: string) => void;
  onPostDelete: (postId: string) => void;
  onAuthorBlocked: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
};

const authService = AuthService.getInstance();
const postService = PostService.getInstance();

const getTimeRemaining = (endTime?: string, createdAt?: string, pollDuration?: number): string => {
  let targetMs: number | null = null;
  if (endTime) {
    targetMs = new Date(endTime).getTime();
  }
  if ((!targetMs || isNaN(targetMs)) && createdAt) {
    const durationHours = typeof pollDuration === 'number' && pollDuration > 0 ? pollDuration : 24;
    targetMs = new Date(createdAt).getTime() + durationHours * 3600 * 1000;
  }
  if (!targetMs || isNaN(targetMs)) return 'Active poll';
  const difference = targetMs - Date.now();
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

export default function PollCardSection({ post, onCommentClick, onPostDelete, onAuthorBlocked, onPostUpdate }: PollCardSectionProps) {
  const router = useRouter();
  const postUrl = findFirstUrl(`${post.caption} ${post.description}`);
  const currentUserId = authService.getCurrentUser()?.uid;
  const [isLiked, setIsLiked] = useState(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  const [hasShared, setHasShared] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [likesVisible, setLikesVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState(currentUserId ? post.pollVotes?.[currentUserId] : undefined);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(
    Object.fromEntries((post.pollOptions ?? []).map((option) => [option.id, option.votes]))
  );

  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeRemaining = useMemo(
    () => getTimeRemaining(post.pollEndTime, post.createdAt, post.pollDuration),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await postService.toggleLike(post.id, currentUserId, previousLiked);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      onPostUpdate({ ...post, stats: { ...post.stats, likes: result.likeCount }, likedUserIds: result.liked ? [currentUserId] : [] });
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

  const handleShare = async () => {
    try {
      if (!hasShared) {
        const result = await postService.recordShare(post.id);
        setShareCount(result.shareCount);
        setHasShared(true);
        onPostUpdate({ ...post, stats: { ...post.stats, shares: result.shareCount } });
      }
      await Share.share({ message: `${post.caption || post.description || 'Vote on this poll in Ourlime'}\n\n${postService.getPostUrl(post.id)}` });
    } catch (error: unknown) {
      setFeedback({ title: 'Poll not shared', message: error instanceof Error ? error.message : 'Please try again' });
    }
  };

  return (
    <>
    <View style={feedCardContainerStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={handleNavigateProfile} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <UserAvatar profileImage={post.user.profileImage} firstName={post.user.firstName || post.user.userName} size={48} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#111827', fontSize: 16, fontWeight: '700' }}>{post.user.firstName} {post.user.lastName}</Text><IdentityBadges user={post.user} /></View>
            <Text style={{ marginTop: 2, color: '#6b7280', fontSize: 13 }}>@{post.user.userName} · Poll</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 8 }}><Icon name="more-horizontal" size={21} color="#6b7280" /></TouchableOpacity>
      </View>

      {post.location ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><Icon name="map-pin" size={14} color="#10b981" /><Text style={{ marginLeft: 5, color: '#6b7280' }}>{post.location.name}</Text></View> : null}
      {post.caption ? <Text style={{ marginTop: 15, color: '#111827', fontSize: 18, lineHeight: 24, fontWeight: '700' }}>{post.caption}</Text> : null}
      {post.description && post.description !== post.caption ? <Text style={{ marginTop: 7, color: '#4b5563', lineHeight: 21 }}>{post.description}</Text> : null}
      {postUrl ? <PostLinkPreview url={postUrl} /> : null}

      {post.media && post.media.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <ImageAndVideoPostSection media={post.media} />
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        {(post.pollOptions ?? []).map((option) => {
          const votes = voteCounts[option.id] ?? 0;
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSelected = selectedOptionId === option.id;
          return (
            <TouchableOpacity key={option.id} onPress={() => void handleVote(option.id)} disabled={pollEnded} style={{ marginBottom: 10, padding: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: isSelected ? '#10b981' : '#e5e7eb', backgroundColor: '#ffffff' }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`, backgroundColor: '#d1fae5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#111827', fontWeight: isSelected ? '700' : '600' }}>{option.text}</Text>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>{percentage}% · {votes}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
        <Text style={{ color: pollEnded ? '#c64d53' : '#059669', fontSize: 13, fontWeight: '600' }}>{timeRemaining}</Text>
      </View>
      {post.hashtags.length > 0 ? <Text style={{ marginTop: 12, color: '#059669', fontWeight: '600' }}>{post.hashtags.map((tag) => `#${tag}`).join(' ')}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
        <TouchableOpacity onPress={() => void handleLike()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Icon name="heart" size={22} color={isLiked ? '#c64d53' : '#6b7280'} /></TouchableOpacity><TouchableOpacity onPress={() => setLikesVisible(true)} disabled={likeCount === 0} style={{ marginLeft: 7, marginRight: 26, paddingVertical: 6 }}><Text style={{ color: isLiked ? '#c64d53' : '#6b7280', fontWeight: '600' }}>{likeCount}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onCommentClick(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 26, paddingVertical: 6 }}><Icon name="message-circle" size={22} color="#6b7280" /><Text style={{ marginLeft: 7, color: '#6b7280', fontWeight: '600' }}>{post.stats.comments}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => void handleShare()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Icon name="share-2" size={22} color="#6b7280" /><Text style={{ marginLeft: 7, color: '#6b7280', fontWeight: '600' }}>{shareCount}</Text></TouchableOpacity>
      </View>
      <PostOptionsSheet visible={optionsVisible} post={post} currentUserId={currentUserId ?? null} onClose={() => setOptionsVisible(false)} onDelete={onPostDelete} onBlock={onAuthorBlocked} onPostUpdate={onPostUpdate} />
      <LikesModal visible={likesVisible} postId={post.id} onClose={() => setLikesVisible(false)} />
    </View>
    <CustomModal visible={feedback !== null} type="danger" title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    </>
  );
}
