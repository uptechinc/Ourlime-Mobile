import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/Feather';
import AdminPressable from '@/components/admin/AdminPressable';
import { radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminMediaGalleryProps = {
	uris: string[];
	/** For accessibility labels ("<label>, photo 2 of 4"). */
	label: string;
	/** 1 = square (products, pets); 16/9 for course covers. */
	aspectRatio?: number;
};

/**
 * Review gallery in the style of a store product page: one large photo shown whole (never cropped), a counter, and a
 * row of thumbnails to switch photos. Photos that fail to load are dropped.
 */
export default function AdminMediaGallery({ uris, label, aspectRatio = 1 }: AdminMediaGalleryProps) {
	const { colors } = useAppTheme();
	const [failed, setFailed] = useState<string[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const usable = uris.filter((uri) => uri && !failed.includes(uri));

	if (usable.length === 0) {
		return (
			<View style={{ width: '100%', aspectRatio, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
				<Icon name="image" size={32} color={colors.mutedText} />
				<Text style={[type.meta, { color: colors.mutedText }]}>No photos</Text>
			</View>
		);
	}

	const index = Math.min(activeIndex, usable.length - 1);
	const current = usable[index];
	const markFailed = (uri: string) => setFailed((list) => (list.includes(uri) ? list : [...list, uri]));

	return (
		<View style={{ gap: space.sm }}>
			<View style={{ width: '100%', aspectRatio, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }}>
				<Image
					source={{ uri: current }}
					style={{ width: '100%', height: '100%' }}
					contentFit="contain"
					cachePolicy="memory-disk"
					transition={120}
					accessibilityLabel={`${label}, photo ${index + 1} of ${usable.length}`}
					accessibilityIgnoresInvertColors
					onError={() => markFailed(current)}
				/>
				{usable.length > 1 ? (
					<View style={{ position: 'absolute', right: space.sm, bottom: space.sm, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
						<Text style={[type.label, { color: colors.text }]}>
							{index + 1} / {usable.length}
						</Text>
					</View>
				) : null}
			</View>
			{usable.length > 1 ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
					{usable.map((uri, thumbIndex) => {
						const isActive = thumbIndex === index;
						return (
							<AdminPressable
								key={uri}
								onPress={() => setActiveIndex(thumbIndex)}
								accessibilityRole="button"
								accessibilityLabel={`Show photo ${thumbIndex + 1}`}
								accessibilityState={{ selected: isActive }}
								style={{ width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: isActive ? colors.accent : colors.border, opacity: isActive ? 1 : 0.8 }}
							>
								<Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" onError={() => markFailed(uri)} />
							</AdminPressable>
						);
					})}
				</ScrollView>
			) : null}
		</View>
	);
}
