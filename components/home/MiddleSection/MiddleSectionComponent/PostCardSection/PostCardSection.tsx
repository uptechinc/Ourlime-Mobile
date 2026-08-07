import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { AuthService } from '@/lib/services/AuthService';
import { PostService, type PostItem } from '@/lib/services/PostService';
import ImageAndVideoPostSection from './ImageAndVideoPostSection/ImageAndVideoPostSection';
import UserAvatar from '@/components/ui/UserAvatar';
import PostOptionsSheet from './PostOptionsSheet';
import LikesModal from './LikesModal';
import IdentityBadges from './IdentityBadges';
import { EventService } from '@/lib/services/EventService';

type PostCardSectionProps = {
  post: PostItem;
  onCommentClick: (postId: string) => void;
  onPostDelete: (postId: string) => void;
  onAuthorBlocked: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
};

const authService = AuthService.getInstance();
const postService = PostService.getInstance();
const eventService = EventService.getInstance();

const formatTimestamp = (createdAt: string): string => {
  const createdDate = new Date(createdAt);
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)}d`;
  return createdDate.toLocaleDateString();
};

export default function PostCardSection({ post, onCommentClick, onPostDelete, onAuthorBlocked, onPostUpdate }: PostCardSectionProps) {
  const router = useRouter();
  const currentUserId = authService.getCurrentUser()?.uid;
  const [isLiked, setIsLiked] = useState(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  const [hasShared, setHasShared] = useState(false);
  const [isReposted, setIsReposted] = useState(post.repostedByViewer === true);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [likesVisible, setLikesVisible] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<{ isAttending: boolean; attendeeCount: number }>();
  const [eventAttendanceLoading, setEventAttendanceLoading] = useState(false);

  const handleNavigateProfile = (userName?: string) => {
    const targetUser = userName || post.user.userName;
    if (targetUser) {
      router.push(`/profile/${targetUser}` as any);
    }
  };

  useEffect(() => {
    if (!post.eventId) return;
    setEventAttendanceLoading(true);
    void eventService.getAttendance(post.eventId, currentUserId).then(setEventAttendance).catch((error: unknown) => {
      console.warn('[PostCardSection.eventAttendance]', error instanceof Error ? error.message : 'Attendance unavailable');
    }).finally(() => setEventAttendanceLoading(false));
  }, [currentUserId, post.eventId]);

  const handleToggleAttendance = async () => {
    if (!post.eventId || !currentUserId) return Alert.alert('Sign in required', 'Sign in to RSVP.');
    setEventAttendanceLoading(true);
    try {
      setEventAttendance(await eventService.toggleAttendance(post.eventId, currentUserId));
    } catch (error: unknown) {
      Alert.alert('RSVP not updated', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setEventAttendanceLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      Alert.alert('Sign in required', 'Sign in to like posts.');
      return;
    }
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
      console.error('[PostCardSection.handleLike]', error);
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
      await Share.share({ message: `${post.caption || post.description || 'View this post on Ourlime'}\n\n${postService.getPostUrl(post.id)}` });
    } catch (error: unknown) {
      Alert.alert('Post not shared', error instanceof Error ? error.message : 'Please try again');
    }
  };

  const handleRepost = async () => {
    if (!currentUserId) return Alert.alert('Sign in required', 'Sign in to repost.');
    if (isReposted) return;
    try {
      await postService.repost(post.id);
      setIsReposted(true);
      setShareCount((count) => count + 1);
    } catch (error: unknown) {
      Alert.alert('Post not reposted', error instanceof Error ? error.message : 'Please try again');
    }
  };

  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 18, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => handleNavigateProfile()} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <UserAvatar profileImage={post.user.profileImage} firstName={post.user.firstName || post.user.userName} size={48} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700' }}>{post.user.firstName} {post.user.lastName}</Text>
              <IdentityBadges user={post.user} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>@{post.user.userName} · {formatTimestamp(post.createdAt)}</Text>
              <Icon name={post.visibility === 'private' ? 'lock' : post.visibility === 'friends' ? 'users' : 'globe'} size={12} color="#9ca3af" style={{ marginLeft: 5 }} />
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 8 }}><Icon name="more-horizontal" size={21} color="#6b7280" /></TouchableOpacity>
      </View>

      {post.repostedFrom ? (
        <TouchableOpacity onPress={() => handleNavigateProfile(post.repostedFrom?.userName)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, padding: 10, borderRadius: 13, backgroundColor: '#ecfdf5' }}>
          <Icon name="repeat" size={15} color="#047857" />
          <Text style={{ marginLeft: 7, color: '#047857', fontSize: 12, fontWeight: '700' }}>Reposted from @{post.repostedFrom.userName}</Text>
        </TouchableOpacity>
      ) : null}

      {post.location ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Icon name="map-pin" size={14} color="#10b981" />
          <Text style={{ marginLeft: 5, color: '#6b7280', fontSize: 13 }}>{post.location.name}</Text>
        </View>
      ) : null}
      {post.type === 'event' ? (
        <View style={{ marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="calendar" size={17} color="#047857" /><Text style={{ marginLeft: 8, color: '#047857', fontWeight: '800' }}>{post.startDate ? new Date(post.startDate).toLocaleString() : 'Event date to be announced'}</Text></View>
          {post.endDate ? <Text style={{ marginTop: 5, color: '#4b5563', fontSize: 12 }}>Ends {new Date(post.endDate).toLocaleString()}</Text> : null}
          <View style={{ flexDirection: 'row', marginTop: post.recurrence || post.category ? 8 : 0 }}>
            {post.category ? <View style={{ marginRight: 7, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#d1fae5' }}><Text style={{ color: '#047857', fontSize: 11, fontWeight: '700' }}>{post.category}</Text></View> : null}
            {post.recurrence ? <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#ffffff' }}><Text style={{ color: '#6b7280', fontSize: 11 }}>{post.recurrence}</Text></View> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 }}>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>{eventAttendance?.attendeeCount ?? 0} {(eventAttendance?.attendeeCount ?? 0) === 1 ? 'attendee' : 'attendees'}</Text>
            {post.userId === currentUserId ? <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: '#ffffff' }}><Text style={{ color: '#047857', fontWeight: '700', fontSize: 12 }}>Organizing (Host)</Text></View> : <TouchableOpacity onPress={() => void handleToggleAttendance()} disabled={eventAttendanceLoading} style={{ minWidth: 92, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 13, backgroundColor: eventAttendance?.isAttending ? '#d1fae5' : '#10b981' }}>{eventAttendanceLoading ? <ActivityIndicator size="small" color={eventAttendance?.isAttending ? '#047857' : '#ffffff'} /> : <Text style={{ color: eventAttendance?.isAttending ? '#047857' : '#ffffff', fontWeight: '800', fontSize: 12 }}>{eventAttendance?.isAttending ? 'Attending' : 'Attend'}</Text>}</TouchableOpacity>}
          </View>
        </View>
      ) : null}
      {post.caption ? <Text style={{ marginTop: 14, color: '#111827', fontSize: 17, lineHeight: 23, fontWeight: '600' }}>{post.caption}</Text> : null}
      {post.description && post.description !== post.caption ? <Text style={{ marginTop: 8, color: '#374151', fontSize: 15, lineHeight: 22 }}>{post.description}</Text> : null}
      {post.hashtags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {post.hashtags.map((tag) => <Text key={tag} style={{ marginRight: 8, marginBottom: 4, color: '#059669', fontWeight: '600' }}>#{tag}</Text>)}
        </View>
      ) : null}
      {post.media.length > 0 ? <View style={{ marginTop: 14 }}><ImageAndVideoPostSection media={post.media} /></View> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
        <TouchableOpacity onPress={() => void handleLike()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Icon name="heart" size={22} color={isLiked ? '#c64d53' : '#6b7280'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setLikesVisible(true)} disabled={likeCount === 0} style={{ marginLeft: 7, marginRight: 26, paddingVertical: 6 }}><Text style={{ color: isLiked ? '#c64d53' : '#6b7280', fontWeight: '600' }}>{likeCount}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onCommentClick(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 26, paddingVertical: 6 }}>
          <Icon name="message-circle" size={22} color="#6b7280" />
          <Text style={{ marginLeft: 7, color: '#6b7280', fontWeight: '600' }}>{post.stats.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleShare()} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24, paddingVertical: 6 }}>
          <Icon name="share-2" size={22} color="#6b7280" />
          <Text style={{ marginLeft: 7, color: '#6b7280', fontWeight: '600' }}>{shareCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleRepost()} disabled={isReposted} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Icon name="repeat" size={22} color={isReposted ? '#10b981' : '#6b7280'} /></TouchableOpacity>
      </View>
      <PostOptionsSheet visible={optionsVisible} post={post} currentUserId={currentUserId ?? null} onClose={() => setOptionsVisible(false)} onDelete={onPostDelete} onBlock={onAuthorBlocked} />
      <LikesModal visible={likesVisible} postId={post.id} onClose={() => setLikesVisible(false)} />
    </View>
  );
}
