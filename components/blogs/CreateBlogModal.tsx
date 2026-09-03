import { useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';

type CreateBlogModalProps = {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	onSuccess?: () => void;
};

export default function CreateBlogModal({
	isOpen,
	onClose,
	userId,
	onSuccess,
}: CreateBlogModalProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		title: '',
		type: 'blog' as 'blog' | 'article',
		excerpt: '',
		content: '',
		coverImage: '',
		categoryId: '',
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

	const handleSubmit = async () => {
		if (
			!formData.title.trim() ||
			!formData.excerpt.trim() ||
			!formData.content.trim()
		) {
			Alert.alert('Error', 'Please fill in all required fields.');
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
						onClose();
					},
				},
			]);
		} catch (error) {
			console.error('Error creating blog:', error);
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
				handleInputChange('coverImage', result.assets[0].uri);
			}
		} catch (pickerError) {
			console.error('[CreateBlogModal.handlePickCoverImage] Error:', pickerError);
			Alert.alert('Error', 'Failed to pick image.');
		}
	};

	const showTypeSelection = () => {
		Alert.alert(
			'Select Type',
			'Choose the type of content you want to create',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Blog', onPress: () => handleInputChange('type', 'blog') },
				{
					text: 'Article',
					onPress: () => handleInputChange('type', 'article'),
				},
			]
		);
	};

	const showCategorySelection = () => {
		Alert.alert('Select Category', 'Choose a category for your content', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Technology',
				onPress: () => handleInputChange('categoryId', 'technology'),
			},
			{
				text: 'Lifestyle',
				onPress: () => handleInputChange('categoryId', 'lifestyle'),
			},
			{
				text: 'Business',
				onPress: () => handleInputChange('categoryId', 'business'),
			},
			{
				text: 'Health',
				onPress: () => handleInputChange('categoryId', 'health'),
			},
			{
				text: 'Education',
				onPress: () => handleInputChange('categoryId', 'education'),
			},
		]);
	};

	return (
		<Modal
			visible={isOpen}
			transparent
			statusBarTranslucent
			navigationBarTranslucent
			animationType="none"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<SwipeDismissSurface
				visible={isOpen}
				onDismiss={onClose}
				handleColor="#d1d5db"
				disabled={isLoading}
				accessibilityLabel="Swipe down to close blog creation"
				style={{
					flex: 1,
					backgroundColor: '#ffffff',
				}}
			>
				{/* Header */}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'space-between',
						alignItems: 'center',
						padding: 16,
						borderBottomWidth: 1,
						borderBottomColor: '#e5e7eb',
						backgroundColor: '#ffffff',
					}}
				>
					<Text
						style={{
							fontSize: 20,
							fontWeight: 'bold',
							color: '#111827',
						}}
					>
						Create New Blog
					</Text>
					<TouchableOpacity
						onPress={onClose}
						style={{
							padding: 8,
							borderRadius: 20,
						}}
					>
						<Text style={{ fontSize: 20, color: '#6b7280' }}>✕</Text>
					</TouchableOpacity>
				</View>

				{/* Form Content */}
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{ padding: 16 }}
					showsVerticalScrollIndicator={false}
				>
					<View style={{ gap: 16 }}>
						{/* Title */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Title *
							</Text>
							<TextInput
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									fontSize: 16,
									backgroundColor: '#ffffff',
								}}
								placeholder="Enter your blog title"
								value={formData.title}
								onChangeText={(text) => handleInputChange('title', text)}
							/>
						</View>

						{/* Type Selection */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Type *
							</Text>
							<TouchableOpacity
								onPress={showTypeSelection}
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									backgroundColor: '#ffffff',
									flexDirection: 'row',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}
							>
								<Text
									style={{
										fontSize: 16,
										color: formData.type ? '#111827' : '#9ca3af',
									}}
								>
									{formData.type || 'Select blog type'}
								</Text>
								<Text style={{ fontSize: 16, color: '#9ca3af' }}>▼</Text>
							</TouchableOpacity>
						</View>

						{/* Excerpt */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Excerpt *
							</Text>
							<TextInput
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									fontSize: 16,
									backgroundColor: '#ffffff',
									height: 80,
									textAlignVertical: 'top',
								}}
								placeholder="Write a brief summary of your blog"
								value={formData.excerpt}
								onChangeText={(text) => handleInputChange('excerpt', text)}
								multiline
								numberOfLines={3}
							/>
						</View>

						{/* Content */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Content *
							</Text>
							<TextInput
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									fontSize: 16,
									backgroundColor: '#ffffff',
									height: 200,
									textAlignVertical: 'top',
								}}
								placeholder="Write your blog content here"
								value={formData.content}
								onChangeText={(text) => handleInputChange('content', text)}
								multiline
								numberOfLines={10}
							/>
						</View>

						{/* Cover Image */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Cover Image URL
							</Text>
							<View style={{ flexDirection: 'row', gap: 8 }}>
								<TextInput
									style={{
										flex: 1,
										borderWidth: 1,
										borderColor: '#d1d5db',
										borderRadius: 8,
										padding: 12,
										fontSize: 16,
										backgroundColor: '#ffffff',
									}}
									placeholder="Enter image URL"
									value={formData.coverImage}
									onChangeText={(text) => handleInputChange('coverImage', text)}
								/>
								<TouchableOpacity
									style={{
										paddingHorizontal: 16,
										paddingVertical: 12,
										backgroundColor: '#10b981',
										borderRadius: 8,
										justifyContent: 'center',
										alignItems: 'center',
									}}
									onPress={handlePickCoverImage}
								>
									<Text style={{ color: '#ffffff', fontWeight: '500' }}>
										Pick Image
									</Text>
								</TouchableOpacity>
							</View>
							{Boolean(formData.coverImage) && (
								<View style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', height: 120, backgroundColor: '#f3f4f6' }}>
									<Image
										source={{ uri: formData.coverImage }}
										style={{ width: '100%', height: '100%' }}
										resizeMode="cover"
									/>
									<TouchableOpacity
										style={{
											position: 'absolute',
											top: 6,
											right: 6,
											backgroundColor: 'rgba(0, 0, 0, 0.6)',
											borderRadius: 12,
											paddingHorizontal: 8,
											paddingVertical: 4,
										}}
										onPress={() => handleInputChange('coverImage', '')}
									>
										<Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>Remove</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>

						{/* Category */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Category *
							</Text>
							<TouchableOpacity
								onPress={showCategorySelection}
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									backgroundColor: '#ffffff',
									flexDirection: 'row',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}
							>
								<Text
									style={{
										fontSize: 16,
										color: formData.categoryId ? '#111827' : '#9ca3af',
									}}
								>
									{formData.categoryId || 'Select a category'}
								</Text>
								<Text style={{ fontSize: 16, color: '#9ca3af' }}>▼</Text>
							</TouchableOpacity>
						</View>

						{/* Read Time */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Read Time (minutes) *
							</Text>
							<TextInput
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									fontSize: 16,
									backgroundColor: '#ffffff',
								}}
								placeholder="Estimated read time"
								value={formData.readTime.toString()}
								onChangeText={(text) =>
									handleInputChange('readTime', parseInt(text) || 0)
								}
								keyboardType="numeric"
							/>
						</View>

						{/* Tags */}
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: '500',
									marginBottom: 8,
									color: '#374151',
								}}
							>
								Tags
							</Text>
							<TextInput
								style={{
									borderWidth: 1,
									borderColor: '#d1d5db',
									borderRadius: 8,
									padding: 12,
									fontSize: 16,
									backgroundColor: '#ffffff',
								}}
								placeholder="Add tags (comma separated)"
								onChangeText={(text) => {
									const tags = text.split(',').map((tag) => tag.trim());
									setFormData((prev) => ({ ...prev, tags }));
								}}
							/>
						</View>
					</View>
				</ScrollView>

				{/* Footer */}
				<View
					style={{
						flexDirection: 'row',
						gap: 12,
						padding: 16,
						borderTopWidth: 1,
						borderTopColor: '#e5e7eb',
						backgroundColor: '#ffffff',
					}}
				>
					<TouchableOpacity
						onPress={onClose}
						style={{
							flex: 1,
							paddingVertical: 12,
							borderWidth: 1,
							borderColor: '#d1d5db',
							borderRadius: 8,
							alignItems: 'center',
						}}
					>
						<Text style={{ fontSize: 16, color: '#374151' }}>Cancel</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={handleSubmit}
						disabled={isLoading}
						style={{
							flex: 1,
							paddingVertical: 12,
							backgroundColor: '#10b981',
							borderRadius: 8,
							alignItems: 'center',
							opacity: isLoading ? 0.6 : 1,
						}}
					>
						{isLoading ? (
							<ActivityIndicator size="small" color="#ffffff" />
						) : (
							<Text
								style={{
									fontSize: 16,
									color: '#ffffff',
									fontWeight: '500',
								}}
							>
								Create Blog
							</Text>
						)}
					</TouchableOpacity>
				</View>
			</SwipeDismissSurface>
		</Modal>
	);
}
