import type { AdminIconName, AdminToneName } from '@/lib/admin/adminTokens';

/** A labelled, tone-coded action: the header primary action, a row's one inline action, an empty-state action. */
export type AdminHeaderAction = {
	key: string;
	/** Visible text and the accessibilityLabel. */
	label: string;
	icon: AdminIconName;
	/** Defaults to 'positive' for a primary action. */
	tone?: AdminToneName;
	onPress: () => void;
	disabled?: boolean;
	busy?: boolean;
};

/** One row of an AdminOverflowMenu ("⋯"). Danger items are listed last and must open an AdminDialog, never run directly. */
export type AdminOverflowItem = {
	key: string;
	label: string;
	icon?: AdminIconName;
	tone?: 'neutral' | 'danger';
	onPress: () => void;
	disabled?: boolean;
	/** One meta line, e.g. "Writes to all 40 pages". */
	description?: string;
};
