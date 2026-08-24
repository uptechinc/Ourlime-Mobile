import { useEffect, type ReactNode } from 'react';
import {
	Linking,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { auth } from '@/lib/firebaseConfig';

type ProtectedHelpRoute =
	| '/help/tickets/new'
	| '/help/tickets'
	| '/help/child-safety/report'
	| '/help/child-safety/reports';

type ChildSafetyHelpParameters = {
	targetType?: string;
	targetId?: string;
	ownerUserId?: string;
	parentId?: string;
	routePath?: string;
};

function buildChildSafetyReportDestination(parameters: ChildSafetyHelpParameters): string {
	const queryParts: string[] = [];
	const appendParameter = (name: string, value?: string) => {
		if (value) queryParts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
	};
	appendParameter('targetType', parameters.targetType || 'other');
	appendParameter('targetId', parameters.targetId);
	appendParameter('ownerUserId', parameters.ownerUserId);
	appendParameter('parentId', parameters.parentId);
	appendParameter('routePath', parameters.routePath);
	return `/help/child-safety/report${queryParts.length ? `?${queryParts.join('&')}` : ''}`;
}

export default function HelpRoute() {
	const router = useRouter();
	const { colors } = useAppTheme();
	const { authorization } = usePageAccess();
	const isSignedIn = auth.currentUser?.emailVerified === true;
	const parameters = useLocalSearchParams<ChildSafetyHelpParameters>();
	useEffect(() => {
		if (!parameters.targetId) return;
		if (!isSignedIn) {
			router.replace({
				pathname: '/(auth)/login',
				params: { next: buildChildSafetyReportDestination(parameters) },
			});
			return;
		}
		router.replace({
			pathname: '/help/child-safety/report',
			params: { ...parameters, targetType: parameters.targetType || 'other' },
		});
	}, [isSignedIn, parameters, router]);

	const handleProtectedNavigation = (route: ProtectedHelpRoute) => {
		if (isSignedIn) {
			router.push(route as Href);
			return;
		}
		router.push({ pathname: '/(auth)/login', params: { next: route } });
	};

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
				<TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
					<Ionicons name="chevron-back" size={26} color={colors.icon} />
				</TouchableOpacity>
				<Text
					style={{
						marginLeft: 8,
						color: colors.text,
						fontSize: 20,
						fontWeight: '900',
					}}
				>
					Help & Support
				</Text>
			</View>
			<ScrollView
				contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
				keyboardShouldPersistTaps="handled"
			>
				<View
					style={{
						padding: 18,
						borderRadius: 20,
						backgroundColor: colors.successSurface,
					}}
				>
					<Ionicons name="help-buoy" size={31} color={colors.accent} />
					<Text
						style={{
							marginTop: 9,
							color: colors.text,
							fontSize: 22,
							fontWeight: '900',
						}}
					>
						How can we help?
					</Text>
					<Text
						style={{
							marginTop: 6,
							color: colors.secondaryText,
							lineHeight: 21,
						}}
					>
						Find community rules, reporting guidance, policies, and the
						confidential child-safety reporting channel.
					</Text>
					<View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
						<Ionicons name="lock-closed" size={14} color={colors.accent} />
						<Text style={{ flex: 1, marginLeft: 7, color: colors.accentText, fontSize: 12, fontWeight: '800' }}>
							Help resources are public. Sign in to open or manage reports.
						</Text>
					</View>
				</View>
				<View style={{ marginTop: 15, gap: 14 }}>
					<HelpGroup
						title="Support"
						detail="Open and continue conversations with Ourlime Support."
						colors={colors}
					>
						<HelpLink
							title="Open Support Ticket"
							detail="Start a private text and image conversation"
							icon="chatbubbles"
							onPress={() => handleProtectedNavigation('/help/tickets/new')}
							colors={colors}
							authenticationRequired={!isSignedIn}
						/>
						<HelpLink
							title="My Tickets"
							detail="Replies, status, and ticket history"
							icon="ticket"
							onPress={() => handleProtectedNavigation('/help/tickets')}
							colors={colors}
							authenticationRequired={!isSignedIn}
						/>
					</HelpGroup>

					<HelpGroup
						title="Child Safety"
						detail="Restricted reporting, case updates, and protection guidance."
						colors={colors}
						danger
					>
						<HelpLink
							title="Report a Child Safety Concern"
							detail="Submit a detailed restricted report"
							icon="warning"
							onPress={() => handleProtectedNavigation('/help/child-safety/report')}
							colors={colors}
							danger
							authenticationRequired={!isSignedIn}
						/>
						<HelpLink
							title="My Safety Reports"
							detail="Safe status, evidence, and secure updates"
							icon="shield"
							onPress={() => handleProtectedNavigation('/help/child-safety/reports')}
							colors={colors}
							danger
							authenticationRequired={!isSignedIn}
						/>
						<HelpLink
							title="Child Safety Standards"
							detail="Ourlime's child protection commitments"
							icon="shield-checkmark"
							onPress={() => router.push('/child-safety-standards')}
							colors={colors}
						/>
						<HelpLink
							title="Contact Child Safety"
							detail="ourlimechildsafety@gmail.com"
							icon="mail"
							onPress={() =>
								void Linking.openURL('mailto:ourlimechildsafety@gmail.com')
							}
							colors={colors}
						/>
					</HelpGroup>

					<HelpGroup
						title="Rules & Policies"
						detail="Understand Ourlime's platform rules and reporting process."
						colors={colors}
					>
						<HelpLink
							title="Community Guidelines"
							detail="Expected conduct and reporting guidance"
							icon="people"
							onPress={() => router.push('/policies')}
							colors={colors}
						/>
						<HelpLink
							title="Policies & Guidelines"
							detail="Privacy, terms, and platform standards"
							icon="document-text"
							onPress={() => router.push('/policies')}
							colors={colors}
						/>
					</HelpGroup>

					{authorization.isAdmin || authorization.isDeveloper ? (
						<HelpGroup
							title="Staff Workspaces"
							detail="Restricted queues for authorized Ourlime staff."
							colors={colors}
						>
							<HelpLink
								title="Support Ticket Queue"
								detail="Claim, transfer, and respond to tickets"
								icon="headset"
								onPress={() => router.push('/help/tickets/staff' as Href)}
								colors={colors}
							/>
							<HelpLink
								title="Child Safety Review"
								detail="Restricted case review and secure replies"
								icon="lock-closed"
								onPress={() => router.push('/help/child-safety/review' as Href)}
								colors={colors}
								danger
							/>
						</HelpGroup>
					) : null}
				</View>
				<View
					style={{
						marginTop: 20,
						padding: 16,
						borderRadius: 20,
						backgroundColor: colors.destructiveSurface,
					}}
				>
					<Text style={{ color: colors.destructiveText, fontWeight: '900' }}>
						Immediate danger
					</Text>
					<Text
						style={{
							marginTop: 5,
							color: colors.destructiveText,
							lineHeight: 20,
						}}
					>
						Contact local emergency services first. Never download, copy,
						forward, email, upload, or redistribute suspected child sexual abuse
						material.
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

type HelpGroupProps = {
	title: string;
	detail: string;
	children: ReactNode;
	colors: AppThemeColors;
	danger?: boolean;
};

function HelpGroup({
	title,
	detail,
	children,
	colors,
	danger = false,
}: HelpGroupProps) {
	return (
		<View
			style={{
				padding: 12,
				borderRadius: 20,
				borderWidth: 1,
				borderColor: danger ? colors.destructiveSurface : colors.border,
				backgroundColor: colors.elevated,
			}}
		>
			<View style={{ paddingHorizontal: 3, paddingTop: 2, paddingBottom: 9 }}>
				<Text
					style={{
						color: danger ? colors.destructiveText : colors.text,
						fontSize: 16,
						fontWeight: '900',
					}}
				>
					{title}
				</Text>
				<Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>
					{detail}
				</Text>
			</View>
			<View style={{ gap: 8 }}>{children}</View>
		</View>
	);
}

type HelpLinkProps = {
	title: string;
	detail: string;
	icon:
		| 'people'
		| 'document-text'
		| 'shield-checkmark'
		| 'mail'
		| 'chatbubbles'
		| 'ticket'
		| 'warning'
		| 'shield'
		| 'headset'
		| 'lock-closed';
	onPress: () => void;
	colors: AppThemeColors;
	danger?: boolean;
	authenticationRequired?: boolean;
};
function HelpLink({
	title,
	detail,
	icon,
	onPress,
	colors,
	danger = false,
	authenticationRequired = false,
}: HelpLinkProps) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				padding: 14,
				borderRadius: 16,
				borderWidth: 1,
				borderColor: danger ? colors.destructive : colors.border,
				backgroundColor: colors.surface,
			}}
		>
			<View
				style={{
					width: 42,
					height: 42,
					borderRadius: 13,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: danger
						? colors.destructiveSurface
						: colors.successSurface,
				}}
			>
				<Ionicons
					name={icon}
					size={21}
					color={danger ? colors.destructive : colors.accent}
				/>
			</View>
			<View style={{ flex: 1, marginLeft: 12 }}>
				<Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text>
				<Text style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>
					{detail}
				</Text>
				{authenticationRequired ? (
					<View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
						<Ionicons name="lock-closed" size={11} color={colors.mutedText} />
						<Text style={{ marginLeft: 4, color: colors.mutedText, fontSize: 10, fontWeight: '800' }}>
							Sign in required
						</Text>
					</View>
				) : null}
			</View>
			<Ionicons name="chevron-forward" size={18} color={colors.icon} />
		</TouchableOpacity>
	);
}
