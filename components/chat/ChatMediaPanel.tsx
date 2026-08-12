import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { FullMessage, Attachment } from '@/lib/messaging/MessagingService';
import { DocumentPreviewModal } from './DocumentPreviewModal';

type ChatMediaPanelProps = {
  visible: boolean;
  onClose: () => void;
  messages: FullMessage[];
  friendName: string;
  onImagePress: (url: string) => void;
};

type MediaTab = 'media' | 'documents' | 'links';

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

export function ChatMediaPanel({
  visible,
  onClose,
  messages,
  friendName,
  onImagePress,
}: ChatMediaPanelProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>('media');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const { mediaList, docList, linkList } = useMemo(() => {
    const media: { id: string; url: string; isVideo?: boolean; isSticker?: boolean }[] = [];
    const docs: { id: string; attachment: Attachment }[] = [];
    const links: { id: string; url: string }[] = [];

    messages.forEach((msg) => {
      const msgId = msg.id ?? `${msg.timestamp?.seconds ?? Date.now()}`;

      // Attachment media / document
      if (msg.attachment) {
        const isImage = msg.attachment.fileType.startsWith('image/');
        const isVideo = msg.attachment.fileType.startsWith('video/');
        if (isImage || isVideo) {
          media.push({ id: `${msgId}-media`, url: msg.attachment.url, isVideo });
        } else {
          docs.push({ id: `${msgId}-doc`, attachment: msg.attachment });
        }
      }

      // Sticker
      const stickerUrl = msg.stickerUrl ?? msg.stickerData?.stickerUrl;
      if (stickerUrl) {
        media.push({ id: `${msgId}-sticker`, url: stickerUrl, isSticker: true });
      }

      // Voice note
      const audioUrl = msg.audioUrl ?? msg.voiceNoteData?.audioUrl;
      if (audioUrl) {
        docs.push({
          id: `${msgId}-vn`,
          attachment: {
            url: audioUrl,
            fileName: 'Voice Note.webm',
            fileType: 'audio/webm',
            fileSize: 0,
          },
        });
      }

      // Extracted URLs from text
      if (msg.message) {
        const matches = msg.message.match(URL_PATTERN);
        if (matches) {
          matches.forEach((u, i) => {
            links.push({ id: `${msgId}-link-${i}`, url: u });
          });
        }
      }
    });

    return {
      mediaList: media.reverse(),
      docList: docs.reverse(),
      linkList: links.reverse(),
    };
  }, [messages]);

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: 50 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 6, marginRight: 8 }}>
            <Icon name="arrow-left" size={22} color="#1e293b" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1e293b' }}>Shared Content</Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>with {friendName}</Text>
          </View>
        </View>

        {/* Tabs: Media | Documents | Links */}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#ffffff' }}>
          {[
            { key: 'media', label: `Media (${mediaList.length})`, icon: 'image' },
            { key: 'documents', label: `Docs (${docList.length})`, icon: 'file-text' },
            { key: 'links', label: `Links (${linkList.length})`, icon: 'link' },
          ].map(({ key, label, icon }) => {
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveTab(key as MediaTab)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: isActive ? 2 : 0,
                  borderBottomColor: '#10b981',
                  gap: 6,
                }}
              >
                <Icon name={icon} size={15} color={isActive ? '#10b981' : '#64748b'} />
                <Text style={{ fontSize: 13, fontWeight: isActive ? '700' : '500', color: isActive ? '#10b981' : '#64748b' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content View */}
        <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 12 }}>
          {activeTab === 'media' && (
            mediaList.length === 0 ? (
              <EmptyState icon="image" title="No shared media" subtitle="Photos, videos, and stickers sent in chat will appear here." />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {mediaList.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => onImagePress(item.url)}
                    style={{ width: '31.5%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' }}
                  >
                    <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    {item.isVideo && (
                      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                        <Icon name="play-circle" size={24} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}

          {activeTab === 'documents' && (
            docList.length === 0 ? (
              <EmptyState icon="file-text" title="No shared documents" subtitle="Files and voice notes sent in chat will appear here." />
            ) : (
              docList.map(({ id, attachment }) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => setPreviewAttachment(attachment)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: '#f1f5f9',
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Icon name="file-text" size={20} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                    {attachment.fileSize > 0 && (
                      <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        {(attachment.fileSize / 1024).toFixed(1)} KB
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Preview</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )
          )}

          {activeTab === 'links' && (
            linkList.length === 0 ? (
              <EmptyState icon="link" title="No shared links" subtitle="Web links shared in conversation will appear here." />
            ) : (
              linkList.map((link) => (
                <TouchableOpacity
                  key={link.id}
                  onPress={() => Linking.openURL(link.url)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: '#f1f5f9',
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Icon name="link" size={18} color="#3b82f6" />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: '#2563eb', fontWeight: '500' }} numberOfLines={1}>
                    {link.url}
                  </Text>
                  <Icon name="external-link" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))
            )
          )}
        </ScrollView>

        {/* Document Preview Modal */}
        <DocumentPreviewModal
          visible={Boolean(previewAttachment)}
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      </View>
    </Modal>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon name={icon} size={28} color="#94a3b8" />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 32 }}>{subtitle}</Text>
    </View>
  );
}
