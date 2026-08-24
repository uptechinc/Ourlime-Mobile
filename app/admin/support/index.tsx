import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { supportTicketService } from '@/lib/services/SupportTicketService';
import {
	SUPPORT_TICKET_CATEGORY_LABELS,
	type SupportTicket,
	type SupportTicketFilter,
} from '@/lib/types/support';

const FILTERS: readonly { value: SupportTicketFilter; label: string }[] = [
	{ value: 'unassigned', label: 'Unassigned' },
	{ value: 'mine', label: 'Mine' },
	{ value: 'waiting', label: 'Waiting' },
	{ value: 'urgent', label: 'Urgent' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'all', label: 'All' },
];
type AdminSupportTicketsScreenProps = { detailRoutePrefix?: string };

export default function AdminSupportTicketsScreen({
	detailRoutePrefix = '/admin/support',
}: AdminSupportTicketsScreenProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const [filter, setFilter] = useState<SupportTicketFilter>('unassigned');
	const [items, setItems] = useState<SupportTicket[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const load = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			setItems((await supportTicketService.listStaff(filter)).items);
		} catch (loadError: unknown) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Support queue could not be loaded.'
			);
		} finally {
			setLoading(false);
		}
	}, [filter]);
	useEffect(() => {
		void load();
	}, [load]);
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
				<View style={{ flex: 1, marginLeft: 10 }}>
					<Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>
						Support Tickets
					</Text>
					<Text style={{ color: colors.mutedText, fontSize: 11 }}>
						Administrator & developer queue
					</Text>
				</View>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{
					flexGrow: 0,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
				}}
				contentContainerStyle={{ gap: 7, padding: 10 }}
			>
				{FILTERS.map((item) => (
					<TouchableOpacity
						key={item.value}
						onPress={() => setFilter(item.value)}
						style={{
							paddingHorizontal: 14,
							paddingVertical: 9,
							borderRadius: 99,
							backgroundColor:
								filter === item.value ? colors.accent : colors.surface,
						}}
					>
						<Text
							style={{
								color: filter === item.value ? '#fff' : colors.secondaryText,
								fontWeight: '900',
								fontSize: 12,
							}}
						>
							{item.label}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<ScrollView
				refreshControl={
					<RefreshControl
						refreshing={loading}
						onRefresh={() => void load()}
						tintColor={colors.accent}
					/>
				}
				contentContainerStyle={{ padding: 15, paddingBottom: 35 }}
			>
				{error ? (
					<Text
						style={{
							padding: 12,
							color: colors.destructiveText,
							backgroundColor: colors.destructiveSurface,
						}}
					>
						{error}
					</Text>
				) : null}
				{loading && !items.length ? (
					<ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
				) : null}
				{!loading && !items.length ? (
					<Text
						style={{
							marginTop: 45,
							textAlign: 'center',
							color: colors.mutedText,
						}}
					>
						No tickets match this queue.
					</Text>
				) : (
					items.map((ticket) => (
						<TouchableOpacity
							key={ticket.id}
							onPress={() =>
								router.push(`${detailRoutePrefix}/${ticket.id}` as Href)
							}
							style={{
								marginBottom: 9,
								padding: 15,
								borderRadius: 17,
								borderWidth: 1,
								borderColor:
									ticket.priority === 'urgent'
										? colors.destructive
										: colors.border,
								backgroundColor: colors.surface,
							}}
						>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Text
									style={{
										color: colors.text,
										fontFamily: 'monospace',
										fontWeight: '900',
									}}
								>
									{ticket.reference}
								</Text>
								<Text
									style={{
										marginLeft: 7,
										color: colors.mutedText,
										fontSize: 10,
										fontWeight: '900',
									}}
								>
									{ticket.status.replaceAll('_', ' ').toUpperCase()}
								</Text>
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
								{ticket.requesterDisplayName}
							</Text>
							<Text
								style={{
									marginTop: 3,
									color: ticket.assignedStaff
										? colors.mutedText
										: colors.warningText,
									fontSize: 12,
								}}
							>
								{ticket.assignedStaff
									? `Assigned to ${ticket.assignedStaff.displayName}`
									: 'Waiting for claim'}
							</Text>
						</TouchableOpacity>
					))
				)}
			</ScrollView>
		</SafeAreaView>
	);
}
