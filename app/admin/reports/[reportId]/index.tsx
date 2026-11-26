import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner-native';
import { db } from '@/lib/firebaseConfig';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminState from '@/components/admin/AdminState';
import AdminButton from '@/components/admin/AdminButton';
import AdminIconButton from '@/components/admin/AdminIconButton';
import AdminDialog from '@/components/admin/AdminDialog';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { ReportedContentPreviewSkeleton } from '@/components/admin/AdminSkeletons';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import CommentsModal from '@/components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal';
import { PostService, type PostItem } from '@/lib/services/PostService';
import { AuthService } from '@/lib/services/AuthService';
import { AdminModerationService, type AdminModerationAction, type AdminModerationReport } from '@/lib/services/AdminModerationService';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const moderationService = AdminModerationService.getInstance();
const postService = PostService.getInstance();
const authService = AuthService.getInstance();

type ActionGroup = 'resolution' | 'content' | 'account' | 'escalation';

const ACTIONS: readonly { id: AdminModerationAction; label: string; group: ActionGroup }[] = [
	{ id: 'dismiss', label: 'Dismiss report', group: 'resolution' },
	{ id: 'resolved_no_violation', label: 'Resolve — no violation', group: 'resolution' },
	{ id: 'content_removed', label: 'Remove content', group: 'content' },
	{ id: 'content_hidden', label: 'Hide content temporarily', group: 'content' },
	{ id: 'content_restored', label: 'Restore content', group: 'content' },
	{ id: 'content_restricted', label: 'Restrict visibility', group: 'content' },
	{ id: 'commenting_disabled', label: 'Disable commenting', group: 'content' },
	{ id: 'advertisement_removed', label: 'Delete advertisement', group: 'content' },
	{ id: 'warning_issued', label: 'Issue warning', group: 'account' },
	{ id: 'posting_disabled', label: 'Disable posting', group: 'account' },
	{ id: 'messaging_disabled', label: 'Disable messaging', group: 'account' },
	{ id: 'account_suspended', label: 'Suspend account', group: 'account' },
	{ id: 'account_temp_banned', label: 'Temporarily ban account', group: 'account' },
	{ id: 'account_perma_banned', label: 'Permanently ban account', group: 'account' },
	{ id: 'account_restricted', label: 'Restrict account features', group: 'account' },
	{ id: 'profile_picture_removed', label: 'Remove profile picture', group: 'account' },
	{ id: 'username_removed', label: 'Remove username', group: 'account' },
	{ id: 'bio_removed', label: 'Remove bio', group: 'account' },
	{ id: 'escalated_senior_review', label: 'Escalate to senior review', group: 'escalation' },
	{ id: 'requested_info', label: 'Request more information', group: 'escalation' },
	{ id: 'referred_legal', label: 'Refer to legal / safety', group: 'escalation' },
];

/** The four "Take action" categories. Account sanctions are danger-toned, never styled like "Resolve". */
const ACTION_GROUPS: readonly { id: ActionGroup; label: string; description: string; icon: AdminIconName; tone: AdminToneName }[] = [
	{ id: 'resolution', label: 'Resolve', description: 'Close the report', icon: 'check-circle', tone: 'positive' },
	{ id: 'content', label: 'Content', description: 'Remove, hide or restrict the content', icon: 'file-text', tone: 'pending' },
	{ id: 'account', label: 'Account', description: 'Warn, restrict, suspend or ban the user', icon: 'user-x', tone: 'danger' },
	{ id: 'escalation', label: 'Escalate', description: 'Senior review, more info or legal', icon: 'arrow-up-circle', tone: 'neutral' },
];

/** Actions that take a duration in days. */
const DURATION_ACTIONS: readonly AdminModerationAction[] = ['content_hidden', 'commenting_disabled', 'messaging_disabled', 'posting_disabled', 'account_suspended', 'account_temp_banned'];
const RESOLVE_NO_ACTION: AdminModerationAction = 'resolved_no_violation';

/** Image-overlay colours (the media viewer and the video play badge sit on photos, not on theme surfaces). */
const MEDIA_VIEWER_SCRIM = 'rgba(0,0,0,0.92)';
const VIDEO_BADGE_SCRIM = 'rgba(0,0,0,0.3)';

const toLabel = (value: string): string => {
	const words = value.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
};
const severityTone = (severity: AdminModerationReport['severity']): AdminToneName =>
	severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'pending' : 'neutral';
const reportStatusTone = (status: AdminModerationReport['status']): AdminToneName => {
	if (status === 'pending' || status === 'under_review' || status === 'escalated') return 'pending';
	if (status === 'action_taken' || status === 'resolved') return 'positive';
	return 'neutral';
};
const actionGroupOf = (actionId: AdminModerationAction | null): ActionGroup | null => ACTIONS.find((action) => action.id === actionId)?.group ?? null;
const groupTone = (group: ActionGroup | null): AdminToneName => ACTION_GROUPS.find((item) => item.id === group)?.tone ?? 'neutral';

type ActionPickerSheetProps = {
	visible: boolean;
	onClose: () => void;
	/** Called once the sheet has fully closed, so the action dialog can open (iOS cannot stack a closing Modal). */
	onPick: (actionId: AdminModerationAction) => void;
};

/** "Take action": step 1 picks a category, step 2 an action in it. */
function ActionPickerSheet({ visible, onClose, onPick }: ActionPickerSheetProps) {
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const [step, setStep] = useState<ActionGroup | null>(null);
	const pendingPickRef = useRef<AdminModerationAction | null>(null);
	const activeGroup = ACTION_GROUPS.find((group) => group.id === step) ?? null;

	useEffect(() => {
		if (visible) setStep(null);
	}, [visible]);

	const runPendingPick = () => {
		const picked = pendingPickRef.current;
		pendingPickRef.current = null;
		if (picked) onPick(picked);
	};

	const handlePick = (actionId: AdminModerationAction) => {
		pendingPickRef.current = actionId;
		onClose();
		if (Platform.OS !== 'ios') runPendingPick();
	};

	const title = activeGroup ? activeGroup.label : 'Take action';

	return (
		<Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose} onDismiss={runPendingPick}>
			{/* Same Android full-screen workaround as FilterSheet, so the sheet sits on the bottom edge. */}
			<View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
				<ModalBackdrop onPress={onClose} accessibilityLabel="Close actions" style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
				<ModalMotionSurface variant="sheet" style={{ maxHeight: '85%' }}>
					<SwipeDismissSurface
						visible={visible}
						onDismiss={onClose}
						handleColor={colors.border}
						accessibilityLabel="Swipe down to close actions"
						style={{ borderTopLeftRadius: radius.dialog, borderTopRightRadius: radius.dialog, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.md) + space.sm }}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: activeGroup ? space.xs : space.xl, paddingRight: space.sm }}>
							{activeGroup ? <AdminIconButton icon="arrow-left" label="Back to categories" onPress={() => setStep(null)} /> : null}
							<Text accessibilityRole="header" style={[type.title, { flex: 1, color: colors.text }]}>
								{title}
							</Text>
							<AdminIconButton icon="x" label="Close actions" onPress={onClose} />
						</View>
						<ScrollView contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }} showsVerticalScrollIndicator={false}>
							{activeGroup
								? ACTIONS.filter((action) => action.group === activeGroup.id).map((action) => (
										<AdminListRow
											key={action.id}
											title={action.label}
											leading={{ kind: 'icon', name: activeGroup.icon, tone: activeGroup.tone }}
											onPress={() => handlePick(action.id)}
											accessibilityHint="Opens the reason form"
										/>
									))
								: ACTION_GROUPS.map((group) => {
										const count = ACTIONS.filter((action) => action.group === group.id).length;
										return (
											<AdminListRow
												key={group.id}
												title={group.label}
												subtitle={group.description}
												meta={`${count} ${count === 1 ? 'action' : 'actions'}`}
												leading={{ kind: 'icon', name: group.icon, tone: group.tone }}
												onPress={() => setStep(group.id)}
											/>
										);
									})}
						</ScrollView>
					</SwipeDismissSurface>
				</ModalMotionSurface>
			</View>
		</Modal>
	);
}

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
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [targetContent, setTargetContent] = useState<TargetContentState | null>(null);
	const [reportedUserData, setReportedUserData] = useState<UserSummary | null>(null);
	const [reporterUserData, setReporterUserData] = useState<UserSummary | null>(null);
	const [commentsModalOpen, setCommentsModalOpen] = useState(false);
	const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState<string | null>(null);
	const [actionSheetOpen, setActionSheetOpen] = useState(false);
	const [selectedAction, setSelectedAction] = useState<AdminModerationAction | null>(null);
	const [reason, setReason] = useState('');
	const [durationDays, setDurationDays] = useState('7');
	const [busy, setBusy] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

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

	/** 'initial' shows the skeleton; 'refresh' (pull, and after an action) keeps the report on screen. */
	const load = useCallback(
		async (mode: 'initial' | 'refresh' = 'initial') => {
			if (!reportId) {
				setError('Report ID is missing.');
				setLoading(false);
				return;
			}
			if (mode === 'refresh') setRefreshing(true);
			else setLoading(true);
			setError(null);
			try {
				const fetchedReport = await moderationService.fetchReport(reportId);
				setReport(fetchedReport);
				void loadTargetDetails(fetchedReport);
			} catch (loadError: unknown) {
				console.error('[AdminReportDetailRoute.load] Error:', loadError instanceof Error ? loadError.message : loadError);
				setError(loadError instanceof Error ? loadError.message : 'Report could not be loaded.');
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[loadTargetDetails, reportId]
	);
	useEffect(() => {
		if (!accessLoading && authorization.isAdmin) void load();
	}, [accessLoading, authorization.isAdmin, load]);

	const openAction = (actionId: AdminModerationAction) => {
		setActionError(null);
		setSelectedAction(actionId);
		setReason(report?.moderatorNotes ?? '');
	};

	const needsDuration = selectedAction !== null && DURATION_ACTIONS.includes(selectedAction);
	const parsedDays = Number(durationDays);
	const isDurationValid = !needsDuration || (Number.isFinite(parsedDays) && parsedDays > 0);
	const canApplyAction = Boolean(report && selectedAction && reason.trim()) && isDurationValid && !busy;

	const handleAction = async () => {
		if (!report || !selectedAction || !reason.trim() || busy || !isDurationValid) return;
		const durationMs = needsDuration && Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays * 86_400_000 : undefined;
		setBusy(true);
		setActionError(null);
		try {
			await moderationService.takeAction(report.id, selectedAction, reason, durationMs);
			setSelectedAction(null);
			toast.success('Moderation action applied through the secure server workflow.');
			await load('refresh');
		} catch (takeActionError: unknown) {
			console.error('[AdminReportDetailRoute.handleAction] Error:', takeActionError instanceof Error ? takeActionError.message : takeActionError);
			// The dialog stays open with the reason intact.
			setActionError(takeActionError instanceof Error ? takeActionError.message : 'Moderation action failed.');
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async () => {
		if (!report || busy) return;
		setBusy(true);
		setDeleteError(null);
		try {
			await moderationService.deleteReport(report.id);
			setConfirmingDelete(false);
			toast.success('Report deleted.');
			if (router.canGoBack()) router.back();
			else router.replace('/admin/moderation' as Href);
		} catch (removeError: unknown) {
			console.error('[AdminReportDetailRoute.handleDelete] Error:', removeError instanceof Error ? removeError.message : removeError);
			setDeleteError(removeError instanceof Error ? removeError.message : 'Report could not be deleted.');
		} finally {
			setBusy(false);
		}
	};

	const openProfile = (usernameOrId: string | null | undefined) => {
		if (usernameOrId) router.push(`/profile/${usernameOrId}` as Href);
	};

	const openComments = () => {
		if (!report || !targetContent) return;
		if (targetContent.rawPost) {
			setCommentsModalOpen(true);
			return;
		}
		const postId = targetContent.parentPostId || report.targetId;
		router.push({ pathname: '/post/[id]', params: { id: postId, openComments: 'true' } } as Href);
	};

	const destinationRoute = targetContent?.destinationRoute;
	const canViewComments = Boolean(targetContent?.found && (targetContent.kind === 'post' || targetContent.kind === 'lime' || targetContent.parentPostId));
	const openContentLabel = !targetContent?.found
		? 'Try opening the content'
		: targetContent.kind === 'post'
			? 'Open live post'
			: targetContent.kind === 'comment' || targetContent.kind === 'reply'
				? 'Open parent post and comment'
				: targetContent.kind === 'user'
					? 'Open profile'
					: targetContent.kind === 'community'
						? 'Open community'
						: 'Open content';

	const overflowActions: AdminOverflowItem[] = [
		...(destinationRoute ? [{ key: 'open', label: openContentLabel, icon: 'external-link' as const, onPress: () => router.push(destinationRoute as Href) }] : []),
		...(canViewComments
			? [{ key: 'comments', label: typeof targetContent?.stats?.comments === 'number' ? `View comments (${targetContent.stats.comments})` : 'View comments', icon: 'message-circle' as const, onPress: openComments }]
			: []),
		{
			key: 'delete',
			label: 'Delete report',
			icon: 'trash-2',
			tone: 'danger',
			disabled: !report || busy,
			description: 'Removes it from the queue; actions taken stay',
			onPress: () => {
				setDeleteError(null);
				setConfirmingDelete(true);
			},
		},
	];

	const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'detail' } : error ? { kind: 'error', message: error } : report ? { kind: 'ready' } : { kind: 'loading', variant: 'detail' };
	const selectedActionMeta = ACTIONS.find((action) => action.id === selectedAction) ?? null;
	const selectedTone = groupTone(actionGroupOf(selectedAction));
	const dialogTone: 'positive' | 'pending' | 'danger' = selectedTone === 'danger' ? 'danger' : selectedTone === 'pending' ? 'pending' : 'positive';

	const inputStyle = [
		type.body,
		{ minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];

	const renderField = (label: string, value: string) => (
		<View key={label} style={{ gap: space.xs }}>
			<Text style={[type.label, { color: colors.mutedText }]}>{label}</Text>
			<Text selectable style={[type.body, { color: colors.text }]}>
				{value || 'Not supplied'}
			</Text>
		</View>
	);

	const renderMediaStrip = (media: NonNullable<TargetContentState['media']>, size: number) => (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
			{media.map((mediaItem, mediaIndex) => (
				<AdminPressable
					key={`${mediaItem.url}-${mediaIndex}`}
					onPress={() => setSelectedEvidenceUrl(mediaItem.url)}
					accessibilityRole="imagebutton"
					accessibilityLabel={mediaItem.type === 'video' ? `Open video ${mediaIndex + 1}` : `Open image ${mediaIndex + 1}`}
					style={({ pressed }) => ({ width: size, height: size, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, opacity: pressed ? 0.7 : 1 })}
				>
					<Image source={{ uri: mediaItem.thumbnailUrl || mediaItem.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
					{mediaItem.type === 'video' ? (
						<View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: VIDEO_BADGE_SCRIM }}>
							<Icon name="play" size={24} color={colors.onAccent} />
						</View>
					) : null}
				</AdminPressable>
			))}
		</ScrollView>
	);

	const renderReportedContent = () => {
		if (!report) return null;
		if (!targetContent || targetContent.loading) return <ReportedContentPreviewSkeleton />;
		if (!targetContent.found) {
			const pending = getAdminTone(colors, 'pending');
			return (
				<>
					{targetContent.error ? <AdminState kind="inlineError" message={targetContent.error} /> : null}
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: pending.border, backgroundColor: pending.soft }}>
						<Icon name="alert-triangle" size={18} color={pending.text} />
						<Text style={[type.body, { flex: 1, color: pending.text }]}>Reported content could not be found live or has already been removed.</Text>
					</View>
					{targetContent.content ? (
						<View style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Snapshot at time of report</Text>
							<Text selectable style={[type.body, { color: colors.text }]}>
								{targetContent.content}
							</Text>
						</View>
					) : null}
				</>
			);
		}
		const author = targetContent.author;
		return (
			<>
				{author ? (
					<AdminListRow
						title={author.name}
						subtitle={author.username ? `@${author.username}` : undefined}
						leading={{ kind: 'avatar', uri: author.profileImage ?? undefined, name: author.name }}
						onPress={author.username || author.id ? () => openProfile(author.username || author.id) : undefined}
						accessibilityHint="Opens the profile"
					/>
				) : null}
				{targetContent.title ? <Text style={[type.section, { color: colors.text }]}>{targetContent.title}</Text> : null}
				{targetContent.content ? (
					<Text selectable style={[type.body, { color: colors.text }]}>
						{targetContent.content}
					</Text>
				) : null}
				{targetContent.pollOptions && targetContent.pollOptions.length > 0 ? (
					<View style={{ gap: space.sm }}>
						{targetContent.pollOptions.map((option, optionIndex) => (
							<View key={optionIndex} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.control }}>
								<Text style={[type.bodyStrong, { flex: 1, color: colors.text }]}>{option.text}</Text>
								<Text style={[type.meta, { color: colors.mutedText }]}>{option.votes} votes</Text>
							</View>
						))}
					</View>
				) : null}
				{targetContent.media && targetContent.media.length > 0 ? renderMediaStrip(targetContent.media, 120) : null}
				{targetContent.stats && (typeof targetContent.stats.likes === 'number' || typeof targetContent.stats.comments === 'number') ? (
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
						{typeof targetContent.stats.likes === 'number' ? (
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
								<Icon name={targetContent.kind === 'community' ? 'users' : 'heart'} size={14} color={colors.mutedText} />
								<Text style={[type.meta, { color: colors.mutedText }]}>
									{targetContent.stats.likes} {targetContent.kind === 'community' ? 'members' : 'likes'}
								</Text>
							</View>
						) : null}
						{typeof targetContent.stats.comments === 'number' ? (
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
								<Icon name="message-square" size={14} color={colors.mutedText} />
								<Text style={[type.meta, { color: colors.mutedText }]}>
									{targetContent.stats.comments} {targetContent.stats.comments === 1 ? 'comment' : 'comments'}
								</Text>
							</View>
						) : null}
						{typeof targetContent.stats.shares === 'number' && targetContent.stats.shares > 0 ? (
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
								<Icon name="share-2" size={14} color={colors.mutedText} />
								<Text style={[type.meta, { color: colors.mutedText }]}>{targetContent.stats.shares} shares</Text>
							</View>
						) : null}
					</View>
				) : null}
			</>
		);
	};

	return (
		<>
			<AdminScreen
				title="Report"
				subtitle={report ? `${toLabel(report.status)} · ${report.contentType}` : undefined}
				state={screenState}
				onRefresh={() => load('refresh')}
				refreshing={refreshing}
				backFallback={'/admin/moderation' as Href}
				overflowActions={report ? overflowActions : undefined}
				footer={
					report ? (
						<>
							<AdminButton label="Resolve, no action" tone="neutral" disabled={busy} onPress={() => openAction(RESOLVE_NO_ACTION)} style={{ flex: 1 }} />
							<AdminButton label="Take action" icon="zap" tone="positive" emphasis="primary" disabled={busy} onPress={() => setActionSheetOpen(true)} style={{ flex: 1 }} />
						</>
					) : undefined
				}
			>
				{report ? (
					<View style={{ gap: space.xl }}>
						<AdminSection title="Reported content" description={toLabel(report.contentType)} collapsible={{ initiallyOpen: true }}>
							{renderReportedContent()}
						</AdminSection>

						<AdminSection title="Report">
							<Text style={[type.section, { color: colors.text }]}>{report.reason}</Text>
							<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
								<AdminStatusPill label={report.severity} tone={severityTone(report.severity)} />
								<AdminStatusPill label={toLabel(report.status)} tone={reportStatusTone(report.status)} />
							</View>
							<Text style={[type.body, { color: colors.secondaryText }]}>{report.description || 'No reporter description.'}</Text>
							{renderField('Content type', report.contentType)}
							{renderField('Target ID', report.targetId)}
							<View style={{ gap: space.xs }}>
								<Text style={[type.label, { color: colors.mutedText }]}>Reporter</Text>
								<AdminListRow
									title={report.reporterName}
									subtitle={reporterUserData?.username ? `@${reporterUserData.username}` : undefined}
									meta={report.reporterId ? `ID ${report.reporterId}` : undefined}
									leading={{ kind: 'avatar', uri: reporterUserData?.profileImage ?? undefined, name: reporterUserData?.name ?? report.reporterName }}
									onPress={report.reporterId ? () => openProfile(reporterUserData?.username || report.reporterId) : undefined}
									accessibilityHint="Opens the reporter's profile"
								/>
							</View>
							<View style={{ gap: space.xs }}>
								<Text style={[type.label, { color: colors.mutedText }]}>Reported user</Text>
								<AdminListRow
									title={reportedUserData?.name || report.reportedUserId || 'Not supplied'}
									subtitle={reportedUserData?.username ? `@${reportedUserData.username}` : undefined}
									meta={report.reportedUserId ? `ID ${report.reportedUserId}` : undefined}
									leading={{ kind: 'avatar', uri: reportedUserData?.profileImage ?? undefined, name: reportedUserData?.name ?? 'User' }}
									onPress={report.reportedUserId ? () => openProfile(reportedUserData?.username || report.reportedUserId) : undefined}
									accessibilityHint="Opens the reported user's profile"
								/>
							</View>
						</AdminSection>

						{report.evidence && report.evidence.length > 0 ? (
							<AdminSection title={`Evidence (${report.evidence.length})`} description="Attached by the reporter">
								{renderMediaStrip(
									report.evidence.map((url) => ({ url, type: 'image' as const })),
									100
								)}
							</AdminSection>
						) : null}
					</View>
				) : null}
			</AdminScreen>

			<ActionPickerSheet visible={actionSheetOpen} onClose={() => setActionSheetOpen(false)} onPick={openAction} />

			<AdminDialog
				visible={Boolean(selectedAction)}
				tone={dialogTone}
				icon={ACTION_GROUPS.find((group) => group.id === selectedActionMeta?.group)?.icon ?? null}
				title={selectedActionMeta?.label ?? 'Moderation action'}
				description="The reason is saved with the report and the audit log."
				confirmLabel={busy ? 'Applying…' : 'Apply'}
				busy={busy}
				confirmDisabled={!canApplyAction}
				onConfirm={() => void handleAction()}
				onClose={() => setSelectedAction(null)}
			>
				<View style={{ gap: space.md }}>
					{actionError ? <AdminState kind="inlineError" message={actionError} /> : null}
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Reason (required)</Text>
						<TextInput
							value={reason}
							onChangeText={setReason}
							editable={!busy}
							multiline
							placeholder="Required moderation reason"
							placeholderTextColor={colors.mutedText}
							accessibilityLabel="Moderation reason"
							style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
						/>
					</View>
					{needsDuration ? (
						<View style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Duration in days</Text>
							<TextInput
								value={durationDays}
								onChangeText={setDurationDays}
								editable={!busy}
								keyboardType="number-pad"
								placeholder="Duration in days"
								placeholderTextColor={colors.mutedText}
								accessibilityLabel="Duration in days"
								style={inputStyle}
							/>
							{!isDurationValid ? <Text style={[type.meta, { color: getAdminTone(colors, 'danger').text }]}>Enter a number of days above 0.</Text> : null}
						</View>
					) : null}
				</View>
			</AdminDialog>

			<AdminDialog
				visible={confirmingDelete}
				tone="danger"
				icon="trash-2"
				title="Delete this report?"
				description="The report is removed from the moderation queue. Any action already taken on the content stays in place. This cannot be undone."
				confirmLabel="Delete"
				stage={busy ? 'busy' : 'idle'}
				busyTitle="Deleting report…"
				busyMessage="Please wait while the report is removed."
				onConfirm={() => void handleDelete()}
				onClose={() => setConfirmingDelete(false)}
			>
				{deleteError ? <AdminState kind="inlineError" message={deleteError} /> : null}
			</AdminDialog>

			{/* Embedded comments inspection */}
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

			{/* Full-screen media and evidence viewer */}
			<Modal visible={Boolean(selectedEvidenceUrl)} transparent animationType="fade" onRequestClose={() => setSelectedEvidenceUrl(null)}>
				<SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: MEDIA_VIEWER_SCRIM, justifyContent: 'center', alignItems: 'center', padding: space.lg }}>
					<AdminIconButton icon="x" label="Close viewer" variant="soft" iconSize={24} onPress={() => setSelectedEvidenceUrl(null)} style={{ position: 'absolute', top: space.xxl + space.lg, right: space.lg, zIndex: 10 }} />
					{selectedEvidenceUrl ? <Image source={{ uri: selectedEvidenceUrl }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
				</SafeAreaView>
			</Modal>
		</>
	);
}
