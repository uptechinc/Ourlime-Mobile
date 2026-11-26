import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import AdminFilterSheet, { ADMIN_DATE_RANGE_LABELS, type AdminFilterSheetDateRange } from '@/components/admin/AdminFilterSheet';
import type { AnyFilterGroup, FilterValues } from '@/components/ui/FilterSheet';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminToolbarSearch = {
	value: string;
	placeholder: string;
	/** Called after the user stops typing for `debounceMs` (default 300), and immediately on clear or submit. */
	onChange: (next: string) => void;
	debounceMs?: number;
	/** Inline spinner in the field while results load; never swap the screen for a skeleton on search. */
	loading?: boolean;
};

export type AdminToolbarFilters = {
	/** Current values live on the groups (FilterGroup.value / MultiFilterGroup.values). */
	groups: AnyFilterGroup[];
	/** Called with every group's next value, from the sheet, a removed chip or "Clear all". */
	onApply: (next: FilterValues) => void;
	/** Sheet title; default "Filters". */
	title?: string;
	/** Optional date presets inside the sheet; a non-"all" preset counts as an active filter. */
	dateRange?: AdminFilterSheetDateRange;
};

export type AdminToolbarSegmentOption = { value: string; label: string; count?: number };

export type AdminToolbarSegments = {
	value: string;
	/** 2–3 mutually exclusive views of different content; not for filters. */
	options: AdminToolbarSegmentOption[];
	onChange: (value: string) => void;
};

export type AdminToolbarProps = {
	search?: AdminToolbarSearch;
	filters?: AdminToolbarFilters;
	segments?: AdminToolbarSegments;
	/** e.g. "24 of 180 records". */
	resultSummary?: string;
	/** Rare; prefer the header overflow menu. */
	trailing?: ReactNode;
};

type ActiveFilterChip = { key: string; label: string; next: () => void };

const DEFAULT_DEBOUNCE_MS = 300;

/** Every group's current value, keyed by group key. */
export function toFilterValues(groups: AnyFilterGroup[]): FilterValues {
	return groups.reduce<FilterValues>((values, group) => ({ ...values, [group.key]: group.kind === 'multiple' ? group.values : group.value }), {});
}

/** Every group's reset value (single: defaultValue, multiple: none selected). */
export function toDefaultFilterValues(groups: AnyFilterGroup[]): FilterValues {
	return groups.reduce<FilterValues>((values, group) => ({ ...values, [group.key]: group.kind === 'multiple' ? [] : group.defaultValue }), {});
}

/** How many groups differ from their default (a multi group counts once), plus a non-"all" date range. */
export function countActiveFilters(groups: AnyFilterGroup[], dateRange?: AdminFilterSheetDateRange): number {
	const groupCount = groups.filter((group) => (group.kind === 'multiple' ? group.values.length > 0 : group.value !== group.defaultValue)).length;
	return groupCount + (dateRange && dateRange.value.preset !== 'all' ? 1 : 0);
}

function ToolbarSearch({ search }: { search: AdminToolbarSearch }) {
	const { colors } = useAppTheme();
	const [text, setText] = useState(search.value);
	const lastEmittedRef = useRef(search.value);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChangeRef = useRef(search.onChange);
	onChangeRef.current = search.onChange;

	// Follow outside changes (e.g. "Clear all" from the parent) without clobbering what the user is typing.
	useEffect(() => {
		if (search.value !== lastEmittedRef.current) {
			lastEmittedRef.current = search.value;
			setText(search.value);
		}
	}, [search.value]);

	useEffect(() => () => {
		if (timerRef.current) clearTimeout(timerRef.current);
	}, []);

	const emit = (next: string) => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = null;
		if (next === lastEmittedRef.current) return;
		lastEmittedRef.current = next;
		onChangeRef.current(next);
	};

	const handleChangeText = (next: string) => {
		setText(next);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => emit(next), search.debounceMs ?? DEFAULT_DEBOUNCE_MS);
	};

	const handleClear = () => {
		setText('');
		emit('');
	};

	return (
		<View
			style={{
				flex: 1,
				minHeight: ADMIN_MIN_TOUCH,
				flexDirection: 'row',
				alignItems: 'center',
				gap: space.sm,
				paddingLeft: space.md,
				borderRadius: radius.md,
				borderWidth: 1,
				borderColor: colors.border,
				backgroundColor: colors.input,
			}}
		>
			<Icon name="search" size={16} color={colors.mutedText} />
			<TextInput
				value={text}
				onChangeText={handleChangeText}
				onSubmitEditing={() => emit(text)}
				placeholder={search.placeholder}
				placeholderTextColor={colors.mutedText}
				accessibilityLabel={search.placeholder}
				returnKeyType="search"
				autoCorrect={false}
				autoCapitalize="none"
				style={[type.body, { flex: 1, minHeight: ADMIN_MIN_TOUCH - 2, paddingVertical: 0, color: colors.text }]}
			/>
			{search.loading ? <ActivityIndicator size="small" color={colors.mutedText} style={{ marginRight: text ? 0 : space.md }} /> : null}
			{text ? (
				<AdminPressable
					onPress={handleClear}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					style={({ pressed }) => ({ width: ADMIN_MIN_TOUCH - 2, height: ADMIN_MIN_TOUCH - 2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
				>
					<Icon name="x" size={16} color={colors.icon} />
				</AdminPressable>
			) : null}
		</View>
	);
}

function ToolbarSegments({ segments }: { segments: AdminToolbarSegments }) {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	return (
		<View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }}>
			{segments.options.map((option) => {
				const selected = option.value === segments.value;
				const label = option.count === undefined ? option.label : `${option.label} · ${option.count}`;
				return (
					<AdminPressable
						key={option.value}
						onPress={() => segments.onChange(option.value)}
						accessibilityRole="tab"
						accessibilityLabel={label}
						accessibilityState={{ selected }}
						hitSlop={{ top: space.xs, bottom: space.xs }}
						style={({ pressed }) => ({
							flex: 1,
							minHeight: 36,
							alignItems: 'center',
							justifyContent: 'center',
							paddingHorizontal: space.sm,
							borderRadius: radius.sm,
							borderWidth: 1,
							borderColor: selected ? positive.border : 'transparent',
							backgroundColor: selected ? positive.soft : 'transparent',
							opacity: pressed ? 0.7 : 1,
						})}
					>
						<Text numberOfLines={1} ellipsizeMode="tail" style={[type.bodyStrong, { color: selected ? positive.text : colors.secondaryText }]}>
							{label}
						</Text>
					</AdminPressable>
				);
			})}
		</View>
	);
}

/**
 * Admin list toolbar, in order: segments, then search plus a "Filters" button with a count, then removable chips
 * for each active filter plus "Clear all", then a result summary. Keep it mounted while the list reloads.
 */
export default function AdminToolbar({ search, filters, segments, resultSummary, trailing }: AdminToolbarProps) {
	const { colors } = useAppTheme();
	const [sheetVisible, setSheetVisible] = useState(false);
	const positive = getAdminTone(colors, 'positive');
	const neutral = getAdminTone(colors, 'neutral');

	const activeCount = filters ? countActiveFilters(filters.groups, filters.dateRange) : 0;

	const chips: ActiveFilterChip[] = [];
	if (filters) {
		const current = toFilterValues(filters.groups);
		filters.groups.forEach((group) => {
			if (group.kind === 'multiple') {
				group.values.forEach((selectedValue) => {
					const optionLabel = group.options.find((option) => option.value === selectedValue)?.label ?? selectedValue;
					chips.push({
						key: `${group.key}:${selectedValue}`,
						label: optionLabel,
						next: () => filters.onApply({ ...current, [group.key]: group.values.filter((value) => value !== selectedValue) }),
					});
				});
				return;
			}
			if (group.value === group.defaultValue) return;
			chips.push({
				key: group.key,
				label: group.options.find((option) => option.value === group.value)?.label ?? group.value,
				next: () => filters.onApply({ ...current, [group.key]: group.defaultValue }),
			});
		});
		const dateRange = filters.dateRange;
		if (dateRange && dateRange.value.preset !== 'all') {
			chips.push({ key: '__dateRange', label: ADMIN_DATE_RANGE_LABELS[dateRange.value.preset], next: () => dateRange.onChange({ preset: 'all' }) });
		}
	}

	const handleClearAll = () => {
		if (!filters) return;
		filters.onApply(toDefaultFilterValues(filters.groups));
		if (filters.dateRange && filters.dateRange.value.preset !== 'all') filters.dateRange.onChange({ preset: 'all' });
	};

	const filterTone = activeCount ? positive : neutral;

	return (
		<View style={{ gap: space.sm }}>
			{segments ? <ToolbarSegments segments={segments} /> : null}

			{search || filters || trailing ? (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
					{search ? <ToolbarSearch search={search} /> : <View style={{ flex: 1 }} />}
					{filters ? (
						<AdminPressable
							onPress={() => setSheetVisible(true)}
							accessibilityRole="button"
							accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
							style={({ pressed }) => ({
								minHeight: ADMIN_MIN_TOUCH,
								flexDirection: 'row',
								alignItems: 'center',
								gap: space.sm,
								paddingHorizontal: space.md,
								borderRadius: radius.md,
								borderWidth: 1,
								borderColor: filterTone.border,
								backgroundColor: activeCount ? filterTone.soft : colors.surface,
								opacity: pressed ? 0.7 : 1,
							})}
						>
							<Icon name="sliders" size={16} color={activeCount ? positive.text : colors.icon} />
							<Text style={[type.bodyStrong, { color: activeCount ? positive.text : colors.text }]}>Filters</Text>
							{activeCount ? (
								<View style={{ minWidth: 20, height: 20, paddingHorizontal: space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: positive.border, backgroundColor: colors.surface }}>
									<Text style={[type.meta, { color: positive.text }]}>{activeCount}</Text>
								</View>
							) : null}
						</AdminPressable>
					) : null}
					{trailing}
				</View>
			) : null}

			{chips.length ? (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
					{chips.map((chip) => (
						<AdminPressable
							key={chip.key}
							onPress={chip.next}
							accessibilityRole="button"
							accessibilityLabel={`Remove filter ${chip.label}`}
							hitSlop={{ top: space.xs, bottom: space.xs }}
							style={({ pressed }) => ({
								minHeight: 36,
								flexDirection: 'row',
								alignItems: 'center',
								gap: space.xs,
								paddingLeft: space.md,
								paddingRight: space.sm,
								borderRadius: radius.pill,
								borderWidth: 1,
								borderColor: positive.border,
								backgroundColor: positive.soft,
								opacity: pressed ? 0.7 : 1,
							})}
						>
							<Text numberOfLines={1} style={[type.meta, { color: positive.text }]}>
								{chip.label}
							</Text>
							<Icon name="x" size={14} color={positive.text} />
						</AdminPressable>
					))}
					<AdminButton label="Clear all" emphasis="ghost" tone="neutral" onPress={handleClearAll} />
				</View>
			) : null}

			{resultSummary ? <Text style={[type.meta, { color: colors.mutedText }]}>{resultSummary}</Text> : null}

			{filters ? (
				<AdminFilterSheet
					visible={sheetVisible}
					title={filters.title}
					groups={filters.groups}
					dateRange={filters.dateRange}
					onApply={filters.onApply}
					onClose={() => setSheetVisible(false)}
				/>
			) : null}
		</View>
	);
}
