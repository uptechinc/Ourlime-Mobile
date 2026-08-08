import { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Feather';
import { LocationService, type LocationSearchResult } from '@/lib/services/LocationService';
import type { PostLocation } from '@/lib/services/PostService';

type LocationPickerModalProps = {
  initialLocation?: PostLocation;
  onClose: () => void;
  onSelect: (location: PostLocation) => void;
};

const DEFAULT_LAT = 10.6599;
const DEFAULT_LNG = -61.5199;
const locationService = LocationService.getInstance();

export default function LocationPickerModal({ initialLocation, onClose, onSelect }: LocationPickerModalProps) {
  const [selected, setSelected] = useState<PostLocation | undefined>(initialLocation);
  const [currentCoords, setCurrentCoords] = useState({
    lat: initialLocation?.lat ?? DEFAULT_LAT,
    lng: initialLocation?.lng ?? DEFAULT_LNG,
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  // 400ms debounced automatic search
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const searchResults = await locationService.search(query);
        setResults(searchResults);
      } catch {
        // ignore
      } finally {
        setBusy(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResult = (result: LocationSearchResult) => {
    const location = locationService.fromSearchResult(result);
    setSelected(location);
    setCurrentCoords({ lat: result.lat, lng: result.lng });
    setResults([]);
    setQuery(location.name);
  };

  const handleLocate = async () => {
    setBusy(true);
    try {
      const location = await locationService.getCurrentLocation();
      setSelected(location);
      if (location.lat !== undefined && location.lng !== undefined) {
        setCurrentCoords({ lat: location.lat, lng: location.lng });
      }
    } catch (error: unknown) {
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not retrieve your current location.');
    } finally {
      setBusy(false);
    }
  };

  const handleCoordinate = async (lat: number, lng: number) => {
    setBusy(true);
    setCurrentCoords({ lat, lng });
    try {
      setSelected(await locationService.reverseGeocode(lat, lng));
    } catch {
      setSelected({ name: 'Pinned location', address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
    } finally {
      setBusy(false);
    }
  };

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #e2e8f0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${currentCoords.lat}, ${currentCoords.lng}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'OpenStreetMap'
          }).addTo(map);

          var marker = L.marker([${currentCoords.lat}, ${currentCoords.lng}], { draggable: true }).addTo(map);

          function postCoords(lat, lng) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
          }

          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            postCoords(e.latlng.lat, e.latlng.lng);
          });

          marker.on('dragend', function(e) {
            var position = marker.getLatLng();
            postCoords(position.lat, position.lng);
          });
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><Icon name="x" size={24} color="#374151" /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' }}>Add location</Text>
          <TouchableOpacity onPress={() => selected && onSelect(selected)} disabled={!selected || busy} style={{ padding: 8 }}>
            <Text style={{ color: selected ? '#10b981' : '#9ca3af', fontWeight: '800' }}>Attach</Text>
          </TouchableOpacity>
        </View>

        {/* Debounced Search Bar */}
        <View style={{ flexDirection: 'row', margin: 14, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#f9fafb' }}>
          <Icon name="search" size={18} color="#6b7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search address or landmark..."
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: '#111827' }}
          />
          {busy ? <ActivityIndicator size="small" color="#10b981" /> : query.length > 0 ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Icon name="x-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Results Dropdown */}
        {results.length > 0 ? (
          <ScrollView style={{ maxHeight: 190, marginHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#ffffff', zIndex: 100 }} keyboardShouldPersistTaps="handled">
            {results.map((result) => (
              <TouchableOpacity key={`${result.lat}-${result.lng}`} onPress={() => handleResult(result)} style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <Icon name="map-pin" size={17} color="#10b981" />
                <Text style={{ flex: 1, marginLeft: 9, color: '#374151', fontSize: 13 }}>{result.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Interactive OpenStreetMap WebView Container */}
        <View style={{ flex: 1, marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e2e8f0', minHeight: 260, position: 'relative' }}>
          <WebView
            originWhitelist={['*']}
            source={{ html: leafletHtml }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (typeof data.lat === 'number' && typeof data.lng === 'number') {
                  void handleCoordinate(data.lat, data.lng);
                }
              } catch {
                // ignore
              }
            }}
            style={{ width: '100%', height: '100%' }}
          />

          <TouchableOpacity onPress={() => void handleLocate()} style={{ position: 'absolute', right: 14, top: 14, width: 44, height: 44, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 }}>
            <Icon name="crosshair" size={21} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Footer Selected Location Preview */}
        <View style={{ margin: 14, padding: 14, minHeight: 65, borderRadius: 14, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="map-pin" size={20} color="#10b981" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: '#111827', fontWeight: '700' }}>{busy ? 'Finding location…' : selected?.name ?? 'Tap map to drop a pin'}</Text>
            {selected?.address ? <Text numberOfLines={2} style={{ marginTop: 3, color: '#6b7280', fontSize: 12 }}>{selected.address}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
