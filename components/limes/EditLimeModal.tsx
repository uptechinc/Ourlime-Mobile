import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Globe, Users, Lock, Sparkles, Laugh, Lightbulb, Video as VideoIcon, Music2, Compass } from 'lucide-react-native';
import type { Reel } from '@/types/userTypes';
import { limeService, type LimeEditPayload } from '@/lib/services/LimeService';
import { SearchService } from '@/lib/services/SearchService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';

type EditLimeModalProps = {
	visible: boolean;
	reel: Reel;
	onClose: () => void;
	onSaved: (updatedReel: Reel) => void;
};

type UserSuggestion = {
	id: string;
	userName: string;
	firstName: string;
	lastName: string;
	profileImage?: string;
};

const searchService = SearchService.getInstance();

const CATEGORIES = [
	{ name: 'For You', IconComponent: Sparkles, color: '#10b981' },
	{ name: 'Following', IconComponent: Users, color: '#10b981' },
	{ name: 'Comedy', IconComponent: Laugh, color: '#f59e0b' },
	{ name: 'Academic', IconComponent: Lightbulb, color: '#eab308' },
	{ name: 'DIY', IconComponent: VideoIcon, color: '#ef4444' },
	{ name: 'Music', IconComponent: Music2, color: '#6366f1' },
	{ name: 'Explore', IconComponent: Compass, color: '#06b6d4' },
];

const PRIVACY_OPTIONS = [
	{ key: 'public' as const, label: 'Public', IconComponent: Globe },
	{ key: 'friends' as const, label: 'Friends', IconComponent: Users },
	{ key: 'private' as const, label: 'Only me', IconComponent: Lock },
];

const MAX_CAPTION_LENGTH = 150;

export default function EditLimeModal({ visible, reel, onClose, onSaved }: EditLimeModalProps) {
	const { colors } = useAppTheme();

	const [caption, setCaption] = useState(reel.caption || '');
	const [category, setCategory] = useState(reel.category || 'For You');
	const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(
		(reel.visibility as 'public' | 'friends' | 'private') || 'public'
	);
	const [mentionInput, setMentionInput] = useState('');
	const [mentionResults, setMentionResults] = useState<UserSuggestion[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setCaption(reel.caption || '');
			setCategory(reel.category || 'For You');
			setVisibility((reel.visibility as 'public' | 'friends' | 'private') || 'public');
			setMentionInput('');
			setMentionResults([]);
			setIsSaving(false);
			setErrorMessage(null);
		}
	}, [visible, reel]);

	// Mention autocomplete search
	const activeMentionQuery = useMemo(() => {
		const beforeCursor = caption;
		const match = beforeCursor.match(/@([\w.-]{1,30})$/);
		if (match) return match[1].toLowerCase();
		const inputClean = mentionInput.trim().replace(/^@/, '').toLowerCase();
		return inputClean.length > 0 ? inputClean : null;
	}, [caption, mentionInput]);

	useEffect(() => {
		if (!activeMentionQuery) {
			setMentionResults([]);
			return;
		}
		const timer = setTimeout(async () => {
			try {
				const profiles = await searchService.searchUsers(activeMentionQuery, 6);
				setMentionResults(
					profiles.map((profile) => ({
						id: profile.uid,
						userName: profile.userName || 'user',
						firstName: profile.firstName || '',
						lastName: profile.lastName || '',
						profileImage: profile.profilePicture || undefined,
					}))
				);
			} catch {
				setMentionResults([]);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [activeMentionQuery]);

	const handleSelectMention = useCallback(
		(user: UserSuggestion) => {
			const mentionTag = `@${user.userName}`;
			// Replace partial @query at end of caption with the full mention
			const replaced = caption.replace(/@[\w.-]*$/, mentionTag + ' ');
			setCaption(replaced);
			setMentionInput('');
			setMentionResults([]);
		},
		[caption]
	);

	const handleSave = useCallback(async () => {
		if (isSaving) return;
		setIsSaving(true);
		setErrorMessage(null);

		try {
			const updates: LimeEditPayload = {};
			const trimmedCaption = caption.trim();

			if (trimmedCaption !== (reel.caption || '').trim()) {
				updates.caption = trimmedCaption;
			}
			if (category !== (reel.category || 'For You')) {
				updates.category = category;
			}
			if (visibility !== ((reel.visibility as 'public' | 'friends' | 'private') || 'public')) {
				updates.visibility = visibility;
			}

			// Extract mentions from caption
			const extractedMentions = (trimmedCaption.match(/@([\w.-]+)/g) || []).map((match) => match.replace('@', ''));
			const currentMentions = reel.caption
				? (reel.caption.match(/@([\w.-]+)/g) || []).map((match) => match.replace('@', ''))
				: [];
			if (JSON.stringify(extractedMentions.sort()) !== JSON.stringify(currentMentions.sort())) {
				updates.mentions = extractedMentions;
			}

			if (Object.keys(updates).length === 0) {
				onClose();
				return;
			}

			await limeService.updateLime(reel.id, updates);

			const updatedReel: Reel = {
				...reel,
				caption: updates.caption !== undefined ? updates.caption : reel.caption,
				category: updates.category !== undefined ? updates.category : reel.category,
				visibility: updates.visibility !== undefined ? updates.visibility : reel.visibility,
			};

			onSaved(updatedReel);
			onClose();
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : 'Failed to save changes. Please try again.');
		} finally {
			setIsSaving(false);
		}
	}, [isSaving, caption, category, visibility, reel, onSaved, onClose]);

	if (!visible) return null;

	return (
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
						<Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Edit Lime</Text>
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
						<View style={{ marginBottom: 24 }}>
							<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
								Caption
							</Text>
							<TextInput
								value={caption}
								onChangeText={(text) => {
									if (text.length <= MAX_CAPTION_LENGTH) setCaption(text);
								}}
								maxLength={MAX_CAPTION_LENGTH}
								multiline
								placeholder="Write a caption for your Lime..."
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
							<Text style={{ alignSelf: 'flex-end', marginTop: 4, fontSize: 11, color: caption.length >= MAX_CAPTION_LENGTH ? '#ef4444' : colors.mutedText }}>
								{caption.length}/{MAX_CAPTION_LENGTH}
							</Text>

							{/* Mention autocomplete dropdown */}
							{mentionResults.length > 0 ? (
								<View style={{ marginTop: 6, borderRadius: 12, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
									{mentionResults.map((user) => (
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

						{/* Category */}
						<View style={{ marginBottom: 24 }}>
							<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
								Category
							</Text>
							<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
								{CATEGORIES.map((cat) => {
									const isActive = category === cat.name;
									const CatIcon = cat.IconComponent;
									return (
										<TouchableOpacity
											key={cat.name}
											onPress={() => setCategory(cat.name)}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingHorizontal: 12,
												paddingVertical: 8,
												borderRadius: 20,
												backgroundColor: isActive ? cat.color : colors.control,
												borderWidth: 1,
												borderColor: isActive ? cat.color : colors.border,
												gap: 6,
											}}
										>
											<CatIcon size={14} color={isActive ? '#ffffff' : cat.color} />
											<Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#ffffff' : colors.secondaryText }}>
												{cat.name}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						{/* Visibility */}
						<View style={{ marginBottom: 24 }}>
							<Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 6 }}>
								Visibility
							</Text>
							<View style={{ flexDirection: 'row', gap: 8 }}>
								{PRIVACY_OPTIONS.map((option) => {
									const isActive = visibility === option.key;
									const PrivacyIcon = option.IconComponent;
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
											<PrivacyIcon size={14} color={isActive ? '#ffffff' : colors.mutedText} />
											<Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#ffffff' : colors.secondaryText }}>
												{option.label}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</Modal>
	);
}
