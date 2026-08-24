import type { ReactNode } from 'react';
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminWorkspaceShellProps = {
	title: string;
	subtitle: string;
	children: ReactNode;
	loading: boolean;
	refreshing: boolean;
	error: string | null;
	onRefresh: () => void;
};

export default function AdminWorkspaceShell({
	title,
	subtitle,
	children,
	loading,
	refreshing,
	error,
	onRefresh,
}: AdminWorkspaceShellProps) {
	const router = useRouter();
	const { authorization, loading: accessLoading } = usePageAccess();
	const { colors } = useAppTheme();
	const handleBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace('/(tabs)');
	};

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={{ flex: 1, backgroundColor: colors.canvas }}
		>
			<View
				style={{
					minHeight: 62,
					flexDirection: 'row',
					alignItems: 'center',
					paddingHorizontal: 14,
					backgroundColor: colors.navigation,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
				}}
			>
				<TouchableOpacity
					onPress={() => router.back()}
					accessibilityRole="button"
					accessibilityLabel="Go back"
					style={{ padding: 7 }}
				>
					<Icon name="arrow-left" size={23} color={colors.icon} />
				</TouchableOpacity>
				<View style={{ flex: 1, marginLeft: 8 }}>
					<Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>
						{title}
					</Text>
					<Text
						numberOfLines={1}
						style={{ marginTop: 1, fontSize: 11, color: colors.mutedText }}
					>
						{subtitle}
					</Text>
				</View>
				<TouchableOpacity
					onPress={() => router.push('/admin')}
					accessibilityRole="button"
					accessibilityLabel="Admin overview"
					style={{ padding: 7 }}
				>
					<Icon name="grid" size={21} color="#10b981" />
				</TouchableOpacity>
			</View>

			{accessLoading ? (
				<View
					style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
				>
					<ActivityIndicator size="large" color="#10b981" />
				</View>
			) : !authorization.isAdmin ? (
				<View
					style={{
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						padding: 28,
					}}
				>
					<Icon name="lock" size={38} color="#c64d53" />
					<Text
						style={{
							marginTop: 14,
							fontSize: 20,
							fontWeight: '900',
							color: colors.text,
						}}
					>
						Admin access required
					</Text>
					<TouchableOpacity
						onPress={handleBack}
						style={{
							marginTop: 20,
							borderRadius: 999,
							backgroundColor: '#10b981',
							paddingHorizontal: 20,
							paddingVertical: 11,
						}}
					>
						<Text style={{ color: '#ffffff', fontWeight: '800' }}>Go Back</Text>
					</TouchableOpacity>
				</View>
			) : loading ? (
				<View
					style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
				>
					<ActivityIndicator size="large" color={colors.accent} />
					<Text style={{ marginTop: 11, color: colors.mutedText }}>
						Loading {title.toLowerCase()}…
					</Text>
				</View>
			) : error ? (
				<View
					style={{
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						padding: 28,
					}}
				>
					<Icon name="alert-triangle" size={36} color={colors.destructive} />
					<Text
						style={{
							marginTop: 12,
							textAlign: 'center',
							lineHeight: 20,
							color: colors.destructiveText,
						}}
					>
						{error}
					</Text>
					<TouchableOpacity
						onPress={onRefresh}
						style={{
							marginTop: 16,
							borderRadius: 999,
							backgroundColor: colors.accent,
							paddingHorizontal: 20,
							paddingVertical: 11,
						}}
					>
						<Text style={{ color: colors.onAccent, fontWeight: '800' }}>
							Retry
						</Text>
					</TouchableOpacity>
				</View>
			) : (
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={colors.accent}
						/>
					}
				>
					{children}
				</ScrollView>
			)}
		</SafeAreaView>
	);
}
