import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
// React's own JSX factory: NativeWind's Babel plugin rewrites JSX and createElement, but not direct calls to this.
import { jsx as createNativeElement } from 'react/jsx-runtime';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Image,
    ActivityIndicator,
    Modal,
    Pressable,
    Keyboard,
    FlatList,
    ScrollView,
    Clipboard,
    type ImageSourcePropType,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollViewProps,
} from 'react-native';
import { toast } from 'sonner-native';
import ReportPostModal from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ReportPostModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { messagingService, ChatUploadCancelledError, type FullMessage, type Attachment } from '@/lib/messaging/MessagingService';
import { describeMessageForReply, replyPreviewText } from '@/lib/messaging/replyPreview';
import { checkChatAttachment, maxVideoSecondsForLimit, readFileSize, resolveChatMimeType, CHAT_IMAGE_MAX_DIMENSION, MAX_CHAT_FILE_BYTES, formatMegabytes } from '@/lib/messaging/ChatAttachmentPolicy';
import ChatVideoViewer from '@/components/chat/ChatVideoViewer';
import { ChatImageBubble, ChatVideoBubble } from '@/components/chat/ChatMediaBubbles';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import VoiceNoteRecorder from '@/components/chat/VoiceNoteRecorder';
import VideoTrimModal, { type TrimmedVideoResult, type VideoTrimSource } from '@/components/media/VideoTrimModal';
import { chatFileShareService } from '@/lib/services/ChatFileShareService';
import { voiceNotePlaybackService } from '@/lib/services/VoiceNotePlaybackService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { StickerService, normalizeStickerUrl } from '@/lib/sticker/StickerService';
import { getLocalStickerSource, getRandomLocalStickerSource } from '@/assets/images/stickers/stickerMap';
import { EmojiStickerKeyboard } from '@/components/chat/EmojiStickerKeyboard';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { ChatSettingsMenu } from '@/components/chat/ChatSettingsMenu';
import { ChatMediaPanel } from '@/components/chat/ChatMediaPanel';
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { DocumentPreviewModal, formatFileSize, getAttachmentPreviewKind } from '@/components/chat/DocumentPreviewModal';
import { LinkPreviewMessage, LinkInputBanner } from '@/components/chat/LinkPreviewMessage';
import { findFirstUrl } from '@/lib/services/OpenGraphService';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { DeleteMessageModal } from '@/components/chat/DeleteMessageModal';
import type { ReplyReference } from '@/lib/types/message';
import type { Sticker } from '@/lib/types/sticker';
import type { Timestamp } from 'firebase/firestore';
import { useSimpleChatMessages } from '@/lib/hooks/useSimpleChatMessages';
import { useTypingIndicator } from '@/lib/hooks/useTypingIndicator';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { ChatConversationSkeleton } from '@/components/ui/Skeleton';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { presenceService, type PresenceState } from '@/lib/services/PresenceService';
import { useCallCoordinator } from '@/lib/contexts/CallContext';
import { useCallStore } from '@/lib/store/useCallStore';
import { useCallElsewhereNotice } from '@/lib/hooks/useCallElsewhereNotice';
import { simpleChatMessageService } from '@/lib/services/SimpleChatMessageService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';
import { sharedPostPresentationService } from '@/lib/services/SharedPostPresentationService';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

const authService = AuthService.getInstance();
const relationshipService = RelationshipService.getInstance();
const stickerService = StickerService.getInstance();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMessageTime(ts: Timestamp | { seconds: number; nanoseconds: number } | undefined): string {
    if (!ts) return '';
    const date = new Date((ts.seconds ?? 0) * 1000);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dh = h % 12 || 12;
    const timeStr = `${dh}:${m.toString().padStart(2, '0')} ${ampm}`;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return timeStr;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function getMsgId(message: FullMessage): string {
    return messagingService.getMessageIdentity(message);
}

/** Reply timestamps are Firestore Timestamps from the app and plain {seconds, nanoseconds} maps from the website. */
function readReplySeconds(value: unknown): number | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    if ('seconds' in value && typeof value.seconds === 'number') return value.seconds;
    if ('_seconds' in value && typeof value._seconds === 'number') return value._seconds;
    return undefined;
}

/** Index of a reply's original among the loaded messages (by id, else by send time and sender), or -1. */
function findReplyTarget(messages: FullMessage[], reply: ReplyReference): number {
    const byId = messages.findIndex((message) => getMsgId(message) === reply.messageId);
    if (byId >= 0) return byId;
    const seconds = readReplySeconds(reply.originalTimestamp);
    if (seconds === undefined) return -1;
    const sameSecond = (message: FullMessage) => message.timestamp.seconds === seconds;
    const bySender = messages.findIndex((message) => sameSecond(message) && message.senderId === reply.originalSenderId);
    return bySender >= 0 ? bySender : messages.findIndex(sameSecond);
}

// How far from the newest message the reader must scroll before "jump to latest" appears.
const JUMP_TO_LATEST_DISTANCE = 600;

/**
 * The message list's scroll view, created outside NativeWind: its wrapper drops the `ref` of React Native
 * 0.86's function-component ScrollView, which left the list unable to scroll programmatically (jumping to a reply
 * or to the latest message silently did nothing).
 */
function renderMessageScrollView(props: ScrollViewProps): ReactElement<ScrollViewProps> {
    return createNativeElement(ScrollView, props) as ReactElement<ScrollViewProps>;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

// ─── System Message Renderer ─────────────────────────────────────────────────

type SystemMessageProps = {
    msg: FullMessage;
    currentUserId: string;
    friendFirstName: string;
    onJoinCall: (type: 'audio' | 'video') => void;
    callActive: boolean;
};

function SystemMessage({ msg, currentUserId, friendFirstName, onJoinCall, callActive }: SystemMessageProps) {
    const { colors } = useAppTheme();
    const isOwn = msg.senderId === currentUserId;

    if (msg.message === '[SYS:CALL_ENDED]') {
        return (
            <View style={{ alignItems: 'center', marginVertical: 10, paddingHorizontal: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(100,116,139,0.1)',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    gap: 6,
                }}>
                    <Icon name="phone-off" size={12} color="#94a3b8" />
                    <Text style={{ fontSize: 12, color: colors.mutedText, fontWeight: '500' }}>
                        Call ended · {formatMessageTime(msg.timestamp)}
                    </Text>
                </View>
            </View>
        );
    }

    const isVideo = msg.message === '[SYS:VIDEO_CALL_INVITE]';
    const isVoice = msg.message === '[SYS:VOICE_CALL_INVITE]';

    if (isVideo || isVoice) {
        return (
            <View style={{
                alignItems: isOwn ? 'flex-end' : 'flex-start',
                paddingHorizontal: 12,
                marginVertical: 4,
            }}>
                <View style={{
                    backgroundColor: isOwn ? '#10b981' : colors.elevated,
                    borderRadius: 16,
                    borderWidth: isOwn ? 0 : 1,
                    borderColor: colors.border,
                    padding: 16,
                    alignItems: 'center',
                    minWidth: 200,
                    maxWidth: 260,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.07,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#f0fdf4',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                    }}>
                        <Icon name={isVideo ? 'video' : 'phone'} size={24} color={isOwn ? '#ffffff' : '#10b981'} />
                    </View>

                    <Text style={{ fontSize: 15, fontWeight: '700', color: isOwn ? '#ffffff' : colors.text, textAlign: 'center', marginBottom: 4 }}>
                        {isOwn
                            ? `You started a ${isVideo ? 'video' : 'voice'} call`
                            : `${friendFirstName} is calling you...`}
                    </Text>

                    {callActive ? (
                        <>
                            {!isOwn ? (
                                <TouchableOpacity
                                    onPress={() => onJoinCall(isVideo ? 'video' : 'audio')}
                                    style={{
                                        marginTop: 10,
                                        backgroundColor: '#10b981',
                                        borderRadius: 12,
                                        paddingHorizontal: 24,
                                        paddingVertical: 10,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <Icon name={isVideo ? 'video' : 'phone'} size={16} color="#ffffff" />
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>Join Call</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => onJoinCall(isVideo ? 'video' : 'audio')}
                                    style={{
                                        marginTop: 10,
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                        borderRadius: 12,
                                        paddingHorizontal: 24,
                                        paddingVertical: 10,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.35)',
                                    }}
                                >
                                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>Rejoin Call</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View style={{
                            marginTop: 10,
                            backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(100,116,139,0.1)',
                            borderRadius: 12,
                            paddingHorizontal: 20,
                            paddingVertical: 9,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <Icon name="phone-off" size={14} color={isOwn ? 'rgba(255,255,255,0.7)' : '#94a3b8'} />
                            <Text style={{ color: isOwn ? 'rgba(255,255,255,0.8)' : '#94a3b8', fontSize: 13, fontWeight: '600' }}>
                                Call Ended
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    return null;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

type MessageBubbleProps = {
    msg: FullMessage;
    currentUserId: string;
    friend: UserProfile | null;
    onReply: (msg: FullMessage) => void;
    onDelete: (msg: FullMessage, deleteForEveryone: boolean) => void;
    onReact: (msg: FullMessage, emoji: string) => void;
    onForward: (msg: FullMessage) => void;
    onImagePress: (url: string) => void;
    onPreviewDoc: (attachment: Attachment) => void;
    onOpenVideo: (attachment: Attachment) => void;
    /** Quoted text for this message's reply box (voice notes / files have no text of their own). */
    replyPreview: string | null;
    onPressReply: (reply: ReplyReference) => void;
    /** Briefly tinted after jumping to this message from a reply. */
    isHighlighted: boolean;
    /** Only the newest message animates in; older pages and jump windows appear without motion. */
    animateEntry: boolean;
    isStarred: boolean;
    onToggleStar: (msg: FullMessage) => void;
    onEdit: (msg: FullMessage) => void;
    onReport: (msg: FullMessage) => void;
};

// Same edit window the server enforces (ChatDataService EDIT_WINDOW_MS).
const MESSAGE_EDIT_WINDOW_MS = 20 * 60 * 1000;

/** Tells the user why a tap did nothing while something is still uploading or sending (instead of a silent no-op). */
function notifyBusy(message: string): void {
    toast(message, { id: 'chat-busy' });
    void interactionFeedbackService.play('warning');
}

function MessageBubble({ msg, currentUserId, friend, onReply, onDelete, onReact, onForward, onImagePress, onPreviewDoc, onOpenVideo, replyPreview, onPressReply, isHighlighted, animateEntry, isStarred, onToggleStar, onEdit, onReport }: MessageBubbleProps) {
    const { colors, isDark } = useAppTheme();
    const [showActions, setShowActions] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    if (!friend) return null;
    const isOwn = msg.senderId === currentUserId;

    const attachmentKind = msg.attachment ? getAttachmentPreviewKind(msg.attachment) : null;
    const isImage = attachmentKind === 'image';
    const isVideo = attachmentKind === 'video';
    const isAudioFile = attachmentKind === 'audio';
    const isDoc = Boolean(msg.attachment) && !isImage && !isVideo && !isAudioFile;
    const hasText = msg.message?.trim().length > 0;
    const stickerUrl = normalizeStickerUrl(msg.stickerUrl ?? msg.stickerData?.stickerUrl);
    const isSticker = msg.type === 'sticker' || !!stickerUrl;
    const audioUrl = msg.audioUrl ?? msg.voiceNoteData?.audioUrl;
    const audioDuration = msg.audioDuration ?? msg.voiceNoteData?.audioDuration ?? 0;
    const isVoiceNote = msg.type === 'voiceNote' || !!audioUrl;
    const isDeleted = msg.isDeletedForEveryone;

    const sharedContent = hasText ? sharedContentMessageService.parse(msg.message) : null;
    const isSharedMediaCard = sharedContent?.kind === 'lime' || sharedContent?.kind === 'post';
    const visibleText = sharedContent?.visibleText ?? msg.message;
    const hasVisibleText = visibleText.trim().length > 0;
    const detectedUrl = sharedContent?.sourceUrl ?? (hasText ? findFirstUrl(msg.message) : null);

    const reactionSummary: { emoji: string; count: number; iMine: boolean }[] = Object.entries(msg.reactions ?? {}).map(([emoji, users]) => ({
        emoji,
        count: users.length,
        iMine: users.includes(currentUserId),
    }));

    return (
        <Animated.View
            entering={animateEntry ? FadeInUp.springify().damping(18).stiffness(220) : undefined}
            style={{ backgroundColor: isHighlighted ? 'rgba(16,185,129,0.18)' : 'transparent' }}
        >
        <Pressable
            onLongPress={() => setShowActions(true)}
            style={{
                flexDirection: isOwn ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                marginBottom: 4,
                paddingHorizontal: 12,
            }}
        >
            {!isOwn && (
                <View style={{ marginRight: 6, marginBottom: 2 }}>
                    <UserAvatar profileImage={friend.profilePicture} firstName={friend.firstName ?? 'U'} size={26} />
                </View>
            )}

            <View style={{ maxWidth: '78%' }}>
                {msg.replyTo && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go to the original message"
                        onPress={() => { if (msg.replyTo) onPressReply(msg.replyTo); }}
                        onLongPress={() => setShowActions(true)}
                        // The quote sits above the bubble (on the chat background), so it uses surface colours on both sides.
                        style={{
                            backgroundColor: colors.elevated,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignSelf: isOwn ? 'flex-end' : 'flex-start',
                            borderLeftWidth: 3,
                            borderLeftColor: '#10b981',
                            borderRadius: 8,
                            padding: 7,
                            marginBottom: 4,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', marginBottom: 2 }}>
                            {msg.replyTo.originalSenderId === currentUserId ? 'You' : friend.firstName}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.secondaryText }} numberOfLines={1}>
                            {replyPreview ?? msg.replyTo.originalMessage}
                        </Text>
                    </Pressable>
                )}

                {msg.isForwarded && !isDeleted && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Icon name="corner-up-right" size={11} color={colors.mutedText} />
                        <Text style={{ fontSize: 11, color: colors.mutedText, marginLeft: 4, fontStyle: 'italic' }}>Forwarded</Text>
                    </View>
                )}

                {isSticker && stickerUrl ? (
                    <TouchableOpacity onPress={() => onImagePress(stickerUrl)}>
                        <StickerBubble
                            url={stickerUrl}
                            width={msg.stickerWidth ?? msg.stickerData?.stickerWidth ?? 160}
                            height={msg.stickerHeight ?? msg.stickerData?.stickerHeight ?? 160}
                            time={formatMessageTime(msg.timestamp)}
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={{
                        backgroundColor: isSharedMediaCard ? 'transparent' : isOwn ? '#10b981' : colors.elevated,
                        borderRadius: 18,
                        borderBottomRightRadius: isOwn ? 4 : 18,
                        borderBottomLeftRadius: isOwn ? 18 : 4,
                        paddingHorizontal: isSharedMediaCard ? 0 : isDeleted || isImage || isVideo || isVoiceNote ? 10 : 14,
                        paddingVertical: isSharedMediaCard ? 0 : 9,
                        borderWidth: isSharedMediaCard || isOwn ? 0 : 1,
                        borderColor: isSharedMediaCard ? 'transparent' : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isSharedMediaCard ? 0 : 0.06,
                        shadowRadius: 4,
                        elevation: isSharedMediaCard ? 0 : 1,
                    }}>
                        {isDeleted ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Icon name="trash-2" size={13} color={isOwn ? 'rgba(255,255,255,0.7)' : colors.mutedText} />
                                <Text style={{ fontSize: 13, fontStyle: 'italic', color: isOwn ? 'rgba(255,255,255,0.8)' : colors.mutedText }}>
                                    This message was deleted
                                </Text>
                            </View>
                        ) : (
                            <>
                                {isImage && msg.attachment && (
                                    <ChatImageBubble url={msg.attachment.url} spacingBelow={hasText ? 8 : 0} onPress={() => onImagePress(msg.attachment!.url)} />
                                )}

                                {isVideo && msg.attachment && (
                                    <ChatVideoBubble url={msg.attachment.url} sizeLabel={formatFileSize(msg.attachment.fileSize)} spacingBelow={hasText ? 8 : 0} onPress={() => onOpenVideo(msg.attachment!)} />
                                )}

                                {isAudioFile && msg.attachment && (
                                    <View style={{ marginBottom: hasText ? 8 : 0 }}>
                                        <VoiceNotePlayer audioUrl={msg.attachment.url} duration={0} isSentByMe={isOwn} fileName={msg.attachment.fileName} playbackId={`file:${getMsgId(msg)}`} />
                                    </View>
                                )}

                                {isDoc && msg.attachment && (
                                    <View style={{
                                        width: 220,
                                        borderRadius: 12,
                                        backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : colors.control,
                                        padding: 10,
                                        borderWidth: 1,
                                        borderColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.border,
                                        marginBottom: hasText ? 8 : 0,
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.successSurface, alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="file-text" size={18} color={isOwn ? '#ffffff' : '#10b981'} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: isOwn ? '#ffffff' : colors.text }} numberOfLines={1}>
                                                    {msg.attachment.fileName}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: isOwn ? 'rgba(255,255,255,0.7)' : colors.mutedText }}>
                                                    {formatFileSize(msg.attachment.fileSize)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Action buttons: Preview + Download */}
                                        <View style={{ flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.border, paddingTop: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => onPreviewDoc(msg.attachment!)}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.surface,
                                                    borderRadius: 8,
                                                    paddingVertical: 6,
                                                    gap: 4,
                                                }}
                                            >
                                                <Icon name="eye" size={13} color={isOwn ? '#ffffff' : '#10b981'} />
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: isOwn ? '#ffffff' : '#10b981' }}>Preview</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => {
                                                    const file = msg.attachment!;
                                                    void chatFileShareService.share(file.url, file.fileName, file.fileType).catch((error: unknown) => {
                                                        console.error('[MessageBubble.saveFile] Error:', error);
                                                        toast.error('The file could not be saved.');
                                                    });
                                                }}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.surface,
                                                    borderRadius: 8,
                                                    paddingVertical: 6,
                                                    gap: 4,
                                                }}
                                            >
                                                <Icon name="download" size={13} color={isOwn ? '#ffffff' : colors.icon} />
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: isOwn ? '#ffffff' : colors.secondaryText }}>Save</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {isVoiceNote && audioUrl && (
                                    <VoiceNotePlayer
                                        audioUrl={audioUrl}
                                        duration={audioDuration}
                                        isSentByMe={isOwn}
                                        playbackId={`vn:${getMsgId(msg)}`}
                                    />
                                )}

                                {hasVisibleText && (
                                    <View style={isSharedMediaCard ? {
                                        alignSelf: isOwn ? 'flex-end' : 'flex-start',
                                        backgroundColor: isOwn ? '#10b981' : colors.elevated,
                                        borderRadius: 16,
                                        borderWidth: isOwn ? 0 : 1,
                                        borderColor: colors.border,
                                        paddingHorizontal: 13,
                                        paddingVertical: 9,
                                        marginBottom: 6,
                                    } : undefined}>
                                        <Text style={{ fontSize: 15, color: isOwn ? '#ffffff' : colors.text, lineHeight: 21 }}>
                                            {visibleText}
                                        </Text>
                                    </View>
                                )}

                                {/* OpenGraph Link Card */}
                                {detectedUrl && (
                                    <LinkPreviewMessage url={detectedUrl} isOwn={isOwn} instanceId={getMsgId(msg)} />
                                )}
                            </>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
                            <Text style={{ fontSize: 10, color: isSharedMediaCard ? colors.mutedText : isOwn ? 'rgba(255,255,255,0.65)' : colors.mutedText }}>
                                {formatMessageTime(msg.timestamp)}
                            </Text>
                            {isOwn && (
                                <Icon
                                    name={msg.status === 'read' ? 'check-circle' : 'check'}
                                    size={12}
                                    color={msg.status === 'read' ? '#60a5fa' : isSharedMediaCard ? colors.mutedText : 'rgba(255,255,255,0.6)'}
                                />
                            )}
                        </View>
                    </View>
                )}

                {reactionSummary.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 }}>
                        {reactionSummary.map(({ emoji, count, iMine }) => (
                            <TouchableOpacity
                                key={emoji}
                                onPress={() => onReact(msg, emoji)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: iMine ? colors.successSurface : colors.control,
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderWidth: 1,
                                    borderColor: iMine ? colors.accent : colors.border,
                                }}
                            >
                                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                                <Text style={{ fontSize: 11, color: colors.secondaryText, marginLeft: 4 }}>{count}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <Modal visible={showActions} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setShowActions(false)}>
                <ModalBackdrop style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowActions(false)}>
                    <ModalMotionSurface variant="dialog" style={{ minWidth: 240 }}>
                    <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.elevated, borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: isDark ? 0.45 : 0.2, shadowRadius: 16, elevation: 10 }}>
                        {!isDeleted && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                {REACTION_EMOJIS.map((emoji) => (
                                    <AnimatedActionButton key={emoji} onPress={() => { onReact(msg, emoji); setShowActions(false); }} feedback="like" accessibilityLabel={`React with ${emoji}`} style={{ padding: 6 }}>
                                        <Text style={{ fontSize: 22 }}>{emoji}</Text>
                                    </AnimatedActionButton>
                                ))}
                            </View>
                        )}

                        {!isDeleted && [
                            { icon: 'corner-up-left', label: 'Reply', action: () => { onReply(msg); setShowActions(false); } },
                            { icon: 'corner-up-right', label: 'Forward', action: () => { onForward(msg); setShowActions(false); } },
                            { icon: 'star', label: isStarred ? 'Unstar' : 'Star', action: () => { onToggleStar(msg); setShowActions(false); } },
                            ...(isOwn && hasText && !isSticker && !isVoiceNote && !msg.attachment && Date.now() - msg.timestamp.seconds * 1000 < MESSAGE_EDIT_WINDOW_MS
                                ? [{ icon: 'edit-2', label: 'Edit', action: () => { onEdit(msg); setShowActions(false); } }]
                                : []),
                            ...(hasText ? [{ icon: 'copy', label: 'Copy Text', action: () => { Clipboard.setString(msg.message); toast.success('Copied'); setShowActions(false); } }] : []),
                            ...(!isOwn ? [{ icon: 'flag', label: 'Report', action: () => { onReport(msg); setShowActions(false); } }] : []),
                        ].map(({ icon, label, action }) => (
                            <AnimatedActionButton key={label} onPress={action} accessibilityLabel={label} pressScale={0.97} playful={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                                <Icon name={icon} size={17} color={colors.icon} />
                                <Text style={{ marginLeft: 14, fontSize: 15, color: colors.text, fontWeight: '500' }}>{label}</Text>
                            </AnimatedActionButton>
                        ))}

                        {!isDeleted && (
                            <AnimatedActionButton
                                onPress={() => {
                                    setShowActions(false);
                                    setShowDeleteModal(true);
                                }}
                                accessibilityLabel="Delete"
                                pressScale={0.97}
                                playful={false}
                                feedback="warning"
                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}
                            >
                                <Icon name="trash-2" size={17} color="#ef4444" />
                                <Text style={{ marginLeft: 14, fontSize: 15, color: '#ef4444', fontWeight: '500' }}>Delete</Text>
                            </AnimatedActionButton>
                        )}
                    </Pressable>
                    </ModalMotionSurface>
                </ModalBackdrop>
            </Modal>

            <DeleteMessageModal
                visible={showDeleteModal}
                isOwnMessage={isOwn}
                onDeleteForMe={() => onDelete(msg, false)}
                onDeleteForEveryone={isOwn ? () => onDelete(msg, true) : undefined}
                onClose={() => setShowDeleteModal(false)}
            />
        </Pressable>
        </Animated.View>
    );
}

// ─── Sticker Bubble ───────────────────────────────────────────────────────────

function StickerBubble({ url, width, height, time }: { url: string; width: number; height: number; time: string }) {
    const { colors } = useAppTheme();
    const [errored, setErrored] = useState(false);
    const localSource = getLocalStickerSource(url);
    const imageSource = localSource ?? { uri: url };

    return (
        <View>
            {errored ? (
                <Text style={{ fontSize: 52 }}>🎨</Text>
            ) : (
                <Image
                    source={imageSource}
                    style={{ width: Math.min(width, 160), height: Math.min(height, 160) }}
                    resizeMode="contain"
                    onError={() => setErrored(true)}
                />
            )}
            <Text style={{ fontSize: 10, color: colors.mutedText, marginTop: 3, textAlign: 'right' }}>{time}</Text>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatPage() {
    const { id: friendId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { isDark, colors } = useAppTheme();
    const { activeUserId } = useAppData();
    const insets = useSafeAreaInsets();
    const currentUserId = activeUserId ?? '';
    const chatRoomId = messagingService.getChatRoomId(currentUserId, friendId ?? '');
    const cachedFriend = useResourceStore((state) => state.conversations.data?.find((conversation) => conversation.uid === friendId) ?? null);

    const [friend, setFriend] = useState<UserProfile | null>(cachedFriend);
    const [friendPresence, setFriendPresence] = useState<PresenceState | null>(null);
    const {
        messages: loadedMessages,
        loading: isLoading,
        errorMessage: messageError,
        reload: reloadMessages,
        mode: timelineMode,
        windowKey,
        windowTargetId,
        hasOlder,
        hasNewer,
        loadingOlder,
        loadingNewer,
        newWhileDetached,
        loadOlder,
        loadNewer,
        jumpToMessage,
        refreshMessage,
        addMessage,
        clearMessages,
    } = useSimpleChatMessages(friendId ?? '', chatRoomId);
    const messages = useMemo(
        () => loadedMessages.filter((message) => !(message.deletedFor ?? []).includes(currentUserId)),
        [currentUserId, loadedMessages],
    );
    const listRef = useRef<FlatList<FullMessage>>(null);
    // Newest first for the inverted list, so the newest message sits at the bottom.
    const listMessages = useMemo(() => [...messages].reverse(), [messages]);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [isAwayFromLatest, setIsAwayFromLatest] = useState(false);
    // After a jump loads a new window, the jumped-to message is centered once its rows are laid out.
    const [pendingCenter, setPendingCenter] = useState<{ windowKey: number; id: string | null }>({ windowKey: 0, id: null });
    if (pendingCenter.windowKey !== windowKey) {
        setPendingCenter({ windowKey, id: windowTargetId });
        setIsAwayFromLatest(false);
    }
    const [messageText, setMessageText] = useState('');
    const { isPeerTyping, notifyTyping, stopTyping } = useTypingIndicator(chatRoomId, friendId ?? '');
    const [replyTo, setReplyTo] = useState<FullMessage | null>(null);
    const [isSending, setIsSending] = useState(false);
    // Website parity: starred messages, editing your own messages, reporting a message.
    const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
    const [editingMessage, setEditingMessage] = useState<FullMessage | null>(null);
    const [reportMessage, setReportMessage] = useState<FullMessage | null>(null);
    const [showStarred, setShowStarred] = useState(false);
    const [keyboardState, setKeyboardState] = useState<{ visible: boolean; tab: 'emojis' | 'stickers' }>({ visible: false, tab: 'emojis' });
    const [composerStickerIcon, setComposerStickerIcon] = useState<ImageSourcePropType>(() => getRandomLocalStickerSource());

    useEffect(() => {
        if (keyboardState.visible) {
            setComposerStickerIcon(getRandomLocalStickerSource());
        }
    }, [keyboardState.visible]);
    const [showSettings, setShowSettings] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [showAttachModal, setShowAttachModal] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; fileName: string; mimeType: string; type: 'image' | 'video' | 'document'; sizeBytes: number; durationSeconds: number | null } | null>(null);
    // Upload progress (0-100) of the attachment being sent; null when idle.
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const uploadAbortRef = useRef<AbortController | null>(null);
    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [voiceNoteUpload, setVoiceNoteUpload] = useState<number | null>(null);
    const [trimCandidate, setTrimCandidate] = useState<(VideoTrimSource & { fileName: string; mimeType: string }) | null>(null);
    const [preparingAttachment, setPreparingAttachment] = useState(false);
    const [videoViewer, setVideoViewer] = useState<Attachment | null>(null);
    const [wallpaperUri, setWallpaperUri] = useState<string | null>(null);
    const [randomStickerBg, setRandomStickerBg] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showMediaPanel, setShowMediaPanel] = useState(false);
    const [forwardMessage, setForwardMessage] = useState<FullMessage | null>(null);
    const [previewDocAttachment, setPreviewDocAttachment] = useState<Attachment | null>(null);
    const [dismissedInputUrl, setDismissedInputUrl] = useState<string | null>(null);
    const [chatModal, setChatModal] = useState<{
        visible: boolean;
        type: CustomModalType;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void;
    }>({
        visible: false,
        type: 'info',
        title: '',
        message: '',
    });

    const handledCallMessageRef = useRef<string | null>(null);
    const messageListContentStyle = useMemo(() => ({ paddingVertical: 12 }), []);

    const wallpaperKey = `ourlime_chat_wallpaper_${currentUserId}_${friendId}`;

    // Live URL detection in input
    const inputUrl = findFirstUrl(messageText);
    const showInputLinkBanner = Boolean(inputUrl && inputUrl !== dismissedInputUrl);

    useEffect(() => {
        return () => {
            sharedPostPresentationService.deactivateAllPlayers();
            voiceNotePlaybackService.stop();
            uploadAbortRef.current?.abort();
            if (friendId && currentUserId) {
                void simpleChatMessageService.markRead(friendId);
                void conversationResourceService.patchConversation(currentUserId, friendId, { unreadCount: 0 });
            }
        };
    }, [friendId, currentUserId]);

    useEffect(() => {
        if (!friendId) return;
        const refreshPresence = () => void presenceService.getPresence(friendId).then(setFriendPresence).catch(() => setFriendPresence(null));
        refreshPresence();
        const timer = setInterval(refreshPresence, 60_000);
        return () => clearInterval(timer);
    }, [friendId]);

    // Mark messages as read immediately on open and whenever new messages arrive
    useEffect(() => {
        if (!friendId || !currentUserId) return;
        void simpleChatMessageService.markRead(friendId);
        void conversationResourceService.patchConversation(currentUserId, friendId, { unreadCount: 0 });
    }, [friendId, currentUserId, messages.length]);

    useEffect(() => {
        const latest = timelineMode === 'live' ? messages.at(-1) : undefined;
        if (!latest || latest.senderId !== friendId) return;
        const messageId = getMsgId(latest);
        if (latest.message === '[SYS:CALL_ENDED]') return;
        if (handledCallMessageRef.current === messageId) return;
        if (latest.message !== '[SYS:VIDEO_CALL_INVITE]' && latest.message !== '[SYS:VOICE_CALL_INVITE]') return;
        if (Date.now() - latest.timestamp.toMillis() > 45_000) return;
        handledCallMessageRef.current = messageId;
        // Legacy call records remain visible, but current call signaling is handled globally.
    }, [friendId, messages, timelineMode]);

    // Load wallpaper or random sticker background on entry
    useEffect(() => {
        if (!wallpaperKey) return;
        AsyncStorage.getItem(wallpaperKey).then((val) => {
            if (val) {
                setWallpaperUri(val);
            } else {
                const unsub = stickerService.subscribeToAllStickers((stickers) => {
                    if (stickers.length > 0) {
                        const idx = Math.floor(Math.random() * stickers.length);
                        setRandomStickerBg(stickers[idx].imageUrl);
                    }
                });
                return () => unsub();
            }
        }).catch(() => {});
    }, [wallpaperKey]);

    const handleUploadWallpaper = async (uri: string) => {
        setWallpaperUri(uri);
        await AsyncStorage.setItem(wallpaperKey, uri).catch(() => {});
        setChatModal({
            visible: true,
            type: 'success',
            title: 'Wallpaper Updated',
            message: 'Chat background updated successfully.',
            confirmText: 'OK',
        });
    };

    const handleResetWallpaper = async () => {
        setWallpaperUri(null);
        await AsyncStorage.removeItem(wallpaperKey).catch(() => {});
        setChatModal({
            visible: true,
            type: 'success',
            title: 'Wallpaper Reset',
            message: 'Chat background reset to default.',
            confirmText: 'OK',
        });
    };

    // Check block status
    useEffect(() => {
        if (!friendId || !currentUserId) return;
        relationshipService.checkBlockStatus(currentUserId, friendId).then(({ isBlockedByMe, isBlockedByOther }: { isBlockedByMe: boolean; isBlockedByOther: boolean }) => {
            setIsBlocked(isBlockedByMe || isBlockedByOther);
        });
    }, [friendId, currentUserId]);

    const getCallActiveForMessage = useCallback((index: number): boolean => {
        for (let newerIndex = index + 1; newerIndex < messages.length; newerIndex += 1) {
            if (messages[newerIndex].message === '[SYS:CALL_ENDED]') return false;
        }
        // In a jumped-to window the newer messages aren't loaded, so an old invite can't be shown as joinable.
        return timelineMode === 'live';
    }, [messages, timelineMode]);

    // Load friend profile
    useEffect(() => {
        if (!friendId) return;
        if (cachedFriend) {
            setFriend(cachedFriend);
            return;
        }
        authService.getUserProfileIfAvailable(friendId).then((profile) => {
            if (profile) setFriend(profile);
        });
    }, [cachedFriend, friendId]);

    const busyMessage = uploadProgress !== null
        ? `Your file is still uploading (${uploadProgress}%). Please wait or tap ✕ to cancel.`
        : voiceNoteUpload !== null
            ? 'Your voice note is still sending…'
            : preparingAttachment
                ? 'Still preparing your file…'
                : isSending
                    ? 'Still sending your message…'
                    : null;

    const handleMessageTextChange = useCallback((text: string) => {
        setMessageText(text);
        if (!editingMessage) notifyTyping(text);
    }, [editingMessage, notifyTyping]);

    useEffect(() => {
        if (!messageText.trim()) stopTyping();
    }, [messageText, stopTyping]);

    // Send message
    const handleSend = useCallback(async () => {
        if (busyMessage) { notifyBusy(busyMessage); return; }
        if ((!messageText.trim() && !pendingAttachment) || !friendId || !currentUserId || isSending || isBlocked) return;
        if (editingMessage) {
            const target = editingMessage;
            const nextText = messageText.trim();
            if (!nextText || nextText === target.message) { setEditingMessage(null); setMessageText(''); return; }
            setIsSending(true);
            setEditingMessage(null);
            setMessageText('');
            try {
                await messagingService.editMessage(friendId, currentUserId, target.timestamp.seconds, nextText, target.id);
                await refreshMessage(target);
                toast.success('Message edited');
            } catch (error: unknown) {
                console.error('[ChatScreen.editMessage] Error:', error);
                setMessageText(nextText);
                setEditingMessage(target);
                toast.error(error instanceof Error ? error.message : 'Messages can only be edited within 20 minutes');
            } finally {
                setIsSending(false);
            }
            return;
        }
        const text = messageText.trim();
        setMessageText('');
        setDismissedInputUrl(null);
        setIsSending(true);
        setKeyboardState({ visible: false, tab: 'emojis' });
        Keyboard.dismiss();

        let replyRef: ReplyReference | undefined;
        if (replyTo) {
            replyRef = {
                messageId: getMsgId(replyTo),
                originalMessage: describeMessageForReply(replyTo),
                originalSenderId: replyTo.senderId,
                originalTimestamp: replyTo.timestamp,
            };
        }
        setReplyTo(null);

        let attachment: Attachment | undefined;
        if (pendingAttachment) {
            try {
                const controller = new AbortController();
                uploadAbortRef.current = controller;
                setUploadProgress(0);
                attachment = await messagingService.uploadFile(pendingAttachment.uri, pendingAttachment.fileName, pendingAttachment.mimeType, currentUserId, {
                    signal: controller.signal,
                    onProgress: setUploadProgress,
                });
            } catch (err) {
                uploadAbortRef.current = null;
                setUploadProgress(null);
                if (err instanceof ChatUploadCancelledError) {
                    setMessageText(text);
                    setIsSending(false);
                    toast('Upload cancelled');
                    return;
                }
                setMessageText(text);
                setChatModal({
                    visible: true,
                    type: 'error',
                    title: 'Upload Failed',
                    message: `Failed to upload attachment: ${err instanceof Error ? err.message : String(err)}`,
                    confirmText: 'OK',
                });
                setIsSending(false);
                return;
            }
            uploadAbortRef.current = null;
            setUploadProgress(null);
            setPendingAttachment(null);
        }

        try {
            const serverMessage = await messagingService.sendMessage(friendId, text, currentUserId, replyRef, attachment);
            addMessage(serverMessage);
            void conversationResourceService.patchConversation(currentUserId, friendId, {
                lastMessage: text || (attachment ? attachment.fileName : 'Attachment'),
                lastMessageTime: serverMessage.timestamp,
                lastMessageSenderId: currentUserId,
                unreadCount: 0,
            });
            void interactionFeedbackService.play('success');
        } catch (err) {
            setChatModal({
                visible: true,
                type: 'error',
                title: 'Send Failed',
                message: `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
                confirmText: 'OK',
            });
            setMessageText(text);
        } finally {
            setIsSending(false);
        }
    }, [addMessage, busyMessage, messageText, friendId, currentUserId, isSending, replyTo, pendingAttachment, isBlocked, editingMessage, refreshMessage]);

    // Start a call
    const callCoordinator = useCallCoordinator();
    // Same account already calling / on a call with this friend from another device: show a pill and block calling.
    const thisDeviceCallId = useCallStore((state) => state.session?.id ?? null);
    const callElsewhereNotice = useCallElsewhereNotice(currentUserId, friendId, friend?.firstName || friend?.userName || 'them', thisDeviceCallId);
    const isCallingBlocked = isBlocked || callElsewhereNotice !== null;
    const handleStartCall = useCallback(async (type: 'audio' | 'video') => {
        if (!friendId || !currentUserId || isBlocked) return;
        await callCoordinator.startCall(friendId, type === 'audio' ? 'voice' : 'video');
    }, [callCoordinator, friendId, currentUserId, isBlocked]);

    /**
     * Checks a picked file before it's attached: allowed type and the 25 MB Storage limit. Photos are resized to
     * 1600px like the website; videos over the limit open the trimmer.
     */
    const stageAttachment = useCallback(async (picked: { uri: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null; durationSeconds?: number | null; kind: 'image' | 'video' | 'document' }) => {
        setPreparingAttachment(true);
        try {
            let { uri, fileName } = picked;
            let mimeType = resolveChatMimeType(fileName, picked.mimeType, picked.kind);
            const kind: 'image' | 'video' | 'document' = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'document';
            let sizeBytes = await readFileSize(uri, picked.sizeBytes);

            if (kind === 'image' && !/gif|svg/i.test(mimeType)) {
                try {
                    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
                    const resized = await manipulateAsync(uri, [{ resize: { width: CHAT_IMAGE_MAX_DIMENSION } }], { compress: 0.82, format: SaveFormat.JPEG });
                    uri = resized.uri;
                    mimeType = 'image/jpeg';
                    fileName = fileName.replace(/\.[^.]+$/, '') + '.jpg';
                    sizeBytes = await readFileSize(uri);
                } catch (resizeError: unknown) {
                    console.warn('[ChatScreen.stageAttachment] Error: image resize failed, sending original', resizeError instanceof Error ? resizeError.message : String(resizeError));
                }
            }

            if (kind === 'video' && sizeBytes > MAX_CHAT_FILE_BYTES) {
                const durationSeconds = picked.durationSeconds ?? 0;
                if (durationSeconds > 1) {
                    setTrimCandidate({ uri, durationSeconds, fileSize: sizeBytes, fileName, mimeType });
                    toast(`This video is ${formatMegabytes(sizeBytes)}. Trim it to fit the 25 MB limit.`);
                    return;
                }
            }

            const check = checkChatAttachment(fileName, mimeType, sizeBytes);
            if (!check.ok) {
                setChatModal({ visible: true, type: 'warning', title: check.reason === 'size' ? 'File too large' : 'File type not supported', message: check.message, confirmText: 'OK' });
                return;
            }
            setPendingAttachment({ uri, fileName, mimeType, type: kind, sizeBytes, durationSeconds: picked.durationSeconds ?? null });
        } finally {
            setPreparingAttachment(false);
        }
    }, []);

    const handleTrimmedVideo = useCallback((result: TrimmedVideoResult) => {
        const candidate = trimCandidate;
        setTrimCandidate(null);
        if (!candidate) return;
        void stageAttachment({ uri: result.uri, fileName: candidate.fileName.replace(/\.[^.]+$/, '') + '.mp4', mimeType: 'video/mp4', sizeBytes: result.fileSize, durationSeconds: result.durationSeconds, kind: 'video' })
            .then(() => undefined);
    }, [stageAttachment, trimCandidate]);

    const handleAttachImage = useCallback(async () => {
        setShowAttachModal(false);
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || (asset.mimeType?.startsWith('video/') ?? false);
        await stageAttachment({
            uri: asset.uri,
            fileName: asset.fileName ?? (isVideo ? `video_${Date.now()}.mp4` : `media_${Date.now()}.jpg`),
            mimeType: asset.mimeType,
            sizeBytes: asset.fileSize,
            durationSeconds: typeof asset.duration === 'number' ? asset.duration / 1000 : null,
            kind: isVideo ? 'video' : 'image',
        });
    }, [stageAttachment]);

    const handleAttachDoc = useCallback(async () => {
        setShowAttachModal(false);
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        await stageAttachment({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType, sizeBytes: asset.size, kind: 'document' });
    }, [stageAttachment]);

    /** Uploads a recorded voice note (voiceNotes/{uid}/…m4a) and sends it like the website does. */
    const handleSendVoiceNote = useCallback(async (uri: string, durationSeconds: number) => {
        setIsRecordingVoice(false);
        if (voiceNoteUpload !== null) { notifyBusy('Your previous voice note is still sending…'); return; }
        if (!friendId || !currentUserId || isBlocked) return;
        setVoiceNoteUpload(0);
        try {
            const voiceNoteData = await messagingService.uploadVoiceNote(uri, currentUserId, durationSeconds, { onProgress: setVoiceNoteUpload });
            const serverMessage = await messagingService.sendMessage(friendId, '', currentUserId, undefined, undefined, undefined, voiceNoteData);
            addMessage(serverMessage);
            void conversationResourceService.patchConversation(currentUserId, friendId, {
                lastMessage: 'Voice note',
                lastMessageTime: serverMessage.timestamp,
                lastMessageSenderId: currentUserId,
                unreadCount: 0,
            });
            void interactionFeedbackService.play('success');
        } catch (error: unknown) {
            console.error('[ChatScreen.handleSendVoiceNote] Error:', error);
            toast.error('Voice note could not be sent. Check your connection and try again.');
        } finally {
            setVoiceNoteUpload(null);
        }
    }, [addMessage, currentUserId, friendId, isBlocked, voiceNoteUpload]);

    const handleStickerSelect = useCallback(async (sticker: Sticker) => {
        if (busyMessage) { notifyBusy(busyMessage); return; }
        if (!friendId || !currentUserId || isBlocked) return;
        const stickerData = {
            type: 'sticker' as const,
            stickerId: sticker.id,
            stickerUrl: sticker.imageUrl,
            packId: sticker.packId,
            stickerWidth: sticker.width,
            stickerHeight: sticker.height,
        };
        try {
            const serverMessage = await messagingService.sendMessage(friendId, '', currentUserId, undefined, undefined, stickerData);
            addMessage(serverMessage);
            void conversationResourceService.patchConversation(currentUserId, friendId, {
                lastMessage: '🎨 Sticker',
                lastMessageTime: serverMessage.timestamp,
                lastMessageSenderId: currentUserId,
                unreadCount: 0,
            });
            void interactionFeedbackService.play('success');
        } catch {
            setChatModal({
                visible: true,
                type: 'error',
                title: 'Sticker Failed',
                message: 'Failed to send sticker. Please try again.',
                confirmText: 'OK',
            });
        }
    }, [addMessage, busyMessage, friendId, currentUserId, isBlocked]);

    const handleDelete = useCallback(async (msg: FullMessage, deleteForEveryone: boolean) => {
        if (!friendId || !currentUserId) return;
        try {
            await messagingService.deleteMessage(friendId, currentUserId, msg.timestamp.seconds, deleteForEveryone, msg.id);
            await refreshMessage(msg);
            toast.success(deleteForEveryone ? 'Deleted for everyone' : 'Deleted for you');
        } catch (error: unknown) {
            console.error('[ChatScreen.handleDelete] Error:', error);
            toast.error(error instanceof Error ? error.message : 'The message could not be deleted.');
        }
    }, [friendId, currentUserId, refreshMessage]);

    const handleReact = useCallback(async (msg: FullMessage, emoji: string) => {
        if (!currentUserId || isBlocked) return;
        try {
            await messagingService.toggleReaction(chatRoomId, msg.timestamp.seconds, emoji, currentUserId, msg.id);
            await refreshMessage(msg);
        } catch (error: unknown) {
            console.error('[ChatScreen.handleReact] Error:', error);
            toast.error('The reaction could not be saved.');
        }
    }, [chatRoomId, currentUserId, isBlocked, refreshMessage]);

    const handleForward = useCallback((msg: FullMessage) => {
        setForwardMessage(msg);
    }, []);

    useEffect(() => {
        if (!currentUserId || !friendId) return;
        messagingService.getStarredMessageIds(currentUserId, friendId)
            .then(setStarredMessageIds)
            .catch((error: unknown) => console.warn('[ChatScreen.loadStarred] Error:', error instanceof Error ? error.message : 'unavailable'));
    }, [currentUserId, friendId]);

    const handleToggleStar = useCallback((msg: FullMessage) => {
        if (!currentUserId || !friendId) return;
        const messageId = getMsgId(msg);
        const wasStarred = starredMessageIds.has(messageId);
        setStarredMessageIds((current) => { const next = new Set(current); if (wasStarred) next.delete(messageId); else next.add(messageId); return next; });
        messagingService.setMessageStarred(currentUserId, friendId, messageId, !wasStarred)
            .then(() => toast.success(wasStarred ? 'Message unstarred' : 'Message starred'))
            .catch((error: unknown) => {
                console.error('[ChatScreen.toggleStar] Error:', error);
                setStarredMessageIds((current) => { const next = new Set(current); if (wasStarred) next.add(messageId); else next.delete(messageId); return next; });
                toast.error('Could not update starred message');
            });
    }, [currentUserId, friendId, starredMessageIds]);

    const handleEditRequest = useCallback((msg: FullMessage) => {
        setReplyTo(null);
        setEditingMessage(msg);
        setMessageText(msg.message);
    }, []);

    const handleDeleteChat = useCallback(async () => {
        if (!chatRoomId) return;
        await messagingService.clearChatHistory(chatRoomId);
        clearMessages();
    }, [chatRoomId, clearMessages]);

    useEffect(() => {
        if (!highlightedId) return;
        const timer = setTimeout(() => setHighlightedId(null), 2500);
        return () => clearTimeout(timer);
    }, [highlightedId]);

    // `index` is the message's position oldest-first; the inverted list counts from the newest.
    const scrollToLoadedMessage = useCallback((index: number) => {
        setHighlightedId(getMsgId(messages[index]));
        listRef.current?.scrollToIndex({ index: messages.length - 1 - index, animated: true, viewPosition: 0.5 });
    }, [messages]);

    // WhatsApp-style: tapping a reply's quote goes to the original. If it isn't loaded, only the messages around
    // it are loaded (not everything in between); scrolling then pages older/newer from there.
    const handleJumpToReply = useCallback(async (reply: ReplyReference) => {
        const loadedIndex = findReplyTarget(messages, reply);
        if (loadedIndex >= 0) {
            scrollToLoadedMessage(loadedIndex);
            return;
        }
        try {
            const targetId = await jumpToMessage({
                messageId: reply.messageId,
                timestampSeconds: readReplySeconds(reply.originalTimestamp),
                senderId: reply.originalSenderId,
            });
            if (!targetId) {
                toast('The original message is no longer available');
                return;
            }
            setHighlightedId(targetId);
        } catch (error: unknown) {
            console.error('[ChatScreen.handleJumpToReply] Error:', error);
            toast.error('The original message could not be loaded.');
        }
    }, [jumpToMessage, messages, scrollToLoadedMessage]);

    const handleJumpToStarred = useCallback((message: FullMessage) => {
        setShowStarred(false);
        const index = messages.findIndex((candidate) => getMsgId(candidate) === getMsgId(message));
        if (index >= 0) scrollToLoadedMessage(index);
    }, [messages, scrollToLoadedMessage]);

    const handleJumpToLatest = useCallback(() => {
        setIsAwayFromLatest(false);
        if (timelineMode === 'detached') {
            void reloadMessages();
            return;
        }
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, [reloadMessages, timelineMode]);

    // Fired once the rows of a freshly loaded window are laid out (all of them render on the first pass).
    const handleListContentSizeChange = useCallback(() => {
        if (!pendingCenter.id) return;
        const index = listMessages.findIndex((message) => getMsgId(message) === pendingCenter.id);
        setPendingCenter((current) => ({ ...current, id: null }));
        if (index >= 0) listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    }, [listMessages, pendingCenter.id]);

    // A loaded message far off-screen hasn't been laid out yet: load the window around it instead of guessing.
    const handleScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
        const target = listMessages[index];
        if (!target) return;
        void jumpToMessage({ messageId: getMsgId(target), timestampSeconds: target.timestamp.seconds, senderId: target.senderId })
            .then((targetId) => { if (targetId) setHighlightedId(targetId); })
            .catch((error: unknown) => console.error('[ChatScreen.handleScrollToIndexFailed] Error:', error));
    }, [jumpToMessage, listMessages]);

    // Inverted list: offset 0 is the newest message.
    const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const away = event.nativeEvent.contentOffset.y > JUMP_TO_LATEST_DISTANCE;
        setIsAwayFromLatest((current) => (current === away ? current : away));
    }, []);

    const handleReachedOldest = useCallback(() => {
        void loadOlder();
    }, [loadOlder]);

    const handleReachedNewest = useCallback(() => {
        void loadNewer();
    }, [loadNewer]);

    const showJumpToLatest = timelineMode === 'detached' || isAwayFromLatest;

    // Lets reply boxes show what they replied to when the stored quote is empty (voice notes, files, stickers).
    const messagesById = useMemo(() => new Map(messages.map((message) => [getMsgId(message), message])), [messages]);

    const renderMessage = useCallback(({ item: message, index }: { item: FullMessage; index: number }) => {
        const isCallEnded = message.message === '[SYS:CALL_ENDED]';
        const isCallInvite = message.message === '[SYS:VIDEO_CALL_INVITE]' || message.message === '[SYS:VOICE_CALL_INVITE]';

        if (isCallEnded || isCallInvite) {
            return (
                <SystemMessage
                    msg={message}
                    currentUserId={currentUserId}
                    friendFirstName={friend?.firstName ?? 'Friend'}
                    onJoinCall={handleStartCall}
                    callActive={isCallInvite ? getCallActiveForMessage(messages.length - 1 - index) : false}
                />
            );
        }

        return (
            <MessageBubble
                msg={message}
                currentUserId={currentUserId}
                friend={friend}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onReact={handleReact}
                onForward={handleForward}
                onImagePress={setLightboxUrl}
                onPreviewDoc={setPreviewDocAttachment}
                onOpenVideo={setVideoViewer}
                replyPreview={message.replyTo ? replyPreviewText(message.replyTo.originalMessage, messagesById.get(message.replyTo.messageId)) : null}
                onPressReply={handleJumpToReply}
                isHighlighted={highlightedId === getMsgId(message)}
                animateEntry={timelineMode === 'live' && index === 0}
                isStarred={starredMessageIds.has(getMsgId(message))}
                onToggleStar={handleToggleStar}
                onEdit={handleEditRequest}
                onReport={setReportMessage}
            />
        );
    }, [currentUserId, friend, getCallActiveForMessage, handleDelete, handleForward, handleJumpToReply, handleReact, handleStartCall, highlightedId, messages.length, messagesById, starredMessageIds, handleToggleStar, handleEditRequest, timelineMode]);

    const activeBg = wallpaperUri ?? randomStickerBg;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

            {/* ── Header ────────────────────────────────────────────────── */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surface,
            }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back to friends"
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
                >
                    <Icon name="chevron-left" size={30} color={colors.text} />
                </TouchableOpacity>

                {friend ? (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}
                        onPress={() => router.push({ pathname: '/profile/[username]', params: { username: friend.userName } })}
                    >
                        <UserAvatar profileImage={friend.profilePicture} firstName={friend.firstName ?? 'U'} size={38} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                {friend.firstName} {friend.lastName}
                            </Text>
                            <Text style={{ fontSize: 12, color: isPeerTyping || friendPresence?.status === 'online' ? '#10b981' : colors.mutedText, fontStyle: isPeerTyping ? 'italic' : 'normal' }}>
                                {isPeerTyping ? 'typing…' : friendPresence?.status === 'online' ? 'Online' : `@${friend.userName}`}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flex: 1 }} />
                )}

                <TouchableOpacity onPress={() => handleStartCall('audio')} disabled={isCallingBlocked} style={{ padding: 8, opacity: isCallingBlocked ? 0.35 : 1 }}>
                    <Icon name="phone" size={20} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleStartCall('video')} disabled={isCallingBlocked} style={{ padding: 8, opacity: isCallingBlocked ? 0.35 : 1 }}>
                    <Icon name="video" size={20} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 8 }}>
                    <Icon name="settings" size={20} color="#6b7280" />
                </TouchableOpacity>
            </View>

            {/* ── Messages & Background Wallpaper ───────────────────────── */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                <View style={{ flex: 1, position: 'relative' }}>
                    {/* Background Wallpaper (custom image or random sticker) */}
                    {wallpaperUri ? (
                        <Image
                            source={{ uri: wallpaperUri }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}
                            resizeMode="cover"
                        />
                    ) : randomStickerBg ? (
                        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                                source={{ uri: randomStickerBg }}
                                style={{ width: 220, height: 220, opacity: 0.18 }}
                                resizeMode="contain"
                            />
                        </View>
                    ) : null}

                    {messages.length > 0 ? (
                    <View style={{ flex: 1 }}>
                    <FlatList
                        // A new window (jump to a reply, or back to the latest) re-anchors the list from scratch.
                        key={`chat-window-${windowKey}`}
                        ref={listRef}
                        data={listMessages}
                        inverted
                        extraData={highlightedId}
                        keyExtractor={getMsgId}
                        style={{ flex: 1, backgroundColor: activeBg ? 'transparent' : colors.canvas }}
                        contentContainerStyle={messageListContentStyle}
                        showsVerticalScrollIndicator={false}
                        renderItem={renderMessage}
                        renderScrollComponent={renderMessageScrollView}
                        // A jump window is small (~40 rows): render it all so the target can be centered exactly.
                        initialNumToRender={pendingCenter.id ? listMessages.length : undefined}
                        onContentSizeChange={handleListContentSizeChange}
                        onScrollToIndexFailed={handleScrollToIndexFailed}
                        // Keeps the reader's place when newer messages are added below; follows new messages only
                        // while at the newest message (not in a jumped-to window).
                        maintainVisibleContentPosition={{
                            minIndexForVisible: 0,
                            autoscrollToTopThreshold: timelineMode === 'live' ? 80 : undefined,
                        }}
                        // Inverted: the end is the top (older messages), the start is the bottom (newer ones).
                        onEndReached={hasOlder ? handleReachedOldest : undefined}
                        onEndReachedThreshold={0.5}
                        onStartReached={timelineMode === 'detached' && hasNewer ? handleReachedNewest : undefined}
                        onStartReachedThreshold={0.5}
                        onScroll={handleListScroll}
                        scrollEventThrottle={64}
                        ListFooterComponent={loadingOlder ? (
                            <ActivityIndicator style={{ marginVertical: 10 }} color={colors.accent} />
                        ) : null}
                        // Inverted list: the header sits at the bottom, under the newest message.
                        ListHeaderComponent={(
                            <>
                                {/* Right under the newest message; not inside a jumped-to window of older messages. */}
                                {isPeerTyping && timelineMode === 'live' && friend ? (
                                    <TypingIndicator profileImage={friend.profilePicture} firstName={friend.firstName ?? 'Friend'} />
                                ) : null}
                                {loadingNewer ? <ActivityIndicator style={{ marginVertical: 10 }} color={colors.accent} /> : null}
                                {callElsewhereNotice ? (
                                    <View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ alignItems: 'center', marginVertical: 10, paddingHorizontal: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
                                            <Icon name="phone-call" size={12} color="#10b981" />
                                            <Text style={{ fontSize: 12, color: colors.mutedText, fontWeight: '500' }}>{callElsewhereNotice}</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </>
                        )}
                    />
                    {showJumpToLatest ? (
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={newWhileDetached > 0 ? `Jump to latest, ${newWhileDetached} new` : 'Jump to latest message'}
                            onPress={handleJumpToLatest}
                            style={{ position: 'absolute', right: 14, bottom: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
                        >
                            <Icon name="chevrons-down" size={20} color={colors.text} />
                            {newWhileDetached > 0 ? (
                                <View style={{ position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{newWhileDetached > 99 ? '99+' : newWhileDetached}</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    ) : null}
                    </View>
                    ) : isLoading ? (
                        <ChatConversationSkeleton />
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: activeBg ? 'transparent' : colors.canvas, paddingHorizontal: 32 }}>
                            {messageError ? (
                                <>
                                    <Icon name="alert-triangle" size={34} color={colors.destructive} />
                                    <Text style={{ color: colors.destructiveText, textAlign: 'center', fontWeight: '700', marginTop: 12 }}>
                                        {messageError}
                                    </Text>
                                    <TouchableOpacity onPress={() => void reloadMessages()} style={{ marginTop: 14, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10 }}>
                                        <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                        <Icon name="message-circle" size={36} color={colors.accent} />
                                    </View>
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Start a conversation</Text>
                                    <Text style={{ fontSize: 14, color: colors.mutedText, textAlign: 'center' }}>
                                        Say hello to <Text style={{ color: colors.accentText, fontWeight: '600' }}>{friend?.firstName ?? 'your friend'}</Text>!
                                    </Text>
                                </>
                            )}
                        </View>
                    )}
                </View>

                {/* ── Blocked Banner ────────────────────────────────────────── */}
                {isBlocked ? (
                    <View style={{ backgroundColor: '#fef2f2', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#fecaca', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#dc2626', textAlign: 'center' }}>
                            You cannot send messages to @{friend?.userName ?? 'user'} due to block restrictions.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Pending photo / video preview */}
                        {pendingAttachment && (pendingAttachment.type === 'video' || pendingAttachment.type === 'image') ? (
                            <View style={{ height: 220, backgroundColor: '#000000', borderTopWidth: 2, borderTopColor: '#10b981' }}>
                                {pendingAttachment.type === 'video' ? (
                                    <CustomVideoPlayer key={pendingAttachment.uri} url={pendingAttachment.uri} autoPlay={false} showSpeed={false} />
                                ) : (
                                    <Image source={{ uri: pendingAttachment.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                )}
                            </View>
                        ) : null}

                        {/* Pending Attachment Preview Banner */}
                        {pendingAttachment && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: isDark ? colors.control : '#f0fdf4',
                                borderTopWidth: 2,
                                borderTopColor: '#10b981',
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                            }}>
                                {pendingAttachment.type === 'image' ? (
                                    <Image source={{ uri: pendingAttachment.uri }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }} />
                                ) : pendingAttachment.type === 'video' ? (
                                    <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <Icon name="video" size={20} color="#10b981" />
                                    </View>
                                ) : (
                                    <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <Icon name="file-text" size={20} color="#10b981" />
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                                        {pendingAttachment.fileName}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>
                                        {uploadProgress !== null
                                            ? `Uploading… ${uploadProgress}%`
                                            : `${formatFileSize(pendingAttachment.sizeBytes)} · ${pendingAttachment.type === 'video' ? 'Video ready' : 'Ready'} — tap Send to upload`}
                                    </Text>
                                    {uploadProgress !== null ? (
                                        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 4, overflow: 'hidden' }}>
                                            <View style={{ width: `${uploadProgress}%`, height: 3, backgroundColor: '#10b981' }} />
                                        </View>
                                    ) : null}
                                </View>
                                {pendingAttachment.type === 'video' && uploadProgress === null ? (
                                    <TouchableOpacity
                                        accessibilityLabel="Trim video"
                                        accessibilityRole="button"
                                        onPress={() => {
                                            if (busyMessage) { notifyBusy(busyMessage); return; }
                                            const durationSeconds = pendingAttachment.durationSeconds ?? 0;
                                            if (durationSeconds <= 1) { toast('This video is too short to trim.'); return; }
                                            setTrimCandidate({ uri: pendingAttachment.uri, durationSeconds, fileSize: pendingAttachment.sizeBytes, fileName: pendingAttachment.fileName, mimeType: pendingAttachment.mimeType });
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.control, marginRight: 4 }}
                                    >
                                        <Icon name="scissors" size={14} color="#10b981" />
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Trim</Text>
                                    </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity
                                    accessibilityLabel={uploadProgress !== null ? 'Cancel upload' : `Remove ${pendingAttachment.fileName}`}
                                    accessibilityRole="button"
                                    onPress={() => { if (uploadProgress !== null) uploadAbortRef.current?.abort(); else setPendingAttachment(null); }}
                                    style={{ padding: 6 }}
                                >
                                    <Icon name="x" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Editing banner */}
                        {editingMessage ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successSurface, borderTopWidth: 2, borderTopColor: '#10b981', paddingHorizontal: 14, paddingVertical: 9 }}>
                                <Icon name="edit-2" size={14} color="#10b981" />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Editing message</Text>
                                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedText }}>{editingMessage.message}</Text>
                                </View>
                                <TouchableOpacity accessibilityLabel="Cancel editing" onPress={() => { setEditingMessage(null); setMessageText(''); }} style={{ padding: 4 }}>
                                    <Icon name="x" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Reply Banner */}
                        {replyTo && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#f0fdf4',
                                borderTopWidth: 2,
                                borderTopColor: '#10b981',
                                paddingHorizontal: 14,
                                paddingVertical: 9,
                            }}>
                                <Icon name="corner-up-left" size={14} color="#10b981" />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                                        Replying to {replyTo.senderId === currentUserId ? 'yourself' : friend?.firstName}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: '#475569' }} numberOfLines={1}>
                                        {describeMessageForReply(replyTo)}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                    <Icon name="x" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Live Link Input Preview Banner */}
                        {showInputLinkBanner && inputUrl && (
                            <LinkInputBanner url={inputUrl} onDismiss={() => setDismissedInputUrl(inputUrl)} />
                        )}

                        {preparingAttachment || voiceNoteUpload !== null ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.successSurface, paddingHorizontal: 14, paddingVertical: 9 }}>
                                <ActivityIndicator size="small" color="#10b981" />
                                <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                                    {voiceNoteUpload !== null ? `Sending voice note… ${voiceNoteUpload}%` : 'Preparing file…'}
                                </Text>
                            </View>
                        ) : null}

                        {/* Modernized Web-Parity Input Bar */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            paddingHorizontal: 12,
                            paddingTop: 8,
                            paddingBottom: Math.max(8, insets.bottom),
                            backgroundColor: colors.surface,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            gap: 8,
                        }}>
                            {isRecordingVoice ? (
                                <View style={{ flex: 1 }}>
                                    <VoiceNoteRecorder
                                        onCancel={() => setIsRecordingVoice(false)}
                                        onSend={(uri, seconds) => void handleSendVoiceNote(uri, seconds)}
                                        onError={(message) => { setIsRecordingVoice(false); toast.error(message); }}
                                    />
                                </View>
                            ) : null}
                            {!isRecordingVoice ? (<>
                            {/* WhatsApp / Web Long White Pill Container */}
                            <View style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.elevated,
                                borderRadius: 24,
                                borderWidth: 1,
                                borderColor: colors.border,
                                paddingHorizontal: 6,
                                paddingVertical: Platform.OS === 'ios' ? 4 : 2,
                                minHeight: 44,
                                maxHeight: 120,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.04,
                                shadowRadius: 3,
                                elevation: 1,
                            }}>
                                {/* Sticker Picker Toggle (Random Sticker Icon) */}
                                <TouchableOpacity
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setComposerStickerIcon(getRandomLocalStickerSource());
                                        setKeyboardState({ visible: true, tab: 'stickers' });
                                    }}
                                    style={{ padding: 4, alignItems: 'center', justifyContent: 'center' }}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Open stickers"
                                >
                                    <Image
                                        source={composerStickerIcon}
                                        style={{
                                             width: 22,
                                             height: 22,
                                             borderRadius: 4,
                                             borderWidth: keyboardState.visible && keyboardState.tab === 'stickers' ? 1.5 : 0,
                                             borderColor: colors.accent,
                                        }}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>

                                {/* WhatsApp Emoji Keyboard Toggle (Smile icon) */}
                                <TouchableOpacity
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setKeyboardState({ visible: true, tab: 'emojis' });
                                    }}
                                    style={{ padding: 6 }}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Open emojis"
                                >
                                    <Icon
                                        name="smile"
                                        size={20}
                                        color={keyboardState.visible && keyboardState.tab === 'emojis' ? colors.accent : colors.icon}
                                    />
                                </TouchableOpacity>

                                {/* Center Clean TextInput */}
                                <TextInput
                                    style={{
                                        flex: 1,
                                        fontSize: 15,
                                        color: colors.text,
                                        paddingHorizontal: 6,
                                        paddingVertical: Platform.OS === 'ios' ? 6 : 4,
                                        maxHeight: 100,
                                    }}
                                    placeholder={`Message ${friend?.firstName ?? ''}...`}
                                    placeholderTextColor={colors.mutedText}
                                    value={messageText}
                                    onChangeText={handleMessageTextChange}
                                    multiline
                                    autoCapitalize="sentences"
                                    onFocus={() => setKeyboardState((s) => ({ ...s, visible: false }))}
                                />

                                {/* Paperclip Attachment Icon */}
                                <TouchableOpacity
                                    onPress={() => (busyMessage ? notifyBusy(busyMessage) : setShowAttachModal(true))}
                                    accessibilityLabel="Attach file"
                                    style={{ padding: 6, opacity: busyMessage ? 0.5 : 1 }}
                                    activeOpacity={0.7}
                                >
                                    <Icon name="paperclip" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {/* Circular Action Button Outside Pill (Send or Mic) */}
                            {(messageText.trim().length > 0 || pendingAttachment) ? (
                                <AnimatedActionButton
                                    feedback="message"
                                    accessibilityLabel="Send message"
                                    onPress={handleSend}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: '#10b981',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: '#10b981',
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.35,
                                        shadowRadius: 6,
                                        elevation: 4,
                                    }}
                                >
                                    {isSending ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Icon name="send" size={18} color="#ffffff" style={{ marginLeft: 2 }} />
                                    )}
                                </AnimatedActionButton>
                            ) : (
                                <TouchableOpacity
                                    accessibilityLabel="Record voice note"
                                    accessibilityRole="button"
                                    onPress={() => {
                                        if (busyMessage) { notifyBusy(busyMessage); return; }
                                        if (editingMessage) { notifyBusy('Finish or cancel editing your message first.'); return; }
                                        Keyboard.dismiss();
                                        setKeyboardState({ visible: false, tab: 'emojis' });
                                        setIsRecordingVoice(true);
                                    }}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: '#10b981',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: editingMessage !== null || busyMessage ? 0.5 : 1,
                                    }}
                                >
                                    <Icon name="mic" size={20} color="#ffffff" />
                                </TouchableOpacity>
                            )}
                            </>) : null}
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>

            {/* ── Attachment Modal ──────────────────────────────────────── */}
            <Modal visible={showAttachModal} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setShowAttachModal(false)}>
                <ModalBackdrop style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setShowAttachModal(false)}>
                    <ModalMotionSurface variant="sheet">
                    <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Attach File</Text>

                        <AnimatedActionButton
                            onPress={() => void handleAttachImage()}
                            feedback="share"
                            accessibilityLabel="Attach photo or video"
                            pressScale={0.97}
                            playful={false}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.control, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Icon name="image" size={20} color="#10b981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Photo or Video</Text>
                                <Text style={{ fontSize: 12, color: colors.mutedText }}>Share images or videos from gallery</Text>
                            </View>
                        </AnimatedActionButton>

                        <AnimatedActionButton
                            onPress={() => void handleAttachDoc()}
                            feedback="share"
                            accessibilityLabel="Attach document"
                            pressScale={0.97}
                            playful={false}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.control, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Icon name="file-text" size={20} color="#3b82f6" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Document</Text>
                                <Text style={{ fontSize: 12, color: colors.mutedText }}>Share PDF, DOCX, code or text files</Text>
                            </View>
                        </AnimatedActionButton>
                    </Pressable>
                    </ModalMotionSurface>
                </ModalBackdrop>
            </Modal>

            {/* ── Document Preview Modal ─────────────────────────────────── */}
            <DocumentPreviewModal
                visible={Boolean(previewDocAttachment)}
                attachment={previewDocAttachment}
                onClose={() => setPreviewDocAttachment(null)}
            />

            {/* ── Unified WhatsApp Emoji & Sticker Keyboard ───────────────── */}
            <EmojiStickerKeyboard
                visible={keyboardState.visible}
                initialTab={keyboardState.tab}
                onClose={() => setKeyboardState((s) => ({ ...s, visible: false }))}
                onEmojiSelect={(emoji) => setMessageText((t) => t + emoji)}
                onStickerSelect={handleStickerSelect}
                onBackspace={() => setMessageText((t) => t.slice(0, -1))}
            />

            {/* ── Settings Menu ─────────────────────────────────────────── */}
            {friend && (
                <ChatSettingsMenu
                    visible={showSettings}
                    onClose={() => setShowSettings(false)}
                    userName={friend.userName ?? ''}
                    friendId={friendId ?? ''}
                    currentUserId={currentUserId}
                    onDeleteChat={handleDeleteChat}
                    onOpenChatMedia={() => setShowMediaPanel(true)}
                    onOpenStarred={() => setShowStarred(true)}
                    onUploadWallpaper={handleUploadWallpaper}
                    onResetWallpaper={handleResetWallpaper}
                    hasCustomWallpaper={Boolean(wallpaperUri)}
                />
            )}

            {/* ── Starred messages (website settings menu) ─────────────── */}
            <Modal visible={showStarred} transparent animationType="slide" onRequestClose={() => setShowStarred(false)}>
                <Pressable onPress={() => setShowStarred(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}>
                    <Pressable style={{ maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                            <Icon name="star" size={18} color="#f59e0b" />
                            <Text style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 17, fontWeight: '900' }}>Starred messages</Text>
                            <TouchableOpacity accessibilityLabel="Close starred messages" onPress={() => setShowStarred(false)} style={{ padding: 4 }}><Icon name="x" size={20} color={colors.mutedText} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={messages.filter((message) => starredMessageIds.has(getMsgId(message)))}
                            keyExtractor={getMsgId}
                            ListEmptyComponent={<Text style={{ color: colors.mutedText, paddingVertical: 24, textAlign: 'center' }}>No starred messages yet. Long-press a message and tap Star.</Text>}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Go to this message"
                                    onPress={() => handleJumpToStarred(item)}
                                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800' }}>{item.senderId === currentUserId ? 'You' : friend?.firstName ?? 'Friend'} · {new Date(item.timestamp.seconds * 1000).toLocaleString()}</Text>
                                    <Text style={{ color: colors.text, marginTop: 3 }}>{item.message || (item.attachment ? 'Attachment' : item.stickerUrl || item.stickerData ? 'Sticker' : item.audioUrl || item.voiceNoteData ? 'Voice message' : 'Message')}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </Pressable>
                </Pressable>
            </Modal>

            {reportMessage ? (
                <ReportPostModal
                    visible
                    onClose={() => setReportMessage(null)}
                    target={{
                        contentType: 'message',
                        targetId: getMsgId(reportMessage),
                        reportedUserId: reportMessage.senderId,
                        chatId: chatRoomId,
                        routePath: `/chat/${friendId ?? ''}`,
                        previewText: reportMessage.message || 'Attachment',
                        label: 'message',
                    }}
                />
            ) : null}

            {/* ── Chat Media Panel ──────────────────────────────────────── */}
            {friend && (
                <ChatMediaPanel
                    visible={showMediaPanel}
                    onClose={() => setShowMediaPanel(false)}
                    messages={messages}
                    friendName={`${friend.firstName} ${friend.lastName}`}
                    onImagePress={(url) => {
                        setShowMediaPanel(false);
                        setLightboxUrl(url);
                    }}
                />
            )}

            {/* ── Forward Message Modal ─────────────────────────────────── */}
            <ForwardMessageModal
                visible={Boolean(forwardMessage)}
                onClose={() => setForwardMessage(null)}
                messageToForward={forwardMessage}
                currentUserId={currentUserId}
                onForwardSuccess={(name) => {
                    setChatModal({
                        visible: true,
                        type: 'success',
                        title: 'Message Forwarded',
                        message: `Message forwarded to ${name}.`,
                        confirmText: 'OK',
                    });
                }}
            />

            <ChatVideoViewer
                url={videoViewer?.url ?? null}
                title={videoViewer?.fileName}
                onClose={() => setVideoViewer(null)}
                onSave={() => {
                    if (!videoViewer) return;
                    void chatFileShareService.share(videoViewer.url, videoViewer.fileName, videoViewer.fileType).catch((error: unknown) => {
                        console.error('[ChatScreen.saveVideo] Error:', error);
                        toast.error('The video could not be saved.');
                    });
                }}
            />

            {trimCandidate ? (
                <VideoTrimModal
                    source={{ uri: trimCandidate.uri, durationSeconds: trimCandidate.durationSeconds, fileSize: trimCandidate.fileSize }}
                    maxDurationSeconds={Math.min(Math.ceil(trimCandidate.durationSeconds), maxVideoSecondsForLimit(trimCandidate.durationSeconds, trimCandidate.fileSize))}
                    title={trimCandidate.fileSize > MAX_CHAT_FILE_BYTES ? 'Trim video to send (25 MB max)' : 'Trim video'}
                    requireCut
                    onCancel={() => setTrimCandidate(null)}
                    onComplete={handleTrimmedVideo}
                    onError={(message) => { setTrimCandidate(null); toast.error(message); }}
                />
            ) : null}

            {/* ── Image Lightbox ────────────────────────────────────────── */}
            {lightboxUrl && (
                <Modal visible animationType="fade" transparent onRequestClose={() => setLightboxUrl(null)}>
                    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setLightboxUrl(null)}>
                        <Image source={{ uri: lightboxUrl }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
                        <TouchableOpacity onPress={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 60, right: 20, padding: 12 }}>
                            <Icon name="x" size={26} color="#ffffff" />
                        </TouchableOpacity>
                    </Pressable>
                </Modal>
            )}

            {/* ── Action / Feedback Dialog ──────────────────────────────── */}
            <CustomModal
                visible={chatModal.visible}
                type={chatModal.type}
                title={chatModal.title}
                message={chatModal.message}
                confirmText={chatModal.confirmText}
                cancelText={chatModal.cancelText}
                onConfirm={chatModal.onConfirm}
                onClose={() => setChatModal((prev) => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}
