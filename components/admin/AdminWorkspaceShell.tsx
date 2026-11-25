import type { ReactNode } from 'react';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';

type AdminWorkspaceShellProps = {
	title: string;
	subtitle: string;
	children: ReactNode;
	loading: boolean;
	refreshing: boolean;
	error: string | null;
	onRefresh: () => void;
};

/**
 * Legacy admin workspace frame, now a thin wrapper over AdminScreen so existing workspaces keep working until they
 * migrate. Same props and behaviour: admin gate and lock screen, skeleton while `loading` (first load only), full
 * error with Retry, pull-to-refresh, and the canGoBack fallback to /admin. Delete once every caller uses AdminScreen.
 */
export default function AdminWorkspaceShell({ title, subtitle, children, loading, refreshing, error, onRefresh }: AdminWorkspaceShellProps) {
	const state: AdminScreenState = loading ? { kind: 'loading' } : error ? { kind: 'error', message: error } : { kind: 'ready' };
	return (
		<AdminScreen title={title} subtitle={subtitle} state={state} refreshing={refreshing} onRefresh={onRefresh}>
			{children}
		</AdminScreen>
	);
}
