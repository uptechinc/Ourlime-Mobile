import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { collection, query, where, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type { UserProfile } from '@/lib/services/AuthService';
import {
  PostService,
  type PostItem,
  type PostLocation,
  type PostMediaDraft,
  type PostType,
  type PostVisibility,
} from '@/lib/services/PostService';
import { MAX_POST_MEDIA, PostMediaService, type PendingImageCrop } from '@/lib/services/PostMediaService';
import UserAvatar from '@/components/ui/UserAvatar';
import LocationPickerModal from './LocationPickerModal';
import MediaCropModal from './MediaCropModal';
import { RelationshipService, type RelationshipUser } from '@/lib/services/RelationshipService';
import { dispatchMentionNotifications } from '@/lib/services/dispatchMentionNotifications';

type DraftPollOption = { id: string; text: string };
type TextSelection = { start: number; end: number };
type PollDurationChoice = { label: string; hours: number | 'custom' };
type CustomPollUnit = 'seconds' | 'minutes' | 'hours' | 'days';
type CreatePostModalProps = {
  setTogglePostForm: Dispatch<SetStateAction<boolean>>;
  userProfile: UserProfile;
  onCreatePost: (post: PostItem) => void;
};

const postService = PostService.getInstance();
const mediaService = PostMediaService.getInstance();
const relationshipService = RelationshipService.getInstance();
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

export default function CreatePostModal({ setTogglePostForm, userProfile, onCreatePost }: CreatePostModalProps) {
  const captionInputRef = useRef<TextInput>(null);
  const uploadControllerRef = useRef<AbortController | undefined>(undefined);
  const [postType, setPostType] = useState<PostType>('regular');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [caption, setCaption] = useState('');
  const [captionSelection, setCaptionSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [cropQueue, setCropQueue] = useState<PendingImageCrop[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [location, setLocation] = useState<PostLocation>();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pollDurationChoice, setPollDurationChoice] = useState<number | 'custom'>(24);
  const [customPollDuration, setCustomPollDuration] = useState('1');
  const [customPollUnit, setCustomPollUnit] = useState<CustomPollUnit>('hours');
  const [pollOptions, setPollOptions] = useState<DraftPollOption[]>([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('userName', '>=', activeMentionQuery),
          where('userName', '<=', activeMentionQuery + '\uf8ff'),
          limit(10)
        );
        const snap = await getDocs(q);
        const found: RelationshipUser[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            userName: d.userName || 'user',
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            profileImage: d.profileImage || undefined,
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
      } catch (_) {}
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
  const isPostDisabled = isSubmitting || cropQueue.length > 0 || (postType === 'poll'
    ? validPollOptions.length < 2 || !hasNonMentionContent
    : postType === 'event'
    ? !eventTitle.trim() && !hasNonMentionContent
    : !hasNonMentionContent && media.length === 0);

  const handleClose = () => {
    if (!isSubmitting) setTogglePostForm(false);
  };

  const handlePickMedia = async () => {
    const maximum = postType === 'poll' ? 1 : MAX_POST_MEDIA;
    const availableSlots = maximum - media.length - cropQueue.length;
    if (availableSlots <= 0) {
      Alert.alert('Media limit reached', postType === 'poll' ? 'A poll can contain one optional image.' : `A post can contain up to ${MAX_POST_MEDIA} photos or videos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach images and videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: postType === 'poll' ? ['images'] : ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: availableSlots,
    });
    if (result.canceled) return;
    const validated = await mediaService.validateSelection(result.assets, media.length + cropQueue.length);
    if (validated.errors.length > 0) Alert.alert('Some media could not be added', validated.errors.join('\n\n'));
    setMedia((current) => [...current, ...validated.videos].slice(0, maximum));
    setCropQueue((current) => [...current, ...validated.imagesToCrop].slice(0, maximum - media.length - validated.videos.length));
  };

  const handleCroppedMedia = (item: PostMediaDraft) => {
    setMedia((current) => [...current, item].slice(0, MAX_POST_MEDIA));
    setCropQueue((current) => current.slice(1));
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

  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            handleClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const getPollDurationHours = (): number => {
    if (pollDurationChoice !== 'custom') return pollDurationChoice;
    const value = Math.max(1, Number(customPollDuration) || 1);
    return customPollUnit === 'seconds' ? value / 3600 : customPollUnit === 'minutes' ? value / 60 : customPollUnit === 'days' ? value * 24 : value;
  };

  const handleSubmit = async () => {
    if (isPostDisabled) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    try {
      let createdEventId: string | undefined;
      if (postType === 'event') {
        const eventDoc = await addDoc(collection(db, 'events'), {
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
          createdAt: serverTimestamp(),
          user: {
            id: userProfile.uid,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            userName: userProfile.userName,
            profileImage: userProfile.profilePicture ?? null,
          },
        });
        createdEventId = eventDoc.id;
      }

      const createdPost = await postService.createPost({
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
        signal: controller.signal,
        onUploadProgress: (progress) => setUploadProgress(progress.percentage),
      });
      onCreatePost(createdPost);
      dispatchMentionNotifications({
        actorUserId: userProfile.uid,
        actorName: userProfile.userName || userProfile.firstName,
        actorProfileImage: userProfile.profilePicture ?? undefined,
        content: caption.trim(),
        contentType: 'post',
        postId: createdPost.id,
      });
      setTogglePostForm(false);
    } catch (error: unknown) {
      console.error('[CreatePostModal.handleSubmit]', error);
      Alert.alert('Post not created', error instanceof Error ? error.message : 'Please check your connection and try again.');
    } finally {
      uploadControllerRef.current = undefined;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 8 }} {...panResponder.panHandlers}>
          <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: '#d1d5db' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }} {...panResponder.panHandlers}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting} style={{ padding: 8 }}><Icon name="x" size={24} color="#374151" /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#111827' }}>{postType === 'poll' ? 'Create poll' : 'Create post'}</Text>
          <TouchableOpacity onPress={() => void handleSubmit()} disabled={isPostDisabled} style={{ minWidth: 68, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: isPostDisabled ? '#d1d5db' : '#10b981' }}>
            {isSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '700' }}>Post</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            {isSubmitting && media.length > 0 ? (
              <View style={{ marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: '#ecfdf5' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={{ flex: 1, marginLeft: 9, color: '#047857', fontWeight: '700' }}>Uploading media… {uploadProgress}%</Text>
                  <TouchableOpacity onPress={() => uploadControllerRef.current?.abort()}><Text style={{ color: '#c64d53', fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                </View>
                <View style={{ height: 5, marginTop: 9, borderRadius: 3, backgroundColor: '#d1fae5', overflow: 'hidden' }}><View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: '#10b981' }} /></View>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <UserAvatar profileImage={userProfile.profilePicture} firstName={userProfile.firstName || userProfile.email} size={52} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{userProfile.firstName} {userProfile.lastName}</Text>
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  {(['public', 'friends', 'private'] as const).map((option) => (
                    <TouchableOpacity key={option} onPress={() => setVisibility(option)} style={{ marginRight: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: visibility === option ? '#d1fae5' : '#f3f4f6' }}>
                      <Text style={{ color: visibility === option ? '#047857' : '#6b7280', fontSize: 12, textTransform: 'capitalize' }}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 14, padding: 4, marginBottom: 16 }}>
              {(['regular', 'poll', 'event'] as const).map((option) => (
                <TouchableOpacity key={option} onPress={() => setPostType(option)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11, backgroundColor: postType === option ? '#ffffff' : 'transparent' }}>
                  <Text style={{ color: postType === option ? '#10b981' : '#6b7280', fontWeight: '700', textTransform: 'capitalize' }}>
                    {option === 'regular' ? 'Post' : option === 'poll' ? 'Poll' : '📅 Event'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {postType === 'event' ? (
              <View style={{ marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', gap: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>Event Details</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Event Title (e.g. Lime Party @ Maracas)"
                  placeholderTextColor="#9ca3af"
                  style={{ backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a', fontWeight: '600' }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Start Date</Text>
                    <TextInput
                      value={eventStartDate}
                      onChangeText={setEventStartDate}
                      placeholder="YYYY-MM-DD"
                      style={{ backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13, color: '#0f172a' }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Start Time</Text>
                    <TextInput
                      value={eventStartTime}
                      onChangeText={setEventStartTime}
                      placeholder="HH:MM"
                      style={{ backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13, color: '#0f172a' }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>End Date</Text>
                    <TextInput
                      value={eventEndDate}
                      onChangeText={setEventEndDate}
                      placeholder="YYYY-MM-DD"
                      style={{ backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13, color: '#0f172a' }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>End Time</Text>
                    <TextInput
                      value={eventEndTime}
                      onChangeText={setEventEndTime}
                      placeholder="HH:MM"
                      style={{ backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 13, color: '#0f172a' }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Recurrence:</Text>
                  {(['none', 'weekly', 'monthly', 'yearly'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setEventRecurrence(r)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: eventRecurrence === r ? '#065f46' : '#e2e8f0' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: eventRecurrence === r ? '#ffffff' : '#334155', textTransform: 'capitalize' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <View>
              <TextInput ref={captionInputRef} value={caption} onChangeText={setCaption} selection={captionSelection} onSelectionChange={(event) => setCaptionSelection(event.nativeEvent.selection)} placeholder="Tell us what's on your mind (use @ to mention friends)" placeholderTextColor="#9ca3af" multiline maxLength={2200} style={{ minHeight: 112, padding: 16, paddingRight: 48, borderRadius: 16, backgroundColor: '#f9fafb', color: '#111827', fontSize: 17, textAlignVertical: 'top' }} />
              <TouchableOpacity onPress={() => setShowEmojiPicker((value) => !value)} style={{ position: 'absolute', right: 10, bottom: 28, padding: 8 }}><Icon name="smile" size={22} color="#10b981" /></TouchableOpacity>
              <Text style={{ textAlign: 'right', fontSize: 11, color: caption.length > 2100 ? '#ef4444' : '#9ca3af', marginTop: 4, marginRight: 6 }}>{caption.length}/2200</Text>
            </View>
            {mentionSuggestions.length > 0 ? (
              <View style={{ marginTop: 7, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 13, overflow: 'hidden' }}>
                {mentionSuggestions.map((friend) => <TouchableOpacity key={friend.id} onPress={() => handleInsertMention(friend)} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}><UserAvatar profileImage={friend.profileImage} firstName={friend.firstName || friend.userName} size={34} /><View style={{ marginLeft: 9 }}><Text style={{ color: '#111827', fontWeight: '700' }}>{friend.firstName} {friend.lastName}</Text><Text style={{ color: '#6b7280', fontSize: 12 }}>@{friend.userName}</Text></View></TouchableOpacity>)}
              </View>
            ) : null}
            {showEmojiPicker ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, padding: 10, borderRadius: 14, backgroundColor: '#f3f4f6' }}>
                {emojis.map((emoji) => <TouchableOpacity key={emoji} onPress={() => handleInsertEmoji(emoji)} style={{ width: '20%', paddingVertical: 8, alignItems: 'center' }}><Text style={{ fontSize: 24 }}>{emoji}</Text></TouchableOpacity>)}
              </View>
            ) : null}


            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 13, backgroundColor: '#ffffff' }}>
                <Icon name="at-sign" size={18} color="#10b981" />
                <TextInput
                  value={mentionInput}
                  onChangeText={setMentionInput}
                  onSubmitEditing={() => handleAddMentionTag(mentionInput)}
                  returnKeyType="done"
                  placeholder="Mention friends (e.g. rishi or @rishi)"
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, color: '#111827' }}
                />
                <TouchableOpacity onPress={() => handleAddMentionTag(mentionInput)} disabled={!mentionInput.trim()}>
                  <Icon name="plus-circle" size={21} color={mentionInput.trim() ? '#10b981' : '#9ca3af'} />
                </TouchableOpacity>
              </View>

              {taggedMentions.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {taggedMentions.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setTaggedMentions((curr) => curr.filter((t) => t !== tag))}
                      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: '#d1fae5' }}
                    >
                      <Text style={{ color: '#047857', fontWeight: '700' }}>@{tag}</Text>
                      <Icon name="x" size={13} color="#047857" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {postType === 'poll' ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ marginBottom: 10, color: '#111827', fontWeight: '700' }}>Poll options</Text>
                {pollOptions.map((option, index) => (
                  <View key={option.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TextInput value={option.text} onChangeText={(text) => setPollOptions((current) => current.map((item) => item.id === option.id ? { ...item, text } : item))} maxLength={100} placeholder={`Option ${index + 1}`} style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12 }} />
                    {index > 1 ? <TouchableOpacity onPress={() => setPollOptions((current) => current.filter((item) => item.id !== option.id))} style={{ padding: 10 }}><Icon name="trash-2" size={19} color="#c64d53" /></TouchableOpacity> : null}
                  </View>
                ))}
                {pollOptions.length < 4 ? <TouchableOpacity onPress={() => setPollOptions((current) => [...current, { id: `${Date.now()}`, text: '' }])} style={{ paddingVertical: 10 }}><Text style={{ color: '#10b981', fontWeight: '700' }}>+ Add option</Text></TouchableOpacity> : null}
                <Text style={{ marginTop: 8, marginBottom: 8, color: '#6b7280' }}>Poll duration</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {pollDurations.map((choice) => <TouchableOpacity key={choice.label} onPress={() => setPollDurationChoice(choice.hours)} style={{ marginRight: 7, marginBottom: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, backgroundColor: pollDurationChoice === choice.hours ? '#d1fae5' : '#f3f4f6' }}><Text style={{ color: pollDurationChoice === choice.hours ? '#047857' : '#6b7280' }}>{choice.label}</Text></TouchableOpacity>)}
                </View>
                {pollDurationChoice === 'custom' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                    <TextInput value={customPollDuration} onChangeText={(value) => setCustomPollDuration(value.replace(/\D/g, ''))} keyboardType="number-pad" style={{ width: 78, padding: 11, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12 }} />
                    {(['seconds', 'minutes', 'hours', 'days'] as const).map((unit) => <TouchableOpacity key={unit} onPress={() => setCustomPollUnit(unit)} style={{ marginLeft: 5, paddingHorizontal: 7, paddingVertical: 10, borderRadius: 12, backgroundColor: customPollUnit === unit ? '#d1fae5' : '#f3f4f6' }}><Text style={{ color: customPollUnit === unit ? '#047857' : '#6b7280', fontSize: 10 }}>{unit}</Text></TouchableOpacity>)}
                  </View>
                ) : null}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ marginBottom: 8, color: '#6b7280' }}>Poll image (optional)</Text>
                  {media[0] ? <View style={{ alignSelf: 'flex-start' }}><Image source={{ uri: media[0].uri }} style={{ width: 130, height: 96, borderRadius: 12 }} /><TouchableOpacity onPress={() => setMedia([])} style={{ position: 'absolute', right: 4, top: 4, width: 25, height: 25, borderRadius: 13, backgroundColor: '#111827cc', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} color="#ffffff" /></TouchableOpacity></View> : <TouchableOpacity onPress={() => void handlePickMedia()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#10b981', borderRadius: 13 }}><Icon name="image" size={18} color="#10b981" /><Text style={{ marginLeft: 8, color: '#047857', fontWeight: '700' }}>Add poll image</Text></TouchableOpacity>}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 18 }}>
                <TouchableOpacity onPress={() => void handlePickMedia()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#10b981', borderRadius: 14, backgroundColor: '#ecfdf5' }}>
                  <Icon name="image" size={20} color="#10b981" /><Text style={{ marginLeft: 8, color: '#047857', fontWeight: '700' }}>Add photos or videos ({media.length}/{MAX_POST_MEDIA})</Text>
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
              </View>
            )}

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6 }}>Suggested Hashtags</Text>
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
                        backgroundColor: isSelected ? '#10b981' : '#f1f5f9',
                        borderWidth: 1,
                        borderColor: isSelected ? '#10b981' : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#ffffff' : '#334155' }}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 13 }}>
                <Icon name="hash" size={19} color="#10b981" />
                <TextInput value={hashtagInput} onChangeText={setHashtagInput} onSubmitEditing={handleAddHashtag} returnKeyType="done" placeholder="Add a hashtag" style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 13 }} />
                <TouchableOpacity onPress={handleAddHashtag} disabled={!normalizeHashtag(hashtagInput)}><Icon name="plus-circle" size={21} color={normalizeHashtag(hashtagInput) ? '#10b981' : '#9ca3af'} /></TouchableOpacity>
              </View>
              {hashtags.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{hashtags.map((tag) => <TouchableOpacity key={tag} onPress={() => setHashtags((current) => current.filter((item) => item !== tag))} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: '#d1fae5' }}><Text style={{ color: '#047857', fontWeight: '700' }}>#{tag}</Text><Icon name="x" size={13} color="#047857" style={{ marginLeft: 4 }} /></TouchableOpacity>)}</View> : null}
            </View>

            {postType === 'regular' ? (
              location ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#ecfdf5' }}>
                  <Icon name="map-pin" size={19} color="#10b981" /><View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: '#047857', fontWeight: '700' }}>{location.name}</Text><Text numberOfLines={1} style={{ color: '#6b7280', fontSize: 12 }}>{location.address}</Text></View>
                  <TouchableOpacity onPress={() => setLocation(undefined)} style={{ padding: 6 }}><Icon name="x" size={18} color="#6b7280" /></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowLocationPicker(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 13 }}><Icon name="map-pin" size={19} color="#10b981" /><Text style={{ marginLeft: 10, color: '#6b7280' }}>Tag a location</Text></TouchableOpacity>
              )
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {cropQueue[0] ? <MediaCropModal pending={cropQueue[0]} queueLength={cropQueue.length} onCancel={() => setCropQueue((current) => current.slice(1))} onComplete={handleCroppedMedia} /> : null}
      {showLocationPicker ? <LocationPickerModal initialLocation={location} onClose={() => setShowLocationPicker(false)} onSelect={(selectedLocation) => { setLocation(selectedLocation); setShowLocationPicker(false); }} /> : null}
    </Modal>
  );
}
