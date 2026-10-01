const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('ConversationResourceService uses conversation summaries as the source of truth and lets fresh data win', () => {
  const code = read('lib/services/ConversationResourceService.ts');
  // The old chats-collection listener recomputed unread from the legacy array and zeroed it on every new message.
  assert.doesNotMatch(code, /collection\(db, 'chats'\)/);
  assert.match(code, /collection\(db, 'users', userId, 'conversationSummaries'\)/);
  // Fresh summary fields overwrite the stored copy for the same conversation.
  assert.match(code, /\{ \.\.\.previous, \.\.\.item/);
  // Own sent messages never count as unread.
  assert.match(code, /unreadCount: \(this\.activeUserId && lastMessageSenderId === this\.activeUserId\)\s*\?\s*0/);
});

test('ChatDataService sends update conversation summaries: 0 for the sender, +1 for the receiver', () => {
  const code = read('lib/services/ChatDataService.ts');
  assert.match(code, /lastMessageSenderId: senderId/);
  assert.match(code, /conversationSummaries', receiverId\), \{[\s\S]*?unreadCount: 0,/);
  assert.match(code, /conversationSummaries', senderId\), \{[\s\S]*?unreadCount: increment\(1\)/);
  const messaging = read('lib/messaging/MessagingService.ts');
  assert.match(messaging, /unreadCount: friend\.lastMessageSenderId === currentUserId \? 0 : friend\.unreadCount/);
  assert.match(messaging, /public async markMessagesAsRead\(currentUserId: string, peerId: string\)/);
});

test('SimpleChatMessageService marks a conversation read through ChatDataService', () => {
  const code = read('lib/services/SimpleChatMessageService.ts');
  assert.match(code, /this\.chatData\.updateConversation\(peerId, 'read'\)/);
});

test('Chat screen patches unreadCount = 0 on message send and on unmount cleanup', () => {
  const code = read('app/chat/[id]/index.tsx');
  assert.match(code, /void conversationResourceService\.patchConversation\(currentUserId, friendId, \{[\s\S]*?unreadCount: 0/);
  assert.match(code, /return \(\) => \{[\s\S]*?void simpleChatMessageService\.markRead\(friendId\);[\s\S]*?void conversationResourceService\.patchConversation\(currentUserId, friendId, \{ unreadCount: 0 \}\);/);
});

test('Chat list and layout tab badge guard hasUnread against user own sent messages', () => {
  const chatList = read('app/(tabs)/Chat.tsx');
  assert.match(chatList, /user\.lastMessageSenderId !== currentUserId && \(user\.unreadCount \?\? 0\) > 0/);
  assert.match(chatList, /c\.lastMessageSenderId !== currentUserId && \(c\.unreadCount \?\? 0\) > 0/);
  assert.match(chatList, /item\?\.lastMessageSenderId !== currentUserId && \(item\?\.unreadCount \?\? 0\) > 0/);

  const tabLayout = read('app/(tabs)/_layout.tsx');
  assert.match(tabLayout, /if \(currentUserId && item\.lastMessageSenderId === currentUserId\) return sum;/);
});
