import { useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type {
	CommunityCardModel,
	CommunityCategory,
	UpdateCommunityInput,
} from '@/lib/types/community';
import { communityMediaService } from '@/lib/services/CommunityMediaService';
import {
	CommunityService,
	type CommunityAvailability,
} from '@/lib/services/CommunityService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type EditCommunityModalProps = {
	visible: boolean;
	community: CommunityCardModel;
	categories: CommunityCategory[];
	rules: string[];
	onClose: () => void;
	onSave: (updates: UpdateCommunityInput) => Promise<void>;
	onDelete: () => void;
};

const communityService = CommunityService.getInstance();

export default function EditCommunityModal({
	visible,
	community,
	categories,
	rules: initialRules,
	onClose,
	onSave,
	onDelete,
}: EditCommunityModalProps) {
	const { colors } = useAppTheme();
	const [title, setTitle] = useState(community.title);
	const [slug, setSlug] = useState(community.slug);
	const [description, setDescription] = useState(community.description);
	const [categoryId, setCategoryId] = useState<string | null>(
		community.categoryId
	);
	const [isPrivate, setIsPrivate] = useState(community.isPrivate);
	const [verifiedMembersOnly, setVerifiedMembersOnly] = useState(
		community.verifiedMembersOnly
	);
	const [postingPermission, setPostingPermission] = useState<
		CommunityCardModel['postingPermission']
	>(community.postingPermission);
	const [imageUrl, setImageUrl] = useState(community.imageUrl ?? '');
	const [selectedBanner, setSelectedBanner] =
		useState<ImagePicker.ImagePickerAsset | null>(null);
	const [rules, setRules] = useState(initialRules);
	const [newRule, setNewRule] = useState('');
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [availability, setAvailability] =
		useState<CommunityAvailability | null>(null);
	const [checkingAvailability, setCheckingAvailability] = useState(false);
	useEffect(() => {
		if (!visible) return;
		setTitle(community.title);
		setSlug(community.slug);
		setDescription(community.description);
		setCategoryId(community.categoryId);
		setIsPrivate(community.isPrivate);
		setVerifiedMembersOnly(community.verifiedMembersOnly);
		setPostingPermission(community.postingPermission);
		setImageUrl(community.imageUrl ?? '');
		setSelectedBanner(null);
		setRules(initialRules);
	}, [community, initialRules, visible]);
	useEffect(() => {
		if (
			!visible ||
			(title.trim() === community.title && slug.trim() === community.slug)
		) {
			setAvailability(null);
			return;
		}
		const timeout = setTimeout(() => {
			setCheckingAvailability(true);
			void communityService
				.checkAvailability(title, slug, community.id)
				.then(setAvailability)
				.catch(() => setAvailability(null))
				.finally(() => setCheckingAvailability(false));
		}, 400);
		return () => clearTimeout(timeout);
	}, [community.id, community.slug, community.title, slug, title, visible]);
	const pickBanner = async (): Promise<void> => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			setFeedback('Photo library permission is required.');
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [3, 1],
			quality: 0.88,
		});
		if (!result.canceled && result.assets[0])
			setSelectedBanner(result.assets[0]);
	};
	const handleSave = async (): Promise<void> => {
		if (title.trim().length < 3 || description.length > 300) {
			setFeedback(
				'Use a name with at least 3 characters and a description under 300 characters.'
			);
			return;
		}
		if (checkingAvailability) {
			setFeedback('Wait for the community name and URL check to finish.');
			return;
		}
		if (
			availability &&
			(!availability.nameAvailable || !availability.slugAvailable)
		) {
			setFeedback(
				`Choose an available community name and URL.${availability.suggestions.length ? ` Try ${availability.suggestions[0]}.` : ''}`
			);
			return;
		}
		setBusy(true);
		try {
			const bannerUrl = selectedBanner
				? (
						await communityMediaService.uploadBanner(
							selectedBanner,
							() => undefined
						)
					).downloadUrl
				: imageUrl.trim() || null;
			await onSave({
				title: title.trim(),
				slug,
				description: description.trim(),
				categoryId,
				isPrivate,
				verifiedMembersOnly,
				postingPermission,
				imageUrl: bannerUrl,
				rules,
			});
			onClose();
		} catch (error: unknown) {
			setFeedback(
				error instanceof Error
					? error.message
					: 'Community could not be updated.'
			);
		} finally {
			setBusy(false);
		}
	};
	const preview = selectedBanner?.uri || imageUrl;
	return (
		<>
			<Modal
				visible={visible}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={onClose}
			>
				<SwipeDismissSurface
					visible={visible}
					onDismiss={onClose}
					handleColor={colors.border}
					disabled={busy}
					accessibilityLabel="Swipe down to close community editor"
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							padding: 16,
							backgroundColor: colors.surface,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
						}}
					>
						<Text
							style={{
								flex: 1,
								color: colors.text,
								fontSize: 20,
								fontWeight: '900',
							}}
						>
							Edit community
						</Text>
						<TouchableOpacity onPress={onClose}>
							<X size={23} color={colors.icon} />
						</TouchableOpacity>
					</View>
					<ScrollView
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{ padding: 18, paddingBottom: 46 }}
					>
						{preview ? (
							<View style={{ borderRadius: 16, overflow: 'hidden' }}>
								<CachedImage
									uri={preview}
									recyclingKey={`edit-community-${community.id}-${preview}`}
									style={{ width: '100%', height: 120 }}
									contentFit="cover"
								/>
								<TouchableOpacity
									onPress={() => {
										setSelectedBanner(null);
										setImageUrl('');
									}}
									style={{
										position: 'absolute',
										right: 8,
										top: 8,
										padding: 8,
										borderRadius: 18,
										backgroundColor: colors.destructive,
									}}
								>
									<Trash2 size={16} color="#fff" />
								</TouchableOpacity>
							</View>
						) : (
							<TouchableOpacity
								onPress={() => void pickBanner()}
								style={{
									height: 110,
									alignItems: 'center',
									justifyContent: 'center',
									borderRadius: 16,
									borderWidth: 1,
									borderStyle: 'dashed',
									borderColor: colors.border,
									backgroundColor: colors.control,
								}}
							>
								<ImagePlus size={28} color={colors.accent} />
								<Text
									style={{
										marginTop: 7,
										color: colors.secondaryText,
										fontWeight: '800',
									}}
								>
									Choose and crop banner
								</Text>
							</TouchableOpacity>
						)}
						<TouchableOpacity
							onPress={() => void pickBanner()}
							style={{ alignSelf: 'flex-start', marginTop: 8 }}
						>
							<Text style={{ color: colors.accentText, fontWeight: '800' }}>
								Replace banner
							</Text>
						</TouchableOpacity>
						{(
							[
								{
									label: 'Name',
									value: title,
									setter: setTitle,
									multiline: false,
									limit: 80,
								},
								{
									label: 'URL slug',
									value: slug,
									setter: setSlug,
									multiline: false,
									limit: 60,
								},
								{
									label: 'Description',
									value: description,
									setter: setDescription,
									multiline: true,
									limit: 300,
								},
								{
									label: 'Image URL',
									value: imageUrl,
									setter: setImageUrl,
									multiline: false,
									limit: 500,
								},
							] as const
						).map((field) => (
							<View key={field.label} style={{ marginTop: 15 }}>
								<Text
									style={{
										marginBottom: 6,
										color: colors.secondaryText,
										fontWeight: '800',
									}}
								>
									{field.label}
								</Text>
								<TextInput
									value={field.value}
									onChangeText={field.setter}
									multiline={field.multiline}
									maxLength={field.limit}
									placeholderTextColor={colors.mutedText}
									style={{
										minHeight: field.multiline ? 100 : 45,
										textAlignVertical: 'top',
										padding: 12,
										borderRadius: 13,
										borderWidth: 1,
										borderColor: colors.border,
										backgroundColor: colors.input,
										color: colors.text,
									}}
								/>
							</View>
						))}
						<Text
							style={{
								marginTop: 16,
								marginBottom: 7,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Category
						</Text>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
							{categories.map((category) => (
								<TouchableOpacity
									key={category.id}
									onPress={() => setCategoryId(category.id)}
									style={{
										marginRight: 6,
										marginBottom: 6,
										paddingHorizontal: 10,
										paddingVertical: 7,
										borderRadius: 999,
										backgroundColor:
											categoryId === category.id
												? colors.selectedControl
												: colors.control,
									}}
								>
									<Text
										style={{
											color:
												categoryId === category.id
													? colors.selectedText
													: colors.secondaryText,
											fontSize: 11,
											fontWeight: '800',
										}}
									>
										{category.name}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<View
							style={{
								marginTop: 12,
								borderRadius: 15,
								backgroundColor: colors.surface,
								borderWidth: 1,
								borderColor: colors.border,
							}}
						>
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									padding: 13,
								}}
							>
								<Text
									style={{ flex: 1, color: colors.text, fontWeight: '800' }}
								>
									Private community
								</Text>
								<Switch value={isPrivate} onValueChange={setIsPrivate} />
							</View>
							<View style={{ height: 1, backgroundColor: colors.border }} />
							<View
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									padding: 13,
								}}
							>
								<Text
									style={{ flex: 1, color: colors.text, fontWeight: '800' }}
								>
									Verified members only
								</Text>
								<Switch
									value={verifiedMembersOnly}
									onValueChange={setVerifiedMembersOnly}
								/>
							</View>
						</View>
						<Text
							style={{
								marginTop: 16,
								marginBottom: 7,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Posting permission
						</Text>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
							{(['everyone', 'members', 'admins', 'owner'] as const).map(
								(permission) => (
									<TouchableOpacity
										key={permission}
										onPress={() => setPostingPermission(permission)}
										style={{
											marginRight: 6,
											marginBottom: 6,
											paddingHorizontal: 10,
											paddingVertical: 7,
											borderRadius: 999,
											backgroundColor:
												postingPermission === permission
													? colors.selectedControl
													: colors.control,
										}}
									>
										<Text
											style={{
												color:
													postingPermission === permission
														? colors.selectedText
														: colors.secondaryText,
												fontSize: 11,
												fontWeight: '800',
												textTransform: 'capitalize',
											}}
										>
											{permission}
										</Text>
									</TouchableOpacity>
								)
							)}
						</View>
						<Text
							style={{
								marginTop: 16,
								marginBottom: 7,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Community rules
						</Text>
						{rules.map((rule, index) => (
							<View
								key={`${index}-${rule}`}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									marginBottom: 7,
								}}
							>
								<TextInput
									value={rule}
									onChangeText={(value) =>
										setRules((current) =>
											current.map((item, itemIndex) =>
												itemIndex === index ? value : item
											)
										)
									}
									style={{
										flex: 1,
										padding: 11,
										borderRadius: 12,
										borderWidth: 1,
										borderColor: colors.border,
										backgroundColor: colors.input,
										color: colors.text,
									}}
								/>
								<TouchableOpacity
									onPress={() =>
										setRules((current) =>
											current.filter((_item, itemIndex) => itemIndex !== index)
										)
									}
									style={{ padding: 9 }}
								>
									<Trash2 size={17} color={colors.destructive} />
								</TouchableOpacity>
							</View>
						))}
						{rules.length < 20 ? (
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<TextInput
									value={newRule}
									onChangeText={setNewRule}
									placeholder="Add a rule"
									placeholderTextColor={colors.mutedText}
									style={{
										flex: 1,
										padding: 11,
										borderRadius: 12,
										borderWidth: 1,
										borderColor: colors.border,
										backgroundColor: colors.input,
										color: colors.text,
									}}
								/>
								<TouchableOpacity
									onPress={() => {
										if (newRule.trim()) {
											setRules((current) => [...current, newRule.trim()]);
											setNewRule('');
										}
									}}
									style={{
										marginLeft: 7,
										padding: 10,
										borderRadius: 11,
										backgroundColor: colors.control,
									}}
								>
									<Plus size={17} color={colors.accent} />
								</TouchableOpacity>
							</View>
						) : null}
						<TouchableOpacity
							disabled={busy}
							onPress={() => void handleSave()}
							style={{
								marginTop: 22,
								minHeight: 48,
								borderRadius: 14,
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: colors.accent,
							}}
						>
							{busy ? (
								<ActivityIndicator color={colors.onAccent} />
							) : (
								<Text style={{ color: colors.onAccent, fontWeight: '900' }}>
									Save changes
								</Text>
							)}
						</TouchableOpacity>
						<TouchableOpacity
							onPress={onDelete}
							style={{
								marginTop: 11,
								minHeight: 46,
								borderRadius: 14,
								borderWidth: 1,
								borderColor: colors.destructive,
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<Text
								style={{ color: colors.destructiveText, fontWeight: '900' }}
							>
								Delete community
							</Text>
						</TouchableOpacity>
					</ScrollView>
				</SafeAreaView>
				</SwipeDismissSurface>
			</Modal>
			<CustomModal
				visible={Boolean(feedback)}
				title="Community settings"
				message={feedback ?? ''}
				type="error"
				onClose={() => setFeedback(null)}
			/>
		</>
	);
}
