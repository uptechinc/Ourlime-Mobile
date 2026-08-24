import type { Href } from 'expo-router';
import type {
	NativePushDestinationKind,
	NotificationType,
	PushOnlyNotificationType,
} from '@/lib/types/notification';
import { deepLinkService } from '@/lib/services/DeepLinkService';

export type NotificationDestinationInput = {
	schemaVersion?: string;
	destinationKind?: NativePushDestinationKind;
	notificationId?: string;
	type?: NotificationType | PushOnlyNotificationType | string;
	senderId?: string;
	sourceUserId?: string;
	userName?: string;
	sourceUserName?: string;
	communityId?: string;
	projectId?: string;
	postId?: string;
	limeId?: string;
	reelId?: string;
	reportId?: string;
	eventId?: string;
	requestId?: string;
	contentId?: string;
	contentType?: string;
	chatId?: string;
	callId?: string;
	callType?: string;
	profileUserId?: string;
	rootCommentId?: string;
	commentId?: string;
	replyId?: string;
	parentReplyId?: string;
	taskId?: string;
	marketplaceListingId?: string;
	blogId?: string;
	courseId?: string;
	childSafetyReportId?: string;
	childSafetyReviewerView?: string;
	supportTicketId?: string;
	supportStaffView?: string;
	path?: string;
	actionUrl?: string;
};

type NavigationDestinationResult = {
	behavior: 'navigate';
	route: Href;
	fallbackRoute: Href;
	notificationId?: string;
	peerId?: string;
};

type CallDestinationResult = {
	behavior: 'call';
	route: Href;
	fallbackRoute: Href;
	notificationId?: string;
	peerId?: string;
	callId: string;
};

export type NotificationDestinationResult =
	NavigationDestinationResult | CallDestinationResult;

type UnknownDestinationSource = {
	schemaVersion?: unknown;
	destinationKind?: unknown;
	notificationId?: unknown;
	type?: unknown;
	notificationType?: unknown;
	senderId?: unknown;
	sourceUserId?: unknown;
	callerId?: unknown;
	userName?: unknown;
	sourceUserName?: unknown;
	communityId?: unknown;
	projectId?: unknown;
	postId?: unknown;
	limeId?: unknown;
	reelId?: unknown;
	reportId?: unknown;
	eventId?: unknown;
	requestId?: unknown;
	contentId?: unknown;
	contentType?: unknown;
	chatId?: unknown;
	callId?: unknown;
	callType?: unknown;
	path?: unknown;
	actionUrl?: unknown;
	profileUserId?: unknown;
	rootCommentId?: unknown;
	commentId?: unknown;
	replyId?: unknown;
	parentReplyId?: unknown;
	taskId?: unknown;
	marketplaceListingId?: unknown;
	blogId?: unknown;
	courseId?: unknown;
	childSafetyReportId?: unknown;
	childSafetyReviewerView?: unknown;
	supportTicketId?: unknown;
	supportStaffView?: unknown;
};

const DESTINATION_KINDS: readonly NativePushDestinationKind[] = [
	'notifications',
	'profile',
	'post',
	'chat',
	'call',
	'community',
	'community_requests',
	'community_reports',
	'project',
	'admin_testers',
	'admin_report',
	'content',
	'lime',
	'event',
	'marketplace_listing',
	'blog',
	'course',
	'child_safety_case',
	'support_ticket',
];

export class NotificationDestinationRegistry {
	private static instance: NotificationDestinationRegistry;

	private constructor() {}

	public static getInstance(): NotificationDestinationRegistry {
		if (!NotificationDestinationRegistry.instance)
			NotificationDestinationRegistry.instance =
				new NotificationDestinationRegistry();
		return NotificationDestinationRegistry.instance;
	}

	public normalize(value: unknown): NotificationDestinationInput {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
		const source = value as UnknownDestinationSource;
		const destinationKindValue = this.readString(source.destinationKind);
		const destinationKind = DESTINATION_KINDS.includes(
			destinationKindValue as NativePushDestinationKind
		)
			? (destinationKindValue as NativePushDestinationKind)
			: undefined;
		return {
			schemaVersion: this.readString(source.schemaVersion),
			destinationKind,
			notificationId: this.readString(source.notificationId),
			type:
				this.readString(source.type) ||
				this.readString(source.notificationType),
			senderId: this.readString(source.senderId),
			sourceUserId:
				this.readString(source.sourceUserId) ||
				this.readString(source.callerId),
			userName: this.readString(source.userName),
			sourceUserName: this.readString(source.sourceUserName),
			communityId: this.readString(source.communityId),
			projectId: this.readString(source.projectId),
			postId: this.readString(source.postId),
			limeId: this.readString(source.limeId),
			reelId: this.readString(source.reelId),
			reportId: this.readString(source.reportId),
			eventId: this.readString(source.eventId),
			requestId: this.readString(source.requestId),
			contentId: this.readString(source.contentId),
			contentType: this.readString(source.contentType),
			chatId: this.readString(source.chatId),
			callId: this.readString(source.callId),
			callType: this.readString(source.callType),
			path: this.readString(source.path),
			actionUrl: this.readString(source.actionUrl),
			profileUserId: this.readString(source.profileUserId),
			rootCommentId: this.readString(source.rootCommentId),
			commentId: this.readString(source.commentId),
			replyId: this.readString(source.replyId),
			parentReplyId: this.readString(source.parentReplyId),
			taskId: this.readString(source.taskId),
			marketplaceListingId: this.readString(source.marketplaceListingId),
			blogId: this.readString(source.blogId),
			courseId: this.readString(source.courseId),
			childSafetyReportId: this.readString(source.childSafetyReportId),
			childSafetyReviewerView: this.readString(source.childSafetyReviewerView),
			supportTicketId: this.readString(source.supportTicketId),
			supportStaffView: this.readString(source.supportStaffView),
		};
	}

	public resolve(
		data: NotificationDestinationInput
	): NotificationDestinationResult {
		const fallbackRoute = this.notificationsRoute(data.notificationId);
		const type = data.type ?? '';
		const peerId = data.chatId || data.senderId || data.sourceUserId;

		if (
			(type === 'incoming_call' || data.destinationKind === 'call') &&
			data.callId
		) {
			return {
				behavior: 'call',
				route: peerId ? this.chatRoute(peerId) : fallbackRoute,
				fallbackRoute,
				notificationId: data.notificationId,
				peerId,
				callId: data.callId,
			};
		}
		if (type === 'message' || data.destinationKind === 'chat') {
			return this.navigate(
				peerId ? this.chatRoute(peerId) : fallbackRoute,
				fallbackRoute,
				data,
				peerId
			);
		}
		if (
			type === 'voice_call' ||
			type === 'video_call' ||
			type === 'call_state'
		) {
			return this.navigate(
				peerId ? this.chatRoute(peerId) : fallbackRoute,
				fallbackRoute,
				data,
				peerId
			);
		}

		if (type === 'community_removed' || type === 'event_cancelled') {
			return this.navigate(fallbackRoute, fallbackRoute, data);
		}
		if (type === 'beta_management') {
			const path = data.path || data.actionUrl || '';
			const isAdministratorAlert =
				data.destinationKind === 'admin_testers' ||
				path.includes('/admin/testers') ||
				path.includes('/profile/admin/testers');
			return this.navigate(
				isAdministratorAlert ? '/admin/testers' : fallbackRoute,
				fallbackRoute,
				data
			);
		}

		if (
			(type === 'child_safety_case' ||
				data.destinationKind === 'child_safety_case') &&
			(data.childSafetyReportId || data.reportId)
		) {
			const childSafetyReportId =
				data.childSafetyReportId || data.reportId || '';
			return this.navigate(
				(data.childSafetyReviewerView === 'true'
					? `/help/child-safety/review/${encodeURIComponent(childSafetyReportId)}`
					: `/help/child-safety/reports/${encodeURIComponent(childSafetyReportId)}`) as Href,
				fallbackRoute,
				data
			);
		}
		if (
			(type === 'support_ticket' ||
				data.destinationKind === 'support_ticket') &&
			data.supportTicketId
		) {
			return this.navigate(
				(data.supportStaffView === 'true'
					? `/help/tickets/staff/${encodeURIComponent(data.supportTicketId)}`
					: `/help/tickets/${encodeURIComponent(data.supportTicketId)}`) as Href,
				fallbackRoute,
				data
			);
		}
		if (data.destinationKind === 'notifications')
			return this.navigate(fallbackRoute, fallbackRoute, data);
		if (data.destinationKind === 'event' && data.eventId)
			return this.navigate(
				{ pathname: '/events', params: { targetId: data.eventId } },
				fallbackRoute,
				data
			);
		if (
			data.destinationKind === 'marketplace_listing' &&
			data.marketplaceListingId
		)
			return this.navigate(
				{
					pathname: '/market',
					params: { productId: data.marketplaceListingId },
				},
				fallbackRoute,
				data
			);
		if (data.destinationKind === 'blog' && data.blogId)
			return this.navigate(
				{ pathname: '/blogs/[id]', params: { id: data.blogId } },
				fallbackRoute,
				data
			);
		if (data.destinationKind === 'course' && data.courseId)
			return this.navigate(
				{ pathname: '/eLearning', params: { courseId: data.courseId } },
				fallbackRoute,
				data
			);

		const limeId =
			data.limeId ||
			data.reelId ||
			this.pathSegment(data.path || data.actionUrl, '/limes/');
		if (data.destinationKind === 'lime' || limeId) {
			const params: {
				limeId?: string;
				openComments?: string;
				commentId?: string;
				replyId?: string;
			} = {};
			if (limeId) params.limeId = limeId;
			if (type === 'comment' || type === 'mention') params.openComments = '1';
			if (data.commentId) params.commentId = data.commentId;
			if (data.replyId) params.replyId = data.replyId;
			return this.navigate(
				{ pathname: '/(tabs)/Limes', params },
				fallbackRoute,
				data
			);
		}
		if (
			data.destinationKind === 'project' ||
			(type === 'mention' && data.projectId)
		) {
			const params: { projectId?: string; taskId?: string } = {};
			if (data.projectId) params.projectId = data.projectId;
			if (data.taskId) params.taskId = data.taskId;
			return this.navigate(
				{ pathname: '/projectManagement', params },
				fallbackRoute,
				data
			);
		}
		if (
			type === 'like' ||
			type === 'comment' ||
			type === 'repost' ||
			type === 'mention' ||
			data.destinationKind === 'post'
		) {
			const postId =
				data.postId || this.pathSegment(data.path || data.actionUrl, '/post/');
			const params: {
				id: string;
				openComments?: string;
				rootCommentId?: string;
				commentId?: string;
				replyId?: string;
				parentReplyId?: string;
				notificationId?: string;
			} | null = postId ? { id: postId } : null;
			if (
				params &&
				(type === 'comment' ||
					data.contentType === 'comment' ||
					data.contentType === 'reply' ||
					data.commentId ||
					data.replyId ||
					data.rootCommentId)
			)
				params.openComments = '1';
			if (params && data.rootCommentId)
				params.rootCommentId = data.rootCommentId;
			if (params && data.commentId) params.commentId = data.commentId;
			if (params && data.replyId) params.replyId = data.replyId;
			if (params && data.parentReplyId)
				params.parentReplyId = data.parentReplyId;
			if (params && data.notificationId)
				params.notificationId = data.notificationId;
			return this.navigate(
				params ? { pathname: '/post/[id]', params } : fallbackRoute,
				fallbackRoute,
				data
			);
		}

		if (
			type === 'friend_request' ||
			type === 'friend_accepted' ||
			type === 'friend_declined' ||
			type === 'follow' ||
			data.destinationKind === 'profile'
		) {
			const profilePath = data.path || data.actionUrl;
			const profileIdentifier =
				data.userName ||
				data.sourceUserName ||
				data.profileUserId ||
				data.sourceUserId ||
				this.pathSegment(profilePath, '/profile/viewOtherProfile/') ||
				this.pathSegment(profilePath, '/profile/');
			return this.navigate(
				profileIdentifier
					? {
							pathname: '/profile/[username]',
							params: { username: profileIdentifier },
						}
					: fallbackRoute,
				fallbackRoute,
				data
			);
		}

		const communityId =
			data.communityId ||
			this.pathSegment(data.path || data.actionUrl, '/communities/');
		if (
			type === 'community_join_request' ||
			data.destinationKind === 'community_requests'
		) {
			return this.navigate(
				communityId
					? {
							pathname: '/communities/[id]',
							params: { id: communityId, dashboard: 'requests' },
						}
					: fallbackRoute,
				fallbackRoute,
				data
			);
		}
		if (
			type === 'community_report' ||
			data.destinationKind === 'community_reports'
		) {
			if (communityId)
				return this.navigate(
					{
						pathname: '/communities/[id]',
						params: { id: communityId, dashboard: 'reports' },
					},
					fallbackRoute,
					data
				);
			if (data.reportId)
				return this.navigate(
					{
						pathname: '/admin/reports/[reportId]',
						params: { reportId: data.reportId },
					},
					fallbackRoute,
					data
				);
			return this.navigate(fallbackRoute, fallbackRoute, data);
		}
		if (
			type === 'community_invite' ||
			type === 'community_accepted' ||
			type === 'community_rejected' ||
			type === 'role_change' ||
			data.destinationKind === 'community'
		) {
			return this.navigate(
				communityId
					? { pathname: '/communities/[id]', params: { id: communityId } }
					: fallbackRoute,
				fallbackRoute,
				data
			);
		}
		if (type === 'project_invite') {
			return this.navigate(
				data.projectId
					? {
							pathname: '/projectManagement',
							params: {
								projectId: data.projectId,
								...(data.taskId ? { taskId: data.taskId } : {}),
							},
						}
					: '/projectManagement',
				fallbackRoute,
				data
			);
		}
		if (data.destinationKind === 'admin_testers')
			return this.navigate('/admin/testers', fallbackRoute, data);
		if (data.destinationKind === 'admin_report' && data.reportId)
			return this.navigate(
				{
					pathname: '/admin/reports/[reportId]',
					params: { reportId: data.reportId },
				},
				fallbackRoute,
				data
			);

		const path = data.path || data.actionUrl;
		if (path && path !== '/' && path !== '/notifications') {
			const resolution = deepLinkService.resolve(path);
			if (resolution.kind === 'internal')
				return this.navigate(resolution.route as Href, fallbackRoute, data);
		}
		return this.navigate(fallbackRoute, fallbackRoute, data);
	}

	private navigate(
		route: Href,
		fallbackRoute: Href,
		data: NotificationDestinationInput,
		peerId?: string
	): NotificationDestinationResult {
		return {
			behavior: 'navigate',
			route,
			fallbackRoute,
			notificationId: data.notificationId,
			peerId,
		};
	}

	private notificationsRoute(notificationId?: string): Href {
		return (
			notificationId
				? { pathname: '/notifications', params: { notificationId } }
				: '/notifications'
		) as Href;
	}

	private chatRoute(peerId: string): Href {
		return { pathname: '/chat/[id]', params: { id: peerId } };
	}

	private readString(value: unknown): string {
		return typeof value === 'string' ? value.trim() : '';
	}

	private pathSegment(value: string | undefined, prefix: string): string {
		if (!value?.startsWith(prefix)) return '';
		return decodeURIComponent(
			value.slice(prefix.length).split(/[/?#]/)[0] || ''
		);
	}
}

export const notificationDestinationRegistry =
	NotificationDestinationRegistry.getInstance();
