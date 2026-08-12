import { type Dispatch, type SetStateAction, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

type Stories = {
	id: string;
	username: string;
	file: string;
	profilePicture: string;
};

export default function AddStory({
	setAddStory,
	setStories,
}: {
	setAddStory: Dispatch<SetStateAction<boolean>>;
	setStories: Dispatch<SetStateAction<Stories[]>>;
}) {
	const [fileSelected, setFileSelected] = useState<boolean>(false);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	
	const pickDocument = async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: ['image/*', 'video/*'],
				copyToCacheDirectory: true,
			});

			if (!result.canceled && result.assets[0]) {
				setSelectedFile(result.assets[0].uri);
				setFileSelected(true);
			}
		} catch {
			Alert.alert('Error', 'Failed to pick document');
		}
	};

	const createStory = () => {
		if (selectedFile) {
			const newStory = [
				{
					id: '12345',
					username: 'Ourlime Admin',
					file: selectedFile,
					profilePicture: '/images/avatar.jpg',
				},
			];

			setStories((prevStories) => [...newStory, ...prevStories]);
			setAddStory(false);
		} else {
			Alert.alert('Warning', 'Please select a file first');
		}
	};

	return (
		<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#141414' }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 }}>
				<TouchableOpacity
					onPress={() => setAddStory((prev: boolean) => !prev)}
					style={{ padding: 4 }}
				>
					<Ionicons name="arrow-back" size={24} color="white" />
				</TouchableOpacity>
				<Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>Create New Status</Text>
			</View>

			<View style={{ flex: 1, padding: 16, gap: 16 }}>
				<Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>Media File</Text>

				<TouchableOpacity
					onPress={pickDocument}
					style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}
				>
					<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}>
						<Ionicons name="videocam" size={24} color="#10b981" />
					</View>
					<Text style={{ color: 'white', fontSize: 16 }}>Select Photos & Videos</Text>
				</TouchableOpacity>

				{selectedFile && (
					<Text style={{ color: '#10b981', fontSize: 14, marginLeft: 48 }}>
						File selected: {selectedFile.split('/').pop()}
					</Text>
				)}

				<TouchableOpacity
					style={{
						backgroundColor: fileSelected ? '#10b981' : '#374151',
						paddingVertical: 12,
						paddingHorizontal: 24,
						borderRadius: 8,
						alignSelf: 'center',
						marginTop: 20,
					}}
					onPress={createStory}
					disabled={!fileSelected}
				>
					<Text style={{
						color: fileSelected ? 'white' : '#9ca3af',
						fontSize: 16,
						fontWeight: '600',
						textAlign: 'center',
					}}>
						Create
					</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}
