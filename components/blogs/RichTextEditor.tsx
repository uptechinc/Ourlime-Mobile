import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Strikethrough, Underline, Undo2, Redo2,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type RichTextEditorProps = {
  /** Initial HTML; read once on mount (the editor owns its content afterwards). */
  initialHtml: string;
  placeholder?: string;
  height?: number;
  onChange: (html: string, plainText: string) => void;
};

type EditorCommand =
  | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'h2' | 'h3' | 'p' | 'blockquote'
  | 'insertUnorderedList' | 'insertOrderedList'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight'
  | 'undo' | 'redo';

type EditorState = Partial<Record<EditorCommand, boolean>>;

type EditorMessage =
  | { type: 'change'; html: string; text: string }
  | { type: 'state'; state: EditorState };

type ToolbarButton = { command: EditorCommand; icon: typeof Bold; label: string };

// Mirrors the web TipTap toolbar (StarterKit + Underline + TextAlign).
const TOOLBAR: ToolbarButton[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'strikeThrough', icon: Strikethrough, label: 'Strikethrough' },
  { command: 'h2', icon: Heading2, label: 'Heading 2' },
  { command: 'h3', icon: Heading3, label: 'Heading 3' },
  { command: 'p', icon: Pilcrow, label: 'Paragraph' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
  { command: 'blockquote', icon: Quote, label: 'Quote' },
  { command: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
  { command: 'justifyCenter', icon: AlignCenter, label: 'Align center' },
  { command: 'justifyRight', icon: AlignRight, label: 'Align right' },
  { command: 'undo', icon: Undo2, label: 'Undo' },
  { command: 'redo', icon: Redo2, label: 'Redo' },
];

function buildEditorDocument(initialHtml: string, placeholder: string, textColor: string, mutedColor: string, accentColor: string): string {
  // JSON.stringify safely embeds user HTML inside the script.
  const initial = JSON.stringify(initialHtml).replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #editor { min-height: 100vh; box-sizing: border-box; padding: 14px; outline: none; color: ${textColor};
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; word-wrap: break-word; }
  #editor:empty:before { content: attr(data-placeholder); color: ${mutedColor}; }
  #editor h2 { font-size: 1.45em; margin: 0.6em 0 0.3em; } #editor h3 { font-size: 1.2em; margin: 0.6em 0 0.3em; }
  #editor p { margin: 0 0 0.7em; } #editor a { color: ${accentColor}; }
  #editor blockquote { margin: 0.6em 0; padding-left: 12px; border-left: 3px solid ${accentColor}; color: ${mutedColor}; font-style: italic; }
  #editor ul, #editor ol { padding-left: 1.4em; margin: 0 0 0.7em; }
</style></head><body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder.replace(/"/g, '&quot;')}"></div>
<script>
  var editor = document.getElementById('editor');
  editor.innerHTML = ${initial};
  document.execCommand('defaultParagraphSeparator', false, 'p');
  function post(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  function emitChange() {
    var html = editor.innerHTML === '<br>' || editor.innerHTML === '<p><br></p>' ? '' : editor.innerHTML;
    post({ type: 'change', html: html, text: editor.innerText || '' });
  }
  function emitState() {
    var block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    var state = {};
    ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight'].forEach(function (name) {
      try { state[name] = document.queryCommandState(name); } catch (error) { state[name] = false; }
    });
    state.h2 = block === 'h2'; state.h3 = block === 'h3'; state.blockquote = block === 'blockquote'; state.p = block === 'p';
    post({ type: 'state', state: state });
  }
  window.runCommand = function (command, value) {
    editor.focus();
    if (command === 'h2' || command === 'h3' || command === 'p' || command === 'blockquote') {
      var current = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      document.execCommand('formatBlock', false, current === command && command !== 'p' ? 'p' : command);
    } else if (command === 'createLink') {
      document.execCommand('createLink', false, value);
    } else {
      document.execCommand(command, false, null);
    }
    emitChange(); emitState();
  };
  editor.addEventListener('input', function () { emitChange(); emitState(); });
  document.addEventListener('selectionchange', emitState);
</script></body></html>`;
}

export default function RichTextEditor({ initialHtml, placeholder = 'Start writing your amazing story...', height = 420, onChange }: RichTextEditorProps) {
  const { colors } = useAppTheme();
  const webViewRef = useRef<WebView>(null);
  const [activeState, setActiveState] = useState<EditorState>({});
  const [isLinkPromptOpen, setIsLinkPromptOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  // Built once: re-rendering the document would discard what the user typed.
  const source = useMemo(
    () => ({ html: buildEditorDocument(initialHtml, placeholder, colors.text, colors.mutedText, '#10b981') }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runCommand = (command: EditorCommand | 'createLink', value?: string) => {
    webViewRef.current?.injectJavaScript(`window.runCommand(${JSON.stringify(command)}, ${JSON.stringify(value ?? null)}); true;`);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as EditorMessage;
      if (message.type === 'change') onChange(message.html, message.text);
      else if (message.type === 'state') setActiveState(message.state);
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  const handleInsertLink = () => {
    const url = linkUrl.trim();
    setIsLinkPromptOpen(false);
    if (/^https?:\/\/\S+\.\S+/.test(url)) runCommand('createLink', url);
    setLinkUrl('https://');
  };

  return (
    <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={[styles.toolbar, { borderBottomColor: colors.border }]}>
        {TOOLBAR.map((button) => {
          const Icon = button.icon;
          const isActive = activeState[button.command] === true;
          return (
            <Pressable key={button.command} onPress={() => runCommand(button.command)} style={[styles.toolButton, isActive && { backgroundColor: '#10b98122' }]} accessibilityRole="button" accessibilityLabel={button.label} accessibilityState={{ selected: isActive }}>
              <Icon size={18} color={isActive ? '#10b981' : colors.icon} />
            </Pressable>
          );
        })}
        <Pressable onPress={() => setIsLinkPromptOpen(true)} style={styles.toolButton} accessibilityRole="button" accessibilityLabel="Insert link">
          <Link2 size={18} color={colors.icon} />
        </Pressable>
      </ScrollView>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source}
        onMessage={handleMessage}
        style={{ height, backgroundColor: 'transparent' }}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        nestedScrollEnabled
        javaScriptEnabled
        scrollEnabled
      />
      <Modal visible={isLinkPromptOpen} transparent animationType="fade" onRequestClose={() => setIsLinkPromptOpen(false)}>
        <View style={styles.linkOverlay}>
          <View style={[styles.linkCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.linkTitle, { color: colors.text }]}>Insert link</Text>
            <Text style={[styles.linkHint, { color: colors.mutedText }]}>Select text in the editor first, then add its link.</Text>
            <TextInput value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" keyboardType="url" autoFocus style={[styles.linkInput, { color: colors.text, borderColor: colors.border }]} />
            <View style={styles.linkActions}>
              <Pressable onPress={() => setIsLinkPromptOpen(false)} style={styles.linkButton}><Text style={{ color: colors.mutedText, fontWeight: '700' }}>Cancel</Text></Pressable>
              <Pressable onPress={handleInsertLink} style={[styles.linkButton, { backgroundColor: '#10b981' }]}><Text style={{ color: '#ffffff', fontWeight: '700' }}>Add link</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', gap: 2, paddingHorizontal: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  toolButton: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  linkOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  linkCard: { borderRadius: 18, padding: 18, gap: 10 },
  linkTitle: { fontSize: 17, fontWeight: '800' },
  linkHint: { fontSize: 12 },
  linkInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  linkActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  linkButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});
