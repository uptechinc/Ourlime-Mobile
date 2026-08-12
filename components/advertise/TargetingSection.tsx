import { Dispatch, SetStateAction, useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AdvertiseFormError } from '@/types/advertise';

type TargetingSectionProps = {
	error: AdvertiseFormError;
	changeForm: () => void;
	setFormState: Dispatch<SetStateAction<string>>;
	isFormValid: boolean;
	setIsFormValid: Dispatch<SetStateAction<boolean>>;
};

export default function TargetingSection({
	error,
	changeForm,
	setFormState,
	isFormValid,
	setIsFormValid,
}: TargetingSectionProps) {
	const [gender, setGender] = useState('');
	const [placement, setPlacement] = useState('');
	const [bidding, setBidding] = useState('');
	const [location, setLocation] = useState('');
	const [isPublishing, setIsPublishing] = useState(false);

	const checkFormValidity = useCallback(() => {
		const isValid = !!(
			placement.trim() &&
			bidding.trim() &&
			location.trim() &&
			gender
		);
		setIsFormValid(isValid);
	}, [placement, bidding, location, gender, setIsFormValid]);

	useEffect(() => {
		checkFormValidity();
	}, [placement, bidding, location, gender, checkFormValidity]);

	const handlePublish = () => {
		setIsPublishing(true);
		setTimeout(() => {
			// TODO: Implement AsyncStorage for React Native
			console.log('Media Session Data:', {
				companyName: 'TODO: Get from AsyncStorage',
				fileName: 'TODO: Get from AsyncStorage'
			});
			console.log('Details Session Data:', {
				campaignTitle: 'TODO: Get from AsyncStorage',
				campaignDescription: 'TODO: Get from AsyncStorage',
				startDate: 'TODO: Get from AsyncStorage',
				endDate: 'TODO: Get from AsyncStorage',
				websiteUrl: 'TODO: Get from AsyncStorage'
			});
			console.log('Targeting Session Data:', {
				placement,
				bidding,
				location,
				gender
			});
			setIsPublishing(false);
			changeForm();
		}, 2000);
	};

	const showGenderSelection = () => {
		Alert.alert(
			'Select Gender',
			'Choose the target gender for your campaign',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Male', onPress: () => { setGender('male'); } },
				{ text: 'Female', onPress: () => { setGender('female'); } },
				{ text: 'Other', onPress: () => { setGender('other'); } }
			]
		);
	};

	return (
		<ScrollView style={{ marginVertical: 4, flex: 1, paddingHorizontal: 16 }}>
			<View style={{ gap: 16, paddingVertical: 8 }}>

				{/* Placement Input */}
				<View>
					<Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
						Placement Entire Site (File Format Image)
					</Text>
					<TextInput
						style={{
							borderWidth: 1,
							borderColor: '#d1d5db',
							borderRadius: 8,
							padding: 16,
							fontSize: 16,
							backgroundColor: '#ffffff'
						}}
						placeholder="Enter placement details"
						value={placement}
						onChangeText={(text) => {
							setPlacement(text);
							checkFormValidity();
						}}
					/>
				</View>

				{/* Bidding Input */}
				<View>
					<Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
						Bidding Pay Per click ($0.075)
					</Text>
					<TextInput
						style={{
							borderWidth: 1,
							borderColor: '#d1d5db',
							borderRadius: 8,
							padding: 16,
							fontSize: 16,
							backgroundColor: '#ffffff'
						}}
						placeholder="Enter bidding details"
						value={bidding}
						onChangeText={(text) => {
							setBidding(text);
							checkFormValidity();
						}}
						keyboardType="numeric"
					/>
				</View>

				{/* Location Input */}
				<View>
					<Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
						Location
					</Text>
					<TextInput
						style={{
							borderWidth: 1,
							borderColor: '#d1d5db',
							borderRadius: 8,
							padding: 16,
							fontSize: 16,
							backgroundColor: '#ffffff'
						}}
						placeholder="Enter location"
						value={location}
						onChangeText={(text) => {
							setLocation(text);
							checkFormValidity();
						}}
					/>
				</View>

				{/* Gender Selection */}
				<View>
					<Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' }}>
						Gender
					</Text>
					<TouchableOpacity
						style={{
							borderWidth: 1,
							borderColor: '#d1d5db',
							borderRadius: 8,
							padding: 16,
							backgroundColor: '#ffffff',
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center'
						}}
						onPress={showGenderSelection}
					>
						<Text style={{ 
							fontSize: 16, 
							color: gender ? '#111827' : '#9ca3af' 
						}}>
							{gender || 'Select gender'}
						</Text>
						<Text style={{ fontSize: 16, color: '#9ca3af' }}>▼</Text>
					</TouchableOpacity>
				</View>

				{/* Navigation Buttons */}
				<View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 20 }}>
					<TouchableOpacity
						style={{
							flex: 1,
							padding: 16,
							borderRadius: 8,
							backgroundColor: '#f3f4f6',
							alignItems: 'center'
						}}
						onPress={() => setFormState('Details')}
					>
						<Text style={{ fontSize: 16, fontWeight: '500', color: '#374151' }}>
							Back
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={{
							flex: 1,
							padding: 16,
							borderRadius: 8,
							backgroundColor: isFormValid && !isPublishing ? '#10b981' : '#e5e7eb',
							alignItems: 'center',
							opacity: isFormValid && !isPublishing ? 1 : 0.6
						}}
						onPress={() => {
							if (isFormValid && !isPublishing) {
								handlePublish();
							}
						}}
						disabled={!isFormValid || isPublishing}
					>
						<Text style={{ 
							fontSize: 16, 
							fontWeight: '500', 
							color: isFormValid && !isPublishing ? '#ffffff' : '#9ca3af',
							textAlign: 'center'
						}}>
							{isPublishing ? 'Publishing...' : 'Publish'}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</ScrollView>
	);
}