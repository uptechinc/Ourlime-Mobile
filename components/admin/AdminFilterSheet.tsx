import { useMemo } from 'react';
import FilterSheet, { readSingleFilter, type AnyFilterGroup, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';

export type { AnyFilterGroup, FilterGroup, FilterValues, MultiFilterGroup } from '@/components/ui/FilterSheet';

/** Date presets only (redesign decision 7: no custom range). Rolling presets have an open end. */
export type AdminDateRangePreset = 'all' | 'today' | '24h' | '7d' | '30d' | '90d' | 'this_month';
export type AdminDateRange = { preset: AdminDateRangePreset };

export const ADMIN_DATE_RANGE_LABELS: { [preset in AdminDateRangePreset]: string } = {
	all: 'All time',
	today: 'Today',
	'24h': 'Last 24 hours',
	'7d': 'Last 7 days',
	'30d': 'Last 30 days',
	'90d': 'Last 90 days',
	this_month: 'This month',
};

/** Presets shown when a screen does not pass its own list. */
export const DEFAULT_ADMIN_DATE_PRESETS: AdminDateRangePreset[] = ['all', 'today', '7d', '30d', '90d'];

/** Group key the date range occupies inside the sheet; never collides with a screen's own group keys. */
export const ADMIN_DATE_RANGE_GROUP_KEY = '__adminDateRange';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Start and end dates for a preset. Rolling presets leave `endDate` null, so entries that arrive after the filter
 * was chosen (pull-to-refresh, refetch on focus) are not hidden. Same semantics as MobileAdminDateFilter.
 */
export function resolveAdminDateRange(range: AdminDateRange, now: Date = new Date()): { startDate: Date | null; endDate: Date | null } {
	switch (range.preset) {
		case 'today':
			return {
				startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
				endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
			};
		case '24h':
			return { startDate: new Date(now.getTime() - DAY_MS), endDate: null };
		case '7d':
			return { startDate: new Date(now.getTime() - 7 * DAY_MS), endDate: null };
		case '30d':
			return { startDate: new Date(now.getTime() - 30 * DAY_MS), endDate: null };
		case '90d':
			return { startDate: new Date(now.getTime() - 90 * DAY_MS), endDate: null };
		case 'this_month':
			return { startDate: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0), endDate: null };
		case 'all':
		default:
			return { startDate: null, endDate: null };
	}
}

const isDateRangePreset = (value: string | undefined): value is AdminDateRangePreset =>
	value !== undefined && Object.prototype.hasOwnProperty.call(ADMIN_DATE_RANGE_LABELS, value);

export type AdminFilterSheetDateRange = {
	value: AdminDateRange;
	onChange: (range: AdminDateRange) => void;
	/** Which presets to offer; default DEFAULT_ADMIN_DATE_PRESETS. 'all' is always the reset value. */
	presets?: AdminDateRangePreset[];
	/** Group heading; default "Date range". */
	label?: string;
};

export type AdminFilterSheetProps = {
	visible: boolean;
	/** Default "Filters". */
	title?: string;
	groups: AnyFilterGroup[];
	/** Optional date-range presets, shown as the last single-choice group. */
	dateRange?: AdminFilterSheetDateRange;
	/** Default "Show results". */
	applyLabel?: string;
	/** Receives the screen's own groups only (never the date range, which goes to dateRange.onChange). */
	onApply: (values: FilterValues) => void;
	onClose: () => void;
};

/** Builds the synthetic single-choice group that represents a date range inside the sheet. */
export function buildAdminDateRangeGroup(dateRange: AdminFilterSheetDateRange): FilterGroup {
	const presets = dateRange.presets ?? DEFAULT_ADMIN_DATE_PRESETS;
	const withAll: AdminDateRangePreset[] = presets.includes('all') ? presets : ['all', ...presets];
	return {
		key: ADMIN_DATE_RANGE_GROUP_KEY,
		label: dateRange.label ?? 'Date range',
		options: withAll.map((preset) => ({ value: preset, label: ADMIN_DATE_RANGE_LABELS[preset] })),
		value: dateRange.value.preset,
		defaultValue: 'all',
	};
}

/** Admin filter sheet: FilterSheet's opt-in admin variant (soft-tone chips, soft Apply) plus optional date presets. */
export default function AdminFilterSheet({ visible, title = 'Filters', groups, dateRange, applyLabel, onApply, onClose }: AdminFilterSheetProps) {
	const sheetGroups = useMemo<AnyFilterGroup[]>(() => (dateRange ? [...groups, buildAdminDateRangeGroup(dateRange)] : groups), [dateRange, groups]);

	const handleApply = (values: FilterValues) => {
		const { [ADMIN_DATE_RANGE_GROUP_KEY]: _dateValue, ...screenValues } = values;
		if (dateRange) {
			const nextPreset = readSingleFilter(values, ADMIN_DATE_RANGE_GROUP_KEY);
			if (isDateRangePreset(nextPreset) && nextPreset !== dateRange.value.preset) dateRange.onChange({ preset: nextPreset });
		}
		onApply(screenValues);
	};

	return <FilterSheet visible={visible} title={title} groups={sheetGroups} applyLabel={applyLabel} variant="admin" onApply={handleApply} onClose={onClose} />;
}
