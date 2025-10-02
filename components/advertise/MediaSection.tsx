import React, { Dispatch, SetStateAction, useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, Dimensions } from 'react-native';
import { AdvertiseFormError } from '@/types/advertise';
import * as ImagePicker from 'expo-image-picker';

type MediaSectionProps = {
	error: AdvertiseFormError;
    companyNameValue: string;
    setCompanyNameValue: Dispatch<SetStateAction<string>>;
    selectedFile: any | null;
    setSelectedFile: Dispatch<SetStateAction<any | null>>;
    changeForm: () => void;
};

export default function MediaSection({
	error,
	companyNameValue,
	setCompanyNameValue,
	selectedFile,
	setSelectedFile,
	changeForm,
}: MediaSectionProps) {
    const [isFormValid, setIsFormValid] = useState(false);
    const screenWidth = Dimensions.get('window').width;

    const checkFormValidity = useCallback(() => {
        setIsFormValid(!!companyNameValue && !!selectedFile);
    }, [companyNameValue, selectedFile]);

    useEffect(() => {
        checkFormValidity();
    }, [checkFormValidity]);

    useEffect(() => {
        // TODO: Implement AsyncStorage for React Native
        // Load data from storage on component mount
        console.log('Loading stored data...');
    }, []);

    useEffect(() => {
        // TODO: Implement AsyncStorage for React Native
        // Save company name to storage whenever it changes
        console.log('Storing company name:', companyNameValue);
    }, [companyNameValue]);

    const handleFileSelection = async () => {
        try {
            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to access your media library.');
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setSelectedFile({
                    uri: asset.uri,
                    name: asset.fileName || 'selected-media',
                    type: asset.type,
                    size: asset.fileSize,
                });
                
                // TODO: Implement AsyncStorage for React Native
                console.log('Stored file info:', asset.fileName);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select media. Please try again.');
        }
    };

	return (
		<View style={{ marginVertical: 4, flex: 1, paddingHorizontal: 16 }}>
			<View style={{ 
				backgroundColor: '#fed7aa', 
				padding: 12, 
				borderRadius: 8,
				marginBottom: 16
			}}>
				<Text style={{ fontSize: 14, color: '#ea580c' }}>
					Your current wallet balance is: 0, please top up your wallet to continue.
				</Text>
			</View>

			{/* Company Name Input */}
			<View style={{ marginBottom: 16 }}>
				<Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
					Company Name
				</Text>
				<TextInput
					style={{
						borderWidth: 1,
						borderColor: error.companyName ? '#ef4444' : '#d1d5db',
						borderRadius: 8,
						padding: 16,
						fontSize: 16,
						backgroundColor: '#ffffff'
					}}
					placeholder="Enter your company name"
					value={companyNameValue}
					onChangeText={setCompanyNameValue}
				/>
			</View>

			<Text style={{ fontSize: 14, marginBottom: 12, color: '#374151' }}>
				Select an image for your campaign
			</Text>

			{/* Media Selection Area */}
			<View style={{ 
				height: 300, 
				borderBottomWidth: 2, 
				borderBottomColor: '#374151',
				backgroundColor: '#f5f5f5',
				borderRadius: 8,
				overflow: 'hidden',
				marginBottom: 16
			}}>
				{selectedFile ? (
					<View style={{ flex: 1, position: 'relative' }}>
						<Image
							source={{ uri: selectedFile.uri }}
							style={{
								width: '100%',
								height: '100%',
								resizeMode: 'contain'
							}}
						/>
						<TouchableOpacity
							style={{
								position: 'absolute',
								top: 12,
								right: 12,
								backgroundColor: 'rgba(255, 255, 255, 0.9)',
								padding: 8,
								borderRadius: 6
							}}
							onPress={handleFileSelection}
						>
							<Text style={{ fontSize: 12, color: '#374151' }}>
								Change
							</Text>
						</TouchableOpacity>
						
						{/* File Name Display */}
						<View style={{
							position: 'absolute',
							bottom: 8,
							left: 8,
							backgroundColor: 'rgba(0, 0, 0, 0.7)',
							padding: 4,
							borderRadius: 4
						}}>
							<Text style={{ fontSize: 10, color: '#ffffff' }}>
								{selectedFile.name}
							</Text>
						</View>
					</View>
				) : (
					<View style={{
						flex: 1,
						justifyContent: 'center',
						alignItems: 'center'
					}}>
						<TouchableOpacity
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.9)',
								padding: 16,
								borderRadius: 8,
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center'
							}}
							onPress={handleFileSelection}
						>
							<Text style={{ fontSize: 16, marginRight: 8 }}>📷</Text>
							<Text style={{ fontSize: 14, color: '#374151' }}>
								Select Photos / Videos
							</Text>
						</TouchableOpacity>
					</View>
				)}
			</View>

			{error.file && (
				<Text style={{ fontSize: 14, color: '#ef4444', marginBottom: 16 }}>
					Please upload a file.
				</Text>
			)}

			{/* Next Button */}
			<TouchableOpacity
				style={{
					width: '50%',
					alignSelf: 'center',
					padding: 16,
					borderRadius: 8,
					backgroundColor: isFormValid ? '#d1d5db' : '#e5e7eb',
					opacity: isFormValid ? 1 : 0.6
				}}
				onPress={() => {
					if (isFormValid) {
						changeForm();
					}
				}}
				disabled={!isFormValid}
			>
				<Text style={{ 
					fontSize: 16, 
					fontWeight: '500', 
					color: isFormValid ? '#374151' : '#9ca3af',
					textAlign: 'center'
				}}>
					Next
				</Text>
			</TouchableOpacity>
		</View>
	);
}