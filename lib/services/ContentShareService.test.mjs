import { describe, expect, mock, test } from 'bun:test';

let sharedCalls = [];
mock.module('react-native', () => {
  const shareMock = {
    share: async (payload) => {
      sharedCalls.push(payload);
      return { action: 'sharedAction' };
    },
    sharedAction: 'sharedAction',
  };
  return {
    Share: shareMock,
    default: { Share: shareMock },
  };
});

let sentMessages = [];
let initialPageCalls = 0;
let backgroundPageCalls = 0;
const mockMessagingService = {
  fetchConversationPage: async (_userId, cursor) => {
    if (!cursor) {
      initialPageCalls++;
      return {
        items: [
          { uid: 'friend-1', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
          { uid: 'friend-2', firstName: 'Bob', lastName: 'Jones', userName: 'bob' },
        ],
        nextCursor: 'cursor-2',
      };
    }
    backgroundPageCalls++;
    return {
      items: [
        { uid: 'friend-3', firstName: 'Charlie', lastName: 'Brown', userName: 'charlie' },
      ],
      nextCursor: null,
    };
  },
  sendMessage: async (recipientId, message, senderId) => {
    sentMessages.push({ recipientId, message, senderId });
    return { id: `msg-${Date.now()}` };
  },
};

mock.module('@/lib/messaging/MessagingService', () => ({
  MessagingService: {
    getInstance: () => mockMessagingService,
  },
}));

const { contentShareService } = await import('./ContentShareService.ts');

describe('ContentShareService (Mobile)', () => {
  test('loadRecipients returns cached recipients instantly on second call', async () => {
    contentShareService.clearCache();
    initialPageCalls = 0;
    backgroundPageCalls = 0;

    const first = await contentShareService.loadRecipients('user-1');
    expect(first.length).toBe(2);
    expect(initialPageCalls).toBe(1);

    // Immediate synchronous cache retrieval (initial items + background prefetched items)
    const cached = contentShareService.getCachedRecipients('user-1');
    expect(cached).not.toBeNull();
    expect(cached?.length).toBeGreaterThanOrEqual(2);

    // Second loadRecipients hits cache without re-requesting the initial page
    const second = await contentShareService.loadRecipients('user-1');
    expect(second.length).toBeGreaterThanOrEqual(2);
    expect(initialPageCalls).toBe(1);
  });

  test('loadRecipients with forceRefresh bypasses cache', async () => {
    contentShareService.clearCache();
    initialPageCalls = 0;

    await contentShareService.loadRecipients('user-1');
    expect(initialPageCalls).toBe(1);

    await contentShareService.loadRecipients('user-1', true);
    expect(initialPageCalls).toBe(2);
  });

  test('sendToChats sends shareUrl and sequentially sends attachedMessage for each recipient', async () => {
    sentMessages = [];

    const result = await contentShareService.sendToChats(
      'sender-1',
      ['friend-1', 'friend-2'],
      'https://ourlime.com/limes/lime-123',
      'Check out this awesome lime!'
    );

    expect(result.sentCount).toBe(2);
    expect(result.failedCount).toBe(0);

    const friend1Messages = sentMessages.filter((m) => m.recipientId === 'friend-1');
    expect(friend1Messages.length).toBe(2);
    expect(friend1Messages[0].message).toBe('https://ourlime.com/limes/lime-123');
    expect(friend1Messages[1].message).toBe('Check out this awesome lime!');

    const friend2Messages = sentMessages.filter((m) => m.recipientId === 'friend-2');
    expect(friend2Messages.length).toBe(2);
    expect(friend2Messages[0].message).toBe('https://ourlime.com/limes/lime-123');
    expect(friend2Messages[1].message).toBe('Check out this awesome lime!');
  });

  test('sendToChats only sends shareUrl if attachedMessage is empty or whitespace', async () => {
    sentMessages = [];

    const result = await contentShareService.sendToChats(
      'sender-1',
      ['friend-1'],
      'https://ourlime.com/post/post-456',
      '   '
    );

    expect(result.sentCount).toBe(1);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0]).toEqual({
      recipientId: 'friend-1',
      message: 'https://ourlime.com/post/post-456',
      senderId: 'sender-1',
    });
  });

  test('shareExternally delegates to native Share.share', async () => {
    sharedCalls = [];
    const didShare = await contentShareService.shareExternally({
      title: 'Shared Title',
      message: 'Shared Message',
      url: 'https://ourlime.com/events/event-789',
    });

    expect(didShare).toBe(true);
    expect(sharedCalls.length).toBe(1);
    expect(sharedCalls[0]).toEqual({
      title: 'Shared Title',
      message: 'Shared Message',
      url: 'https://ourlime.com/events/event-789',
    });
  });
});
