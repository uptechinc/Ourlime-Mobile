import { useState, useRef } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	ScrollView,
	Alert,
	ActivityIndicator,
	Image,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useKeyboardHeight } from '@/lib/hooks/useKeyboardHeight';

type CreateBlogModalProps = {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	onSuccess?: () => void;
};

const BLOG_CATEGORIES = [
	{ id: 'technology', label: 'Technology', icon: 'hardware-chip-outline' as const },
	{ id: 'lifestyle', label: 'Lifestyle', icon: 'leaf-outline' as const },
	{ id: 'business', label: 'Business', icon: 'briefcase-outline' as const },
	{ id: 'health', label: 'Health', icon: 'fitness-outline' as const },
	{ id: 'education', label: 'Education', icon: 'school-outline' as const },
	{ id: 'travel', label: 'Travel', icon: 'airplane-outline' as const },
	{ id: 'food', label: 'Food', icon: 'restaurant-outline' as const },
	{ id: 'fashion', label: 'Fashion', icon: 'shirt-outline' as const },
	{ id: 'wellness', label: 'Wellness', icon: 'heart-outline' as const },
	{ id: 'marketing', label: 'Marketing', icon: 'megaphone-outline' as const },
	{ id: 'finance', label: 'Finance', icon: 'cash-outline' as const },
	{ id: 'design', label: 'Design', icon: 'color-palette-outline' as const },
] as const;

export default function CreateBlogModal({
	isOpen,
	onClose,
	userId,
	onSuccess,
}: CreateBlogModalProps) {
	const { colors, isDark } = useAppTheme();
	const keyboardHeight = useKeyboardHeight();
	const scrollViewRef = useRef<ScrollView>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploadingCover, setIsUploadingCover] = useState(false);
	const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
	const [tagInput, setTagInput] = useState('');
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});

	const [formData, setFormData] = useState({
		title: '',
		type: 'blog' as 'blog' | 'article',
		excerpt: '',
		content: '',
		coverImage: '',
		categoryId: 'technology',
		readTime: 0,
		tags: [] as string[],
		sources: [] as {
			title: string;
			url: string;
			author: string;
			publishDate: Date;
			type: string;
			citation: string;
			isVerified: boolean;
		}[],
	});

	const resetForm = () => {
		setFormData({
			title: '',
			type: 'blog',
			excerpt: '',
			content: '',
			coverImage: '',
			categoryId: 'technology',
			readTime: 0,
			tags: [],
			sources: [],
		});
		setTagInput('');
		setFormErrors({});
		setIsLoading(false);
		setIsUploadingCover(false);
		setCategoryPickerOpen(false);
	};

	const handleClose = () => {
		if (isLoading || isUploadingCover) return;
		resetForm();
		onClose();
	};

	const validate = (): boolean => {
		const errors: Record<string, string> = {};
		if (!formData.title.trim()) errors.title = 'Title is required';
		if (!formData.excerpt.trim()) errors.excerpt = 'Excerpt is required';
		if (!formData.content.trim()) errors.content = 'Content is required';
		if (!formData.categoryId) errors.categoryId = 'Category is required';
		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSubmit = async () => {
		if (!validate()) {
			Alert.alert('Validation Error', 'Please complete all required fields.');
			return;
		}

		setIsLoading(true);

		try {
			const blogService = BlogsAndArticlesService.getInstance();
			const wordCount = formData.content.trim().split(/\s+/).length;
			const computedReadTime = Math.max(1, Math.ceil(wordCount / 200));

			await blogService.createPost({
				userId,
				title: formData.title.trim(),
				type: formData.type,
				excerpt: formData.excerpt.trim(),
				content: formData.content.trim(),
				coverImage: formData.coverImage.trim(),
				categoryId: formData.categoryId || 'technology',
				readTime: formData.readTime || computedReadTime,
				tags: formData.tags,
				sources: formData.sources,
			});

			Alert.alert('Success!', 'Blog created successfully!', [
				{
					text: 'OK',
					onPress: () => {
						onSuccess?.();
						handleClose();
					},
				},
			]);
		} catch (error) {
			console.error('[CreateBlogModal] Error creating blog:', error);
			Alert.alert('Error', 'Failed to create blog. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (field: string, value: string | number) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
		if (formErrors[field]) {
			setFormErrors((prev) => {
				const next = { ...prev };
				delete next[field];
				return next;
			});
		}
	};

	const handlePickCoverImage = async () => {
		try {
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (!permission.granted) {
				Alert.alert('Permission needed', 'Allow photo access to attach a cover image.');
				return;
			}
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ['images'],
				allowsEditing: true,
				aspect: [16, 9],
				quality: 0.85,
			});
			if (!result.canceled && result.assets && result.assets.length > 0) {
				const localUri = result.assets[0].uri;
				setIsUploadingCover(true);
				try {
					const blogService = BlogsAndArticlesService.getInstance();
					const downloadUrl = await blogService.uploadCoverImage(userId, localUri);
					handleInputChange('coverImage', downloadUrl);
				} catch (uploadError) {
					console.error('[CreateBlogModal] Cover upload failed:', uploadError);
					Alert.alert('Upload Failed', 'Could not upload cover image. Please try again.');
				} finally {
					setIsUploadingCover(false);
				}
			}
		} catch (pickerError) {
			console.error('[CreateBlogModal.handlePickCoverImage] Error:', pickerError);
			Alert.alert('Error', 'Failed to pick image.');
			setIsUploadingCover(false);
		}
	};

	const handleAddTag = () => {
		const clean = tagInput.trim().replace(/^[#,\s]+|[,\s]+$/g, '');
		if (!clean) return;
		if (formData.tags.length >= 5) {
			Alert.alert('Tag limit reached', 'You can add a maximum of 5 tags.');
			return;
		}
		if (formData.tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
			setTagInput('');
			return;
		}
		setFormData((prev) => ({ ...prev, tags: [...prev.tags, clean] }));
		setTagInput('');
	};

	const handleRemoveTag = (indexToRemove: number) => {
		setFormData((prev) => ({
			...prev,
			tags: prev.tags.filter((_, idx) => idx !== indexToRemove),
		}));
	};

	const selectedCategory = BLOG_CATEGORIES.find((c) => c.id === formData.categoryId) || BLOG_CATEGORIES[0];

	return (
		<Modal
			visible={isOpen}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={handleClose}
		>
			<SwipeDismissSurface
				visible={isOpen}
				onDismiss={handleClose}
				handleColor={colors.border}
				disabled={isLoading || isUploadingCover}
				accessibilityLabel="Swipe down to close blog creation"
				style={{
					flex: 1,
					backgroundColor: colors.canvas,
				}}
			>
				{/* Header */}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'space-between',
						alignItems: 'center',
						paddingHorizontal: 18,
						paddingVertical: 14,
						borderBottomWidth: 1,
						borderBottomColor: colors.border,
						backgroundColor: colors.surface,
					}}
				>
					<View>
						<Text
							style={{
								fontSize: 19,
								fontWeight: '800',
								color: colors.text,
							}}
						>
							Create New Blog
						</Text>
						<Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>
							Share stories, tutorials, and insights
						</Text>
					</View>
					<TouchableOpacity
						onPress={handleClose}
						hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: colors.control,
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Ionicons name="close" size={20} color={colors.text} />
					</TouchableOpacity>
				</View>

				{/* Form Content wrapped in KeyboardAvoidingView */}
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					style={{
						flex: 1,
						paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
					}}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
				>
					<ScrollView
						ref={scrollViewRef}
						style={{ flex: 1 }}
						contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
					>
						<View style={{ gap: 18 }}>
							{/* Title */}
							<View>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
									<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
										Title <Text style={{ color: '#ef4444' }}>*</Text>
									</Text>
									{formErrors.title ? (
										<Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>
											{formErrors.title}
										</Text>
									) : null}
								</View>
								<TextInput
									style={{
										borderWidth: 1,
										borderColor: formErrors.title ? '#ef4444' : colors.border,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 12,
										fontSize: 16,
										color: colors.text,
										backgroundColor: colors.surface,
									}}
									placeholder="Enter a compelling title"
									placeholderTextColor={colors.mutedText}
									value={formData.title}
									onChangeText={(text) => handleInputChange('title', text)}
								/>
							</View>

							{/* Type Selection */}
							<View>
								<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
									Content Format <Text style={{ color: '#ef4444' }}>*</Text>
								</Text>
								<View style={{ flexDirection: 'row', gap: 10 }}>
									<TouchableOpacity
										onPress={() => handleInputChange('type', 'blog')}
										style={{
											flex: 1,
											paddingVertical: 12,
											paddingHorizontal: 14,
											borderRadius: 12,
											borderWidth: 1.5,
											borderColor: formData.type === 'blog' ? colors.accent : colors.border,
											backgroundColor: formData.type === 'blog' ? `${colors.accent}15` : colors.surface,
											flexDirection: 'row',
											alignItems: 'center',
											justifyContent: 'center',
											gap: 8,
										}}
									>
										<Ionicons
											name="book-outline"
											size={18}
											color={formData.type === 'blog' ? colors.accent : colors.mutedText}
										/>
										<Text
											style={{
												fontSize: 15,
												fontWeight: '700',
												color: formData.type === 'blog' ? colors.accent : colors.text,
											}}
										>
											Blog Post
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										onPress={() => handleInputChange('type', 'article')}
										style={{
											flex: 1,
											paddingVertical: 12,
											paddingHorizontal: 14,
											borderRadius: 12,
											borderWidth: 1.5,
											borderColor: formData.type === 'article' ? colors.accent : colors.border,
											backgroundColor: formData.type === 'article' ? `${colors.accent}15` : colors.surface,
											flexDirection: 'row',
											alignItems: 'center',
											justifyContent: 'center',
											gap: 8,
										}}
									>
										<Ionicons
											name="document-text-outline"
											size={18}
											color={formData.type === 'article' ? colors.accent : colors.mutedText}
										/>
										<Text
											style={{
												fontSize: 15,
												fontWeight: '700',
												color: formData.type === 'article' ? colors.accent : colors.text,
											}}
										>
											Article
										</Text>
									</TouchableOpacity>
								</View>
							</View>

							{/* Cover Image */}
							<View>
								<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
									Cover Image
								</Text>
								{formData.coverImage ? (
									<View
										style={{
											borderRadius: 14,
											overflow: 'hidden',
											borderWidth: 1,
											borderColor: colors.border,
											backgroundColor: colors.surface,
										}}
									>
										<Image
											source={{ uri: formData.coverImage }}
											style={{ width: '100%', height: 180 }}
											resizeMode="cover"
										/>
										<View
											style={{
												flexDirection: 'row',
												justifyContent: 'space-between',
												alignItems: 'center',
												padding: 12,
												backgroundColor: colors.surface,
												borderTopWidth: 1,
												borderTopColor: colors.border,
											}}
										>
											<TouchableOpacity
												onPress={handlePickCoverImage}
												disabled={isUploadingCover}
												style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
											>
												<Ionicons name="image-outline" size={16} color={colors.accent} />
												<Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Change Image</Text>
											</TouchableOpacity>
											<TouchableOpacity
												onPress={() => handleInputChange('coverImage', '')}
												style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
											>
												<Ionicons name="trash-outline" size={16} color="#ef4444" />
												<Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Remove</Text>
											</TouchableOpacity>
										</View>
									</View>
								) : (
									<TouchableOpacity
										onPress={handlePickCoverImage}
										disabled={isUploadingCover}
										style={{
											borderWidth: 1.5,
											borderStyle: 'dashed',
											borderColor: colors.border,
											borderRadius: 14,
											paddingVertical: 24,
											alignItems: 'center',
											justifyContent: 'center',
											backgroundColor: colors.surface,
										}}
									>
										{isUploadingCover ? (
											<View style={{ alignItems: 'center', gap: 8 }}>
												<ActivityIndicator size="small" color={colors.accent} />
												<Text style={{ fontSize: 13, color: colors.mutedText, fontWeight: '600' }}>
													Uploading cover photo to storage...
												</Text>
											</View>
										) : (
											<View style={{ alignItems: 'center', gap: 6 }}>
												<View
													style={{
														width: 44,
														height: 44,
														borderRadius: 22,
														backgroundColor: colors.control,
														alignItems: 'center',
														justifyContent: 'center',
													}}
												>
													<Ionicons name="cloud-upload-outline" size={22} color={colors.accent} />
												</View>
												<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
													Upload Cover Image
												</Text>
												<Text style={{ fontSize: 12, color: colors.mutedText }}>
													Recommended 16:9 ratio (PNG, JPG, WebP)
												</Text>
											</View>
										)}
									</TouchableOpacity>
								)}
							</View>

							{/* Excerpt */}
							<View>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
									<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
										Excerpt <Text style={{ color: '#ef4444' }}>*</Text>
									</Text>
									<Text
										style={{
											fontSize: 12,
											color: formData.excerpt.length > 200 ? '#f59e0b' : colors.mutedText,
											fontWeight: '600',
										}}
									>
										{formData.excerpt.length}/200
									</Text>
								</View>
								<TextInput
									style={{
										borderWidth: 1,
										borderColor: formErrors.excerpt ? '#ef4444' : colors.border,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 12,
										fontSize: 15,
										color: colors.text,
										backgroundColor: colors.surface,
										height: 80,
										textAlignVertical: 'top',
									}}
									placeholder="A short, catchy summary that appears in previews and feeds"
									placeholderTextColor={colors.mutedText}
									value={formData.excerpt}
									onChangeText={(text) => handleInputChange('excerpt', text)}
									multiline
									numberOfLines={3}
								/>
							</View>

							{/* Category Picker Trigger */}
							<View>
								<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
									Category <Text style={{ color: '#ef4444' }}>*</Text>
								</Text>
								<TouchableOpacity
									onPress={() => setCategoryPickerOpen(true)}
									style={{
										borderWidth: 1,
										borderColor: colors.border,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 12,
										backgroundColor: colors.surface,
										flexDirection: 'row',
										justifyContent: 'space-between',
										alignItems: 'center',
									}}
								>
									<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
										<Ionicons name={selectedCategory.icon} size={18} color={colors.accent} />
										<Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
											{selectedCategory.label}
										</Text>
									</View>
									<Ionicons name="chevron-down" size={18} color={colors.mutedText} />
								</TouchableOpacity>
							</View>

							{/* Content */}
							<View>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
									<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
										Content <Text style={{ color: '#ef4444' }}>*</Text>
									</Text>
									{formErrors.content ? (
										<Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>
											{formErrors.content}
										</Text>
									) : null}
								</View>
								<TextInput
									style={{
										borderWidth: 1,
										borderColor: formErrors.content ? '#ef4444' : colors.border,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 12,
										fontSize: 15,
										color: colors.text,
										backgroundColor: colors.surface,
										minHeight: 180,
										textAlignVertical: 'top',
										lineHeight: 22,
									}}
									placeholder="Write your blog story, insights, or guide..."
									placeholderTextColor={colors.mutedText}
									value={formData.content}
									onChangeText={(text) => handleInputChange('content', text)}
									multiline
									numberOfLines={8}
								/>
							</View>

							{/* Tags Section with Fixed Contrast & Interactive Chips */}
							<View>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
									<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
										Tags <Text style={{ fontSize: 12, color: colors.mutedText }}>(Up to 5)</Text>
									</Text>
									<Text style={{ fontSize: 12, color: colors.mutedText, fontWeight: '600' }}>
										{formData.tags.length}/5
									</Text>
								</View>

								{/* Tag Input Field & Add Button */}
								<View style={{ flexDirection: 'row', gap: 8 }}>
									<TextInput
										style={{
											flex: 1,
											borderWidth: 1,
											borderColor: colors.border,
											borderRadius: 12,
											paddingHorizontal: 14,
											paddingVertical: 10,
											fontSize: 15,
											color: colors.text,
											backgroundColor: colors.surface,
										}}
										placeholder="Type tag (e.g. Mobile, UX, AI)"
										placeholderTextColor={colors.mutedText}
										value={tagInput}
										onChangeText={setTagInput}
										onSubmitEditing={handleAddTag}
										returnKeyType="done"
										editable={formData.tags.length < 5}
										onFocus={() => {
											setTimeout(() => {
												scrollViewRef.current?.scrollToEnd({ animated: true });
											}, 120);
										}}
									/>
									<TouchableOpacity
										onPress={handleAddTag}
										disabled={!tagInput.trim() || formData.tags.length >= 5}
										style={{
											paddingHorizontal: 18,
											borderRadius: 12,
											backgroundColor:
												tagInput.trim() && formData.tags.length < 5
													? colors.accent
													: colors.control,
											justifyContent: 'center',
											alignItems: 'center',
										}}
									>
										<Text
											style={{
												color:
													tagInput.trim() && formData.tags.length < 5
														? colors.onAccent
														: colors.mutedText,
												fontWeight: '700',
												fontSize: 14,
											}}
										>
											Add
										</Text>
									</TouchableOpacity>
								</View>

								{/* Rendered Chips */}
								{formData.tags.length > 0 ? (
									<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
										{formData.tags.map((tag, idx) => (
											<View
												key={`${tag}-${idx}`}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													gap: 6,
													paddingVertical: 6,
													paddingHorizontal: 12,
													borderRadius: 20,
													backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
													borderWidth: 1,
													borderColor: colors.border,
												}}
											>
												<Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
													#{tag}
												</Text>
												<TouchableOpacity
													onPress={() => handleRemoveTag(idx)}
													hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
												>
													<Ionicons name="close-circle" size={16} color={colors.mutedText} />
												</TouchableOpacity>
											</View>
										))}
									</View>
								) : null}
							</View>

							{/* Read Time (Optional Override) */}
							<View>
								<Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
									Estimated Read Time <Text style={{ fontSize: 12, color: colors.mutedText }}>(minutes, optional)</Text>
								</Text>
								<TextInput
									style={{
										borderWidth: 1,
										borderColor: colors.border,
										borderRadius: 12,
										paddingHorizontal: 14,
										paddingVertical: 10,
										fontSize: 15,
										color: colors.text,
										backgroundColor: colors.surface,
									}}
									placeholder="Auto-calculated if left blank"
									placeholderTextColor={colors.mutedText}
									value={formData.readTime ? formData.readTime.toString() : ''}
									onChangeText={(text) =>
										handleInputChange('readTime', parseInt(text, 10) || 0)
									}
									keyboardType="numeric"
									onFocus={() => {
										setTimeout(() => {
											scrollViewRef.current?.scrollToEnd({ animated: true });
										}, 120);
									}}
								/>
							</View>
						</View>
					</ScrollView>

					{/* Footer Actions */}
					<View
						style={{
							flexDirection: 'row',
							gap: 12,
							paddingHorizontal: 18,
							paddingVertical: 14,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.surface,
						}}
					>
						<TouchableOpacity
							onPress={handleClose}
							disabled={isLoading || isUploadingCover}
							style={{
								flex: 1,
								paddingVertical: 13,
								borderRadius: 12,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.control,
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Cancel</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={handleSubmit}
							disabled={isLoading || isUploadingCover}
							style={{
								flex: 1.6,
								paddingVertical: 13,
								borderRadius: 12,
								backgroundColor: colors.accent,
								alignItems: 'center',
								justifyContent: 'center',
								opacity: isLoading || isUploadingCover ? 0.6 : 1,
							}}
						>
							{isLoading ? (
								<ActivityIndicator size="small" color={colors.onAccent} />
							) : (
								<Text
									style={{
										fontSize: 15,
										fontWeight: '800',
										color: colors.onAccent,
									}}
								>
									Publish Blog
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>

				{/* Category Picker Sub-Modal */}
				<Modal
					visible={categoryPickerOpen}
					transparent
					animationType="fade"
					onRequestClose={() => setCategoryPickerOpen(false)}
				>
					<View
						style={{
							flex: 1,
							backgroundColor: 'rgba(0,0,0,0.5)',
							justifyContent: 'center',
							alignItems: 'center',
							padding: 20,
						}}
					>
						<View
							style={{
								width: '100%',
								maxWidth: 380,
								maxHeight: '75%',
								backgroundColor: colors.canvas,
								borderRadius: 20,
								borderWidth: 1,
								borderColor: colors.border,
								padding: 18,
								shadowColor: '#000',
								shadowOpacity: 0.25,
								shadowRadius: 16,
								elevation: 10,
							}}
						>
							<View
								style={{
									flexDirection: 'row',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: 14,
									paddingBottom: 10,
									borderBottomWidth: 1,
									borderBottomColor: colors.border,
								}}
							>
								<Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
									Select Category
								</Text>
								<TouchableOpacity onPress={() => setCategoryPickerOpen(false)}>
									<Ionicons name="close" size={22} color={colors.mutedText} />
								</TouchableOpacity>
							</View>
							<ScrollView showsVerticalScrollIndicator={false}>
								<View style={{ gap: 6 }}>
									{BLOG_CATEGORIES.map((cat) => {
										const isSelected = formData.categoryId === cat.id;
										return (
											<TouchableOpacity
												key={cat.id}
												onPress={() => {
													handleInputChange('categoryId', cat.id);
													setCategoryPickerOpen(false);
												}}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													justifyContent: 'space-between',
													paddingVertical: 12,
													paddingHorizontal: 14,
													borderRadius: 12,
													backgroundColor: isSelected ? `${colors.accent}15` : colors.surface,
													borderWidth: 1,
													borderColor: isSelected ? colors.accent : colors.border,
												}}
											>
												<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
													<Ionicons
														name={cat.icon}
														size={18}
														color={isSelected ? colors.accent : colors.mutedText}
													/>
													<Text
														style={{
															fontSize: 15,
															fontWeight: isSelected ? '800' : '600',
															color: isSelected ? colors.accent : colors.text,
														}}
													>
														{cat.label}
													</Text>
												</View>
												{isSelected ? (
													<Ionicons name="checkmark-circle" size={20} color={colors.accent} />
												) : null}
											</TouchableOpacity>
										);
									})}
								</View>
							</ScrollView>
						</View>
					</View>
				</Modal>
			</SwipeDismissSurface>
		</Modal>
	);
}
