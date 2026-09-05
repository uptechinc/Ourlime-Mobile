import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import CustomModal from '@/components/ui/CustomModal';
import UserAvatar from '@/components/ui/UserAvatar';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { AuthService } from '@/lib/services/AuthService';
import {
	AdminModerationService,
	type AdminModerationAction,
	type AdminModerationReport,
} from '@/lib/services/AdminModerationService';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const moderationService = AdminModerationService.getInstance();
const postService = PostService.getInstance();
const authService = AuthService.getInstance();
const ACTIONS: readonly {
	id: AdminModerationAction;
	label: string;
	group: 'resolution' | 'content' | 'account' | 'escalation';
}[] = [
	{ id: 'dismiss', label: 'Dismiss report', group: 'resolution' },
	{
		id: 'resolved_no_violation',
		label: 'Resolve — no violation',
		group: 'resolution',
	},
	{ id: 'content_removed', label: 'Remove content', group: 'content' },
	{ id: 'content_hidden', label: 'Hide content temporarily', group: 'content' },
	{ id: 'content_restored', label: 'Restore content', group: 'content' },
	{ id: 'content_restricted', label: 'Restrict visibility', group: 'content' },
	{ id: 'commenting_disabled', label: 'Disable commenting', group: 'content' },
	{
		id: 'advertisement_removed',
		label: 'Delete advertisement',
		group: 'content',
	},
	{ id: 'warning_issued', label: 'Issue warning', group: 'account' },
	{ id: 'posting_disabled', label: 'Disable posting', group: 'account' },
	{ id: 'messaging_disabled', label: 'Disable messaging', group: 'account' },
	{ id: 'account_suspended', label: 'Suspend account', group: 'account' },
	{
		id: 'account_temp_banned',
		label: 'Temporarily ban account',
		group: 'account',
	},
	{
		id: 'account_perma_banned',
		label: 'Permanently ban account',
		group: 'account',
	},
	{
		id: 'account_restricted',
		label: 'Restrict account features',
		group: 'account',
	},
	{
		id: 'profile_picture_removed',
		label: 'Remove profile picture',
		group: 'account',
	},
	{ id: 'username_removed', label: 'Remove username', group: 'account' },
	{ id: 'bio_removed', label: 'Remove bio', group: 'account' },
	{
		id: 'escalated_senior_review',
		label: 'Escalate to senior review',
		group: 'escalation',
	},
	{
		id: 'requested_info',
		label: 'Request more information',
		group: 'escalation',
	},
	{
		id: 'referred_legal',
		label: 'Refer to legal / safety',
		group: 'escalation',
	},
];

type TargetContentState = {
	loading: boolean;
	error: string | null;
	found: boolean;
	kind: string;
	title?: string;
	content?: string;
	author?: {
		id?: string;
		name: string;
		username: string;
		profileImage?: string | null;
	};
	media?: {
		url: string;
		type: 'image' | 'video';
		thumbnailUrl?: string;
	}[];
	stats?: {
		likes?: number;
		comments?: number;
		shares?: number;
	};
	pollOptions?: { text: string; votes: number }[];
	destinationRoute?: string;
	parentPostId?: string;
	rawPost?: PostItem | null;
};

type UserSummary = {
	id: string;
	name: string;
	username: string;
	profileImage?: string | null;
};

export default function AdminReportDetailRoute() {
	const router = useRouter();
	const { colors } = useAppTheme();
	const { reportId } = useLocalSearchParams<{ reportId?: string }>();
	const { authorization, loading: accessLoading } = usePageAccess();
	const [report, setReport] = useState<AdminModerationReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [targetContent, setTargetContent] = useState<TargetContentState | null>(null);
	const [reportedUserData, setReportedUserData] = useState<UserSummary | null>(null);
	const [reporterUserData, setReporterUserData] = useState<UserSummary | null>(null);
	const [commentsModalOpen, setCommentsModalOpen] = useState(false);
	const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);
	const [selectedAction, setSelectedAction] =
		useState<AdminModerationAction | null>(null);
	const [reason, setReason] = useState('');
	const [durationDays, setDurationDays] = useState('7');
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const loadTargetDetails = useCallback(async (reportItem: AdminModerationReport) => {
		const { contentType, targetId, parentContentId, targetSnapshot, routePath, reportedUserId, reporterId } = reportItem;
		const normalizedType = (contentType || 'post').toLowerCase();

		setTargetContent({
			loading: true,
			error: null,
			found: false,
			kind: normalizedType,
		});

		// Fetch reported user and reporter profiles in parallel
		if (reportedUserId) {
			void (async () => {
				try {
					const uSnap = await getDoc(doc(db, 'users', reportedUserId));
					if (uSnap.exists()) {
						const d = uSnap.data() || {};
						setReportedUserData({
							id: reportedUserId,
							name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.userName || 'User',
							username: typeof d.userName === 'string' ? d.userName : '',
							profileImage: typeof d.profileImage === 'string' ? d.profileImage : null,
						});
					}
				} catch {}
			})();
		}
		if (reporterId) {
			void (async () => {
				try {
					const uSnap = await getDoc(doc(db, 'users', reporterId));
					if (uSnap.exists()) {
						const d = uSnap.data() || {};
						setReporterUserData({
							id: reporterId,
							name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.userName || 'User',
							username: typeof d.userName === 'string' ? d.userName : '',
							profileImage: typeof d.profileImage === 'string' ? d.profileImage : null,
						});
					}
				} catch {}
			})();
		}

		try {
			// 1. POST (also limes, reels, community posts)
			if (
				normalizedType === 'post' ||
				normalizedType === 'lime' ||
				normalizedType === 'reel' ||
				normalizedType === 'community_post'
			) {
				try {
					const post = await postService.fetchPost(targetId);
					if (post) {
						setTargetContent({
							loading: false,
							error: null,
							found: true,
							kind: 'post',
							title: post.caption ? (post.caption.length > 50 ? post.caption.slice(0, 50) + '…' : post.caption) : undefined,
							content: post.description || post.caption || '',
							author: {
								id: post.userId,
								name: `${post.user.firstName} ${post.user.lastName}`.trim() || post.user.userName,
								username: post.user.userName,
								profileImage: post.user.profileImage,
							},
							media: (post.media || []).map((m) => ({
								url: m.typeUrl,
								type: m.type,
								thumbnailUrl: m.thumbnailUrl,
							})),
							stats: {
								likes: post.stats.likes,
								comments: post.stats.comments,
								shares: post.stats.shares,
							},
							pollOptions: post.pollOptions?.map((p) => ({ text: p.text, votes: p.votes })),
							destinationRoute: `/post/${targetId}`,
							rawPost: post,
						});
						return;
					}
				} catch {
					// Fall through to Firestore document check
				}

				const snap = await getDoc(doc(db, 'feedPosts', targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const caption = typeof data.caption === 'string' ? data.caption : '';
					const description = typeof data.description === 'string' ? data.description : '';
					const userId = typeof data.userId === 'string' ? data.userId : '';
					let authorName = 'Ourlime user';
					let authorUsername = '';
					let authorAvatar: string | undefined = undefined;
					if (userId) {
						try {
							const uSnap = await getDoc(doc(db, 'users', userId));
							if (uSnap.exists()) {
								const uData = uSnap.data() || {};
								authorName = `${uData.firstName || ''} ${uData.lastName || ''}`.trim() || uData.userName || 'Ourlime user';
								authorUsername = typeof uData.userName === 'string' ? uData.userName : '';
								authorAvatar = typeof uData.profileImage === 'string' ? uData.profileImage : undefined;
							}
						} catch {}
					}
					const mediaList: { url: string; type: 'image' | 'video'; thumbnailUrl?: string }[] = [];
					if (Array.isArray(data.media)) {
						for (const item of data.media) {
							if (typeof item === 'object' && item !== null) {
								const itemObj = item as Record<string, unknown>;
								const typeUrl = typeof itemObj.typeUrl === 'string' ? itemObj.typeUrl : typeof itemObj.url === 'string' ? itemObj.url : '';
								if (typeUrl) {
									mediaList.push({
										url: typeUrl,
										type: itemObj.type === 'video' ? 'video' : 'image',
										thumbnailUrl: typeof itemObj.thumbnailUrl === 'string' ? itemObj.thumbnailUrl : undefined,
									});
								}
							}
						}
					}
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'post',
						content: description || caption || '',
						author: {
							id: userId,
							name: authorName,
							username: authorUsername,
							profileImage: authorAvatar,
						},
						media: mediaList,
						stats: {
							likes: typeof data.likeCount === 'number' ? data.likeCount : 0,
							comments: typeof data.commentCount === 'number' ? data.commentCount : 0,
							shares: typeof data.shareCount === 'number' ? data.shareCount : 0,
						},
						destinationRoute: `/post/${targetId}`,
					});
					return;
				}

				if (targetSnapshot) {
					setTargetContent({
						loading: false,
						error: null,
						found: false,
						kind: 'post',
						content: typeof targetSnapshot.content === 'string' ? targetSnapshot.content : undefined,
						destinationRoute: `/post/${targetId}`,
					});
					return;
				}

				setTargetContent({
					loading: false,
					error: null,
					found: false,
					kind: 'post',
					destinationRoute: `/post/${targetId}`,
				});
				return;
			}

			// 2. COMMENT or REPLY
			if (normalizedType === 'comment' || normalizedType === 'reply') {
				const collName = normalizedType === 'reply' ? 'feedsPostCommentsReplies' : 'feedsPostComments';
				const snap = await getDoc(doc(db, collName, targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const commentText = typeof data.comment === 'string' ? data.comment : typeof data.reply === 'string' ? data.reply : '';
					const userId = typeof data.userId === 'string' ? data.userId : '';
					const parentPostIdResolved = typeof data.feedsPostId === 'string' ? data.feedsPostId : parentContentId || undefined;
					let authorName = 'Ourlime user';
					let authorUsername = '';
					let authorAvatar: string | undefined = undefined;
					if (userId) {
						try {
							const uSnap = await getDoc(doc(db, 'users', userId));
							if (uSnap.exists()) {
								const uData = uSnap.data() || {};
								authorName = `${uData.firstName || ''} ${uData.lastName || ''}`.trim() || uData.userName || 'Ourlime user';
								authorUsername = typeof uData.userName === 'string' ? uData.userName : '';
								authorAvatar = typeof uData.profileImage === 'string' ? uData.profileImage : undefined;
							}
						} catch {}
					}
					let stickerUrl: string | undefined = undefined;
					if (data.sticker && typeof data.sticker === 'object') {
						const s = data.sticker as Record<string, unknown>;
						if (typeof s.imageUrl === 'string') stickerUrl = s.imageUrl;
					}
					let rawParentPost: PostItem | null = null;
					if (parentPostIdResolved) {
						try {
							rawParentPost = await postService.fetchPost(parentPostIdResolved);
						} catch {}
					}
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: normalizedType,
						content: commentText,
						author: {
							id: userId,
							name: authorName,
							username: authorUsername,
							profileImage: authorAvatar,
						},
						media: stickerUrl ? [{ url: stickerUrl, type: 'image' }] : [],
						parentPostId: parentPostIdResolved,
						rawPost: rawParentPost,
						destinationRoute: parentPostIdResolved
							? `/post/${parentPostIdResolved}?openComments=true&commentId=${targetId}`
							: undefined,
					});
					return;
				}

				if (targetSnapshot) {
					const postId = typeof targetSnapshot.postId === 'string' ? targetSnapshot.postId : undefined;
					setTargetContent({
						loading: false,
						error: null,
						found: false,
						kind: normalizedType,
						content: typeof targetSnapshot.content === 'string' ? targetSnapshot.content : undefined,
						parentPostId: postId,
						destinationRoute: postId ? `/post/${postId}` : undefined,
					});
					return;
				}

				setTargetContent({ loading: false, error: null, found: false, kind: normalizedType });
				return;
			}

			// 3. USER / PROFILE
			if (
				normalizedType === 'user' ||
				normalizedType === 'profile' ||
				normalizedType === 'profile_picture' ||
				normalizedType === 'username' ||
				normalizedType === 'bio'
			) {
				const snap = await getDoc(doc(db, 'users', targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.userName || 'User';
					const username = typeof data.userName === 'string' ? data.userName : '';
					const avatar = typeof data.profileImage === 'string' ? data.profileImage : undefined;
					const bio = typeof data.bio === 'string' ? data.bio : '';
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'user',
						title: name,
						content: bio ? `Bio: ${bio}` : undefined,
						author: { id: targetId, name, username, profileImage: avatar },
						destinationRoute: username ? `/profile/${username}` : undefined,
					});
					return;
				}
				setTargetContent({ loading: false, error: null, found: false, kind: 'user' });
				return;
			}

			// 4. COMMUNITY / GROUP
			if (normalizedType === 'community' || normalizedType === 'group') {
				let snap = await getDoc(doc(db, 'communityVariant', targetId));
				if (!snap.exists()) {
					snap = await getDoc(doc(db, 'communities', targetId));
				}
				if (snap.exists()) {
					const data = snap.data() || {};
					const name = typeof data.name === 'string' ? data.name : typeof data.title === 'string' ? data.title : 'Community';
					const desc = typeof data.description === 'string' ? data.description : '';
					const avatar = typeof data.avatar === 'string' ? data.avatar : typeof data.icon === 'string' ? data.icon : undefined;
					const memberCount = typeof data.memberCount === 'number' ? data.memberCount : undefined;
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'community',
						title: name,
						content: desc,
						author: { name, username: typeof data.category === 'string' ? data.category : '', profileImage: avatar },
						stats: { likes: memberCount },
						destinationRoute: `/communities/${targetId}`,
					});
					return;
				}
				setTargetContent({ loading: false, error: null, found: false, kind: 'community', destinationRoute: `/communities/${targetId}` });
				return;
			}

			// 5. BLOG / BLOG_COMMENT
			if (normalizedType === 'blog' || normalizedType === 'blog_comment') {
				const snap = await getDoc(doc(db, 'blogsAndArticles', targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const title = typeof data.title === 'string' ? data.title : 'Blog Article';
					const content = typeof data.content === 'string' ? data.content : typeof data.summary === 'string' ? data.summary : '';
					const coverImage = typeof data.coverImage === 'string' ? data.coverImage : typeof data.thumbnail === 'string' ? data.thumbnail : undefined;
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'blog',
						title,
						content,
						media: coverImage ? [{ url: coverImage, type: 'image' }] : [],
						destinationRoute: `/blogs/${targetId}`,
					});
					return;
				}
				setTargetContent({ loading: false, error: null, found: false, kind: 'blog', destinationRoute: `/blogs/${targetId}` });
				return;
			}

			// 6. EVENT
			if (normalizedType === 'event' || normalizedType === 'event_comment') {
				let snap = await getDoc(doc(db, 'eventVariant', targetId));
				if (!snap.exists()) snap = await getDoc(doc(db, 'events', targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const title = typeof data.title === 'string' ? data.title : typeof data.name === 'string' ? data.name : 'Event';
					const desc = typeof data.description === 'string' ? data.description : '';
					const banner = typeof data.imageUrl === 'string' ? data.imageUrl : typeof data.bannerUrl === 'string' ? data.bannerUrl : undefined;
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'event',
						title,
						content: desc,
						media: banner ? [{ url: banner, type: 'image' }] : [],
						destinationRoute: `/events?targetId=${targetId}`,
					});
					return;
				}
				setTargetContent({ loading: false, error: null, found: false, kind: 'event', destinationRoute: `/events?targetId=${targetId}` });
				return;
			}

			// 7. MARKETPLACE / PRODUCT
			if (normalizedType === 'marketplace_listing' || normalizedType === 'product') {
				let snap = await getDoc(doc(db, 'marketplace', targetId));
				if (!snap.exists()) snap = await getDoc(doc(db, 'products', targetId));
				if (snap.exists()) {
					const data = snap.data() || {};
					const title = typeof data.title === 'string' ? data.title : typeof data.name === 'string' ? data.name : 'Product';
					const desc = typeof data.description === 'string' ? data.description : '';
					const price = typeof data.price === 'number' ? `$${data.price}` : typeof data.price === 'string' ? data.price : '';
					const images = Array.isArray(data.images) ? data.images.filter((i): i is string => typeof i === 'string') : [];
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'marketplace_listing',
						title: price ? `${title} — ${price}` : title,
						content: desc,
						media: images.map((url) => ({ url, type: 'image' })),
						destinationRoute: `/market?productId=${targetId}`,
					});
					return;
				}
				setTargetContent({ loading: false, error: null, found: false, kind: 'marketplace_listing', destinationRoute: `/market?productId=${targetId}` });
				return;
			}

			// 8. CHAT MESSAGE
			if (normalizedType === 'chat_message' || normalizedType === 'message') {
				if (targetSnapshot) {
					setTargetContent({
						loading: false,
						error: null,
						found: true,
						kind: 'chat_message',
						content: typeof targetSnapshot.message === 'string' ? targetSnapshot.message : '',
						destinationRoute: reportItem.chatId ? `/chat/${reportItem.chatId}` : undefined,
					});
					return;
				}
				setTargetContent({
					loading: false,
					error: null,
					found: false,
					kind: 'chat_message',
					destinationRoute: reportItem.chatId ? `/chat/${reportItem.chatId}` : undefined,
				});
				return;
			}

			// Fallback generic
			setTargetContent({
				loading: false,
				error: null,
				found: Boolean(targetSnapshot),
				kind: normalizedType,
				content: targetSnapshot && typeof targetSnapshot.content === 'string' ? targetSnapshot.content : undefined,
				destinationRoute: routePath || undefined,
			});
		} catch (err: unknown) {
			console.error('[AdminReport] Failed to load target content:', err);
			setTargetContent({
				loading: false,
				error: err instanceof Error ? err.message : 'Could not load reported content',
				found: false,
				kind: normalizedType,
			});
		}
	}, []);

	const load = useCallback(async () => {
		if (!reportId) {
			setError('Report ID is missing.');
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const fetchedReport = await moderationService.fetchReport(reportId);
			setReport(fetchedReport);
			void loadTargetDetails(fetchedReport);
		} catch (loadError: unknown) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Report could not be loaded.'
			);
		} finally {
			setLoading(false);
		}
	}, [loadTargetDetails, reportId]);
	useEffect(() => {
		if (!accessLoading && authorization.isAdmin) void load();
	}, [accessLoading, authorization.isAdmin, load]);
	const handleAction = async () => {
		if (!report || !selectedAction || !reason.trim() || busy) return;
		const days = Number(durationDays);
		const durationMs =
			Number.isFinite(days) && days > 0 ? days * 86_400_000 : undefined;
		setBusy(true);
		try {
			await moderationService.takeAction(
				report.id,
				selectedAction,
				reason,
				durationMs
			);
			setMessage(
				'Moderation action applied through the secure server workflow.'
			);
			setSelectedAction(null);
			await load();
		} catch (actionError: unknown) {
			setMessage(
				actionError instanceof Error
					? actionError.message
					: 'Moderation action failed.'
			);
		} finally {
			setBusy(false);
		}
	};
	const handleDelete = async () => {
		if (!report || busy) return;
		setBusy(true);
		try {
			await moderationService.deleteReport(report.id);
			router.back();
		} catch (deleteError: unknown) {
			setMessage(
				deleteError instanceof Error
					? deleteError.message
					: 'Report could not be deleted.'
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={{ flex: 1, backgroundColor: colors.canvas }}
		>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					padding: 15,
					backgroundColor: colors.navigation,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
				}}
			>
				<TouchableOpacity onPress={() => router.back()}>
					<Icon name="arrow-left" size={23} color={colors.icon} />
				</TouchableOpacity>
				<Text
					style={{
						flex: 1,
						marginLeft: 12,
						fontSize: 19,
						fontWeight: '900',
						color: colors.text,
					}}
				>
					Report Review
				</Text>
				<TouchableOpacity
					disabled={!report || busy}
					onPress={() => void handleDelete()}
				>
					<Icon name="trash-2" size={20} color={colors.destructive} />
				</TouchableOpacity>
			</View>
			{accessLoading || loading ? (
				<View
					style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
				>
					<ActivityIndicator size="large" color={colors.accent} />
				</View>
			) : !authorization.isAdmin ? (
				<View
					style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
				>
					<Icon name="lock" size={38} color={colors.destructive} />
					<Text
						style={{ marginTop: 12, fontWeight: '900', color: colors.text }}
					>
						Admin access required
					</Text>
				</View>
			) : error ? (
				<View
					style={{
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						padding: 24,
					}}
				>
					<Text style={{ color: colors.destructiveText, textAlign: 'center' }}>
						{error}
					</Text>
					<TouchableOpacity
						onPress={() => void load()}
						style={{
							marginTop: 14,
							borderRadius: 999,
							backgroundColor: colors.accent,
							paddingHorizontal: 18,
							paddingVertical: 10,
						}}
					>
						<Text style={{ color: colors.onAccent, fontWeight: '800' }}>
							Retry
						</Text>
					</TouchableOpacity>
				</View>
			) : report ? (
				<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
					{/* REPORTED CONTENT PREVIEW CARD */}
					<View
						style={{
							marginBottom: 14,
							padding: 16,
							borderRadius: 18,
							backgroundColor: colors.surface,
							borderWidth: 1,
							borderColor: colors.border,
						}}
					>
						{/* Header: Label + Content Type Badge */}
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'space-between',
								marginBottom: 12,
							}}
						>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Icon
									name={
										targetContent?.kind === 'user' ? 'user' :
										targetContent?.kind === 'community' ? 'users' :
										targetContent?.kind === 'comment' || targetContent?.kind === 'reply' ? 'message-circle' :
										targetContent?.kind === 'blog' ? 'book-open' :
										targetContent?.kind === 'event' ? 'calendar' :
										targetContent?.kind === 'marketplace_listing' ? 'shopping-bag' :
										'file-text'
									}
									size={16}
									color={colors.accent}
								/>
								<Text
									style={{
										marginLeft: 6,
										fontSize: 13,
										fontWeight: '900',
										color: colors.text,
										textTransform: 'uppercase',
										letterSpacing: 0.5,
									}}
								>
									Reported Content
								</Text>
							</View>
							<View
								style={{
									paddingHorizontal: 8,
									paddingVertical: 3,
									borderRadius: 8,
									backgroundColor: colors.control,
								}}
							>
								<Text
									style={{
										fontSize: 10,
										fontWeight: '900',
										color: colors.secondaryText,
										textTransform: 'uppercase',
									}}
								>
									{report.contentType}
								</Text>
							</View>
						</View>

						{/* Loading indicator */}
						{targetContent?.loading ? (
							<View style={{ paddingVertical: 20, alignItems: 'center' }}>
								<ActivityIndicator size="small" color={colors.accent} />
								<Text style={{ marginTop: 8, fontSize: 12, color: colors.mutedText }}>
									Loading reported content…
								</Text>
							</View>
						) : targetContent?.found ? (
							<>
								{/* Author Header Row */}
								{targetContent.author ? (
									<View
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											marginBottom: 12,
											paddingBottom: 10,
											borderBottomWidth: 1,
											borderBottomColor: colors.border,
										}}
									>
										<TouchableOpacity
											onPress={() => {
												if (targetContent.author?.username) {
													router.push(`/profile/${targetContent.author.username}` as Href);
												} else if (targetContent.author?.id) {
													router.push(`/profile/${targetContent.author.id}` as Href);
												}
											}}
											style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
										>
											<UserAvatar
												profileImage={targetContent.author.profileImage}
												firstName={targetContent.author.name}
												size={38}
											/>
											<View style={{ marginLeft: 10, flex: 1 }}>
												<Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
													{targetContent.author.name}
												</Text>
												{targetContent.author.username ? (
													<Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedText }}>
														@{targetContent.author.username}
													</Text>
												) : null}
											</View>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => {
												if (targetContent.author?.username) {
													router.push(`/profile/${targetContent.author.username}` as Href);
												} else if (targetContent.author?.id) {
													router.push(`/profile/${targetContent.author.id}` as Href);
												}
											}}
											style={{
												paddingHorizontal: 10,
												paddingVertical: 6,
												borderRadius: 8,
												backgroundColor: colors.control,
											}}
										>
											<Text style={{ fontSize: 11, fontWeight: '800', color: colors.secondaryText }}>
												View Profile
											</Text>
										</TouchableOpacity>
									</View>
								) : null}

								{/* Title if present (e.g. blog title, product name, community name) */}
								{targetContent.title ? (
									<Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 }}>
										{targetContent.title}
									</Text>
								) : null}

								{/* Main Text Content / Caption */}
								{targetContent.content ? (
									<Text
										selectable
										style={{
											fontSize: 14,
											color: colors.text,
											lineHeight: 20,
											marginBottom: 10,
										}}
									>
										{targetContent.content}
									</Text>
								) : null}

								{/* Poll options if present */}
								{targetContent.pollOptions && targetContent.pollOptions.length > 0 ? (
									<View style={{ marginBottom: 12, gap: 6 }}>
										{targetContent.pollOptions.map((opt, index) => (
											<View
												key={index}
												style={{
													padding: 10,
													borderRadius: 10,
													backgroundColor: colors.control,
													flexDirection: 'row',
													justifyContent: 'space-between',
												}}
											>
												<Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{opt.text}</Text>
												<Text style={{ fontSize: 12, color: colors.mutedText, fontWeight: '700' }}>{opt.votes} votes</Text>
											</View>
										))}
									</View>
								) : null}

								{/* Media Gallery (Images / Video thumbnails) */}
								{targetContent.media && targetContent.media.length > 0 ? (
									<View style={{ marginBottom: 12 }}>
										<ScrollView horizontal showsHorizontalScrollIndicator={false}>
											{targetContent.media.map((med, index) => (
												<TouchableOpacity
													key={index}
													onPress={() => setSelectedEvidenceUrl(med.url)}
													style={{
														marginRight: 8,
														borderRadius: 12,
														overflow: 'hidden',
														backgroundColor: colors.control,
														borderWidth: 1,
														borderColor: colors.border,
														width: 140,
														height: 140,
														position: 'relative',
													}}
												>
													<Image
														source={{ uri: med.thumbnailUrl || med.url }}
														style={{ width: '100%', height: '100%' }}
														contentFit="cover"
													/>
													{med.type === 'video' ? (
														<View
															style={{
																position: 'absolute',
																inset: 0,
																alignItems: 'center',
																justifyContent: 'center',
																backgroundColor: 'rgba(0,0,0,0.3)',
															}}
														>
															<Icon name="play" size={24} color="#ffffff" />
														</View>
													) : null}
												</TouchableOpacity>
											))}
										</ScrollView>
									</View>
								) : null}

								{/* Stats Bar */}
								{targetContent.stats && (typeof targetContent.stats.likes === 'number' || typeof targetContent.stats.comments === 'number') ? (
									<View
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											gap: 16,
											paddingVertical: 8,
											borderTopWidth: 1,
											borderTopColor: colors.border,
											marginBottom: 10,
										}}
									>
										{typeof targetContent.stats.likes === 'number' ? (
											<View style={{ flexDirection: 'row', alignItems: 'center' }}>
												<Icon name="heart" size={13} color={colors.mutedText} />
												<Text style={{ marginLeft: 5, fontSize: 12, fontWeight: '700', color: colors.mutedText }}>
													{targetContent.stats.likes} {targetContent.kind === 'community' ? 'members' : 'likes'}
												</Text>
											</View>
										) : null}
										{typeof targetContent.stats.comments === 'number' ? (
											<View style={{ flexDirection: 'row', alignItems: 'center' }}>
												<Icon name="message-square" size={13} color={colors.mutedText} />
												<Text style={{ marginLeft: 5, fontSize: 12, fontWeight: '700', color: colors.mutedText }}>
													{targetContent.stats.comments} {targetContent.stats.comments === 1 ? 'comment' : 'comments'}
												</Text>
											</View>
										) : null}
										{typeof targetContent.stats.shares === 'number' && targetContent.stats.shares > 0 ? (
											<View style={{ flexDirection: 'row', alignItems: 'center' }}>
												<Icon name="share-2" size={13} color={colors.mutedText} />
												<Text style={{ marginLeft: 5, fontSize: 12, fontWeight: '700', color: colors.mutedText }}>
													{targetContent.stats.shares}
												</Text>
											</View>
										) : null}
									</View>
								) : null}

								{/* Action Buttons */}
								<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
									{/* 1. Open Live Post / Content Button */}
									{targetContent.destinationRoute ? (
										<TouchableOpacity
											onPress={() => {
												if (targetContent.destinationRoute) {
													router.push(targetContent.destinationRoute as Href);
												}
											}}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingHorizontal: 12,
												paddingVertical: 9,
												borderRadius: 10,
												backgroundColor: colors.accent,
											}}
										>
											<Icon name="external-link" size={14} color={colors.onAccent} />
											<Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '900', color: colors.onAccent }}>
												{targetContent.kind === 'post' ? 'Open Live Post' :
												 targetContent.kind === 'comment' || targetContent.kind === 'reply' ? 'Open Parent Post & Comment' :
												 targetContent.kind === 'user' ? 'Open Profile' :
												 targetContent.kind === 'community' ? 'Open Community' :
												 'Open Content'}
											</Text>
										</TouchableOpacity>
									) : null}

									{/* 2. View Comments Button */}
									{(targetContent.kind === 'post' || targetContent.kind === 'lime' || targetContent.parentPostId) ? (
										<TouchableOpacity
											onPress={() => {
												if (targetContent.rawPost) {
													setCommentsModalOpen(true);
												} else {
													const postId = targetContent.parentPostId || report.targetId;
													router.push({
														pathname: '/post/[id]',
														params: { id: postId, openComments: 'true' },
													} as Href);
												}
											}}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingHorizontal: 12,
												paddingVertical: 9,
												borderRadius: 10,
												backgroundColor: colors.control,
												borderWidth: 1,
												borderColor: colors.border,
											}}
										>
											<Icon name="message-circle" size={14} color={colors.text} />
											<Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '800', color: colors.text }}>
												View Comments {typeof targetContent.stats?.comments === 'number' ? `(${targetContent.stats.comments})` : ''}
											</Text>
										</TouchableOpacity>
									) : null}
								</View>
							</>
						) : (
							/* Fallback: Content Missing or Deleted */
							<View style={{ paddingVertical: 10 }}>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										padding: 12,
										borderRadius: 12,
										backgroundColor: colors.warningSurface,
										marginBottom: 10,
									}}
								>
									<Icon name="alert-triangle" size={18} color={colors.warningText} />
									<Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '700', color: colors.warningText, flex: 1 }}>
										Reported content could not be found live or has already been removed.
									</Text>
								</View>

								{/* Show snapshot if available */}
								{targetContent?.content ? (
									<View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.control, marginTop: 4 }}>
										<Text style={{ fontSize: 11, fontWeight: '800', color: colors.mutedText, textTransform: 'uppercase', marginBottom: 4 }}>
											Snapshot at time of report:
										</Text>
										<Text selectable style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
											{targetContent.content}
										</Text>
									</View>
								) : null}

								{targetContent?.destinationRoute ? (
									<TouchableOpacity
										onPress={() => {
											if (targetContent.destinationRoute) {
												router.push(targetContent.destinationRoute as Href);
											}
										}}
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											alignSelf: 'flex-start',
											marginTop: 10,
											paddingHorizontal: 12,
											paddingVertical: 8,
											borderRadius: 10,
											backgroundColor: colors.control,
										}}
									>
										<Icon name="external-link" size={13} color={colors.secondaryText} />
										<Text style={{ marginLeft: 6, fontSize: 11, fontWeight: '800', color: colors.secondaryText }}>
											Attempt Navigation
										</Text>
									</TouchableOpacity>
								) : null}
							</View>
						)}
					</View>

					{/* REPORT METADATA & REASON CARD */}
					<View
						style={{
							padding: 16,
							borderRadius: 18,
							backgroundColor: colors.surface,
							borderWidth: 1,
							borderColor: colors.border,
						}}
					>
						<View style={{ flexDirection: 'row' }}>
							<Text
								style={{
									flex: 1,
									fontSize: 18,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								{report.reason}
							</Text>
							<Text
								style={{
									color:
										report.severity === 'critical' || report.severity === 'high'
											? colors.destructiveText
											: colors.warningText,
									fontSize: 10,
									fontWeight: '900',
									textTransform: 'uppercase',
								}}
							>
								{report.severity}
							</Text>
						</View>
						<Text
							style={{
								marginTop: 8,
								color: colors.secondaryText,
								lineHeight: 20,
							}}
						>
							{report.description || 'No reporter description.'}
						</Text>

						{/* Basic Status and IDs */}
						{[
							['Status', report.status],
							['Content type', report.contentType],
							['Target ID', report.targetId],
						].map(([label, value]) => (
							<View key={label} style={{ marginTop: 12 }}>
								<Text
									style={{
										color: colors.mutedText,
										fontSize: 10,
										fontWeight: '900',
										textTransform: 'uppercase',
									}}
								>
									{label}
								</Text>
								<Text selectable style={{ marginTop: 2, color: colors.text }}>
									{value}
								</Text>
							</View>
						))}

						{/* Interactive Reporter Row */}
						<View style={{ marginTop: 12 }}>
							<Text
								style={{
									color: colors.mutedText,
									fontSize: 10,
									fontWeight: '900',
									textTransform: 'uppercase',
								}}
							>
								Reporter
							</Text>
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
									{reporterUserData ? (
										<UserAvatar
											profileImage={reporterUserData.profileImage}
											firstName={reporterUserData.name}
											size={26}
										/>
									) : null}
									<View style={{ marginLeft: reporterUserData ? 8 : 0, flex: 1 }}>
										<Text selectable style={{ color: colors.text, fontWeight: '700' }}>
											{report.reporterName}
										</Text>
										{reporterUserData?.username ? (
											<Text style={{ fontSize: 11, color: colors.mutedText }}>
												@{reporterUserData.username}
											</Text>
										) : null}
									</View>
								</View>
								{report.reporterId ? (
									<TouchableOpacity
										onPress={() => {
											router.push(`/profile/${reporterUserData?.username || report.reporterId}` as Href);
										}}
										style={{
											paddingHorizontal: 8,
											paddingVertical: 4,
											borderRadius: 6,
											backgroundColor: colors.control,
										}}
									>
										<Text style={{ fontSize: 10, fontWeight: '800', color: colors.secondaryText }}>
											View Profile
										</Text>
									</TouchableOpacity>
								) : null}
							</View>
						</View>

						{/* Reporter ID */}
						<View style={{ marginTop: 12 }}>
							<Text
								style={{
									color: colors.mutedText,
									fontSize: 10,
									fontWeight: '900',
									textTransform: 'uppercase',
								}}
							>
								Reporter ID
							</Text>
							<Text selectable style={{ marginTop: 2, color: colors.text }}>
								{report.reporterId}
							</Text>
						</View>

						{/* Interactive Reported User Row */}
						<View style={{ marginTop: 12 }}>
							<Text
								style={{
									color: colors.mutedText,
									fontSize: 10,
									fontWeight: '900',
									textTransform: 'uppercase',
								}}
							>
								Reported User
							</Text>
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
									{reportedUserData ? (
										<UserAvatar
											profileImage={reportedUserData.profileImage}
											firstName={reportedUserData.name}
											size={26}
										/>
									) : null}
									<View style={{ marginLeft: reportedUserData ? 8 : 0, flex: 1 }}>
										<Text selectable style={{ color: colors.text, fontWeight: '700' }}>
											{reportedUserData?.name || report.reportedUserId || 'Not supplied'}
										</Text>
										{reportedUserData?.username ? (
											<Text style={{ fontSize: 11, color: colors.mutedText }}>
												@{reportedUserData.username}
											</Text>
										) : null}
									</View>
								</View>
								{report.reportedUserId ? (
									<TouchableOpacity
										onPress={() => {
											router.push(`/profile/${reportedUserData?.username || report.reportedUserId}` as Href);
										}}
										style={{
											paddingHorizontal: 8,
											paddingVertical: 4,
											borderRadius: 6,
											backgroundColor: colors.control,
										}}
									>
										<Text style={{ fontSize: 10, fontWeight: '800', color: colors.secondaryText }}>
											View Profile
										</Text>
									</TouchableOpacity>
								) : null}
							</View>
						</View>
					</View>

					{/* EVIDENCE GALLERY (IF UPLOADED BY REPORTER) */}
					{report.evidence && report.evidence.length > 0 ? (
						<View
							style={{
								marginTop: 14,
								padding: 16,
								borderRadius: 18,
								backgroundColor: colors.surface,
								borderWidth: 1,
								borderColor: colors.border,
							}}
						>
							<Text
								style={{
									fontSize: 13,
									fontWeight: '900',
									color: colors.text,
									textTransform: 'uppercase',
									letterSpacing: 0.5,
									marginBottom: 10,
								}}
							>
								Attached Evidence ({report.evidence.length})
							</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								{report.evidence.map((url, idx) => (
									<TouchableOpacity
										key={idx}
										onPress={() => setSelectedEvidenceUrl(url)}
										style={{
											marginRight: 8,
											borderRadius: 12,
											overflow: 'hidden',
											borderWidth: 1,
											borderColor: colors.border,
											width: 100,
											height: 100,
										}}
									>
										<Image
											source={{ uri: url }}
											style={{ width: '100%', height: '100%' }}
											contentFit="cover"
										/>
									</TouchableOpacity>
								))}
							</ScrollView>
						</View>
					) : null}
					<Text
						style={{
							marginTop: 18,
							marginBottom: 10,
							fontSize: 16,
							fontWeight: '900',
							color: colors.text,
						}}
					>
						Available actions
					</Text>
					{(['resolution', 'content', 'account', 'escalation'] as const).map(
						(group) => (
							<View key={group} style={{ marginBottom: 13 }}>
								<Text
									style={{
										marginBottom: 7,
										color: colors.mutedText,
										fontSize: 11,
										fontWeight: '900',
										textTransform: 'uppercase',
									}}
								>
									{group}
								</Text>
								<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
									{ACTIONS.filter((action) => action.group === group).map(
										(action) => (
											<TouchableOpacity
												key={action.id}
												onPress={() => {
													setSelectedAction(action.id);
													setReason(report.moderatorNotes);
												}}
												style={{
													marginRight: 7,
													marginBottom: 7,
													borderRadius: 12,
													paddingHorizontal: 11,
													paddingVertical: 9,
													backgroundColor:
														group === 'account'
															? colors.destructiveSurface
															: group === 'content'
																? colors.warningSurface
																: group === 'escalation'
																	? colors.control
																	: colors.successSurface,
												}}
											>
												<Text
													style={{
														color:
															group === 'account'
																? colors.destructiveText
																: group === 'content'
																	? colors.warningText
																	: group === 'escalation'
																		? colors.secondaryText
																		: colors.successText,
														fontSize: 11,
														fontWeight: '800',
													}}
												>
													{action.label}
												</Text>
											</TouchableOpacity>
										)
									)}
								</View>
							</View>
						)
					)}
				</ScrollView>
			) : null}
			<Modal
				visible={Boolean(selectedAction)}
				transparent
				animationType="fade"
				onRequestClose={() => setSelectedAction(null)}
			>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{
						flex: 1,
						justifyContent: 'center',
						padding: 20,
						backgroundColor: 'rgba(15,23,42,0.72)',
					}}
				>
					<View
						style={{
							borderRadius: 22,
							backgroundColor: colors.elevated,
							padding: 18,
						}}
					>
						<View style={{ flexDirection: 'row' }}>
							<Text
								style={{
									flex: 1,
									fontSize: 18,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								{ACTIONS.find((action) => action.id === selectedAction)?.label}
							</Text>
							<TouchableOpacity onPress={() => setSelectedAction(null)}>
								<Icon name="x" size={22} color={colors.icon} />
							</TouchableOpacity>
						</View>
						<TextInput
							value={reason}
							onChangeText={setReason}
							multiline
							placeholder="Required moderation reason"
							placeholderTextColor={colors.mutedText}
							style={{
								minHeight: 90,
								marginTop: 14,
								textAlignVertical: 'top',
								borderRadius: 13,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.input,
								color: colors.text,
								padding: 11,
							}}
						/>
						{selectedAction &&
						[
							'content_hidden',
							'commenting_disabled',
							'messaging_disabled',
							'posting_disabled',
							'account_suspended',
							'account_temp_banned',
						].includes(selectedAction) ? (
							<TextInput
								value={durationDays}
								onChangeText={setDurationDays}
								keyboardType="number-pad"
								placeholder="Duration in days"
								placeholderTextColor={colors.mutedText}
								style={{
									marginTop: 9,
									borderRadius: 13,
									borderWidth: 1,
									borderColor: colors.border,
									backgroundColor: colors.input,
									color: colors.text,
									padding: 11,
								}}
							/>
						) : null}
						<TouchableOpacity
							disabled={busy || !reason.trim()}
							onPress={() => void handleAction()}
							style={{
								marginTop: 14,
								alignItems: 'center',
								borderRadius: 14,
								backgroundColor: colors.accent,
								padding: 13,
							}}
						>
							<Text style={{ color: colors.onAccent, fontWeight: '900' }}>
								{busy ? 'Applying…' : 'Apply action'}
							</Text>
						</TouchableOpacity>
					</View>
				</SafeAreaView>
			</Modal>
			<CustomModal
				visible={Boolean(message)}
				title="Report moderation"
				message={message ?? ''}
				type="info"
				onClose={() => setMessage(null)}
			/>
			{/* Embedded Comments Inspection Modal */}
			{commentsModalOpen && targetContent?.rawPost && (
				<CommentsModal
					post={targetContent.rawPost}
					userId={authService.getCurrentUser()?.uid ?? ''}
					onClose={() => setCommentsModalOpen(false)}
					onPostUpdate={(updatedPost) => {
						setTargetContent((prev) =>
							prev
								? {
										...prev,
										rawPost: updatedPost,
										stats: {
											...prev.stats,
											comments: updatedPost.stats.comments,
											likes: updatedPost.stats.likes,
											shares: updatedPost.stats.shares,
										},
									}
								: prev
						);
					}}
				/>
			)}
			{/* Evidence Fullscreen Viewer Modal */}
			<Modal
				visible={Boolean(selectedEvidenceUrl)}
				transparent
				animationType="fade"
				onRequestClose={() => setSelectedEvidenceUrl(null)}
			>
				<SafeAreaView
					edges={['top', 'bottom', 'left', 'right']}
					style={{
						flex: 1,
						backgroundColor: 'rgba(0,0,0,0.92)',
						justifyContent: 'center',
						alignItems: 'center',
						padding: 16,
					}}
				>
					<TouchableOpacity
						onPress={() => setSelectedEvidenceUrl(null)}
						style={{
							position: 'absolute',
							top: 48,
							right: 20,
							zIndex: 10,
							padding: 8,
							borderRadius: 999,
							backgroundColor: 'rgba(255,255,255,0.2)',
						}}
					>
						<Ionicons name="close" size={26} color="#ffffff" />
					</TouchableOpacity>
					{selectedEvidenceUrl ? (
						<Image
							source={{ uri: selectedEvidenceUrl }}
							style={{ width: '100%', height: '80%' }}
							contentFit="contain"
						/>
					) : null}
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}
