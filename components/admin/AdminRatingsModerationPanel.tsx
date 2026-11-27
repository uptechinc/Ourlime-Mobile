import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import AdminDialog from './AdminDialog';
import AdminListRow from './AdminListRow';
import AdminReviewCard, { AdminReasonField } from './AdminReviewCard';
import AdminButton from './AdminButton';
import AdminState from './AdminState';
import { readSingleFilter, type AnyFilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { adminRatingModerationService, type ModerationReview, type ModerationReviewKind } from '@/lib/services/AdminRatingModerationService';
import { RATING_LIMITS, SERVICE_REVIEW_CRITERIA, SERVICE_REVIEW_CRITERIA_LABELS, type ReviewStatus } from '@/lib/types/ratings';
import { space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { settleAll } from '@/lib/utils/settleAll';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

type KindFilter = 'all' | ModerationReviewKind;
type StatusFilter = 'all' | ReviewStatus;

const KIND_FILTERS: readonly KindFilter[] = ['all', 'service', 'product'];
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'published', 'hidden'];
const KIND_FILTER_LABELS: { [kind in KindFilter]: string } = { all: 'All ratings', service: 'Service ratings', product: 'Product reviews' };
const STATUS_FILTER_LABELS: { [status in StatusFilter]: string } = { all: 'Any status', published: 'Published', hidden: 'Hidden' };
const KIND_LABELS: { [kind in ModerationReviewKind]: string } = { service: 'Service rating', product: 'Product review' };

const rowKey = (review: ModerationReview): string => `${review.kind}:${review.id}`;
const targetKey = (kind: ModerationReviewKind, targetId: string): string => `${kind}:${targetId}`;
const starText = (stars: number): string => {
	const whole = Math.max(0, Math.min(5, Math.round(stars)));
	return `${'★'.repeat(whole)}${'☆'.repeat(5 - whole)}`;
};
const statusPill = (status: ReviewStatus): { label: string; tone: AdminToneName } => (status === 'published' ? { label: 'Published', tone: 'positive' } : { label: 'Hidden', tone: 'danger' });
const formatDate = (ms: number | null, withTime = false): string => {
	if (!ms) return '';
	const date = new Date(ms);
	return withTime ? date.toLocaleString() : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export type RatingModerationController = {
	reviews: ModerationReview[];
	filteredReviews: ModerationReview[];
	targetNames: { [key: string]: string };
	loading: boolean;
	refreshing: boolean;
	error: string;
	searchQuery: string;
	setSearchQuery: (next: string) => void;
	isFiltered: boolean;
	/** Kind and Status groups for the toolbar's Filters sheet. */
	filterGroups: AnyFilterGroup[];
	applyFilters: (values: FilterValues) => void;
	clearFilters: () => void;
	reload: (mode?: 'initial' | 'refresh') => Promise<void>;
	replaceReview: (key: string, update: (review: ModerationReview) => ModerationReview) => void;
};

/** Data and filters for the Ratings tab. Loads lazily the first time `enabled` is true (the tab opens). */
export function useRatingModeration(enabled: boolean): RatingModerationController {
	const [reviews, setReviews] = useState<ModerationReview[]>([]);
	const [targetNames, setTargetNames] = useState<{ [key: string]: string }>({});
	const [kindFilter, setKindFilter] = useState<KindFilter>('all');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const hasLoadedRef = useRef(false);
	/** Ignores a slower, older response so it cannot overwrite a newer one. */
	const requestRef = useRef(0);

	const resolveNames = useCallback(async (loaded: ModerationReview[]) => {
		const unique = new Map<string, ModerationReview>();
		loaded.forEach((review) => {
			if (review.targetId) unique.set(targetKey(review.kind, review.targetId), review);
		});
		const entries = Array.from(unique.entries());
		const names = await settleAll(entries.map(([, review]) => adminRatingModerationService.resolveTargetName(review.kind, review.targetId)));
		const resolved: { [key: string]: string } = {};
		names.forEach((result, index) => {
			if (result.status === 'fulfilled' && result.value) resolved[entries[index][0]] = result.value;
		});
		setTargetNames((current) => ({ ...current, ...resolved }));
	}, []);

	const reload = useCallback(
		async (mode: 'initial' | 'refresh' = 'initial') => {
			const requestId = requestRef.current + 1;
			requestRef.current = requestId;
			if (mode === 'refresh') setRefreshing(true);
			else setLoading(true);
			try {
				const [serviceResult, productResult] = await settleAll([adminRatingModerationService.listRecent('service'), adminRatingModerationService.listRecent('product')]);
				if (requestRef.current !== requestId) return;
				const loaded = [...(serviceResult.status === 'fulfilled' ? serviceResult.value : []), ...(productResult.status === 'fulfilled' ? productResult.value : [])].sort(
					(first, second) => second.createdAtMs - first.createdAtMs
				);
				const failures = [
					serviceResult.status === 'rejected' ? `Service ratings: ${serviceResult.reason instanceof Error ? serviceResult.reason.message : 'could not be loaded'}` : '',
					productResult.status === 'rejected' ? `Product reviews: ${productResult.reason instanceof Error ? productResult.reason.message : 'could not be loaded'}` : '',
				].filter(Boolean);
				if (failures.length) console.error('[AdminRatingsModerationPanel.reload] Error:', failures.join(' | '));
				setReviews(loaded);
				setError(failures.join(' · '));
				void resolveNames(loaded);
			} finally {
				if (requestRef.current === requestId) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		},
		[resolveNames]
	);

	useEffect(() => {
		if (!enabled || hasLoadedRef.current) return;
		hasLoadedRef.current = true;
		void reload('initial');
	}, [enabled, reload]);

	const filteredReviews = useMemo(() => {
		const normalized = searchQuery.trim().toLowerCase();
		return reviews.filter((review) => {
			if (kindFilter !== 'all' && review.kind !== kindFilter) return false;
			if (statusFilter !== 'all' && review.status !== statusFilter) return false;
			if (!normalized) return true;
			const targetName = targetNames[targetKey(review.kind, review.targetId)] ?? '';
			return [review.reviewerName, review.comment, review.title, targetName, review.targetId, review.reviewerId].some((value) => value.toLowerCase().includes(normalized));
		});
	}, [kindFilter, reviews, searchQuery, statusFilter, targetNames]);

	const filterGroups: AnyFilterGroup[] = [
		{ key: 'kind', label: 'Kind', options: KIND_FILTERS.map((value) => ({ value, label: KIND_FILTER_LABELS[value] })), value: kindFilter, defaultValue: 'all' },
		{ key: 'status', label: 'Status', options: STATUS_FILTERS.map((value) => ({ value, label: STATUS_FILTER_LABELS[value] })), value: statusFilter, defaultValue: 'all' },
	];

	const applyFilters = (values: FilterValues) => {
		setKindFilter(KIND_FILTERS.find((value) => value === readSingleFilter(values, 'kind')) ?? 'all');
		setStatusFilter(STATUS_FILTERS.find((value) => value === readSingleFilter(values, 'status')) ?? 'all');
	};

	const clearFilters = () => {
		setKindFilter('all');
		setStatusFilter('all');
		setSearchQuery('');
	};

	const replaceReview = useCallback((key: string, update: (review: ModerationReview) => ModerationReview) => {
		setReviews((current) => current.map((review) => (rowKey(review) === key ? update(review) : review)));
	}, []);

	return {
		reviews,
		filteredReviews,
		targetNames,
		loading,
		refreshing,
		error,
		searchQuery,
		setSearchQuery,
		isFiltered: kindFilter !== 'all' || statusFilter !== 'all' || Boolean(searchQuery.trim()),
		filterGroups,
		applyFilters,
		clearFilters,
		reload,
		replaceReview,
	};
}

/**
 * The Ratings moderation tab (website: Moderation > Ratings): the newest E-Hub service ratings and product reviews,
 * every status. Tapping a row expands its detail with Hide (reason required, AdminDialog) or Publish again.
 */
export default function AdminRatingsModerationPanel({ controller }: { controller: RatingModerationController }) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const { filteredReviews, reviews, error, reload, refreshing, targetNames, replaceReview } = controller;
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const [processingKey, setProcessingKey] = useState<string | null>(null);
	const [hideTarget, setHideTarget] = useState<ModerationReview | null>(null);
	const [hideReason, setHideReason] = useState('');
	const [hideError, setHideError] = useState<string | null>(null);
	const [rowErrors, setRowErrors] = useState<{ [key: string]: string }>({});
	/** Synchronous double-submit guard (state updates land a frame later). */
	const processingRef = useRef(false);

	const targetName = (review: ModerationReview): string => targetNames[targetKey(review.kind, review.targetId)] ?? review.targetId;

	const moderate = async (review: ModerationReview, status: ReviewStatus, reason?: string): Promise<boolean> => {
		if (processingRef.current) return false;
		processingRef.current = true;
		const key = rowKey(review);
		setProcessingKey(key);
		setRowErrors((current) => ({ ...current, [key]: '' }));
		try {
			const trimmed = reason?.trim() || undefined;
			const result = await adminRatingModerationService.moderate(review.kind, { reviewId: review.id, status, reason: trimmed });
			replaceReview(key, (item) => ({ ...item, status: result.review.status, moderationReason: status === 'hidden' ? trimmed ?? null : null, moderatedAtMs: Date.now() }));
			void interactionFeedbackService.play('success');
			toast.success(status === 'hidden' ? 'Review hidden. Averages were recalculated.' : 'Review published again. Averages were recalculated.');
			return true;
		} catch (moderateError: unknown) {
			void interactionFeedbackService.play('warning');
			const message = moderateError instanceof Error ? moderateError.message : 'The review could not be updated.';
			if (status === 'hidden') setHideError(message);
			else {
				setRowErrors((current) => ({ ...current, [key]: message }));
				toast.error(message);
			}
			return false;
		} finally {
			processingRef.current = false;
			setProcessingKey(null);
		}
	};

	const confirmHide = async () => {
		if (!hideTarget || !hideReason.trim()) return;
		setHideError(null);
		const done = await moderate(hideTarget, 'hidden', hideReason);
		if (done) {
			setHideTarget(null);
			setHideReason('');
		}
	};

	const openTarget = (review: ModerationReview) => {
		if (review.kind === 'service') router.push({ pathname: '/ehub/providers/[providerId]', params: { providerId: review.targetId } });
		else router.push({ pathname: '/ehub/products/[productId]', params: { productId: review.targetId } });
	};

	return (
		<View style={{ gap: space.md }}>
			<Text style={[type.meta, { color: colors.mutedText }]}>The newest E-Hub service ratings and product reviews, including hidden ones. Hiding or publishing again recalculates the averages.</Text>
			{error ? <AdminState kind="inlineError" message={error} onRetry={() => void reload('refresh')} retrying={refreshing} /> : null}

			{filteredReviews.length ? (
				<View style={{ gap: space.sm }}>
					{filteredReviews.map((review) => {
						const key = rowKey(review);
						const isExpanded = expandedKey === key;
						return (
							<View key={key} style={{ gap: space.xs }}>
								<AdminListRow
									title={review.reviewerName}
									subtitle={`${starText(review.stars)} · ${targetName(review)}`}
									meta={[KIND_LABELS[review.kind], formatDate(review.createdAtMs), review.title || review.comment].filter(Boolean).join(' · ')}
									leading={{ kind: 'avatar', uri: review.reviewerAvatar ?? undefined, name: review.reviewerName, userId: review.reviewerId || undefined }}
									status={statusPill(review.status)}
									onPress={() => setExpandedKey(isExpanded ? null : key)}
									accessibilityHint={isExpanded ? 'Hides the review detail' : 'Shows the full review and actions'}
								/>
								{isExpanded ? (
									<ReviewDetail
										review={review}
										targetName={targetName(review)}
										busy={processingKey === key}
										disabled={Boolean(processingKey)}
										error={rowErrors[key] || undefined}
										onOpenTarget={() => openTarget(review)}
										onHide={() => {
											setHideError(null);
											setHideReason('');
											setHideTarget(review);
										}}
										onPublish={() => void moderate(review, 'published')}
									/>
								) : null}
							</View>
						);
					})}
				</View>
			) : reviews.length && controller.isFiltered ? (
				<AdminState kind="empty" title="" filtered onClearFilters={controller.clearFilters} />
			) : error ? null : (
				<AdminState kind="empty" icon="star" title="No ratings yet" description="New E-Hub service ratings and product reviews appear here." />
			)}

			<AdminDialog
				visible={Boolean(hideTarget)}
				tone="danger"
				icon="eye-off"
				title="Hide this review?"
				description={hideTarget ? `The ${KIND_LABELS[hideTarget.kind].toLowerCase()} by ${hideTarget.reviewerName} on ${targetName(hideTarget)} stops showing to members, and the average is recalculated without it.` : ''}
				confirmLabel={processingKey ? 'Hiding…' : 'Hide review'}
				busy={Boolean(processingKey)}
				confirmDisabled={!hideReason.trim()}
				onConfirm={() => void confirmHide()}
				onClose={() => {
					if (processingRef.current) return;
					setHideTarget(null);
					setHideReason('');
				}}
			>
				<AdminReasonField
					label="Reason (required)"
					value={hideReason}
					onChangeText={setHideReason}
					placeholder="For example: abusive language, or not about this provider."
					maxLength={RATING_LIMITS.moderationReason}
					editable={!processingKey}
					error={hideError}
				/>
			</AdminDialog>
		</View>
	);
}

type ReviewDetailProps = {
	review: ModerationReview;
	targetName: string;
	busy: boolean;
	disabled: boolean;
	error?: string;
	onOpenTarget: () => void;
	onHide: () => void;
	onPublish: () => void;
};

/** The expanded part of a rating row: full text, criteria, service used, the public page and the decision. */
function ReviewDetail({ review, targetName, busy, disabled, error, onOpenTarget, onHide, onPublish }: ReviewDetailProps) {
	const { colors } = useAppTheme();
	const criteria = review.criteria
		? SERVICE_REVIEW_CRITERIA.flatMap((key) => {
				const score = review.criteria?.[key];
				return typeof score === 'number' && score >= 1 ? [{ label: SERVICE_REVIEW_CRITERIA_LABELS[key], value: `${starText(score)}  ${score}/5` }] : [];
			})
		: [];
	const details = [
		{ label: review.kind === 'service' ? 'Provider' : 'Product', value: targetName },
		{ label: 'Rating', value: `${starText(review.stars)}  ${review.stars}/5` },
		{ label: 'Headline', value: review.title },
		{ label: 'Comment', value: review.comment || 'No written comment.' },
		...(review.kind === 'service'
			? [
					{ label: 'Service used', value: review.serviceUsed || 'Not given' },
					{ label: 'Would recommend', value: review.wouldRecommend === null ? 'Not answered' : review.wouldRecommend ? 'Yes' : 'No' },
				]
			: [{ label: 'Verified customer', value: review.verifiedCustomer ? 'Yes' : 'No' }]),
		...(review.status === 'hidden' ? [{ label: `Hidden${review.moderatedAtMs ? ` · ${formatDate(review.moderatedAtMs, true)}` : ''}`, value: review.moderationReason || 'No reason recorded.' }] : []),
	];
	return (
		<AdminReviewCard
			title={KIND_LABELS[review.kind]}
			subtitle={`${review.reviewerName} · ${formatDate(review.createdAtMs, true)}`}
			meta={`Review ${review.id}`}
			status={statusPill(review.status)}
			details={details}
			error={error}
			inlineAction={
				review.status === 'published'
					? { key: 'hide', label: 'Hide', icon: 'eye-off', tone: 'danger', disabled, onPress: onHide }
					: { key: 'publish', label: busy ? 'Publishing…' : 'Publish again', icon: 'rotate-ccw', tone: 'positive', busy, disabled, onPress: onPublish }
			}
		>
			{criteria.length ? (
				<View style={{ gap: space.xs }}>
					<Text style={[type.label, { color: colors.mutedText }]}>Criteria</Text>
					{criteria.map((criterion) => (
						<View key={criterion.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
							<Text style={[type.body, { color: colors.secondaryText, flex: 1 }]}>{criterion.label}</Text>
							<Text style={[type.body, { color: colors.text }]}>{criterion.value}</Text>
						</View>
					))}
				</View>
			) : review.kind === 'service' ? (
				<Text style={[type.meta, { color: colors.mutedText }]}>No criteria were rated.</Text>
			) : null}
			<AdminButton label={review.kind === 'service' ? 'Open provider page' : 'Open product page'} icon="external-link" emphasis="ghost" onPress={onOpenTarget} />
		</AdminReviewCard>
	);
}
