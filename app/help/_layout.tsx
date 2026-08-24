import { Stack } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export default function HelpLayout() {
	const { colors } = useAppTheme();

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				animation: 'slide_from_right',
				gestureEnabled: true,
				gestureDirection: 'horizontal',
				contentStyle: { backgroundColor: colors.canvas },
			}}
		/>
	);
}
