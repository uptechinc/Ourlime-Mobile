const { describe, expect, test, mock } = require('bun:test');

mock.module('react-native', () => ({
	Platform: { OS: 'ios' },
	NativeModules: {},
	TurboModuleRegistry: { get: () => null },
}));

mock.module('@react-native-async-storage/async-storage', () => ({
	default: {
		getItem: async () => null,
		setItem: async () => {},
		removeItem: async () => {},
	},
}));

mock.module('expo-constants', () => ({
	default: {
		executionEnvironment: 'bare',
		appOwnership: null,
		expoConfig: {},
	},
	ExecutionEnvironment: {
		StoreClient: 'storeClient',
	},
}));

const {
	notificationDestinationRegistry,
} = require('./NotificationDestinationRegistry');

describe('NotificationDestinationRegistry', () => {
	for (const type of ['community_removed', 'event_cancelled']) {
		test(`${type} falls back to Notifications`, () => {
			const result = notificationDestinationRegistry.resolve({ type });
			expect(result.behavior).toBe('navigate');
			expect(result.route).toBe('/notifications');
		});
	}

	for (const type of [
		'friend_request',
		'friend_accepted',
		'friend_declined',
		'follow',
	]) {
		test(`${type} opens the actor profile`, () => {
			const result = notificationDestinationRegistry.resolve({
				type,
				sourceUserId: 'actor-1',
			});
			expect(result.route).toEqual({
				pathname: '/profile/[username]',
				params: { username: 'actor-1' },
			});
		});
	}

	for (const type of ['like', 'comment', 'repost', 'mention']) {
		test(`${type} opens its post`, () => {
			const result = notificationDestinationRegistry.resolve({
				type,
				postId: 'post-1',
			});
			expect(result.route).toEqual({
				pathname: '/post/[id]',
				params:
					type === 'comment'
						? { id: 'post-1', openComments: '1' }
						: { id: 'post-1' },
			});
		});
	}

	test('comment notifications open and focus their thread', () => {
		const result = notificationDestinationRegistry.resolve({
			type: 'comment',
			postId: 'post-1',
			rootCommentId: 'comment-1',
			replyId: 'reply-1',
			notificationId: 'notification-1',
		});
		expect(result.route).toEqual({
			pathname: '/post/[id]',
			params: {
				id: 'post-1',
				openComments: '1',
				rootCommentId: 'comment-1',
				replyId: 'reply-1',
				notificationId: 'notification-1',
			},
		});
	});

	test('entity metadata overrides a broad engagement type', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'mention',
				destinationKind: 'project',
				projectId: 'project-1',
				taskId: 'task-1',
			}).route
		).toEqual({
			pathname: '/projectManagement',
			params: { projectId: 'project-1', taskId: 'task-1' },
		});
		expect(
			notificationDestinationRegistry.resolve({
				type: 'comment',
				destinationKind: 'lime',
				limeId: 'lime-1',
				commentId: 'comment-1',
			}).route
		).toEqual({
			pathname: '/(tabs)/Limes',
			params: { limeId: 'lime-1', openComments: '1', commentId: 'comment-1' },
		});
		expect(
			notificationDestinationRegistry.resolve({
				type: 'friend_accepted',
				destinationKind: 'post',
				postId: 'post-1',
			}).route
		).toEqual({ pathname: '/post/[id]', params: { id: 'post-1' } });
	});

	test('restricted child-safety alerts distinguish reporter and reviewer workspaces', () => {
		const reporter = notificationDestinationRegistry.resolve({
			type: 'child_safety_case',
			childSafetyReportId: 'case-1',
		});
		const reviewer = notificationDestinationRegistry.resolve({
			type: 'child_safety_case',
			childSafetyReportId: 'case-1',
			childSafetyReviewerView: 'true',
		});
		expect(reporter.route).toBe('/help/child-safety/reports/case-1');
		expect(reviewer.route).toBe('/help/child-safety/review/case-1');
	});

	test('support alerts open requester or staff ticket workspaces', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'support_ticket',
				supportTicketId: 'ticket-1',
			}).route
		).toBe('/help/tickets/ticket-1');
		expect(
			notificationDestinationRegistry.resolve({
				type: 'support_ticket',
				supportTicketId: 'ticket-1',
				supportStaffView: 'true',
			}).route
		).toBe('/help/tickets/staff/ticket-1');
	});

	test('messages open the peer chat', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'message',
				senderId: 'user-1',
			}).route
		).toEqual({ pathname: '/chat/[id]', params: { id: 'user-1' } });
	});

	test('live calls are delegated to the call overlay', () => {
		const result = notificationDestinationRegistry.resolve({
			type: 'incoming_call',
			callId: 'call-1',
			sourceUserId: 'user-1',
		});
		expect(result.behavior).toBe('call');
		expect(result.callId).toBe('call-1');
		expect(result.route).toEqual({
			pathname: '/chat/[id]',
			params: { id: 'user-1' },
		});
	});

	test('community requests and reports open their dashboard workspaces', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'community_join_request',
				communityId: 'community-1',
			}).route
		).toEqual({
			pathname: '/communities/[id]',
			params: { id: 'community-1', dashboard: 'requests' },
		});
		expect(
			notificationDestinationRegistry.resolve({
				type: 'community_report',
				communityId: 'community-1',
			}).route
		).toEqual({
			pathname: '/communities/[id]',
			params: { id: 'community-1', dashboard: 'reports' },
		});
	});

	test('project invitations focus the selected project', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'project_invite',
				projectId: 'project-1',
			}).route
		).toEqual({
			pathname: '/projectManagement',
			params: { projectId: 'project-1' },
		});
	});

	test('admin and member beta alerts use different destinations', () => {
		expect(
			notificationDestinationRegistry.resolve({
				type: 'beta_management',
				destinationKind: 'admin_testers',
			}).route
		).toBe('/admin/testers');
		expect(
			notificationDestinationRegistry.resolve({
				type: 'beta_management',
				destinationKind: 'notifications',
			}).route
		).toBe('/notifications');
	});

	test('malformed or unsupported data cannot navigate to the app root', () => {
		const normalized = notificationDestinationRegistry.normalize({
			path: '/',
			type: 'unknown',
		});
		expect(notificationDestinationRegistry.resolve(normalized).route).toBe(
			'/notifications'
		);
	});

	test('typed content and legacy internal routes remain navigable', () => {
		const result = notificationDestinationRegistry.resolve({
			type: 'report_action',
			destinationKind: 'content',
			path: '/events/event-1',
		});
		expect(result.route).toBe('/events?targetId=event-1');
	});

	test('invalid external legacy paths fall back to Notifications', () => {
		const result = notificationDestinationRegistry.resolve({
			type: 'report_action',
			path: 'https://example.com',
		});
		expect(result.route).toBe('/notifications');
	});
});
