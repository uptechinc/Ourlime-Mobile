import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Clipboard,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import type { Attachment } from '@/lib/messaging/MessagingService';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { ChatVideoPlayer } from '@/components/chat/ChatVideoViewer';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import { chatFileShareService } from '@/lib/services/ChatFileShareService';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';

type DocumentPreviewModalProps = {
  visible: boolean;
  attachment: Attachment | null;
  onClose: () => void;
};

export type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'open-document' | 'text' | 'unsupported';

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf']);
const OPEN_DOCUMENT_EXTENSIONS = new Set(['odt', 'ods', 'odp']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', '3gp']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'weba']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'log',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm',
  'py', 'java', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift',
  'kt', 'kts', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'toml', 'ini', 'env', 'vue', 'svelte',
]);
// Same 2 MB cap as the website's text preview.
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

function getExtension(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
}

/** Website getAttachmentPreviewKind: extension first, then MIME type. */
export function getAttachmentPreviewKind(attachment: Pick<Attachment, 'fileName' | 'fileType'>): AttachmentPreviewKind {
  const extension = getExtension(attachment.fileName);
  const fileType = (attachment.fileType || '').toLowerCase();

  if (TEXT_EXTENSIONS.has(extension)) return 'text';
  if (fileType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (OFFICE_EXTENSIONS.has(extension)) return 'office';
  if (OPEN_DOCUMENT_EXTENSIONS.has(extension)) return 'open-document';
  if (IMAGE_EXTENSIONS.has(extension) || fileType.startsWith('image/')) return 'image';
  if (VIDEO_EXTENSIONS.has(extension) || fileType.startsWith('video/')) return 'video';
  if (AUDIO_EXTENSIONS.has(extension) || fileType.startsWith('audio/')) return 'audio';
  if (fileType.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(fileType)) {
    return 'text';
  }
  return 'unsupported';
}

/**
 * Viewer page shown inside the app's WebView: Google's document viewer (same as the website). Microsoft's Office
 * viewer can't open Firebase Storage links ("File not found"), so it isn't used.
 */
function getWebViewerUrl(kind: AttachmentPreviewKind, fileUrl: string): string | null {
  if (kind === 'pdf' && Platform.OS === 'ios') return fileUrl; // iOS WebKit renders PDFs itself.
  if (kind === 'pdf' || kind === 'office' || kind === 'open-document') return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;
  return null;
}

export function DocumentPreviewModal({ visible, attachment, onClose }: DocumentPreviewModalProps) {
  const [textContent, setTextContent] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bumped to reload the viewer (Google's viewer sometimes returns an empty page on the first try).
  const [viewerReloadKey, setViewerReloadKey] = useState(0);

  const previewKind = useMemo(() => (attachment ? getAttachmentPreviewKind(attachment) : 'unsupported'), [attachment]);
  const fileUrl = attachment ? ensureMediaUrl(attachment.url) || attachment.url : '';

  useEffect(() => {
    setWebViewLoading(true);
    setWebViewError(false);
  }, [attachment?.url]);

  // Load text file content for code & text previews
  useEffect(() => {
    if (!visible || !attachment || previewKind !== 'text') return;

    setIsLoadingText(true);
    setTextError(null);
    setTextContent('');

    const loadText = async () => {
      try {
        if (attachment.fileSize > MAX_TEXT_PREVIEW_BYTES) throw new Error('too-large');
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        setTextContent(text.slice(0, MAX_TEXT_PREVIEW_BYTES));
      } catch (err) {
        console.error('[DocumentPreviewModal.loadText] Error:', err);
        setTextError(err instanceof Error && err.message === 'too-large'
          ? 'This file is too large to preview (over 2 MB). Save it to open it in another app.'
          : 'Could not load text preview. You can save the file instead.');
      } finally {
        setIsLoadingText(false);
      }
    };

    void loadText();
  }, [visible, attachment, previewKind, fileUrl]);

  if (!visible || !attachment) return null;

  const extension = getExtension(attachment.fileName).toUpperCase();
  const lineCount = textContent ? textContent.split('\n').length : 0;
  const webViewerUrl = getWebViewerUrl(previewKind, fileUrl);

  const handleReloadViewer = (): void => {
    setWebViewError(false);
    setWebViewLoading(true);
    setViewerReloadKey((value) => value + 1);
  };

  const handleCopyCode = () => {
    if (textContent) {
      Clipboard.setString(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      await chatFileShareService.share(attachment.url, attachment.fileName, attachment.fileType);
    } catch (error: unknown) {
      console.error('[DocumentPreviewModal.handleSave] Error:', error);
      toast.error('The file could not be saved.');
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', flexShrink: 1 }} numberOfLines={1}>
                {attachment.fileName}
              </Text>
              {extension ? (
                <View style={{ backgroundColor: '#10b981', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{extension}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {formatFileSize(attachment.fileSize)} {lineCount > 0 ? `· ${lineCount} lines` : ''}
            </Text>
          </View>

          {previewKind === 'text' && textContent ? (
            <TouchableOpacity onPress={handleCopyCode} accessibilityLabel="Copy text" style={{ padding: 8, marginRight: 4 }}>
              <Icon name={copied ? 'check' : 'copy'} size={18} color={copied ? '#10b981' : '#94a3b8'} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => void handleSave()} disabled={saving} accessibilityLabel="Save or share file" style={{ padding: 8, marginRight: 4 }}>
            {saving ? <ActivityIndicator size="small" color="#94a3b8" /> : <Icon name="download" size={18} color="#94a3b8" />}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} accessibilityLabel="Close preview" style={{ padding: 8 }}>
            <Icon name="x" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Preview Container */}
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
          {previewKind === 'text' && (
            isLoadingText ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Loading preview...</Text>
              </View>
            ) : textError ? (
              <PreviewMessage icon="alert-circle" title={textError} onSave={() => void handleSave()} saving={saving} />
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                <Text selectable style={{
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

          {previewKind === 'image' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: fileUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
          )}

          {previewKind === 'video' && <ChatVideoPlayer url={attachment.url} />}

          {previewKind === 'audio' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <View style={{ width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: '#10b981', padding: 16 }}>
                <VoiceNotePlayer audioUrl={attachment.url} duration={0} isSentByMe fileName={attachment.fileName} playbackId={`preview:${attachment.url}`} />
              </View>
            </View>
          )}

          {webViewerUrl && (
            webViewError ? (
              <PreviewMessage icon="file-text" title="This document couldn't be previewed." detail="Tap Reload to try again, or save it to open it in another app." onSave={() => void handleSave()} saving={saving} onRetry={handleReloadViewer} />
            ) : (
              <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                  <Text style={{ flex: 1, color: '#94a3b8', fontSize: 12 }}>Not showing correctly?</Text>
                  <TouchableOpacity onPress={() => handleReloadViewer()} accessibilityLabel="Reload preview" style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#1e293b' }}>
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>Reload</Text>
                  </TouchableOpacity>
                </View>
                <WebView
                  key={`viewer-${viewerReloadKey}`}
                  source={{ uri: webViewerUrl }}
                  originWhitelist={['https://*']}
                  onLoadEnd={() => setWebViewLoading(false)}
                  onError={() => { setWebViewLoading(false); setWebViewError(true); }}
                  onHttpError={() => { setWebViewLoading(false); setWebViewError(true); }}
                  startInLoadingState={false}
                  setSupportMultipleWindows={false}
                  style={{ flex: 1 }}
                />
                {webViewLoading ? (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Loading document...</Text>
                  </View>
                ) : null}
              </View>
            )
          )}

          {previewKind === 'unsupported' && (
            <PreviewMessage icon="file" title="Preview unavailable" detail={`${extension || 'This'} files can't be previewed in the app. Save it to open it in another app.`} onSave={() => void handleSave()} saving={saving} />
          )}
        </View>
      </SwipeDismissSurface>
    </Modal>
  );
}

type PreviewMessageProps = { icon: string; title: string; detail?: string; onSave: () => void; saving: boolean; onRetry?: () => void };

function PreviewMessage({ icon, title, detail, onSave, saving, onRetry }: PreviewMessageProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name={icon} size={32} color="#10b981" />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      {detail ? <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>{detail}</Text> : null}
      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{ backgroundColor: '#10b981', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name="download" size={18} color="#ffffff" />}
        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Save / Share</Text>
      </TouchableOpacity>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={{ marginTop: 10, borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center', backgroundColor: '#1e293b' }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Reload</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
