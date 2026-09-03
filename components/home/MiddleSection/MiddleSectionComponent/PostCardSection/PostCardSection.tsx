import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
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
import LikesModal from './LikesModal';
import IdentityBadges from './IdentityBadges';
import RichTextContent from '@/components/ui/RichTextContent';
import PostLocationMap from './PostLocationMap';
import { EventService } from '@/lib/services/EventService';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';

type PostCardSectionProps = {
  post: PostItem;
  isVisible?: boolean;
  isProfileRepost?: boolean;
  canModerateCommunityPost?: boolean;
  onCommentClick: (postId: string) => void;
  onPostDelete: (postId: string) => void;
  onAuthorBlocked: (userId: string) => void;
  onPostUpdate: (post: PostItem) => void;
  onRepostRemoved?: (postId: string, updatedPost: PostItem) => void;
};

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

export default function PostCardSection({ post, isVisible = false, isProfileRepost = false, canModerateCommunityPost = false, onCommentClick, onPostDelete, onAuthorBlocked, onPostUpdate, onRepostRemoved }: PostCardSectionProps) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { activeUserId: currentUserId } = useAppData();
  const postUrl = findFirstUrl(`${post.caption} ${post.description}`);
  const [isLiked, setIsLiked] = useState(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
  const [likeCount, setLikeCount] = useState(post.stats.likes);
  const [shareCount, setShareCount] = useState(post.stats.shares);
  const [hasShared, setHasShared] = useState(false);
  const [isReposted, setIsReposted] = useState(post.repostedByViewer === true);
  const [removeRepostVisible, setRemoveRepostVisible] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [likesVisible, setLikesVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [eventAttendance, setEventAttendance] = useState<{ isAttending: boolean; attendeeCount: number }>();
  const [eventAttendanceLoading, setEventAttendanceLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    setIsReposted(post.repostedByViewer === true);
  }, [post.repostedByViewer]);

  useEffect(() => {
    setIsLiked(Boolean(currentUserId && post.likedUserIds.includes(currentUserId)));
  }, [currentUserId, post.likedUserIds]);

  useEffect(() => {
    setLikeCount(post.stats.likes);
  }, [post.stats.likes]);

  const handleNavigateProfile = (userName?: string) => {
    const targetUser = userName || post.user.userName;
    if (targetUser) {
      router.push({ pathname: '/profile/[username]', params: { username: targetUser } });
    }
  };

  useEffect(() => {
    if (!post.eventId) return;
    let active = true;
    setEventAttendanceLoading(true);
    void (async () => {
      try {
        const attendance = await eventService.getAttendance(post.eventId!);
        if (active) setEventAttendance(attendance);
      } catch (error: unknown) {
        console.warn('[PostCardSection.eventAttendance]', error instanceof Error ? error.message : 'Attendance unavailable');
      } finally {
        if (active) setEventAttendanceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUserId, post.eventId]);

  const handleToggleAttendance = async () => {
    if (!post.eventId) return;
    setEventAttendanceLoading(true);
    try {
      setEventAttendance(await eventService.toggleAttendance(post.eventId));
    } catch (error: unknown) {
      setFeedback({ title: 'RSVP not updated', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setEventAttendanceLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      setFeedback({ title: 'Sign in required', message: 'Sign in to like posts.' });
      return;
    }
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
      console.warn('[PostCardSection.handleLike]', error instanceof Error ? error.message : error);
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
      setFeedback({ title: 'Share count not updated', message: error instanceof Error ? error.message : 'Your post was shared, but its count could not be refreshed.' });
    }
  };

  const handleCreateRepost = async () => {
    if (!currentUserId) return setFeedback({ title: 'Sign in required', message: 'Sign in to repost.' });
    setRepostBusy(true);
    try {
      await postService.repost(post.id);
      const nextCount = shareCount + 1;
      const nextRepostedByUserIds = currentUserId
        ? Array.from(new Set([...(post.repostedByUserIds ?? []), currentUserId]))
        : post.repostedByUserIds;
      setIsReposted(true);
      setShareCount(nextCount);
      onPostUpdate({ ...post, repostedByViewer: true, repostedByUserIds: nextRepostedByUserIds, stats: { ...post.stats, shares: nextCount } });
    } catch (error: unknown) {
      setFeedback({ title: 'Repost not updated', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setRepostBusy(false);
    }
  };

  const handleRepostPress = () => {
    if (!currentUserId) {
      setFeedback({ title: 'Sign in required', message: 'Sign in to repost.' });
      return;
    }
    if (isReposted) {
      setRemoveRepostVisible(true);
      return;
    }
    void handleCreateRepost();
  };

  const handleConfirmRemoveRepost = async () => {
    if (repostBusy) return;
    setRepostBusy(true);
    try {
      await postService.removeRepost(post.id);
      const nextCount = Math.max(0, shareCount - 1);
      const updatedPost = {
        ...post,
        repostedByViewer: false,
        repostedByUserIds: currentUserId
          ? post.repostedByUserIds?.filter((reposterUserId) => reposterUserId !== currentUserId)
          : post.repostedByUserIds,
        stats: { ...post.stats, shares: nextCount },
      };
      setIsReposted(false);
      setShareCount(nextCount);
      setRemoveRepostVisible(false);
      if (onRepostRemoved) onRepostRemoved(post.id, updatedPost);
      else onPostUpdate(updatedPost);
    } catch (error: unknown) {
      setRemoveRepostVisible(false);
      setFeedback({ title: 'Repost not removed', message: error instanceof Error ? error.message : 'Please try again' });
    } finally {
      setRepostBusy(false);
    }
  };

  return (
    <>
    <View style={[feedCardContainerStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header & Caption Section */}
      <View style={{ paddingHorizontal: 16 }}>
        {isProfileRepost ? (
          <View accessibilityLabel="Reposted post" style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }}>
            <Icon name="repeat" size={14} color={isDark ? '#6ee7b7' : '#047857'} />
            <Text style={{ marginLeft: 6, color: isDark ? '#6ee7b7' : '#047857', fontSize: 12, fontWeight: '800' }}>Reposted</Text>
          </View>
        ) : null}
        {/* Community Post Header Badge */}
        {post.communityName ? (
          <TouchableOpacity
            onPress={() => {
              if (post.communityId) router.push({ pathname: '/communities/[id]', params: { id: post.communityId } });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
              alignSelf: 'flex-start',
              gap: 6,
            }}
          >
            <Icon name="users" size={13} color={isDark ? '#34d399' : '#059669'} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#34d399' : '#059669' }}>
              Posted in {post.communityName}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => handleNavigateProfile()} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <UserAvatar profileImage={post.user.profileImage} firstName={post.user.firstName || post.user.userName} size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{post.user.firstName} {post.user.lastName}</Text>
                <IdentityBadges user={post.user} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={{ color: colors.mutedText, fontSize: 13 }}>@{post.user.userName} · {formatTimestamp(post.createdAt)}</Text>
                <Icon name={post.visibility === 'private' ? 'lock' : post.visibility === 'friends' ? 'users' : 'globe'} size={12} color={colors.icon} style={{ marginLeft: 5 }} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 8 }}><Icon name="more-horizontal" size={21} color={colors.icon} /></TouchableOpacity>
        </View>

        {post.repostedFrom ? (
          <TouchableOpacity onPress={() => handleNavigateProfile(post.repostedFrom?.userName)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, padding: 10, borderRadius: 13, backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }}>
            <Icon name="repeat" size={15} color={isDark ? '#34d399' : '#047857'} />
            <Text style={{ marginLeft: 7, color: isDark ? '#34d399' : '#047857', fontSize: 12, fontWeight: '700' }}>Reposted from @{post.repostedFrom.userName}</Text>
          </TouchableOpacity>
        ) : null}

        {/* 1. Text */}
        {post.caption ? (
          <RichTextContent
            content={post.caption}
            style={{ marginTop: 14, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '600' }}
          />
        ) : null}
        {post.description && post.description !== post.caption ? (
          <RichTextContent
            content={post.description}
            style={{ marginTop: 8, color: colors.mutedText, fontSize: 15, lineHeight: 22 }}
          />
        ) : null}

        {postUrl ? <PostLinkPreview url={postUrl} /> : null}

        <YouTubePostPreview text={`${post.caption} ${post.description}`} postId={post.id} />

        {/* 2. Hashtags */}
        {post.hashtags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {post.hashtags.map((tag) => <Text key={tag} style={{ marginRight: 8, marginBottom: 4, color: isDark ? '#34d399' : '#059669', fontWeight: '600' }}>#{tag}</Text>)}
          </View>
        ) : null}
      </View>

      {/* 3. Media (Images & Videos) — 100% Edge-to-Edge */}
      {post.media.length > 0 ? <View style={{ marginTop: 12 }}><ImageAndVideoPostSection media={post.media} isParentVisible={isVisible} onLike={() => void handleLike()} /></View> : null}

      {/* 4. Footer & Actions */}
      <View style={{ paddingHorizontal: 16 }}>
        {/* Location Map */}
        {post.location ? (
          <PostLocationMap location={post.location} />
        ) : null}

        {/* Event Card */}
        {post.type === 'event' ? (
          <View style={{ marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: isDark ? '#064e3b' : '#f0fdf4', borderWidth: 1, borderColor: isDark ? '#047857' : '#bbf7d0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="calendar" size={17} color={isDark ? '#34d399' : '#047857'} /><Text style={{ marginLeft: 8, color: isDark ? '#34d399' : '#047857', fontWeight: '800' }}>{post.startDate ? new Date(post.startDate).toLocaleString() : 'Event date to be announced'}</Text></View>
            {post.endDate ? <Text style={{ marginTop: 5, color: isDark ? '#a8b3c7' : '#4b5563', fontSize: 12 }}>Ends {new Date(post.endDate).toLocaleString()}</Text> : null}
            <View style={{ flexDirection: 'row', marginTop: post.recurrence || post.category ? 8 : 0 }}>
              {post.category ? <View style={{ marginRight: 7, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: isDark ? '#065f46' : '#d1fae5' }}><Text style={{ color: isDark ? '#6ee7b7' : '#047857', fontSize: 11, fontWeight: '700' }}>{post.category}</Text></View> : null}
              {post.recurrence ? <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#ffffff' }}><Text style={{ color: colors.mutedText, fontSize: 11 }}>{post.recurrence}</Text></View> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 }}>
              <Text style={{ color: colors.mutedText, fontSize: 12 }}>{eventAttendance?.attendeeCount ?? 0} {(eventAttendance?.attendeeCount ?? 0) === 1 ? 'attendee' : 'attendees'}</Text>
              {post.userId === currentUserId ? <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: isDark ? '#1e293b' : '#ffffff' }}><Text style={{ color: isDark ? '#34d399' : '#047857', fontWeight: '700', fontSize: 12 }}>Organizing (Host)</Text></View> : <TouchableOpacity onPress={() => void handleToggleAttendance()} disabled={eventAttendanceLoading} style={{ minWidth: 92, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 13, backgroundColor: eventAttendance?.isAttending ? (isDark ? '#065f46' : '#d1fae5') : '#10b981' }}>{eventAttendanceLoading ? <ActivityIndicator size="small" color={eventAttendance?.isAttending ? (isDark ? '#34d399' : '#047857') : '#ffffff'} /> : <Text style={{ color: eventAttendance?.isAttending ? (isDark ? '#34d399' : '#047857') : '#ffffff', fontWeight: '800', fontSize: 12 }}>{eventAttendance?.isAttending ? 'Attending' : 'Attend'}</Text>}</TouchableOpacity>}
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AnimatedActionButton feedback="like" accessibilityLabel={isLiked ? 'Unlike post' : 'Like post'} onPress={() => void handleLike()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={23} color={isLiked ? '#ef4444' : colors.icon} />
            </AnimatedActionButton>
            <TouchableOpacity onPress={() => setLikesVisible(true)} disabled={likeCount === 0} style={{ marginLeft: 7, marginRight: 22, paddingVertical: 6 }}><Text style={{ color: isLiked ? '#c64d53' : colors.mutedText, fontWeight: '600' }}>{likeCount}</Text></TouchableOpacity>
            <AnimatedActionButton feedback="comment" accessibilityLabel="Open post comments" onPress={() => onCommentClick(post.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 22, paddingVertical: 6 }}>
              <Icon name="message-circle" size={22} color={colors.icon} />
              <Text style={{ marginLeft: 7, color: colors.mutedText, fontWeight: '600' }}>{post.stats.comments}</Text>
            </AnimatedActionButton>
            <AnimatedActionButton feedback="share" accessibilityLabel="Share post" onPress={() => setShareVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, paddingVertical: 6 }}>
              <Icon name="share-2" size={22} color={colors.icon} />
              <Text style={{ marginLeft: 7, color: colors.mutedText, fontWeight: '600' }}>{shareCount}</Text>
            </AnimatedActionButton>
            {!post.communityId ? <AnimatedActionButton disabled={repostBusy} onPress={handleRepostPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, opacity: repostBusy ? 0.6 : 1 }} accessibilityLabel={isReposted ? 'Remove repost' : 'Repost'}><Icon name="repeat" size={22} color={isReposted ? '#10b981' : colors.icon} /></AnimatedActionButton> : null}
          </View>

          {/* Liked Users Display on the right */}
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

      <PostOptionsSheet visible={optionsVisible} post={post} currentUserId={currentUserId ?? null} canModerateCommunityPost={canModerateCommunityPost} onClose={() => setOptionsVisible(false)} onDelete={onPostDelete} onBlock={onAuthorBlocked} onPostUpdate={onPostUpdate} />
      <LikesModal visible={likesVisible} postId={post.id} origin={post.origin} onClose={() => setLikesVisible(false)} />
    </View>
    <CustomModal
      visible={removeRepostVisible}
      type="warning"
      title="Remove this repost?"
      message="This post will disappear from your profile. The original post will remain available to its author and audience."
      confirmText="Remove repost"
      cancelText="Keep it"
      isLoading={repostBusy}
      onConfirm={() => void handleConfirmRemoveRepost()}
      onClose={() => {
        if (!repostBusy) setRemoveRepostVisible(false);
      }}
    />
    <CustomModal visible={feedback !== null} type="danger" title={feedback?.title ?? ''} message={feedback?.message ?? ''} onClose={() => setFeedback(null)} />
    <ShareContentSheet
      visible={shareVisible}
      currentUserId={currentUserId ?? ''}
      contentLabel="post"
      title={post.caption || post.description || `Post from @${post.user.userName}`}
      message={`${post.caption || post.description || `View @${post.user.userName}'s post on Ourlime`}\n\n${postService.getPostUrl(post.id)}`}
      url={postService.getPostUrl(post.id)}
      onClose={() => setShareVisible(false)}
      onShared={() => void handleShared()}
    />
    </>
  );
}
