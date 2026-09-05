import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { PostService, type PostEditPayload, type PostItem, type PostLocation, type PostVisibility } from '@/lib/services/PostService';
import { SearchService } from '@/lib/services/SearchService';
import { RelationshipService, type RelationshipUser } from '@/lib/services/RelationshipService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import LocationPickerModal from '../CreatePostModal/LocationPickerModal';
import UserAvatar from '@/components/ui/UserAvatar';

type EditPostModalProps = {
	visible: boolean;
	post: PostItem;
	currentUserId: string;
	onClose: () => void;
	onSaved: (updatedPost: PostItem) => void;
};

const postService = PostService.getInstance();
const searchService = SearchService.getInstance();
const relationshipService = RelationshipService.getInstance();

const normalizeHashtag = (value: string): string =>
	value.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();

const SUGGESTED_HASHTAGS = ['Ourlime', 'Trinidad', 'Tobago', 'Caribbean', 'Lime', 'Events', 'Lifestyle', 'Trending', 'Music', 'Food'];

const VISIBILITY_OPTIONS: { key: PostVisibility; label: string; icon: string }[] = [
	{ key: 'public', label: 'Public', icon: 'globe' },
	{ key: 'friends', label: 'Friends', icon: 'users' },
	{ key: 'private', label: 'Private', icon: 'lock' },
];

export default function EditPostModal({ visible, post, currentUserId, onClose, onSaved }: EditPostModalProps) {
	const { colors } = useAppTheme();
	const captionInputRef = useRef<TextInput>(null);

	const [caption, setCaption] = useState(post.caption);
	const [description, setDescription] = useState(post.description);
	const [visibility, setVisibility] = useState<PostVisibility>(post.visibility);
	const [hashtags, setHashtags] = useState<string[]>([...post.hashtags]);
	const [hashtagInput, setHashtagInput] = useState('');
	const [location, setLocation] = useState<PostLocation | null>(post.location ?? null);
	const [showLocationPicker, setShowLocationPicker] = useState(false);

	const [taggedMentions, setTaggedMentions] = useState<string[]>([...post.mentions]);
	const [mentionInput, setMentionInput] = useState('');
	const [searchedUsers, setSearchedUsers] = useState<RelationshipUser[]>([]);
	const [friends, setFriends] = useState<RelationshipUser[]>([]);

	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Reset state when modal opens with a new post
	useEffect(() => {
		if (visible) {
			setCaption(post.caption);
			setDescription(post.description);
			setVisibility(post.visibility);
			setHashtags([...post.hashtags]);
			setHashtagInput('');
			setLocation(post.location ?? null);
			setTaggedMentions([...post.mentions]);
			setMentionInput('');
			setIsSaving(false);
			setErrorMessage(null);
		}
	}, [visible, post]);

	// Load friends for mention suggestions
	useEffect(() => {
		if (!visible) return;
		void relationshipService.getFriends(currentUserId).then(setFriends).catch(() => undefined);
	}, [visible, currentUserId]);

	// Mention search with debounce
	const activeMentionQuery = useMemo(() => {
		const clean = mentionInput.trim().replace(/^@/, '').toLowerCase();
		return clean.length > 0 ? clean : null;
	}, [mentionInput]);

	useEffect(() => {
		if (!activeMentionQuery || activeMentionQuery.length < 1) {
			setSearchedUsers([]);
			return;
		}
		const timer = setTimeout(async () => {
			try {
				const profiles = await searchService.searchUsers(activeMentionQuery, 10);
				const found: RelationshipUser[] = profiles.map((profile) => ({
					id: profile.uid,
					userName: profile.userName || 'user',
					firstName: profile.firstName || '',
					lastName: profile.lastName || '',
					profileImage: profile.profilePicture || undefined,
					isFollowing: false,
					friendshipStatus: 'none',
				}));
				const extraLocal = friends.filter((friend) =>
					`${friend.userName} ${friend.firstName} ${friend.lastName}`.toLowerCase().includes(activeMentionQuery)
				);
				const merged = [...found];
				for (const local of extraLocal) {
					if (!merged.some((existing) => existing.id === local.id)) merged.push(local);
				}
				setSearchedUsers(merged.filter((user) => !taggedMentions.includes(user.userName)));
			} catch {
				setSearchedUsers([]);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [activeMentionQuery, friends, taggedMentions]);

	const mentions = useMemo(
		() =>
			Array.from(
				new Set([
					...taggedMentions,
					...(`${caption} ${description}`.match(/@[\w.-]+/g)?.map((match) => match.slice(1)) ?? []),
				])
			),
		[caption, description, taggedMentions]
	);

	const handleAddHashtag = useCallback(
		(raw: string) => {
			const normalized = normalizeHashtag(raw);
			if (!normalized || hashtags.includes(normalized) || hashtags.length >= 10) return;
			setHashtags((prev) => [...prev, normalized]);
			setHashtagInput('');
		},
		[hashtags]
	);

	const handleRemoveHashtag = useCallback((tag: string) => {
		setHashtags((prev) => prev.filter((existing) => existing !== tag));
	}, []);

	const handleSelectMention = useCallback(
		(user: RelationshipUser) => {
			if (!taggedMentions.includes(user.userName)) {
				setTaggedMentions((prev) => [...prev, user.userName]);
			}
			setMentionInput('');
			setSearchedUsers([]);
		},
		[taggedMentions]
	);

	const handleRemoveMention = useCallback((username: string) => {
		setTaggedMentions((prev) => prev.filter((existing) => existing !== username));
	}, []);

	const handleSave = useCallback(async () => {
		if (isSaving) return;
		setIsSaving(true);
		setErrorMessage(null);

		try {
			const updates: PostEditPayload = {};
			if (caption.trim() !== post.caption) updates.caption = caption.trim();
			if (description.trim() !== post.description) updates.description = description.trim();
			if (visibility !== post.visibility) updates.visibility = visibility;

			const sortedNewHashtags = [...hashtags].sort();
			const sortedOldHashtags = [...post.hashtags].sort();
			if (JSON.stringify(sortedNewHashtags) !== JSON.stringify(sortedOldHashtags)) {
				updates.hashtags = hashtags;
			}

			if (JSON.stringify(mentions.sort()) !== JSON.stringify([...post.mentions].sort())) {
				updates.mentions = mentions;
				updates.friendReferences = mentions.map((mention) => `@${mention}`);
			}

			const locationChanged =
				JSON.stringify(location) !== JSON.stringify(post.location ?? null);
			if (locationChanged) {
				updates.location = location;
			}

			if (Object.keys(updates).length === 0) {
				onClose();
				return;
			}

			await postService.updatePost(post.id, post.origin, updates);

			const updatedPost: PostItem = {
				...post,
				caption: updates.caption !== undefined ? updates.caption : post.caption,
				description: updates.description !== undefined ? updates.description : post.description,
				visibility: updates.visibility !== undefined ? updates.visibility : post.visibility,
				hashtags: updates.hashtags !== undefined ? updates.hashtags : post.hashtags,
				mentions: updates.mentions !== undefined ? updates.mentions : post.mentions,
				friendReferences: updates.friendReferences !== undefined ? updates.friendReferences : post.friendReferences,
				location: locationChanged ? (location ?? undefined) : post.location,
			};

			onSaved(updatedPost);
			onClose();
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : 'Failed to save changes. Please try again.');
		} finally {
			setIsSaving(false);
		}
	}, [isSaving, caption, description, visibility, hashtags, mentions, location, post, onSaved, onClose]);

	const isPoll = post.type === 'poll';

	if (!visible) return null;

	return (
		<>
			<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent onRequestClose={onClose}>
				<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
					<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
						{/* Header */}
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								paddingHorizontal: 16,
								paddingVertical: 14,
								borderBottomWidth: 1,
								borderBottomColor: colors.border,
							}}
						>
							<TouchableOpacity onPress={onClose} disabled={isSaving}>
								<Icon name="x" size={24} color={colors.icon} />
							</TouchableOpacity>
							<Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
								Edit {isPoll ? 'Poll' : 'Post'}
							</Text>
							<TouchableOpacity
								onPress={() => void handleSave()}
								disabled={isSaving}
								style={{
									paddingHorizontal: 16,
									paddingVertical: 8,
									borderRadius: 20,
									backgroundColor: '#10b981',
									opacity: isSaving ? 0.6 : 1,
								}}
							>
								{isSaving ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>Save</Text>
								)}
							</TouchableOpacity>
						</View>

						{/* Error Banner */}
						{errorMessage ? (
							<View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, paddingVertical: 10 }}>
								<Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>{errorMessage}</Text>
							</View>
						) : null}

						<ScrollView
							contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
						>
							{/* Caption */}
							<View style={{ marginBottom: 20 }}>
								<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
									{isPoll ? 'Poll Question' : 'Caption'}
								</Text>
								<TextInput
									ref={captionInputRef}
									value={caption}
									onChangeText={setCaption}
									maxLength={2200}
									multiline
									placeholder={isPoll ? 'Ask your question...' : 'Write something...'}
									placeholderTextColor={colors.mutedText}
									style={{
										minHeight: 80,
										fontSize: 15,
										color: colors.text,
										backgroundColor: colors.control,
										borderRadius: 14,
										padding: 14,
										borderWidth: 1,
										borderColor: colors.border,
										textAlignVertical: 'top',
									}}
								/>
								<Text style={{ alignSelf: 'flex-end', marginTop: 4, fontSize: 11, color: colors.mutedText }}>
									{caption.length}/2200
								</Text>
							</View>

							{/* Description (non-poll only) */}
							{!isPoll ? (
								<View style={{ marginBottom: 20 }}>
									<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
										Description
									</Text>
									<TextInput
										value={description}
										onChangeText={setDescription}
										multiline
										placeholder="Add a description..."
										placeholderTextColor={colors.mutedText}
										style={{
											minHeight: 60,
											fontSize: 14,
											color: colors.text,
											backgroundColor: colors.control,
											borderRadius: 14,
											padding: 14,
											borderWidth: 1,
											borderColor: colors.border,
											textAlignVertical: 'top',
										}}
									/>
								</View>
							) : null}

							{/* Poll Options (read-only for polls) */}
							{isPoll && post.pollOptions ? (
								<View style={{ marginBottom: 20 }}>
									<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
										Poll Options (locked)
									</Text>
									{post.pollOptions.map((option, index) => (
										<View
											key={option.id}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingVertical: 10,
												paddingHorizontal: 14,
												borderRadius: 12,
												backgroundColor: colors.control,
												borderWidth: 1,
												borderColor: colors.border,
												marginBottom: 6,
												opacity: 0.6,
											}}
										>
											<Icon name="check-circle" size={16} color={colors.mutedText} />
											<Text style={{ marginLeft: 10, fontSize: 14, color: colors.secondaryText, flex: 1 }}>
												{option.text}
											</Text>
											<Text style={{ fontSize: 11, color: colors.mutedText }}>
												{option.votes} vote{option.votes !== 1 ? 's' : ''}
											</Text>
										</View>
									))}
									<Text style={{ fontSize: 11, color: colors.mutedText, fontStyle: 'italic', marginTop: 2 }}>
										Poll options cannot be changed after publishing to preserve vote integrity.
									</Text>
								</View>
							) : null}

							{/* Visibility */}
							<View style={{ marginBottom: 20 }}>
								<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
									Visibility
								</Text>
								<View style={{ flexDirection: 'row', gap: 8 }}>
									{VISIBILITY_OPTIONS.map((option) => {
										const isActive = visibility === option.key;
										return (
											<TouchableOpacity
												key={option.key}
												onPress={() => setVisibility(option.key)}
												style={{
													flex: 1,
													flexDirection: 'row',
													alignItems: 'center',
													justifyContent: 'center',
													paddingVertical: 10,
													borderRadius: 12,
													backgroundColor: isActive ? '#10b981' : colors.control,
													borderWidth: 1,
													borderColor: isActive ? '#10b981' : colors.border,
													gap: 6,
												}}
											>
												<Icon name={option.icon} size={14} color={isActive ? '#ffffff' : colors.mutedText} />
												<Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#ffffff' : colors.secondaryText }}>
													{option.label}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>

							{/* Hashtags */}
							<View style={{ marginBottom: 20 }}>
								<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
									Hashtags ({hashtags.length}/10)
								</Text>
								{hashtags.length > 0 ? (
									<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
										{hashtags.map((tag) => (
											<TouchableOpacity
												key={tag}
												onPress={() => handleRemoveHashtag(tag)}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													paddingHorizontal: 10,
													paddingVertical: 6,
													borderRadius: 16,
													backgroundColor: 'rgba(16, 185, 129, 0.12)',
													gap: 4,
												}}
											>
												<Text style={{ fontSize: 13, color: '#10b981', fontWeight: '600' }}>#{tag}</Text>
												<Icon name="x" size={12} color="#10b981" />
											</TouchableOpacity>
										))}
									</View>
								) : null}
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
									<TextInput
										value={hashtagInput}
										onChangeText={setHashtagInput}
										onSubmitEditing={() => handleAddHashtag(hashtagInput)}
										placeholder="Add a hashtag..."
										placeholderTextColor={colors.mutedText}
										returnKeyType="done"
										style={{
											flex: 1,
											fontSize: 14,
											color: colors.text,
											backgroundColor: colors.control,
											borderRadius: 12,
											paddingHorizontal: 14,
											paddingVertical: 10,
											borderWidth: 1,
											borderColor: colors.border,
										}}
									/>
									<TouchableOpacity
										onPress={() => handleAddHashtag(hashtagInput)}
										disabled={!hashtagInput.trim() || hashtags.length >= 10}
										style={{
											padding: 10,
											borderRadius: 12,
											backgroundColor: '#10b981',
											opacity: hashtagInput.trim() && hashtags.length < 10 ? 1 : 0.4,
										}}
									>
										<Icon name="plus" size={18} color="#ffffff" />
									</TouchableOpacity>
								</View>
								{/* Suggested hashtags */}
								<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
									<View style={{ flexDirection: 'row', gap: 6 }}>
										{SUGGESTED_HASHTAGS.filter((suggestion) => !hashtags.includes(suggestion.toLowerCase())).map((suggestion) => (
											<TouchableOpacity
												key={suggestion}
												onPress={() => handleAddHashtag(suggestion)}
												style={{
													paddingHorizontal: 10,
													paddingVertical: 5,
													borderRadius: 12,
													backgroundColor: colors.control,
													borderWidth: 1,
													borderColor: colors.border,
												}}
											>
												<Text style={{ fontSize: 12, color: colors.secondaryText }}>#{suggestion}</Text>
											</TouchableOpacity>
										))}
									</View>
								</ScrollView>
							</View>

							{/* Tag People / Mentions */}
							<View style={{ marginBottom: 20 }}>
								<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
									Tag People
								</Text>
								{taggedMentions.length > 0 ? (
									<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
										{taggedMentions.map((username) => (
											<TouchableOpacity
												key={username}
												onPress={() => handleRemoveMention(username)}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													paddingHorizontal: 10,
													paddingVertical: 6,
													borderRadius: 16,
													backgroundColor: 'rgba(99, 102, 241, 0.12)',
													gap: 4,
												}}
											>
												<Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '600' }}>@{username}</Text>
												<Icon name="x" size={12} color="#6366f1" />
											</TouchableOpacity>
										))}
									</View>
								) : null}
								<TextInput
									value={mentionInput}
									onChangeText={setMentionInput}
									placeholder="Search @username to tag..."
									placeholderTextColor={colors.mutedText}
									style={{
										fontSize: 14,
										color: colors.text,
										backgroundColor: colors.control,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 10,
										borderWidth: 1,
										borderColor: colors.border,
									}}
								/>
								{searchedUsers.length > 0 ? (
									<View style={{ marginTop: 6, borderRadius: 12, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
										{searchedUsers.slice(0, 5).map((user) => (
											<TouchableOpacity
												key={user.id}
												onPress={() => handleSelectMention(user)}
												style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
											>
												<UserAvatar profileImage={user.profileImage} firstName={user.firstName} size={28} />
												<View style={{ marginLeft: 10, flex: 1 }}>
													<Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
														{user.firstName} {user.lastName}
													</Text>
													<Text style={{ fontSize: 11, color: colors.mutedText }}>@{user.userName}</Text>
												</View>
											</TouchableOpacity>
										))}
									</View>
								) : null}
							</View>

							{/* Location */}
							<View style={{ marginBottom: 20 }}>
								<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
									Location
								</Text>
								{location ? (
									<View
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											backgroundColor: colors.control,
											borderRadius: 12,
											padding: 12,
											borderWidth: 1,
											borderColor: colors.border,
										}}
									>
										<Icon name="map-pin" size={16} color="#10b981" />
										<Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: colors.text }} numberOfLines={1}>
											{location.name}
										</Text>
										<TouchableOpacity onPress={() => setShowLocationPicker(true)} style={{ marginRight: 8 }}>
											<Icon name="edit-2" size={16} color={colors.secondaryText} />
										</TouchableOpacity>
										<TouchableOpacity onPress={() => setLocation(null)}>
											<Icon name="x" size={16} color={colors.destructive} />
										</TouchableOpacity>
									</View>
								) : (
									<TouchableOpacity
										onPress={() => setShowLocationPicker(true)}
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											padding: 12,
											borderRadius: 12,
											backgroundColor: colors.control,
											borderWidth: 1,
											borderColor: colors.border,
											borderStyle: 'dashed',
											gap: 8,
										}}
									>
										<Icon name="map-pin" size={16} color={colors.mutedText} />
										<Text style={{ fontSize: 14, color: colors.mutedText }}>Add location</Text>
									</TouchableOpacity>
								)}
							</View>
						</ScrollView>
					</KeyboardAvoidingView>
				</SafeAreaView>
			</Modal>

			<LocationPickerModal
				visible={showLocationPicker}
				onClose={() => setShowLocationPicker(false)}
				onSelect={(selectedLocation: PostLocation) => {
					setLocation(selectedLocation);
					setShowLocationPicker(false);
				}}
			/>
		</>
	);
}
