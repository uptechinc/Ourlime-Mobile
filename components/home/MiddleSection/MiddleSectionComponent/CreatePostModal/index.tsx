import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import type { UserProfile } from '@/lib/services/AuthService';
import {
  type PostLocation,
  type PostMediaDraft,
  type PostType,
  type PostVisibility,
} from '@/lib/services/PostService';
import { MAX_POST_MEDIA, PostMediaService, type PendingImageCrop, type PendingVideoTrim } from '@/lib/services/PostMediaService';
import UserAvatar from '@/components/ui/UserAvatar';
import LocationPickerModal from './LocationPickerModal';
import MediaCropModal from './MediaCropModal';
import VideoTrimModal from './VideoTrimModal';
import { RelationshipService, type RelationshipUser } from '@/lib/services/RelationshipService';
import { SearchService } from '@/lib/services/SearchService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CustomModal from '@/components/ui/CustomModal';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { postSubmissionService } from '@/lib/services/PostSubmissionService';
import VideoThumbnailPicker from '@/components/media/VideoThumbnailPicker';
import { diagnosticLogService } from '@/lib/services/DiagnosticLogService';

type DraftPollOption = { id: string; text: string };
type TextSelection = { start: number; end: number };
type PollDurationChoice = { label: string; hours: number | 'custom' };
type CustomPollUnit = 'seconds' | 'minutes' | 'hours' | 'days';
type ComposerFeedback = { title: string; message: string };
type CreatePostModalProps = {
  setTogglePostForm: Dispatch<SetStateAction<boolean>>;
  userProfile: UserProfile;
  communityId?: string;
  communityName?: string;
};

const mediaService = PostMediaService.getInstance();
const relationshipService = RelationshipService.getInstance();
const searchService = SearchService.getInstance();
const emojis = ['😀', '😂', '😍', '🥳', '😎', '🤔', '😢', '😡', '👍', '👏', '🙏', '❤️', '🔥', '🎉', '🇹🇹', '🌴', '⚽', '🎵', '🍋', '✨'];
const pollDurations: PollDurationChoice[] = [
  { label: '5m', hours: 5 / 60 },
  { label: '15m', hours: 15 / 60 },
  { label: '30m', hours: 0.5 },
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '2d', hours: 48 },
  { label: '3d', hours: 72 },
  { label: '1w', hours: 168 },
  { label: 'Custom', hours: 'custom' },
];

const normalizeHashtag = (value: string): string => value.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();

export default function CreatePostModal({ setTogglePostForm, userProfile, communityId, communityName }: CreatePostModalProps) {
  const { colors } = useAppTheme();
  const captionInputRef = useRef<TextInput>(null);
  const [postType, setPostType] = useState<PostType>('regular');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [caption, setCaption] = useState('');
  const [captionSelection, setCaptionSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [description] = useState('');
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [cropQueue, setCropQueue] = useState<PendingImageCrop[]>([]);
  const [trimQueue, setTrimQueue] = useState<PendingVideoTrim[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [location, setLocation] = useState<PostLocation>();
  const [composerFeedback, setComposerFeedback] = useState<ComposerFeedback | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pollDurationChoice, setPollDurationChoice] = useState<number | 'custom'>(24);
  const [customPollDuration, setCustomPollDuration] = useState('1');
  const [customPollUnit, setCustomPollUnit] = useState<CustomPollUnit>('hours');
  const [pollOptions, setPollOptions] = useState<DraftPollOption[]>([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [friends, setFriends] = useState<RelationshipUser[]>([]);

  const [searchedUsers, setSearchedUsers] = useState<RelationshipUser[]>([]);
  const SUGGESTED_HASHTAGS = ['Ourlime', 'Trinidad', 'Tobago', 'Caribbean', 'Lime', 'Events', 'Lifestyle', 'Trending', 'Music', 'Food'];

  useEffect(() => {
    void relationshipService.getFriends(userProfile.uid).then(setFriends).catch((error: unknown) => {
      console.warn('[CreatePostModal.friends]', error instanceof Error ? error.message : 'Could not load friends');
    });
  }, [userProfile.uid]);

  const [taggedMentions, setTaggedMentions] = useState<string[]>([]);
  const [mentionInput, setMentionInput] = useState('');

  const mentions = useMemo(
    () => Array.from(new Set([
      ...taggedMentions,
      ...(`${caption} ${description}`.match(/@[\w.-]+/g)?.map((m) => m.slice(1)) ?? [])
    ])),
    [caption, description, taggedMentions]
  );

  const activeMentionQuery = useMemo(() => {
    const cleanMentionInput = mentionInput.trim().replace(/^@/, '').toLowerCase();
    if (cleanMentionInput.length > 0) return cleanMentionInput;

    const beforeCaptionCursor = caption.slice(0, captionSelection.start);
    const captionMatch = beforeCaptionCursor.match(/(?:^|\s)@?([\w.-]{1,30})$/);
    if (captionMatch && beforeCaptionCursor.includes('@')) {
      return captionMatch[1].toLowerCase();
    }

    const descMatch = description.match(/(?:^|\s)@?([\w.-]{1,30})$/);
    if (descMatch && description.includes('@')) {
      return descMatch[1].toLowerCase();
    }

    return null;
  }, [caption, captionSelection.start, description, mentionInput]);

  // Query Firestore users collection dynamically when typing query
  useEffect(() => {
    if (!activeMentionQuery || activeMentionQuery.length < 1) {
      setSearchedUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const profiles = await searchService.searchUsers(activeMentionQuery, 10);
        const found: RelationshipUser[] = profiles.map((profile) => {
          return {
            id: profile.uid,
            userName: profile.userName || 'user',
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            profileImage: profile.profilePicture || undefined,
            isFollowing: false,
            friendshipStatus: 'none',
          };
        });

        const extraLocal = friends.filter((f) =>
          `${f.userName} ${f.firstName} ${f.lastName}`.toLowerCase().includes(activeMentionQuery)
        );

        const merged = [...found];
        for (const item of extraLocal) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        setSearchedUsers(merged.slice(0, 10));
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [activeMentionQuery, friends]);

  const mentionSuggestions = useMemo(() => activeMentionQuery === null ? [] : searchedUsers, [activeMentionQuery, searchedUsers]);

  const handleAddMentionTag = (usernameToAdd: string) => {
    const clean = usernameToAdd.trim().replace(/^@/, '').toLowerCase();
    if (clean && !taggedMentions.includes(clean)) {
      setTaggedMentions((prev) => [...prev, clean]);
    }
    setMentionInput('');
  };

  const handleInsertMention = (targetUser: RelationshipUser) => {
    handleAddMentionTag(targetUser.userName);
    const beforeCursor = caption.slice(0, captionSelection.start);
    const match = beforeCursor.match(/(?:^|\s)@?([\w.-]*)$/);
    if (match) {
      const matchText = match[0];
      const start = captionSelection.start - matchText.length;
      const prefix = matchText.startsWith(' ') ? ' ' : '';
      const inserted = `${prefix}@${targetUser.userName} `;
      const updated = `${caption.slice(0, start)}${inserted}${caption.slice(captionSelection.end)}`;
      const cursor = start + inserted.length;
      setCaption(updated);
      setCaptionSelection({ start: cursor, end: cursor });
    }
  };

  const [eventTitle, setEventTitle] = useState('');
  const [eventStartDate, setEventStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventStartTime, setEventStartTime] = useState('18:00');
  const [eventEndDate, setEventEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventEndTime, setEventEndTime] = useState('20:00');
  const [eventRecurrence, setEventRecurrence] = useState<'none' | 'weekly' | 'monthly' | 'yearly'>('none');

  const validPollOptions = pollOptions.filter((option) => option.text.trim());
  const hasNonMentionContent = caption.replace(/@[\w.-]+/g, '').trim().length > 0 || eventTitle.trim().length > 0;
  const isPostDisabled = isSubmitting || cropQueue.length > 0 || trimQueue.length > 0 || (postType === 'poll'
    ? validPollOptions.length < 2 || !hasNonMentionContent
    : postType === 'event'
    ? !eventTitle.trim() && !hasNonMentionContent
    : !hasNonMentionContent && media.length === 0);

  const handleClose = () => {
    if (!isSubmitting) setTogglePostForm(false);
  };

  const handlePickMedia = async () => {
    const maximum = postType === 'poll' ? 1 : MAX_POST_MEDIA;
    const availableSlots = maximum - media.length - cropQueue.length - trimQueue.length;
    if (availableSlots <= 0) {
      setComposerFeedback({ title: 'Media limit reached', message: postType === 'poll' ? 'A poll can contain one optional image.' : `A post can contain up to ${MAX_POST_MEDIA} photos or videos.` });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setComposerFeedback({ title: 'Permission needed', message: 'Allow photo access to attach images and videos.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: postType === 'poll' ? ['images'] : ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: availableSlots,
    });
    if (result.canceled) return;
    const validated = await mediaService.validateSelection(result.assets, media.length + cropQueue.length + trimQueue.length);
    if (validated.errors.length > 0) setComposerFeedback({ title: 'Some media could not be added', message: validated.errors.join('\n\n') });
    setMedia((current) => [...current, ...validated.videos].slice(0, maximum));
    setCropQueue((current) => [...current, ...validated.imagesToCrop].slice(0, maximum - media.length - validated.videos.length));
    setTrimQueue((current) => [...current, ...validated.videosToTrim].slice(0, maximum - media.length - validated.videos.length - validated.imagesToCrop.length));
  };

  const handleCroppedMedia = (item: PostMediaDraft) => {
    setMedia((current) => [...current, item].slice(0, MAX_POST_MEDIA));
    setCropQueue((current) => current.slice(1));
  };

  const handleTrimmedVideo = (item: PostMediaDraft) => {
    setMedia((current) => [...current, item].slice(0, MAX_POST_MEDIA));
    setTrimQueue((current) => current.slice(1));
  };

  const handleAddHashtag = () => {
    const tag = normalizeHashtag(hashtagInput);
    if (tag && !hashtags.includes(tag)) setHashtags((current) => [...current, tag].slice(0, 10));
    setHashtagInput('');
  };

  const handleInsertEmoji = (emoji: string) => {
    const start = Math.min(captionSelection.start, caption.length);
    const end = Math.min(captionSelection.end, caption.length);
    const updated = `${caption.slice(0, start)}${emoji}${caption.slice(end)}`;
    const cursor = start + emoji.length;
    setCaption(updated);
    setCaptionSelection({ start: cursor, end: cursor });
    requestAnimationFrame(() => captionInputRef.current?.focus());
  };



  const handleMoveMedia = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    setMedia((current) => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const swipeDismiss = useSwipeDismiss({ visible: true, onDismiss: handleClose, disabled: isSubmitting });

  const getPollDurationHours = (): number => {
    if (pollDurationChoice !== 'custom') return pollDurationChoice;
    const value = Math.max(1, Number(customPollDuration) || 1);
    return customPollUnit === 'seconds' ? value / 3600 : customPollUnit === 'minutes' ? value / 60 : customPollUnit === 'days' ? value * 24 : value;
  };

  const handleSubmit = () => {
    if (isPostDisabled) return;
    setIsSubmitting(true);
    try {
      postSubmissionService.start({
        event: postType === 'event' ? {
          title: eventTitle.trim() || caption.trim(),
          description: caption.trim() || description.trim(),
          summary: caption.trim(),
          startDate: eventStartDate,
          startTime: eventStartTime,
          endDate: eventEndDate,
          endTime: eventEndTime,
          location: location?.name || location?.address || 'Location TBD',
          recurrence: eventRecurrence,
          creatorId: userProfile.uid,
          userId: userProfile.uid,
          user: {
            id: userProfile.uid,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            userName: userProfile.userName,
            profileImage: userProfile.profilePicture ?? null,
          },
        } : undefined,
        post: {
        userId: userProfile.uid,
        user: {
          id: userProfile.uid,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          userName: userProfile.userName,
          profileImage: userProfile.profilePicture ?? undefined,
        },
        type: postType,
        caption: postType === 'event' && eventTitle.trim() ? `📅 Event: ${eventTitle.trim()}\n\n${caption.trim()}` : caption.trim(),
        description: description.trim(),
        visibility,
        hashtags,
        media,
        mentions,
        friendReferences: mentions.map((mention) => `@${mention}`),
        pollOptions: postType === 'poll' ? validPollOptions : undefined,
        pollDuration: postType === 'poll' ? getPollDurationHours() : undefined,
        location: postType === 'regular' || postType === 'event' ? location : undefined,
        communityId,
        communityName,
        },
      });
      setTogglePostForm(false);
    } catch (error: unknown) {
      diagnosticLogService.error('CreatePostModal', 'submit', error, { postType, mediaCount: media.length });
      setComposerFeedback({ title: 'Post not created', message: error instanceof Error ? error.message : 'Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <Animated.View style={[{ flex: 1 }, swipeDismiss.animatedStyle]}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'left', 'right']}>
        <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close post composer" />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting} style={{ padding: 8 }}><Icon name="x" size={24} color={colors.icon} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>{postType === 'poll' ? 'Create poll' : 'Create post'}</Text>
          <AnimatedActionButton feedback="post" accessibilityLabel="Publish post" onPress={() => void handleSubmit()} disabled={isPostDisabled} style={{ minWidth: 68, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: isPostDisabled ? colors.disabled : colors.accent }}>
            {isSubmitting ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: isPostDisabled ? colors.disabledText : colors.onAccent, fontWeight: '800' }}>Post</Text>}
          </AnimatedActionButton>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <UserAvatar profileImage={userProfile.profilePicture} firstName={userProfile.firstName || userProfile.email} size={52} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{userProfile.firstName} {userProfile.lastName}</Text>
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  {(['public', 'friends', 'private'] as const).map((option) => (
                    <TouchableOpacity key={option} onPress={() => setVisibility(option)} style={{ marginRight: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: visibility === option ? colors.selectedControl : colors.control }}>
                      <Text style={{ color: visibility === option ? colors.selectedText : colors.secondaryText, fontSize: 12, textTransform: 'capitalize' }}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: colors.control, borderRadius: 14, padding: 4, marginBottom: 16 }}>
              {(communityId ? (['regular'] as const) : (['regular', 'poll', 'event'] as const)).map((option) => (
                <TouchableOpacity key={option} onPress={() => setPostType(option)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11, backgroundColor: postType === option ? colors.surface : 'transparent' }}>
                  <Text style={{ color: postType === option ? colors.accentText : colors.secondaryText, fontWeight: '700', textTransform: 'capitalize' }}>
                    {option === 'regular' ? 'Post' : option === 'poll' ? 'Poll' : '📅 Event'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {postType === 'event' ? (
              <View style={{ marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: colors.successSurface, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.successText }}>Event Details</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Event Title (e.g. Lime Party @ Maracas)"
                  placeholderTextColor={colors.mutedText}
                  style={{ backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, fontWeight: '600' }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText, marginBottom: 4 }}>Start Date</Text>
                    <TextInput
                      value={eventStartDate}
                      onChangeText={setEventStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedText}
                      style={{ backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, fontSize: 13, color: colors.text }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText, marginBottom: 4 }}>Start Time</Text>
                    <TextInput
                      value={eventStartTime}
                      onChangeText={setEventStartTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.mutedText}
                      style={{ backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, fontSize: 13, color: colors.text }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText, marginBottom: 4 }}>End Date</Text>
                    <TextInput
                      value={eventEndDate}
                      onChangeText={setEventEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedText}
                      style={{ backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, fontSize: 13, color: colors.text }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.secondaryText, marginBottom: 4 }}>End Time</Text>
                    <TextInput
                      value={eventEndTime}
                      onChangeText={setEventEndTime}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.mutedText}
                      style={{ backgroundColor: colors.input, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, fontSize: 13, color: colors.text }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryText }}>Recurrence:</Text>
                  {(['none', 'weekly', 'monthly', 'yearly'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setEventRecurrence(r)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: eventRecurrence === r ? colors.selectedControl : colors.control }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: eventRecurrence === r ? colors.selectedText : colors.secondaryText, textTransform: 'capitalize' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <View>
              <TextInput ref={captionInputRef} value={caption} onChangeText={setCaption} selection={captionSelection} onSelectionChange={(event) => setCaptionSelection(event.nativeEvent.selection)} placeholder="Tell us what's on your mind (use @ to mention friends)" placeholderTextColor={colors.mutedText} multiline maxLength={2200} style={{ minHeight: 112, padding: 16, paddingRight: 48, borderRadius: 16, backgroundColor: colors.input, color: colors.text, fontSize: 17, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border }} />
              <TouchableOpacity onPress={() => setShowEmojiPicker((value) => !value)} style={{ position: 'absolute', right: 10, bottom: 28, padding: 8 }}><Icon name="smile" size={22} color={colors.accent} /></TouchableOpacity>
              <Text style={{ textAlign: 'right', fontSize: 11, color: caption.length > 2100 ? colors.destructive : colors.mutedText, marginTop: 4, marginRight: 6 }}>{caption.length}/2200</Text>
            </View>
            {mentionSuggestions.length > 0 ? (
              <View style={{ marginTop: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 13, overflow: 'hidden' }}>
                {mentionSuggestions.map((friend) => <TouchableOpacity key={friend.id} onPress={() => handleInsertMention(friend)} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><UserAvatar profileImage={friend.profileImage} firstName={friend.firstName || friend.userName} size={34} /><View style={{ marginLeft: 9 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{friend.firstName} {friend.lastName}</Text><Text style={{ color: colors.mutedText, fontSize: 12 }}>@{friend.userName}</Text></View></TouchableOpacity>)}
              </View>
            ) : null}
            {showEmojiPicker ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, padding: 10, borderRadius: 14, backgroundColor: colors.control }}>
                {emojis.map((emoji) => <TouchableOpacity key={emoji} onPress={() => handleInsertEmoji(emoji)} style={{ width: '20%', paddingVertical: 8, alignItems: 'center' }}><Text style={{ fontSize: 24 }}>{emoji}</Text></TouchableOpacity>)}
              </View>
            ) : null}


            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 13, backgroundColor: colors.input }}>
                <Icon name="at-sign" size={18} color={colors.accent} />
                <TextInput
                  value={mentionInput}
                  onChangeText={setMentionInput}
                  onSubmitEditing={() => handleAddMentionTag(mentionInput)}
                  returnKeyType="done"
                  placeholder="Mention friends (e.g. rishi or @rishi)"
                  placeholderTextColor={colors.mutedText}
                  style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, color: colors.text }}
                />
                <TouchableOpacity onPress={() => handleAddMentionTag(mentionInput)} disabled={!mentionInput.trim()}>
                  <Icon name="plus-circle" size={21} color={mentionInput.trim() ? colors.accent : colors.disabledText} />
                </TouchableOpacity>
              </View>

              {taggedMentions.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {taggedMentions.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setTaggedMentions((curr) => curr.filter((t) => t !== tag))}
                      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: colors.successSurface }}
                    >
                      <Text style={{ color: colors.successText, fontWeight: '700' }}>@{tag}</Text>
                      <Icon name="x" size={13} color={colors.successText} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {postType === 'poll' ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ marginBottom: 10, color: colors.text, fontWeight: '700' }}>Poll options</Text>
                {pollOptions.map((option, index) => (
                  <View key={option.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TextInput value={option.text} onChangeText={(text) => setPollOptions((current) => current.map((item) => item.id === option.id ? { ...item, text } : item))} maxLength={100} placeholder={`Option ${index + 1}`} placeholderTextColor={colors.mutedText} style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text }} />
                    {index > 1 ? <TouchableOpacity onPress={() => setPollOptions((current) => current.filter((item) => item.id !== option.id))} style={{ padding: 10 }}><Icon name="trash-2" size={19} color={colors.destructive} /></TouchableOpacity> : null}
                  </View>
                ))}
                {pollOptions.length < 4 ? <TouchableOpacity onPress={() => setPollOptions((current) => [...current, { id: `${Date.now()}`, text: '' }])} style={{ paddingVertical: 10 }}><Text style={{ color: colors.accentText, fontWeight: '700' }}>+ Add option</Text></TouchableOpacity> : null}
                <Text style={{ marginTop: 8, marginBottom: 8, color: colors.secondaryText }}>Poll duration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {pollDurations.map((choice) => <TouchableOpacity key={choice.label} onPress={() => setPollDurationChoice(choice.hours)} style={{ marginRight: 7, marginBottom: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, backgroundColor: pollDurationChoice === choice.hours ? colors.selectedControl : colors.control }}><Text style={{ color: pollDurationChoice === choice.hours ? colors.selectedText : colors.secondaryText }}>{choice.label}</Text></TouchableOpacity>)}
                </View>
                {pollDurationChoice === 'custom' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                    <TextInput value={customPollDuration} onChangeText={(value) => setCustomPollDuration(value.replace(/\D/g, ''))} keyboardType="number-pad" style={{ width: 78, padding: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text }} />
                    {(['seconds', 'minutes', 'hours', 'days'] as const).map((unit) => <TouchableOpacity key={unit} onPress={() => setCustomPollUnit(unit)} style={{ marginLeft: 5, paddingHorizontal: 7, paddingVertical: 10, borderRadius: 12, backgroundColor: customPollUnit === unit ? colors.selectedControl : colors.control }}><Text style={{ color: customPollUnit === unit ? colors.selectedText : colors.secondaryText, fontSize: 10 }}>{unit}</Text></TouchableOpacity>)}
                  </View>
                ) : null}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ marginBottom: 8, color: colors.secondaryText }}>Poll image (optional)</Text>
                  {media[0] ? <View style={{ alignSelf: 'flex-start' }}><Image source={{ uri: media[0].uri }} style={{ width: 130, height: 96, borderRadius: 12 }} /><TouchableOpacity onPress={() => setMedia([])} style={{ position: 'absolute', right: 4, top: 4, width: 25, height: 25, borderRadius: 13, backgroundColor: '#111827cc', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} color="#ffffff" /></TouchableOpacity></View> : <TouchableOpacity onPress={() => void handlePickMedia()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: 13, backgroundColor: colors.successSurface }}><Icon name="image" size={18} color={colors.accent} /><Text style={{ marginLeft: 8, color: colors.successText, fontWeight: '700' }}>Add poll image</Text></TouchableOpacity>}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 18 }}>
                <TouchableOpacity onPress={() => void handlePickMedia()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: 14, backgroundColor: colors.successSurface }}>
                  <Icon name="image" size={20} color={colors.accent} /><Text style={{ marginLeft: 8, color: colors.successText, fontWeight: '700' }}>Add photos or videos ({media.length}/{MAX_POST_MEDIA})</Text>
                </TouchableOpacity>
                {media.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                    {media.map((item, index) => (
                      <View key={`${item.uri}-${index}`} style={{ marginRight: 10 }}>
                        {item.type === 'image' ? <Image source={{ uri: item.uri }} style={{ width: 104, height: 104, borderRadius: 12 }} /> : <View style={{ width: 104, height: 104, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}><Icon name="video" size={28} color="#ffffff" /><Text style={{ marginTop: 5, color: '#ffffff', fontSize: 10 }}>{Math.round(item.durationSeconds ?? 0)}s</Text></View>}
                        <TouchableOpacity onPress={() => setMedia((current) => current.filter((_, mediaIndex) => mediaIndex !== index))} style={{ position: 'absolute', top: 4, right: 4, width: 25, height: 25, borderRadius: 13, backgroundColor: '#111827cc', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} color="#ffffff" /></TouchableOpacity>
                        <View style={{ position: 'absolute', bottom: 4, left: 4, flexDirection: 'row' }}>
                          <TouchableOpacity onPress={() => handleMoveMedia(index, -1)} disabled={index === 0} style={{ padding: 5, borderRadius: 10, backgroundColor: '#111827bb', opacity: index === 0 ? 0.35 : 1 }}><Icon name="chevron-left" size={15} color="#ffffff" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => handleMoveMedia(index, 1)} disabled={index === media.length - 1} style={{ marginLeft: 4, padding: 5, borderRadius: 10, backgroundColor: '#111827bb', opacity: index === media.length - 1 ? 0.35 : 1 }}><Icon name="chevron-right" size={15} color="#ffffff" /></TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                {/* Video Cover / Thumbnail Selector for Feed Video Posts */}
                {(() => {
                  const firstVideo = media.find((item) => item.type === 'video');
                  if (!firstVideo) return null;
                  return (
                    <VideoThumbnailPicker
                      videoUri={firstVideo.uri}
                      durationSeconds={firstVideo.durationSeconds ?? 10}
                      selectedThumbnailUri={firstVideo.thumbnailUri}
                      onThumbnailChange={(thumbUri) => {
                        setMedia((current) =>
                          current.map((m) =>
                            m.uri === firstVideo.uri ? { ...m, thumbnailUri: thumbUri } : m
                          )
                        );
                      }}
                      aspectRatio="16:9"
                    />
                  );
                })()}
              </View>
            )}

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryText, marginBottom: 6 }}>Suggested Hashtags</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {SUGGESTED_HASHTAGS.map((tag) => {
                  const tagLower = tag.toLowerCase();
                  const isSelected = hashtags.includes(tagLower);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => {
                        if (isSelected) {
                          setHashtags((curr) => curr.filter((t) => t !== tagLower));
                        } else {
                          setHashtags((curr) => [...curr, tagLower]);
                        }
                      }}
                      style={{
                        marginRight: 6,
                        paddingHorizontal: 11,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: isSelected ? colors.selectedControl : colors.control,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.selectedControl : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? colors.selectedText : colors.secondaryText }}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 13, backgroundColor: colors.input }}>
                <Icon name="hash" size={19} color={colors.accent} />
                <TextInput value={hashtagInput} onChangeText={setHashtagInput} onSubmitEditing={handleAddHashtag} returnKeyType="done" placeholder="Add a hashtag" placeholderTextColor={colors.mutedText} style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 13, color: colors.text }} />
                <TouchableOpacity onPress={handleAddHashtag} disabled={!normalizeHashtag(hashtagInput)}><Icon name="plus-circle" size={21} color={normalizeHashtag(hashtagInput) ? colors.accent : colors.disabledText} /></TouchableOpacity>
              </View>
              {hashtags.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{hashtags.map((tag) => <TouchableOpacity key={tag} onPress={() => setHashtags((current) => current.filter((item) => item !== tag))} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: colors.successSurface }}><Text style={{ color: colors.successText, fontWeight: '700' }}>#{tag}</Text><Icon name="x" size={13} color={colors.successText} style={{ marginLeft: 4 }} /></TouchableOpacity>)}</View> : null}
            </View>

            {postType === 'regular' ? (
              location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: colors.successSurface }}>
                  <Icon name="map-pin" size={19} color={colors.accent} /><View style={{ flex: 1, marginLeft: 9 }}><Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.successText, fontWeight: '700' }}>{linkPresentationService.compactUrlsInText(location.name)}</Text><Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.mutedText, fontSize: 12 }}>{linkPresentationService.compactUrlsInText(location.address ?? '')}</Text></View>
                  <TouchableOpacity onPress={() => setLocation(undefined)} style={{ padding: 6 }}><Icon name="x" size={18} color={colors.icon} /></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowLocationPicker(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, backgroundColor: colors.input }}><Icon name="map-pin" size={19} color={colors.accent} /><Text style={{ marginLeft: 10, color: colors.secondaryText }}>Tag a location</Text></TouchableOpacity>
              )
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {cropQueue[0] ? <MediaCropModal pending={cropQueue[0]} queueLength={cropQueue.length} onCancel={() => setCropQueue((current) => current.slice(1))} onComplete={handleCroppedMedia} /> : null}
      {trimQueue[0] ? <VideoTrimModal pending={trimQueue[0]} queueLength={trimQueue.length} onCancel={() => setTrimQueue((current) => current.slice(1))} onComplete={handleTrimmedVideo} /> : null}
      {showLocationPicker ? <LocationPickerModal initialLocation={location} onClose={() => setShowLocationPicker(false)} onSelect={(selectedLocation) => { setLocation(selectedLocation); setShowLocationPicker(false); }} /> : null}
      <CustomModal visible={Boolean(composerFeedback)} title={composerFeedback?.title ?? 'Create post'} message={composerFeedback?.message ?? ''} type="error" onClose={() => setComposerFeedback(null)} />
      </Animated.View>
    </Modal>
  );
}
