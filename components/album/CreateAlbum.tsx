import { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    Image, 
    ScrollView, 
    Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import CustomModal from '@/components/ui/CustomModal';

type CreateAlbumProps = {
	onGoBack: () => void;
};

type ImageAsset = {
	uri: string;
	name: string;
	type: string;
	size?: number;
};

export default function CreateAlbum({ onGoBack }: CreateAlbumProps) {
	const [images, setImages] = useState<ImageAsset[]>([]);
	const [albumName, setAlbumName] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPublished, setIsPublished] = useState(false);
	const [dialogState, setDialogState] = useState<{
		visible: boolean;
		type: 'error' | 'warning' | 'info' | 'success';
		title: string;
		message: string;
	}>({
		visible: false,
		type: 'info',
		title: '',
		message: '',
	});

	const screenWidth = Dimensions.get('window').width;

	const handleImageUpload = async () => {
		try {
			// Request permissions
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				setDialogState({
					visible: true,
					type: 'warning',
					title: 'Permission needed',
					message: 'Please grant permission to access your media library.',
				});
				return;
			}

			// Launch image picker
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsMultipleSelection: true,
				quality: 0.8,
			});

			if (!result.canceled && result.assets.length > 0) {
				const newImages = result.assets.map(asset => ({
					uri: asset.uri,
					name: asset.fileName || `image_${Date.now()}`,
					type: asset.type || 'image/jpeg',
					size: asset.fileSize
				}));
				setImages(prevImages => [...prevImages, ...newImages]);
			}
		} catch (error) {
			console.error('Error picking image:', error);
			setDialogState({
				visible: true,
				type: 'error',
				title: 'Error',
				message: 'Failed to select image. Please try again.',
			});
		}
	};

	const handleDeleteImage = (index: number) => {
		setImages(prevImages => prevImages.filter((_, i) => i !== index));
	};

	const handleSubmit = async () => {
		if (albumName.trim() === '' || images.length === 0) {
			setDialogState({
				visible: true,
				type: 'warning',
				title: 'Missing Details',
				message: 'Please fill in album name and add at least one image.',
			});
			return;
		}

		// Disable button immediately
		setIsPublished(true);
		setIsSubmitting(true);

		try {
			// Simulate API call delay
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Clear form after successful submission
			setAlbumName('');
			setImages([]);

			setDialogState({
				visible: true,
				type: 'success',
				title: 'Success!',
				message: 'Congratulations! Your album has been created successfully!',
			});

		} catch (error) {
			console.error('Error creating album:', error);
			setIsPublished(false);
			
			setDialogState({
				visible: true,
				type: 'error',
				title: 'Error',
				message: 'Failed to create album. Please try again.',
			});

			setTimeout(() => {
				setIsSubmitting(false);
			}, 3000);
		}
	};

	return (
		<View style={{ flex: 1, backgroundColor: '#e5e7eb' }}>
			<ScrollView 
				contentContainerStyle={{ 
					flexGrow: 1, 
					justifyContent: 'center', 
					alignItems: 'center',
					padding: 16
				}}
			>
				<View style={{ 
					width: screenWidth > 600 ? '60%' : '100%',
					backgroundColor: '#ffffff',
					borderRadius: 8,
					padding: 24,
					shadowColor: '#000',
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.1,
					shadowRadius: 4,
					elevation: 3
				}}>
					{/* Header */}
					<View style={{ 
						marginBottom: 8, 
						flexDirection: 'row', 
						alignItems: 'center', 
						justifyContent: 'flex-start' 
					}}>
						<View style={{ 
							width: 56, 
							height: 56, 
							backgroundColor: '#f3f4f6', 
							borderRadius: 8,
							justifyContent: 'center',
							alignItems: 'center'
						}}>
							<Text style={{ fontSize: 24 }}>📷</Text>
						</View>
						<Text style={{ 
							marginLeft: 8, 
							fontSize: 18, 
							fontWeight: '600', 
							color: '#000000' 
						}}>
							Create album
						</Text>
					</View>

					{/* Album Name Input */}
					<View style={{ marginBottom: 16 }}>
						<TextInput
							style={{
								width: '100%',
								borderRadius: 6,
								borderWidth: 1,
								borderColor: '#d1d5db',
								paddingHorizontal: 16,
								paddingVertical: 8,
								fontSize: 16
							}}
							placeholder="Album name"
							value={albumName}
							onChangeText={setAlbumName}
						/>
						<Text style={{ 
							marginTop: 4, 
							fontSize: 14, 
							color: '#6b7280' 
						}}>
							Choose your album name
						</Text>
					</View>

					{/* Photos Section */}
					<View style={{ marginBottom: 24 }}>
						<Text style={{ 
							marginBottom: 8, 
							fontWeight: '600', 
							color: '#374151',
							fontSize: 16
						}}>
							Photos
						</Text>

						<View style={{ 
							flexDirection: 'row', 
							flexWrap: 'wrap', 
							alignItems: 'center', 
							gap: 16 
						}}>
							{/* Display uploaded images */}
							{images.map((image, index) => (
								<View key={index} style={{ position: 'relative' }}>
									<Image
										source={{ uri: image.uri }}
										style={{
											width: 128,
											height: 112,
											borderRadius: 8,
											objectFit: 'cover'
										}}
									/>
									<TouchableOpacity
										onPress={() => handleDeleteImage(index)}
										style={{
											position: 'absolute',
											left: '50%',
											top: '50%',
											transform: [{ translateX: -16 }, { translateY: -16 }],
											width: 32,
											height: 32,
											borderRadius: 16,
											backgroundColor: '#ef4444',
											justifyContent: 'center',
											alignItems: 'center'
										}}
									>
										<Text style={{ color: '#ffffff', fontSize: 16 }}>🗑️</Text>
									</TouchableOpacity>
								</View>
							))}

							{/* Add Image Button */}
							<TouchableOpacity
								onPress={handleImageUpload}
								style={{
									width: 128,
									height: 112,
									borderWidth: 2,
									borderStyle: 'dashed',
									borderColor: '#d1d5db',
									borderRadius: 8,
									justifyContent: 'center',
									alignItems: 'center',
									backgroundColor: '#f9fafb'
								}}
							>
								<Text style={{ fontSize: 24, color: '#9ca3af' }}>📷</Text>
								<Text style={{ 
									marginTop: 8, 
									fontSize: 14, 
									color: '#9ca3af' 
								}}>
									Add image
								</Text>
							</TouchableOpacity>
						</View>

						{/* Image Names List */}
						{images.length > 0 && (
							<View style={{ 
								marginTop: 16, 
								flexDirection: 'row', 
								flexWrap: 'wrap', 
								gap: 16 
							}}>
								{images.map((image, index) => (
									<Text key={index} style={{ 
										fontSize: 14, 
										color: '#6b7280',
										flexShrink: 1
									}}>
										{index + 1}. {image.name}
									</Text>
								))}
							</View>
						)}
					</View>

					{/* Action Buttons */}
					<View style={{ 
						flexDirection: 'row', 
						alignItems: 'center', 
						justifyContent: 'space-between' 
					}}>
						<TouchableOpacity 
							onPress={onGoBack}
							style={{ padding: 8 }}
						>
							<Text style={{ 
								color: '#3b82f6', 
								fontSize: 16,
								fontWeight: '500'
							}}>
								Go back
							</Text>
						</TouchableOpacity>
						
						<TouchableOpacity
							onPress={handleSubmit}
							style={{
								borderRadius: 6,
								paddingHorizontal: 16,
								paddingVertical: 8,
								backgroundColor: albumName.trim() !== '' && images.length > 0 && !isSubmitting
									? '#ef4444'
									: '#9ca3af'
							}}
							disabled={albumName.trim() === '' || images.length === 0 || isSubmitting}
						>
							<Text style={{ 
								color: '#ffffff', 
								fontSize: 16,
								fontWeight: '500'
							}}>
								{isPublished ? 'Published' : isSubmitting ? 'Publishing...' : 'Publish'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</ScrollView>
			<CustomModal
				visible={dialogState.visible}
				type={dialogState.type}
				title={dialogState.title}
				message={dialogState.message}
				onClose={() => setDialogState((prev) => ({ ...prev, visible: false }))}
			/>
		</View>
	);
}
