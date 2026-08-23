import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Clipboard,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { Attachment } from '@/lib/messaging/MessagingService';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type DocumentPreviewModalProps = {
  visible: boolean;
  attachment: Attachment | null;
  onClose: () => void;
};

export type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'text' | 'unsupported';

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'log',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm',
  'py', 'java', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift',
  'kt', 'kts', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'toml', 'ini', 'env', 'vue', 'svelte',
]);

function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function getAttachmentPreviewKind(attachment: Attachment): AttachmentPreviewKind {
  const extension = getExtension(attachment.fileName);
  const fileType = attachment.fileType.toLowerCase();

  if (TEXT_EXTENSIONS.has(extension)) return 'text';
  if (fileType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (OFFICE_EXTENSIONS.has(extension)) return 'office';
  if (IMAGE_EXTENSIONS.has(extension) || fileType.startsWith('image/')) return 'image';
  if (VIDEO_EXTENSIONS.has(extension) || fileType.startsWith('video/')) return 'video';
  if (AUDIO_EXTENSIONS.has(extension) || fileType.startsWith('audio/')) return 'audio';
  if (fileType.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(fileType)) {
    return 'text';
  }
  return 'unsupported';
}

export function DocumentPreviewModal({ visible, attachment, onClose }: DocumentPreviewModalProps) {
  const [textContent, setTextContent] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewKind = useMemo(() => (attachment ? getAttachmentPreviewKind(attachment) : 'unsupported'), [attachment]);

  // Load text file content for code & text previews
  useEffect(() => {
    if (!visible || !attachment || previewKind !== 'text') return;

    setIsLoadingText(true);
    setTextError(null);
    setTextContent('');

    const loadText = async () => {
      try {
        const res = await fetch(attachment.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        setTextContent(text);
      } catch (err) {
        console.error('[DocumentPreviewModal] Error loading text preview:', err);
        setTextError('Could not load text preview. You can open or download the file directly.');
      } finally {
        setIsLoadingText(false);
      }
    };

    void loadText();
  }, [visible, attachment, previewKind]);

  if (!visible || !attachment) return null;

  const extension = getExtension(attachment.fileName).toUpperCase();
  const lineCount = textContent ? textContent.split('\n').length : 0;

  const handleCopyCode = () => {
    if (textContent) {
      Clipboard.setString(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const googleDocsViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(attachment.url)}`;

  return (
    <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor="#475569" accessibilityLabel="Swipe down to close document preview" style={{ flex: 1, backgroundColor: '#0f172a', paddingTop: 44 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1e293b',
          backgroundColor: '#0f172a',
        }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }} numberOfLines={1}>
                {attachment.fileName}
              </Text>
              {extension ? (
                <View style={{ backgroundColor: '#10b981', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{extension}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {(attachment.fileSize / 1024).toFixed(1)} KB {lineCount > 0 ? `· ${lineCount} lines` : ''}
            </Text>
          </View>

          {previewKind === 'text' && textContent ? (
            <TouchableOpacity onPress={handleCopyCode} style={{ padding: 8, marginRight: 4 }}>
              <Icon name={copied ? 'check' : 'copy'} size={18} color={copied ? '#10b981' : '#94a3b8'} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => void Linking.openURL(attachment.url)} style={{ padding: 8, marginRight: 4 }}>
            <Icon name="external-link" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Icon name="x" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Preview Container */}
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
          {/* Text & Code Previewer */}
          {previewKind === 'text' && (
            isLoadingText ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Loading code preview...</Text>
              </View>
            ) : textError ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Icon name="alert-circle" size={40} color="#ef4444" />
                <Text style={{ color: '#f87171', fontSize: 15, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                  {textError}
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                <Text style={{
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 13,
                  color: '#e2e8f0',
                  lineHeight: 20,
                }}>
                  {textContent}
                </Text>
              </ScrollView>
            )
          )}

          {/* Image Previewer */}
          {previewKind === 'image' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: attachment.url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
          )}

          {/* PDF / Office / Unsupported Documents */}
          {(previewKind === 'pdf' || previewKind === 'office' || previewKind === 'unsupported' || previewKind === 'video' || previewKind === 'audio') && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name={previewKind === 'pdf' ? 'file-text' : previewKind === 'office' ? 'file' : 'download'} size={32} color="#10b981" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff', marginBottom: 6, textAlign: 'center' }}>
                {attachment.fileName}
              </Text>
              <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
                Tap below to open or download this {extension || 'document'} file in your system browser.
              </Text>

              <TouchableOpacity
                onPress={() => void Linking.openURL(googleDocsViewerUrl)}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 14,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <Icon name="eye" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>View in Google Docs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void Linking.openURL(attachment.url)}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 14,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <Icon name="download" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Download File</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SwipeDismissSurface>
    </Modal>
  );
}
