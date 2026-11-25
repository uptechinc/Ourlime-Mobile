import { Stack, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import { AdminWorkspaceBodySkeleton } from '@/components/admin/AdminSkeletons';
import { getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
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
	const danger = getAdminTone(colors, 'danger');
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
			<View
				style={{
					width: 64,
					height: 64,
					borderRadius: radius.pill,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: danger.soft,
					borderWidth: 1,
					borderColor: danger.border,
				}}
			>
				<Icon name={icon} size={28} color={danger.text} />
			</View>
			<Text style={[type.title, { marginTop: space.lg, color: colors.text, textAlign: 'center' }]}>{title}</Text>
			<Text style={[type.body, { marginTop: space.sm, color: colors.mutedText, textAlign: 'center' }]}>{message}</Text>
			<AdminButton label={actionLabel} onPress={onAction} style={{ marginTop: space.xl }} />
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
