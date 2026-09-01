import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    Linking,
    Keyboard,
    FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { messagingService, type FullMessage, type Attachment } from '@/lib/messaging/MessagingService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { StickerService, normalizeStickerUrl } from '@/lib/sticker/StickerService';
import { getLocalStickerSource } from '@/assets/images/stickers/stickerMap';
import { EmojiStickerKeyboard } from '@/components/chat/EmojiStickerKeyboard';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { ChatSettingsMenu } from '@/components/chat/ChatSettingsMenu';
import { ChatMediaPanel } from '@/components/chat/ChatMediaPanel';
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { DocumentPreviewModal } from '@/components/chat/DocumentPreviewModal';
import { LinkPreviewMessage, LinkInputBanner } from '@/components/chat/LinkPreviewMessage';
import { findFirstUrl } from '@/lib/services/OpenGraphService';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { DeleteMessageModal } from '@/components/chat/DeleteMessageModal';
import type { ReplyReference } from '@/lib/types/message';
import type { Sticker } from '@/lib/types/sticker';
import type { Timestamp } from 'firebase/firestore';
import { useSimpleChatMessages } from '@/lib/hooks/useSimpleChatMessages';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { presenceService, type PresenceState } from '@/lib/services/PresenceService';
import { useCallCoordinator } from '@/lib/contexts/CallContext';
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
};

function MessageBubble({ msg, currentUserId, friend, onReply, onDelete, onReact, onForward, onImagePress, onPreviewDoc }: MessageBubbleProps) {
    const { colors, isDark } = useAppTheme();
    const [showActions, setShowActions] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    if (!friend) return null;
    const isOwn = msg.senderId === currentUserId;

    const isImage = msg.attachment?.fileType?.startsWith('image/');
    const isVideo = msg.attachment?.fileType?.startsWith('video/');
    const isDoc = msg.attachment && !isImage && !isVideo;
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
        <Animated.View entering={FadeInUp.springify().damping(18).stiffness(220)}>
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
                    <View style={{
                        backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : colors.control,
                        borderLeftWidth: 3,
                        borderLeftColor: '#10b981',
                        borderRadius: 8,
                        padding: 7,
                        marginBottom: 4,
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', marginBottom: 2 }}>
                            {msg.replyTo.originalSenderId === currentUserId ? 'You' : friend.firstName}
                        </Text>
                        <Text style={{ fontSize: 12, color: isOwn ? 'rgba(255,255,255,0.82)' : colors.mutedText }} numberOfLines={1}>
                            {msg.replyTo.originalMessage}
                        </Text>
                    </View>
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
                                    <TouchableOpacity onPress={() => onImagePress(msg.attachment!.url)}>
                                        <Image
                                            source={{ uri: msg.attachment.url }}
                                            style={{ width: 220, height: 160, borderRadius: 12, marginBottom: hasText ? 8 : 0 }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                )}

                                {isVideo && msg.attachment && (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(msg.attachment!.url)}
                                        style={{ width: 220, height: 140, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: hasText ? 8 : 0 }}
                                    >
                                        <Icon name="play-circle" size={40} color="#ffffff" />
                                        <Text style={{ color: '#ffffff', fontSize: 12, marginTop: 6 }}>Tap to play</Text>
                                    </TouchableOpacity>
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
                                                    {(msg.attachment.fileSize / 1024).toFixed(1)} KB
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
                                                onPress={() => Linking.openURL(msg.attachment!.url)}
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
        addMessage,
        clearMessages,
    } = useSimpleChatMessages(friendId ?? '', chatRoomId);
    const messages = useMemo(
        () => loadedMessages.filter((message) => !(message.deletedFor ?? []).includes(currentUserId)),
        [currentUserId, loadedMessages],
    );
    const [messageText, setMessageText] = useState('');
    const [replyTo, setReplyTo] = useState<FullMessage | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [keyboardState, setKeyboardState] = useState<{ visible: boolean; tab: 'emojis' | 'stickers' }>({ visible: false, tab: 'emojis' });
    const [showSettings, setShowSettings] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [showAttachModal, setShowAttachModal] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; fileName: string; mimeType: string; type: 'image' | 'document' } | null>(null);
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
        };
    }, []);

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
        const latest = messages[0];
        if (!latest || latest.senderId !== friendId) return;
        const messageId = getMsgId(latest);
        if (latest.message === '[SYS:CALL_ENDED]') return;
        if (handledCallMessageRef.current === messageId) return;
        if (latest.message !== '[SYS:VIDEO_CALL_INVITE]' && latest.message !== '[SYS:VOICE_CALL_INVITE]') return;
        if (Date.now() - latest.timestamp.toMillis() > 45_000) return;
        handledCallMessageRef.current = messageId;
        // Legacy call records remain visible, but current call signaling is handled globally.
    }, [friendId, messages]);

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
        for (let newerIndex = index - 1; newerIndex >= 0; newerIndex -= 1) {
            if (messages[newerIndex].message === '[SYS:CALL_ENDED]') return false;
        }
        return true;
    }, [messages]);

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

    // Send message
    const handleSend = useCallback(async () => {
        if ((!messageText.trim() && !pendingAttachment) || !friendId || !currentUserId || isSending || isBlocked) return;
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
                originalMessage: replyTo.message,
                originalSenderId: replyTo.senderId,
                originalTimestamp: replyTo.timestamp,
            };
        }
        setReplyTo(null);

        let attachment: Attachment | undefined;
        if (pendingAttachment) {
            try {
                attachment = await messagingService.uploadFile(pendingAttachment.uri, pendingAttachment.fileName, pendingAttachment.mimeType, currentUserId);
            } catch (err) {
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
            setPendingAttachment(null);
        }

        try {
            const serverMessage = await messagingService.sendMessage(friendId, text, currentUserId, replyRef, attachment);
            addMessage(serverMessage);
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
    }, [addMessage, messageText, friendId, currentUserId, isSending, replyTo, pendingAttachment, isBlocked]);

    // Start a call
    const callCoordinator = useCallCoordinator();
    const handleStartCall = useCallback(async (type: 'audio' | 'video') => {
        if (!friendId || !currentUserId || isBlocked) return;
        await callCoordinator.startCall(friendId, type === 'audio' ? 'voice' : 'video');
    }, [callCoordinator, friendId, currentUserId, isBlocked]);

    const handleAttachImage = useCallback(async () => {
        setShowAttachModal(false);
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const fileName = asset.fileName ?? `media_${Date.now()}.jpg`;
        setPendingAttachment({ uri: asset.uri, fileName, mimeType, type: 'image' });
    }, []);

    const handleAttachDoc = useCallback(async () => {
        setShowAttachModal(false);
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled) return;
        const asset = result.assets[0];
        setPendingAttachment({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', type: 'document' });
    }, []);

    const handleStickerSelect = useCallback(async (sticker: Sticker) => {
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
            addMessage(await messagingService.sendMessage(friendId, '', currentUserId, undefined, undefined, stickerData));
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
    }, [addMessage, friendId, currentUserId, isBlocked]);

    const handleDelete = useCallback(async (msg: FullMessage, deleteForEveryone: boolean) => {
        if (!friendId || !currentUserId) return;
        await messagingService.deleteMessage(friendId, currentUserId, msg.timestamp.seconds, deleteForEveryone);
        await reloadMessages();
    }, [friendId, currentUserId, reloadMessages]);

    const handleReact = useCallback(async (msg: FullMessage, emoji: string) => {
        if (!currentUserId || isBlocked) return;
        await messagingService.toggleReaction(chatRoomId, msg.timestamp.seconds, emoji, currentUserId);
        await reloadMessages();
    }, [chatRoomId, currentUserId, isBlocked, reloadMessages]);

    const handleForward = useCallback((msg: FullMessage) => {
        setForwardMessage(msg);
    }, []);

    const handleDeleteChat = useCallback(async () => {
        if (!chatRoomId) return;
        await messagingService.clearChatHistory(chatRoomId);
        clearMessages();
    }, [chatRoomId, clearMessages]);

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
                    callActive={isCallInvite ? getCallActiveForMessage(index) : false}
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
            />
        );
    }, [currentUserId, friend, getCallActiveForMessage, handleDelete, handleForward, handleReact, handleStartCall]);

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
                            <Text style={{ fontSize: 12, color: friendPresence?.status === 'online' ? '#10b981' : colors.mutedText }}>
                                {friendPresence?.status === 'online' ? 'Online' : `@${friend.userName}`}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flex: 1 }} />
                )}

                <TouchableOpacity onPress={() => handleStartCall('audio')} disabled={isBlocked} style={{ padding: 8, opacity: isBlocked ? 0.35 : 1 }}>
                    <Icon name="phone" size={20} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleStartCall('video')} disabled={isBlocked} style={{ padding: 8, opacity: isBlocked ? 0.35 : 1 }}>
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
                    <FlatList
                        data={messages}
                        inverted
                        keyExtractor={getMsgId}
                        style={{ flex: 1, backgroundColor: activeBg ? 'transparent' : colors.canvas }}
                        contentContainerStyle={messageListContentStyle}
                        showsVerticalScrollIndicator={false}
                        renderItem={renderMessage}
                    />
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: activeBg ? 'transparent' : colors.canvas, paddingHorizontal: 32 }}>
                            {isLoading ? (
                                <ActivityIndicator size="large" color={colors.accent} />
                            ) : messageError ? (
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
                                        Ready to send — tap Send to upload
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setPendingAttachment(null)} style={{ padding: 6 }}>
                                    <Icon name="x" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}

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
                                        {replyTo.message || (replyTo.stickerData ? '🎨 Sticker' : replyTo.voiceNoteData ? '🎤 Voice note' : 'Attachment')}
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
                                {/* Sticker Picker Toggle (Grid icon) */}
                                <TouchableOpacity
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setKeyboardState({ visible: true, tab: 'stickers' });
                                    }}
                                    style={{ padding: 6 }}
                                    activeOpacity={0.7}
                                >
                                    <Icon
                                        name="grid"
                                        size={20}
                                        color={keyboardState.visible && keyboardState.tab === 'stickers' ? '#10b981' : '#64748b'}
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
                                >
                                    <Icon
                                        name="smile"
                                        size={20}
                                        color={keyboardState.visible && keyboardState.tab === 'emojis' ? '#10b981' : '#64748b'}
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
                                    onChangeText={setMessageText}
                                    multiline
                                    autoCapitalize="sentences"
                                    onFocus={() => setKeyboardState((s) => ({ ...s, visible: false }))}
                                />

                                {/* Paperclip Attachment Icon */}
                                <TouchableOpacity
                                    onPress={() => setShowAttachModal(true)}
                                    style={{ padding: 6 }}
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
                                    disabled={isSending}
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
                            ) : null}
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
                    onUploadWallpaper={handleUploadWallpaper}
                    onResetWallpaper={handleResetWallpaper}
                    hasCustomWallpaper={Boolean(wallpaperUri)}
                />
            )}

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
