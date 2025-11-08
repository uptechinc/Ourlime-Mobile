import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    StyleSheet,
    Alert
} from 'react-native';
// import { MessagingService } from '@/lib/messaging/MessagingService';
// import { useProfileStore } from '@/src/store/useProfileStore';
// import { Timestamp } from 'firebase/firestore';
// import { format, isToday, isYesterday } from 'date-fns';
// import { Send, Paperclip, Smile, MessageSquare, Check, CheckCheck, ArrowLeft, X, Reply, Trash } from 'lucide-react';
// import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
// import ConfirmationDialog from '@/components/common/ConfirmationDialog';
import { Message, FriendMessagesProps, MessageReactions, ReplyReference } from '@/lib/types';

// Mock data for development
const mockUserData = {
    id: 'mock-user-id',
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe'
};

const mockSelectedFriend = {
    id: 'mock-friend-id',
    firstName: 'Jane',
    lastName: 'Smith',
    userName: 'janesmith',
    profileImage: '/images/transparentLogo.png'
};

// Simple date formatting functions to replace date-fns
const formatDate = (date: Date, formatStr: string): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    if (formatStr === 'h:mm a') {
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    if (formatStr === 'MMM d, h:mm a') {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}, ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    return date.toLocaleDateString();
};

const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

const isYesterday = (date: Date): boolean => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
};

// export const FriendMessages = ({ selectedFriend = mockSelectedFriend, isCompact, onBack }: FriendMessagesProps) => {
export default function FriendMessages() {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    // const messagingService = MessagingService.getInstance();
    const userData = mockUserData; // useProfileStore();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const messagesEndRef = useRef<ScrollView>(null);
    const messageRefs = useRef<{ [key: string]: View }>({});
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [messageReactions, setMessageReactions] = useState<MessageReactions>({});
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);

    /**
     * Format message timestamp for display
     */
    const formatMessageTime = (timestamp: any) => {
        const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 60) {
            if (diffInMinutes < 1) return 'just now';
            if (diffInMinutes === 1) return '1 minute ago';
            return `${diffInMinutes} minutes ago`;
        }

        if (isToday(date)) return formatDate(date, 'h:mm a');
        if (isYesterday(date)) return `Yesterday at ${formatDate(date, 'h:mm a')}`;
        return formatDate(date, 'MMM d, h:mm a');
    };

    /**
     * Generate unique message ID for referencing
     */
    const getMessageId = (msg: Message): string => {
        return msg.id || `${msg.timestamp.seconds || Date.now()}-${msg.timestamp.nanoseconds || 0}`;
    };

    /**
     * Scroll to a specific message
     */
    const scrollToMessage = (messageId: string) => {
        // In React Native, we would use scrollTo method on ScrollView
        // This is a simplified version for mobile
        console.log('Scroll to message:', messageId);
    };

    const router = useRouter();

    // Commented out Firebase subscription for React Native
    // useEffect(() => {
    //     if (!selectedFriend?.id) return;

    //     const unsubscribe = messagingService.subscribeToMessages(
    //         selectedFriend.id,
    //         userData.id || '',
    //         (newMessages) => {
    //             setMessages(newMessages.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds));
    //         }
    //     );

    //     return () => unsubscribe();
    // }, [selectedFriend?.id, messagingService, userData.id, setMessages]);

    /**
     * Send message with optional reply
     */
    // const handleSendMessage = async () => {
    //     if (!message.trim() || !selectedFriend?.id) return;

    //     const messageText = message.trim();
    //     const uid = userData.id;
    //     if (!uid) return;
    //     let replyReference: ReplyReference | undefined;

    //     // Create reply reference if replying to a message
    //     if (replyTo) {
    //         replyReference = {
    //             messageId: getMessageId(replyTo),
    //             originalMessage: replyTo.message,
    //             originalSenderId: replyTo.senderId,
    //             originalTimestamp: replyTo.timestamp
    //         };
    //     }

    //     const messageData: Message = {
    //         id: Date.now().toString(),
    //         message: messageText,
    //         senderId: uid,
    //         receiverId: selectedFriend.id,
    //         timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, // Mock timestamp
    //         status: 'sent',
    //         ...(replyReference && { replyTo: replyReference })
    //     };

    //     setMessages(prev => [...prev, messageData]);
    //     setMessage('');
    //     setReplyTo(null); // Clear reply state

    // Commented out Firebase messaging for React Native
    // try {
    //     await messagingService.sendMessage(
    //         selectedFriend.id,
    //         messageText,
    //         uid,
    //         replyReference
    //     );
    // } catch (error) {
    //     console.error('Error sending message:', error);
    //     setMessages(prev => prev.filter(msg => msg.id !== messageData.id));
    //     setMessage(messageText);
    //     setReplyTo(replyTo); // Restore reply state on error
    // }
    //};

    // React Native doesn't have key events like web, so we'll handle this differently
    // const handleSubmit = () => {
    //     handleSendMessage();
    // };

    // Simplified emoji handling for React Native
    // const handleEmojiClick = (emoji: string) => {
    //     setMessage(prev => prev + emoji);
    //     setShowEmojiPicker(false);
    // };

    // const handleReply = (msg: Message) => setReplyTo(msg);
    // const handleCancelReply = () => setReplyTo(null);

    // const handleDeleteClick = (msg: Message) => {
    //     setMessageToDelete(msg);
    //     setShowDeleteConfirm(true);
    // };

    // const handleDeleteConfirm = async () => {
    //     if (!messageToDelete) return;
    //     const uid = userData.id;
    //     if (!uid) return;

    // Commented out Firebase delete for React Native
    // try {
    //     const success = await messagingService.deleteMessage(
    //         selectedFriend.id,
    //         uid,
    //         messageToDelete.timestamp.seconds
    //     );

    //     if (success) {
    //         setMessages((prev) => prev.filter((m) => m.timestamp.seconds !== messageToDelete.timestamp.seconds));
    //     } else {
    //         console.error('Failed to delete message from database');
    //     }
    // } catch (error) {
    //     console.error('Error deleting message:', error);
    // } finally {
    //     setShowDeleteConfirm(false);
    //     setMessageToDelete(null);
    // }

    // Local delete for React Native
    //     setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
    //     setShowDeleteConfirm(false);
    //     setMessageToDelete(null);
    // };

    // const handleDeleteCancel = () => {
    //     setShowDeleteConfirm(false);
    //     setMessageToDelete(null);
    // };

    // const handleReact = (msgId: string | undefined, emoji: string) => {
    //     const uid = userData.id;
    //     if (!msgId || !uid) return;
    //     setMessageReactions((prev) => {
    //         const reactions = { ...prev };
    //         if (!reactions[msgId]) reactions[msgId] = {};
    //         if (!reactions[msgId][emoji]) reactions[msgId][emoji] = [];
    //         if (reactions[msgId][emoji].includes(uid)) {
    //             reactions[msgId][emoji] = reactions[msgId][emoji].filter((id) => id !== uid);
    //         } else {
    //             reactions[msgId][emoji].push(uid);
    //         }
    //         return { ...reactions };
    //     });
    //     setShowReactionPicker(null);
    // };

    // // Handle delete confirmation alert
    // useEffect(() => {
    //     if (showDeleteConfirm) {
    //         Alert.alert(
    //             "Delete Message",
    //             "Are you sure you want to delete this message? This action cannot be undone.",
    //             [
    //                 { text: "Cancel", onPress: handleDeleteCancel, style: "cancel" },
    //                 { text: "Delete", onPress: handleDeleteConfirm, style: "destructive" }
    //             ]
    //         );
    //     }
    // }, [showDeleteConfirm, handleDeleteCancel, handleDeleteConfirm]);

    return (
        <View style={styles.container}>
            {/* Message Header */}
            <View style={styles.header}>
                {/* {isCompact && ( */}
                <TouchableOpacity onPress={() => router.push('/chat/page')}
                    style={styles.backButton}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                {/* )} */}
                <View style={styles.headerContent}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: 'https://www.w3schools.com/w3images/avatar2.png' }}
                            style={styles.avatar}
                        />
                    </View>
                    <View>
                        <Text style={styles.userName}>
                            John Doe
                        </Text>
                        <Text style={styles.userHandle}>johndoe123</Text>
                    </View>
                </View>
            </View>

            {/* Messages Area */}
            <ScrollView style={styles.messagesArea} ref={messagesEndRef}>
                {replyTo && (
                    <View style={styles.replyContainer}>
                        <Text style={styles.replyText}>
                            Replying to John {/* {replyTo.senderId === userData.id ? 'yourself' : selectedFriend.firstName} */}
                        </Text>
                        <Text style={styles.replyMessage} numberOfLines={1}>{replyTo.message}</Text>
                        <TouchableOpacity style={styles.cancelReplyButton}>
                            <Text style={styles.cancelReplyIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {messages.length > 0 ? (
                    <View style={styles.messagesList}>
                        {messages.map((msg, index) => {
                            const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;
                            const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== msg.senderId;
                            const isOwn = msg.senderId === userData.id;
                            const msgId = getMessageId(msg);

                            return (
                                <View
                                    key={msgId}
                                    ref={(el) => {
                                        if (el) messageRefs.current[msgId] = el;
                                    }}
                                    style={[styles.messageGroup, isOwn ? styles.messageGroupOwn : styles.messageGroupOther]}
                                >
                                    {/* Reply Reference Display */}
                                    {msg.replyTo && (
                                        <TouchableOpacity
                                            style={[styles.replyReference, isOwn ? styles.replyReferenceOwn : styles.replyReferenceOther]}
                                            onPress={() => scrollToMessage(msg.replyTo!.messageId)}
                                        >
                                            <Text style={styles.replyReferenceSender}>
                                                You {/* {msg.replyTo.originalSenderId === userData.id ? 'You' : selectedFriend.firstName} */}
                                            </Text>
                                            <Text style={styles.replyReferenceMessage} numberOfLines={1}>
                                                {msg.replyTo.originalMessage}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Sender Avatar */}
                                    {msg.senderId !== userData.id && isFirstInGroup && (
                                        <View style={styles.senderAvatar}>
                                            <Image
                                                source={{ uri: 'https://www.w3schools.com/w3images/avatar2.png' }}
                                                style={styles.senderAvatarImage}
                                            />
                                        </View>
                                    )}

                                    {/* Message Bubble */}
                                    <View
                                        style={[
                                            styles.messageBubble,
                                            isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
                                            !isLastInGroup && styles.messageBubbleGrouped
                                        ]}
                                    >
                                        <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
                                            {msg.message}
                                        </Text>

                                        {/* Action Buttons - Always visible in React Native */}
                                        <View style={[styles.actionButtons, isOwn ? styles.actionButtonsOwn : styles.actionButtonsOther]}>
                                            <TouchableOpacity
                                                // onPress={() => handleReply(msg)}
                                                style={styles.actionButton}
                                            >
                                                <Text style={styles.actionButtonIcon}>↩</Text>
                                            </TouchableOpacity>
                                            {isOwn && (
                                                <TouchableOpacity
                                                    // onPress={() => handleDeleteClick(msg)}
                                                    style={styles.actionButton}
                                                >
                                                    <Text style={[styles.actionButtonIcon, styles.deleteIcon]}>🗑</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                onPress={() => setShowReactionPicker(msgId)}
                                                style={styles.actionButton}
                                            >
                                                <Text style={styles.actionButtonIcon}>😊</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Reaction Picker */}
                                        {showReactionPicker === msgId && (
                                            <View style={styles.reactionPicker}>
                                                {["👍", "😂", "❤️", "😮", "😢", "😡"].map((emoji) => (
                                                    <TouchableOpacity
                                                        key={emoji}
                                                        // onPress={() => handleReact(msgId, emoji)}
                                                        style={styles.reactionButton}
                                                    >
                                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    {/* Message Reactions */}
                                    {messageReactions[msgId] && (
                                        <View style={styles.messageReactions}>
                                            {Object.entries(messageReactions[msgId]).map(([emoji, users]) => (
                                                users.length > 0 && (
                                                    <View key={emoji} style={styles.reactionChip}>
                                                        <Text style={styles.reactionChipText}>
                                                            {emoji} {users.length}
                                                        </Text>
                                                    </View>
                                                )
                                            ))}
                                        </View>
                                    )}

                                    {/* Message Timestamp and Status */}
                                    <View style={[styles.messageMeta, isOwn ? styles.messageMetaOwn : styles.messageMetaOther]}>
                                        <Text style={styles.messageTime}>
                                            {formatMessageTime(msg.timestamp)}
                                        </Text>
                                        {isOwn && (
                                            <View style={styles.messageStatus}>
                                                {msg.status === 'sent' && <Text style={styles.statusIcon}>✓</Text>}
                                                {msg.status === 'delivered' && <Text style={styles.statusIcon}>✓✓</Text>}
                                                {msg.status === 'read' && <Text style={[styles.statusIcon, styles.statusRead]}>✓✓</Text>}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyStateIcon}>
                            <Text style={styles.emptyStateIconText}>💬</Text>
                        </View>
                        <Text style={styles.emptyStateTitle}>No messages yet</Text>
                        <Text style={styles.emptyStateSubtitle}>Send a message to John{/* {selectedFriend.firstName} */}</Text>
                    </View>
                )}
            </ScrollView>

            {/* Message Input */}
            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <TouchableOpacity
                        style={styles.inputButton}
                        onPress={() => {/* Handle attach file */ }}
                    >
                        <Text style={styles.inputButtonIcon}>📎</Text>
                    </TouchableOpacity>
                    <TextInput
                        ref={inputRef}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="Type a message..."
                        style={styles.textInput}
                        multiline
                        maxLength={1000}
                    />
                    <View style={styles.emojiContainer}>
                        <TouchableOpacity
                            style={styles.inputButton}
                            onPress={() => setShowEmojiPicker((prev) => !prev)}
                        >
                            <Text style={styles.inputButtonIcon}>😊</Text>
                        </TouchableOpacity>
                        {showEmojiPicker && (
                            <View style={styles.emojiPicker}>
                                {["😀", "😂", "😍", "😮", "😢", "😡", "👍", "👎", "❤️", "🎉"].map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        // onPress={() => handleEmojiClick(emoji)}
                                        style={styles.emojiButton}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        // onPress={handleSendMessage}
                        style={styles.sendButton}
                    >
                        <Text style={styles.sendButtonIcon}>➤</Text>
                    </TouchableOpacity>
                </View>
            </View>

        </View>
    );
};

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb', // gray-50
    },
    header: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb', // gray-200
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        zIndex: 99999990,
    },
    backButton: {
        padding: 6,
        marginRight: 8,
    },
    backIcon: {
        fontSize: 16,
        color: '#374151', // gray-700
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        marginRight: 12,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    userName: {
        fontWeight: '500',
        fontSize: 16,
        color: '#111827', // gray-900
    },
    userHandle: {
        fontSize: 12,
        color: '#6b7280', // gray-500
    },
    messagesArea: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    replyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f0fdf4', // green-50
        borderLeftWidth: 4,
        borderLeftColor: '#22c55e', // green-500
        marginBottom: 8,
        borderRadius: 6,
    },
    replyText: {
        fontWeight: '500',
        color: '#22c55e', // green-500
        fontSize: 12,
    },
    replyMessage: {
        color: '#374151', // gray-700
        fontSize: 12,
        marginLeft: 8,
        flex: 1,
    },
    cancelReplyButton: {
        marginLeft: 'auto',
    },
    cancelReplyIcon: {
        color: '#9ca3af', // gray-400
        fontSize: 16,
    },
    messagesList: {
        flexDirection: 'column',
        gap: 8,
    },
    messageGroup: {
        flexDirection: 'column',
        position: 'relative',
    },
    messageGroupOwn: {
        alignItems: 'flex-end',
    },
    messageGroupOther: {
        alignItems: 'flex-start',
    },
    replyReference: {
        marginBottom: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f3f4f6', // gray-100
        borderLeftWidth: 2,
        borderLeftColor: '#22c55e', // green-500
        borderRadius: 4,
        maxWidth: '70%',
    },
    replyReferenceOwn: {
        marginRight: 8,
    },
    replyReferenceOther: {
        marginLeft: 8,
    },
    replyReferenceSender: {
        fontSize: 12,
        color: '#22c55e', // green-500
        fontWeight: '500',
    },
    replyReferenceMessage: {
        fontSize: 12,
        color: '#4b5563', // gray-600
    },
    senderAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 4,
        flexShrink: 0,
    },
    senderAvatarImage: {
        width: '100%',
        height: '100%',
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    messageBubbleOwn: {
        backgroundColor: '#22c55e', // green-500
        borderTopRightRadius: 16,
        borderTopLeftRadius: 16,
        borderBottomRightRadius: 4,
        marginRight: 8,
    },
    messageBubbleOther: {
        backgroundColor: 'white',
        borderTopRightRadius: 16,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        marginLeft: 8,
    },
    messageBubbleGrouped: {
        marginBottom: 2,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    messageTextOwn: {
        color: 'white',
    },
    messageTextOther: {
        color: '#111827', // gray-900
    },
    actionButtons: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateY: -20 }],
        flexDirection: 'column',
        gap: 4,
        zIndex: 50,
    },
    actionButtonsOwn: {
        right: -64,
    },
    actionButtonsOther: {
        left: -64,
    },
    actionButton: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        borderRadius: 20,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    actionButtonIcon: {
        fontSize: 16,
        color: '#4b5563', // gray-600
    },
    deleteIcon: {
        color: '#dc2626', // red-600
    },
    reactionPicker: {
        position: 'absolute',
        top: -50,
        left: '50%',
        transform: [{ translateX: -100 }],
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        borderRadius: 12,
        padding: 8,
        flexDirection: 'row',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 99999992,
    },
    reactionButton: {
        padding: 4,
    },
    reactionEmoji: {
        fontSize: 20,
    },
    messageReactions: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 4,
        marginLeft: 8,
    },
    reactionChip: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    reactionChipText: {
        fontSize: 16,
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    messageMetaOwn: {
        marginRight: 4,
    },
    messageMetaOther: {
        marginLeft: 28,
    },
    messageTime: {
        fontSize: 10,
        color: '#6b7280', // gray-500
    },
    messageStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        fontSize: 12,
        color: '#9ca3af', // gray-400
    },
    statusRead: {
        color: '#3b82f6', // blue-500
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f3f4f6', // gray-100
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyStateIconText: {
        fontSize: 32,
    },
    emptyStateTitle: {
        fontWeight: '500',
        fontSize: 16,
        color: '#6b7280', // gray-500
        marginBottom: 4,
    },
    emptyStateSubtitle: {
        fontSize: 14,
        color: '#6b7280', // gray-500
    },
    inputContainer: {
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 99999990,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    inputButton: {
        padding: 8,
        borderRadius: 20,
    },
    inputButtonIcon: {
        fontSize: 20,
        color: '#6b7280', // gray-500
    },
    textInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        backgroundColor: '#f3f4f6', // gray-100
        borderRadius: 20,
        maxHeight: 120,
        minHeight: 40,
    },
    emojiContainer: {
        position: 'relative',
    },
    emojiPicker: {
        position: 'absolute',
        bottom: 50,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb', // gray-200
        borderRadius: 12,
        padding: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 99999992,
    },
    emojiButton: {
        padding: 4,
    },
    emojiText: {
        fontSize: 20,
    },
    sendButton: {
        padding: 8,
        backgroundColor: '#22c55e', // green-500
        borderRadius: 20,
    },
    sendButtonIcon: {
        fontSize: 20,
        color: 'white',
    },
});
