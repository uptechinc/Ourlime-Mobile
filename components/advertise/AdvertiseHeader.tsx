import React, { Dispatch, SetStateAction } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

type AdvertiseHeaderProps = {
	setActiveTab: Dispatch<SetStateAction<string>>;
	activeTab: string;
};

export default function AdvertiseHeader({
	setActiveTab,
	activeTab,
}: AdvertiseHeaderProps) {
	return (
		<View style={{ padding: 40 }}>
			<Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
				Advertisement
			</Text>
			<View style={{ marginTop: 8, flexDirection: 'row', gap: 20 }}>
				<TouchableOpacity
					style={{
						borderRadius: 50,
						borderWidth: 1,
						borderColor: '#d1d5db',
						padding: 8,
						shadowColor: '#000',
						shadowOffset: { width: 0, height: 1 },
						shadowOpacity: 0.1,
						shadowRadius: 2,
						elevation: 2,
						backgroundColor: activeTab === 'Campaigns' ? '#10b981' : 'transparent'
					}}
					onPress={() => setActiveTab('Campaigns')}
				>
					<Text style={{
						color: activeTab === 'Campaigns' ? '#ffffff' : '#374151',
						fontSize: 14,
						fontWeight: '500',
						textAlign: 'center'
					}}>
						Campaigns
					</Text>
				</TouchableOpacity>
				
				<TouchableOpacity
					style={{
						borderRadius: 50,
						borderWidth: 1,
						borderColor: '#d1d5db',
						padding: 8,
						shadowColor: '#000',
						shadowOffset: { width: 0, height: 1 },
						shadowOpacity: 0.1,
						shadowRadius: 2,
						elevation: 2,
						backgroundColor: activeTab === 'Wallet & Credits' 
							? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
							: 'transparent'
					}}
					onPress={() => setActiveTab('Wallet & Credits')}
				>
					<Text style={{
						color: activeTab === 'Wallet & Credits' ? '#ffffff' : '#374151',
						fontSize: 14,
						fontWeight: '500',
						textAlign: 'center'
					}}>
						Wallet & Credits
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
