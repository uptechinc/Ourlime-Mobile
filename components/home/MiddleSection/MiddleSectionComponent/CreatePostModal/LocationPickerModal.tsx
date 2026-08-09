import { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

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

          marker.on('dragend', function(e) {
            var position = marker.getLatLng();
            postCoords(position.lat, position.lng);
          });

          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            postCoords(e.latlng.lat, e.latlng.lng);
          });
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 8 }} {...panResponder.panHandlers}>
          <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: '#d1d5db' }} />
        </View>
        
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }} {...panResponder.panHandlers}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><Icon name="x" size={24} color="#374151" /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' }}>Add location</Text>
          <TouchableOpacity onPress={() => selected && onSelect(selected)} disabled={!selected || busy} style={{ padding: 8 }}>
            <Text style={{ color: selected ? '#10b981' : '#9ca3af', fontWeight: '800' }}>Attach</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, position: 'relative' }}>
          {/* Debounced Search Bar Container */}
          <View style={{ marginHorizontal: 14, marginTop: 12, marginBottom: 8, zIndex: 1000 }}>
            <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <Icon name="search" size={18} color="#6b7280" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search address or landmark..."
                placeholderTextColor="#9ca3af"
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: '#111827', fontSize: 14 }}
              />
              {busy ? <ActivityIndicator size="small" color="#10b981" /> : query.length > 0 ? (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                  <Icon name="x-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Results Dropdown - Floating Directly OVER Map */}
            {results.length > 0 && (
              <ScrollView
                style={{
                  position: 'absolute',
                  top: 52,
                  left: 0,
                  right: 0,
                  maxHeight: 220,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  backgroundColor: '#ffffff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 10,
                  zIndex: 9999,
                }}
                keyboardShouldPersistTaps="handled"
              >
                {results.map((result) => (
                  <TouchableOpacity
                    key={`${result.lat}-${result.lng}`}
                    onPress={() => handleResult(result)}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                  >
                    <Icon name="map-pin" size={16} color="#10b981" />
                    <Text style={{ flex: 1, marginLeft: 10, color: '#334155', fontSize: 13, fontWeight: '600' }}>
                      {result.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Interactive OpenStreetMap WebView Container */}
          <View style={{ flex: 1, marginHorizontal: 14, marginBottom: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative' }}>
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

          {/* Bottom Selected Location Banner */}
          {selected && (
            <View style={{ marginHorizontal: 14, marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="map-pin" size={18} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>{selected.name}</Text>
                {selected.address ? <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{selected.address}</Text> : null}
              </View>
            </View>
          )}
        </View>

      </SafeAreaView>
    </Modal>
  );
}
