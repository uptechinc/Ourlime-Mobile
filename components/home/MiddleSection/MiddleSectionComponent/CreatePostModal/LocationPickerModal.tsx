import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import { LocationService, type LocationSearchResult } from '@/lib/services/LocationService';
import type { PostLocation } from '@/lib/services/PostService';

type LocationPickerModalProps = {
  initialLocation?: PostLocation;
  onClose: () => void;
  onSelect: (location: PostLocation) => void;
};

const DEFAULT_REGION: Region = {
  latitude: 10.6599,
  longitude: -61.5199,
  latitudeDelta: 0.65,
  longitudeDelta: 0.65,
};
const locationService = LocationService.getInstance();

export default function LocationPickerModal({ initialLocation, onClose, onSelect }: LocationPickerModalProps) {
  const initialRegion: Region = initialLocation?.lat !== undefined && initialLocation.lng !== undefined
    ? { latitude: initialLocation.lat, longitude: initialLocation.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : DEFAULT_REGION;
  const [region, setRegion] = useState(initialRegion);
  const [selected, setSelected] = useState<PostLocation | undefined>(initialLocation);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 3) return;
    setBusy(true);
    try {
      setResults(await locationService.search(query));
    } catch {
      Alert.alert('Search unavailable', 'Location search could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResult = (result: LocationSearchResult) => {
    const location = locationService.fromSearchResult(result);
    setSelected(location);
    setRegion({ latitude: result.lat, longitude: result.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 });
    setResults([]);
    setQuery(location.name);
  };

  const handleLocate = async () => {
    setBusy(true);
    try {
      const location = await locationService.getCurrentLocation();
      setSelected(location);
      setRegion({ latitude: location.lat ?? DEFAULT_REGION.latitude, longitude: location.lng ?? DEFAULT_REGION.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
    } catch (error: unknown) {
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not retrieve your current location.');
    } finally {
      setBusy(false);
    }
  };

  const handleCoordinate = async (latitude: number, longitude: number) => {
    setBusy(true);
    try {
      setSelected(await locationService.reverseGeocode(latitude, longitude));
    } catch {
      setSelected({ name: 'Pinned location', address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lng: longitude });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><Icon name="x" size={24} color="#374151" /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' }}>Add location</Text>
          <TouchableOpacity onPress={() => selected && onSelect(selected)} disabled={!selected || busy} style={{ padding: 8 }}>
            <Text style={{ color: selected ? '#10b981' : '#9ca3af', fontWeight: '800' }}>Attach</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', margin: 14, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, alignItems: 'center', paddingLeft: 12 }}>
          <Icon name="search" size={18} color="#6b7280" />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void handleSearch()} returnKeyType="search" placeholder="Search an address or landmark" style={{ flex: 1, padding: 12 }} />
          <TouchableOpacity onPress={() => void handleSearch()} style={{ padding: 12 }}>{busy ? <ActivityIndicator size="small" color="#10b981" /> : <Text style={{ color: '#10b981', fontWeight: '700' }}>Search</Text>}</TouchableOpacity>
        </View>
        {results.length > 0 ? (
          <ScrollView style={{ maxHeight: 190, marginHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12 }} keyboardShouldPersistTaps="handled">
            {results.map((result) => (
              <TouchableOpacity key={`${result.lat}-${result.lng}`} onPress={() => handleResult(result)} style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <Icon name="map-pin" size={17} color="#10b981" />
                <Text style={{ flex: 1, marginLeft: 9, color: '#374151' }}>{result.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ flex: 1, marginHorizontal: 14, borderRadius: 16, overflow: 'hidden' }}>
          <MapView style={{ flex: 1 }} region={region} onRegionChangeComplete={setRegion} onPress={(event: MapPressEvent) => void handleCoordinate(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}>
            {selected?.lat !== undefined && selected.lng !== undefined ? (
              <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} draggable onDragEnd={(event) => void handleCoordinate(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)} pinColor="#10b981" />
            ) : null}
          </MapView>
          <TouchableOpacity onPress={() => void handleLocate()} style={{ position: 'absolute', right: 14, top: 14, width: 44, height: 44, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
            <Icon name="crosshair" size={21} color="#10b981" />
          </TouchableOpacity>
        </View>
        <View style={{ margin: 14, padding: 14, minHeight: 70, borderRadius: 14, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="map-pin" size={20} color="#10b981" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: '#111827', fontWeight: '700' }}>{busy ? 'Finding location…' : selected?.name ?? 'Tap the map to drop a pin'}</Text>
            {selected?.address ? <Text numberOfLines={2} style={{ marginTop: 3, color: '#6b7280', fontSize: 12 }}>{selected.address}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
