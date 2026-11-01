import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { GeoCoordinates } from '@/lib/services/GeoGuesserService';

type GuessMapProps = {
  guess: GeoCoordinates | null;
  /** Set once the guess is confirmed: the real spot is shown with a line from the guess. */
  actual: GeoCoordinates | null;
  locked: boolean;
  onGuess: (coordinates: GeoCoordinates) => void;
};

// Leaflet with OpenStreetMap tiles in a WebView: no API key and no native map module needed. Centred on Trinidad
// and Tobago like the website's game map.
const MAP_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;background:#e5e7eb}</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([10.65, -61.2], 9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
var guessMarker = null, actualMarker = null, line = null, locked = false;
function dot(color){ return L.divIcon({ className: '', html: '<div style="width:18px;height:18px;border-radius:9px;background:'+color+';border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>', iconSize: [18,18], iconAnchor: [9,9] }); }
map.on('click', function(e){ if (locked) return; window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng })); });
window.setState = function(state){
  locked = state.locked;
  if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
  if (actualMarker) { map.removeLayer(actualMarker); actualMarker = null; }
  if (line) { map.removeLayer(line); line = null; }
  if (state.guess) guessMarker = L.marker([state.guess.lat, state.guess.lng], { icon: dot('#2563eb') }).addTo(map);
  if (state.actual) {
    actualMarker = L.marker([state.actual.lat, state.actual.lng], { icon: dot('#10b981') }).addTo(map);
    if (state.guess) {
      line = L.polyline([[state.guess.lat, state.guess.lng], [state.actual.lat, state.actual.lng]], { color: '#f59e0b', dashArray: '6 6', weight: 3 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 13 });
    } else { map.setView([state.actual.lat, state.actual.lng], 12); }
  } else if (!state.guess) { map.setView([10.65, -61.2], 9); }
};
</script></body></html>`;

/** Tap-to-guess map for Trini GeoGuesser: blue is the guess, green the real place. */
export default function GuessMap({ guess, actual, locked, onGuess }: GuessMapProps) {
  const webViewRef = useRef<WebView>(null);
  const source = useMemo(() => ({ html: MAP_HTML, baseUrl: 'https://ourlime.com' }), []);
  const state = JSON.stringify({ guess, actual, locked });

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`window.setState && window.setState(${state}); true;`);
  }, [state]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const coordinates = JSON.parse(event.nativeEvent.data) as Partial<GeoCoordinates>;
      if (typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') onGuess({ lat: coordinates.lat, lng: coordinates.lng });
    } catch (error: unknown) {
      console.error('[GuessMap.handleMessage] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={source}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onLoadEnd={() => webViewRef.current?.injectJavaScript(`window.setState && window.setState(${state}); true;`)}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', borderRadius: 16 },
  webView: { flex: 1, backgroundColor: '#e5e7eb' },
});
