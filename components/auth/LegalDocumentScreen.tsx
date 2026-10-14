import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { deepLinkService } from '@/lib/services/DeepLinkService';

type LegalDocumentScreenProps = { title: string; url: string };

// The website hides its own header and navigation when <html data-embed="app"> (see app/globals.css on the web).
// Android runs this before <html> exists, so it waits for the root element when needed. Link clicks are caught
// before the site's client-side router handles them and sent to the app, which opens the matching screen.
const OPEN_LINK_MESSAGE = 'ourlime-open-link';
const EMBED_SCRIPT = `(function () {
  function mark() { var root = document.documentElement; if (root) root.setAttribute('data-embed', 'app'); return Boolean(root); }
  if (!mark()) { var observer = new MutationObserver(function () { if (mark()) observer.disconnect(); }); observer.observe(document, { childList: true }); }
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || !window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return;
    var target = new URL(link.href, location.href);
    if (target.origin === location.origin && target.pathname === location.pathname) return;
    event.preventDefault();
    event.stopPropagation();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${OPEN_LINK_MESSAGE}', url: target.href }));
  }, true);
})(); true;`;

type OpenLinkMessage = { type: typeof OPEN_LINK_MESSAGE; url: string };

function readOpenLinkMessage(data: string): OpenLinkMessage | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed) || !('url' in parsed)) return null;
    return parsed.type === OPEN_LINK_MESSAGE && typeof parsed.url === 'string' ? { type: OPEN_LINK_MESSAGE, url: parsed.url } : null;
  } catch {
    return null;
  }
}

function pathOf(address: string): string | null {
  try {
    return new URL(address).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

export default function LegalDocumentScreen({ title, url }: LegalDocumentScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const documentPath = pathOf(url);

  // The document itself loads in the web view; links inside it open the matching app screen,
  // the mail app, or the browser instead of navigating the embedded page.
  const openLink = (address: string): void => {
    const resolution = deepLinkService.resolve(address);
    if (resolution.kind === 'internal') {
      router.push(resolution.route as Href);
      return;
    }
    Linking.openURL(address).catch((error: unknown) => console.error('[LegalDocumentScreen.openLink] Error:', error));
  };

  const handleShouldStartLoad = (request: WebViewNavigation & { isTopFrame?: boolean }): boolean => {
    if (request.isTopFrame === false || request.url === 'about:blank') return true;
    if (request.url.startsWith('http') && pathOf(request.url) === documentPath) return true;
    openLink(request.url);
    return false;
  };

  // The website also messages the native bridge (push and media setup) whenever it finds one; without a handler
  // the bridge has no postMessage function and the site's layout throws, so other messages are ignored.
  const handleMessage = (event: WebViewMessageEvent): void => {
    const message = readOpenLinkMessage(event.nativeEvent.data);
    if (message) openLink(message.url);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.surface }}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color={colors.icon} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{title}</Text>
      </View>
      <WebView source={{ uri: url }} injectedJavaScriptBeforeContentLoaded={EMBED_SCRIPT} onShouldStartLoadWithRequest={handleShouldStartLoad} onMessage={handleMessage} startInLoadingState renderLoading={() => <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>} />
    </SafeAreaView>
  );
}
