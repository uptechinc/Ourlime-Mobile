import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { supportTicketResourceService } from '@/lib/services/SupportTicketResourceService';
import { useSupportTicketStore } from '@/lib/store/useSupportTicketStore';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/lib/types/support';

export default function SupportTicketsScreen() {
	const router = useRouter();
	const { colors } = useAppTheme();
	const resource = useSupportTicketStore((state) => state.tickets);

	const load = useCallback(async () => {
		await supportTicketResourceService.hydrateList();
		await supportTicketResourceService.refreshList();
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const items = resource.data?.items ?? [];

	return (
		<SafeAreaView
			edges={['top', 'bottom', 'left', 'right']}
			style={{ flex: 1, backgroundColor: colors.canvas }}
		>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					padding: 14,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
					backgroundColor: colors.navigation,
				}}
			>
				<TouchableOpacity onPress={() => router.back()}>
					<Ionicons name="chevron-back" size={26} color={colors.icon} />
				</TouchableOpacity>
				<Text
					style={{
						flex: 1,
						marginLeft: 10,
						color: colors.text,
						fontSize: 19,
						fontWeight: '900',
					}}
				>
					My Tickets
				</Text>
				<TouchableOpacity
					onPress={() => router.push('/help/tickets/new')}
					style={{ padding: 8 }}
				>
					<Ionicons name="add" size={25} color={colors.accent} />
				</TouchableOpacity>
			</View>
			<ScrollView
				refreshControl={
					<RefreshControl
						refreshing={resource.status === 'refreshing'}
						onRefresh={() => void supportTicketResourceService.refreshList()}
						tintColor={colors.accent}
					/>
				}
				contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
			>
				{resource.error ? (
					<Text
						style={{
							padding: 13,
							borderRadius: 13,
							color: colors.destructiveText,
							backgroundColor: colors.destructiveSurface,
						}}
					>
						{resource.error.message}
					</Text>
				) : null}
				{resource.status === 'hydrating' && !items.length ? (
					<ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
				) : null}
				{!items.length && resource.status === 'ready' ? (
					<Text
						style={{
							marginTop: 50,
							textAlign: 'center',
							color: colors.mutedText,
						}}
					>
						No support tickets yet.
					</Text>
				) : (
					items.map((ticket) => (
						<TouchableOpacity
							key={ticket.id}
							onPress={() => router.push(`/help/tickets/${ticket.id}` as Href)}
							style={{
								marginBottom: 10,
								padding: 15,
								borderRadius: 18,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.surface,
							}}
						>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Text
									style={{
										color: colors.text,
										fontWeight: '900',
										fontFamily: 'monospace',
									}}
								>
									{ticket.reference}
								</Text>
								{ticket.unreadByRequester ? (
									<Text
										style={{
											marginLeft: 8,
											paddingHorizontal: 7,
											paddingVertical: 3,
											borderRadius: 99,
											overflow: 'hidden',
											color: '#fff',
											backgroundColor: colors.destructive,
											fontSize: 10,
											fontWeight: '900',
										}}
									>
										{ticket.unreadByRequester} NEW
									</Text>
								) : null}
							</View>
							<Text
								numberOfLines={1}
								style={{
									marginTop: 7,
									color: colors.text,
									fontSize: 16,
									fontWeight: '900',
								}}
							>
								{ticket.subject}
							</Text>
							<Text
								style={{ marginTop: 4, color: colors.mutedText, fontSize: 12 }}
							>
								{SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} ·{' '}
								{ticket.status.replaceAll('_', ' ')}
							</Text>
							<Text
								style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}
							>
								{ticket.assignedStaff
									? `${ticket.assignedStaff.displayName} · Ourlime Support`
									: 'Waiting for claim'}
							</Text>
						</TouchableOpacity>
					))
				)}
				{resource.data?.hasMore && resource.data.nextCursor ? (
					<TouchableOpacity
						onPress={() => void supportTicketResourceService.loadMoreList()}
						style={{
							minHeight: 48,
							alignItems: 'center',
							justifyContent: 'center',
							borderRadius: 15,
							borderWidth: 1,
							borderColor: colors.border,
						}}
					>
						<Text style={{ color: colors.secondaryText, fontWeight: '900' }}>
							Load more tickets
						</Text>
					</TouchableOpacity>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}
