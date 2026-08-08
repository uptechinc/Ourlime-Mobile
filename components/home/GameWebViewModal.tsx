import { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// Maps a gameId to its web route path (relative to the site base URL)
const GAME_ROUTES: Record<string, string> = {
    wordle:          '/wordle-game',
    triniGeoGuesser: '/triniGeoGuesser',
};

// Fallback: for unknown gameIds stored in Firestore, try /<gameId> directly
function resolveGameUrl(baseUrl: string, gameId: string): string {
    const path = GAME_ROUTES[gameId] ?? `/${gameId}`;
    return `${baseUrl}${path}`;
}

type GameWebViewModalProps = {
    gameId: string;
    gameName: string;
    isVisible: boolean;
    onClose: () => void;
};

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_API_URL ?? 'https://ourlime.com';

export default function GameWebViewModal({
    gameId,
    gameName,
    isVisible,
    onClose,
}: GameWebViewModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [pageTitle, setPageTitle] = useState(gameName);

    const gameUrl = resolveGameUrl(WEB_BASE_URL, gameId);

    const handleNavChange = (state: WebViewNavigation) => {
        setCanGoBack(state.canGoBack);
    };

    const handleClose = () => {
        setIsLoading(true);
        setHasError(false);
        setCanGoBack(false);
        setPageTitle(gameName);
        onClose();
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={false}
            onRequestClose={handleClose}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>

                {/* ── Header bar ── */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                    backgroundColor: '#ffffff',
                }}>
                    {/* Back button (navigates within WebView if possible, else closes) */}
                    <TouchableOpacity
                        onPress={handleClose}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#f3f4f6',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 10,
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={18} color="#374151" />
                    </TouchableOpacity>

                    {/* Title */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                            {pageTitle}
                        </Text>
                        {isLoading && (
                            <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Loading…</Text>
                        )}
                    </View>

                    {/* Loading indicator */}
                    {isLoading && (
                        <ActivityIndicator size="small" color="#10b981" style={{ marginLeft: 8 }} />
                    )}
                </View>

                {/* ── WebView ── */}
                {hasError ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                        <Ionicons name="game-controller-outline" size={60} color="#d1d5db" />
                        <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '700', color: '#111827' }}>
                            Couldn't load game
                        </Text>
                        <Text style={{ marginTop: 6, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
                            Make sure you're connected to the internet and try again.
                        </Text>
                        <TouchableOpacity
                            style={{
                                marginTop: 20,
                                paddingHorizontal: 24,
                                paddingVertical: 12,
                                borderRadius: 18,
                                backgroundColor: '#10b981',
                            }}
                            onPress={() => setHasError(false)}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <WebView
                        source={{ uri: gameUrl }}
                        style={{ flex: 1 }}
                        onLoadStart={() => { setIsLoading(true); setHasError(false); }}
                        onLoadEnd={() => setIsLoading(false)}
                        onError={() => { setIsLoading(false); setHasError(true); }}
                        onHttpError={() => { setIsLoading(false); setHasError(true); }}
                        onNavigationStateChange={handleNavChange}
                        onMessage={(e) => {
                            // Games can send postMessage to update the title
                            try {
                                const payload = JSON.parse(e.nativeEvent.data) as { title?: string };
                                if (payload.title) setPageTitle(payload.title);
                            } catch {
                                // ignore non-JSON messages
                            }
                        }}
                        // Allow the game to use device features it needs
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                        allowsFullscreenVideo
                        // Performance
                        cacheEnabled={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        // iOS specific
                        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}
