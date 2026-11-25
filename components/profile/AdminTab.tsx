import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminSection from '@/components/admin/AdminSection';
import { space, type AdminIconName } from '@/lib/admin/adminTokens';
import { usePendingApprovalsCount } from '@/lib/hooks/usePendingApprovalsCount';
import type { UserProfile } from '@/lib/services/AuthService';
import { formatPendingCount } from '@/lib/services/PendingApprovalsRules';

type AdminTabProps = { profile: UserProfile };

type AdminTabLink = { id: string; label: string; description: string; icon: AdminIconName; route: Href };

const ADMIN_LINKS: readonly AdminTabLink[] = [
	{ id: 'overview', label: 'Admin overview', description: 'Platform metrics and every workspace', icon: 'grid', route: '/admin' },
	{ id: 'users', label: 'User management', description: 'Roles, account status, archive and restore', icon: 'users', route: '/admin/user-management' },
	{ id: 'moderation', label: 'Content moderation', description: 'Review and resolve reported content', icon: 'flag', route: '/admin/moderation' },
	{ id: 'seller_review', label: 'Seller review', description: 'Private verification applications and decisions', icon: 'shopping-cart', route: '/admin/seller-review' as Href },
	{ id: 'page_access', label: 'Page access', description: 'Availability, maintenance and Coming Soon controls', icon: 'layers', route: '/admin/page-access' },
	{ id: 'security', label: 'Security', description: 'IP rules, whitelist and access settings', icon: 'lock', route: '/admin/security' },
];

/** The profile's admin panel: follows the app theme and links straight to the admin screens. */
export default function AdminTab({ profile }: AdminTabProps) {
	const router = useRouter();
	const pendingApprovals = usePendingApprovalsCount();
	const hasPending = pendingApprovals.total > 0;

	return (
		<View style={{ padding: space.lg }}>
			<AdminSection title="Admin control panel" description={`Signed in as @${profile.userName}`}>
				<View style={{ gap: space.sm }}>
					<AdminListRow
						title="Pending approvals"
						subtitle={hasPending ? 'Registrations, listings, reports and more' : 'Nothing waiting for approval'}
						leading={{ kind: 'icon', name: 'check-square', tone: hasPending ? 'pending' : 'neutral' }}
						status={hasPending ? { label: `${formatPendingCount(pendingApprovals.total, pendingApprovals.totalIsLowerBound)} waiting`, tone: 'pending' } : undefined}
						onPress={() => router.push('/admin/approvals' as Href)}
					/>
					{ADMIN_LINKS.map((link) => (
						<AdminListRow
							key={link.id}
							title={link.label}
							subtitle={link.description}
							leading={{ kind: 'icon', name: link.icon }}
							onPress={() => router.push(link.route)}
						/>
					))}
				</View>
			</AdminSection>
		</View>
	);
}
