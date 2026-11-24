import { Stack, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { AdminWorkspaceBodySkeleton } from '@/components/admin/AdminSkeletons';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminGateNoticeProps = {
	icon: string;
	title: string;
	message: string;
	actionLabel: string;
	onAction: () => void;
};

function AdminGateNotice({ icon, title, message, actionLabel, onAction }: AdminGateNoticeProps) {
	const { colors } = useAppTheme();
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
			<Icon name={icon} size={38} color={colors.destructive} />
			<Text style={{ marginTop: 14, fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
				{title}
			</Text>
			<Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' }}>
				{message}
			</Text>
			<TouchableOpacity
				accessibilityRole="button"
				onPress={onAction}
				style={{ marginTop: 20, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 11 }}
			>
				<Text style={{ color: colors.onAccent, fontWeight: '800' }}>{actionLabel}</Text>
			</TouchableOpacity>
		</View>
	);
}

/**
 * Every /admin route renders through this layout, so none of them (including child-safety and
 * support, which have no screen-level check) can be opened without the canonical admin check
 * (firestore.rules isAdministrator(), via AuthorizationService). Screen options mirror the root
 * Stack so transitions are unchanged.
 */
export default function AdminLayout() {
	const router = useRouter();
	const { colors } = useAppTheme();
	const { authorization, loading, error, profile, retry } = usePageAccess();
	const handleBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace('/(tabs)');
	};

	// Once admin is confirmed keep the navigator mounted, so a background settings reload does not
	// unmount the admin stack and lose its history.
	if (!authorization.isAdmin) {
		return (
			<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
				{loading ? (
					<AdminWorkspaceBodySkeleton />
				) : error && !profile ? (
					<AdminGateNotice
						icon="alert-triangle"
						title="Couldn't verify your access"
						message="Check your connection and try again."
						actionLabel="Retry"
						onAction={retry}
					/>
				) : (
					<AdminGateNotice
						icon="lock"
						title="Admin access required"
						message="Your account does not have permission to open the administration workspace."
						actionLabel="Go Back"
						onAction={handleBack}
					/>
				)}
			</SafeAreaView>
		);
	}

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
