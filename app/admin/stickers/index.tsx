import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TouchableOpacity, View } from 'react-native';
import AdminCollectionWorkspace from '@/components/admin/AdminCollectionWorkspace';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export default function AdminStickersRoute() {
	const [tab, setTab] = useState<'packs' | 'stickers'>('packs');
	const { colors } = useAppTheme();
	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={{ flex: 1, backgroundColor: colors.canvas }}
		>
			<View
				style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}
			>
				{(['packs', 'stickers'] as const).map((item) => (
					<TouchableOpacity
						key={item}
						onPress={() => setTab(item)}
						style={{
							marginRight: 8,
							borderRadius: 999,
							paddingHorizontal: 16,
							paddingVertical: 9,
							backgroundColor: tab === item ? colors.accent : colors.control,
						}}
					>
						<Text
							style={{
								color: tab === item ? colors.onAccent : colors.secondaryText,
								fontWeight: '900',
								textTransform: 'capitalize',
							}}
						>
							{item}
						</Text>
					</TouchableOpacity>
				))}
			</View>
			<View style={{ flex: 1 }}>
				{tab === 'packs' ? (
					<AdminCollectionWorkspace
						kind="sticker_packs"
						title="Sticker Packs"
						subtitle="Review, publish, disable, and remove packs"
					/>
				) : (
					<AdminCollectionWorkspace
						kind="stickers"
						title="Stickers"
						subtitle="Review, publish, disable, and remove sticker assets"
					/>
				)}
			</View>
		</SafeAreaView>
	);
}
