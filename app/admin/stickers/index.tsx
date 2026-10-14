import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AdminCollectionWorkspace from '@/components/admin/AdminCollectionWorkspace';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export default function AdminStickersRoute() {
	const [tab, setTab] = useState<'packs' | 'stickers'>('packs');
	const { colors } = useAppTheme();
	// The tabs sit under the workspace header (they used to render above it, under the status bar).
	const tabs = (
		<View style={{ flexDirection: 'row', marginBottom: 12 }}>
			{(['packs', 'stickers'] as const).map((item) => (
				<TouchableOpacity
					key={item}
					onPress={() => setTab(item)}
					accessibilityRole="tab"
					accessibilityState={{ selected: tab === item }}
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
	);
	return tab === 'packs' ? (
		<AdminCollectionWorkspace
			key="sticker_packs"
			kind="sticker_packs"
			title="Sticker Packs"
			subtitle="Review, publish, disable, and remove packs"
			accessory={tabs}
		/>
	) : (
		<AdminCollectionWorkspace
			key="stickers"
			kind="stickers"
			title="Stickers"
			subtitle="Review, publish, disable, and remove sticker assets"
			accessory={tabs}
		/>
	);
}
