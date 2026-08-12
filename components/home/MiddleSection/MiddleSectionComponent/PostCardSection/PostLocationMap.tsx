import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  Linking,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { PostLocation } from '@/lib/services/PostService';

type PostLocationMapProps = {
  location: PostLocation;
};

export default function PostLocationMap({ location }: PostLocationMapProps) {
  const [expanded, setExpanded] = useState(false);

  const lat = location.coordinates?.latitude ?? location.latitude ?? location.lat;
  const lon = location.coordinates?.longitude ?? location.longitude ?? location.lng;
  const hasCoordinates = typeof lat === 'number' && typeof lon === 'number';
  const zoom = 14;

  // OpenStreetMap static tile url constructed from lat/lon
  const mapTileUrl = hasCoordinates ? `https://static-maps.yandex.ru/1.x/?ll=${lon},${lat}&z=${zoom}&l=map&size=600,300&pt=${lon},${lat},pm2gnm` : null;

  const handleOpenMaps = async () => {
    const label = encodeURIComponent(location.name || location.address || 'Post location');
    const url = hasCoordinates
      ? Platform.select({ ios: `maps:0,0?q=${label}@${lat},${lon}`, default: `geo:${lat},${lon}?q=${lat},${lon}(${label})` })
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address || location.name)}`;
    if (url) await Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Map Preview Image with Controls */}
      {mapTileUrl ? <View style={styles.mapFrame}>
        <Image
          source={{ uri: mapTileUrl }}
          style={styles.mapImage}
          resizeMode="cover"
        />

        {/* Pin Marker Overlay */}
        <View style={styles.markerCenter}>
          <View style={styles.pinBubble}>
            <Icon name="map-pin" size={20} color="#ffffff" />
          </View>
        </View>

        {/* Controls Overlay */}
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={() => setExpanded(true)} style={styles.controlBtn}>
            <Icon name="maximize-2" size={12} color="#1e293b" />
            <Text style={styles.controlText}>Expand</Text>
          </TouchableOpacity>
        </View>
      </View> : null}

      {/* Location Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.iconCircle}>
          <Icon name="map-pin" size={16} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.locName}>{location.name || 'Location'}</Text>
          {location.address ? (
            <Text style={styles.locAddress}>{location.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => void handleOpenMaps()} style={styles.openMapsButton} accessibilityRole="link" accessibilityLabel={`Open ${location.name || 'location'} in maps`}>
          <Icon name="navigation" size={15} color="#047857" />
          <Text style={styles.openMapsText}>Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Expanded Map Modal */}
      {expanded && mapTileUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.expandedContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{location.name}</Text>
                <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeBtn}>
                  <Icon name="x" size={22} color="#0f172a" />
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: mapTileUrl.replace('600,300', '600,600') }}
                style={styles.expandedMap}
                resizeMode="cover"
              />
              <View style={{ padding: 16 }}>
                <Text style={styles.locName}>{location.name}</Text>
                {location.address ? <Text style={styles.locAddress}>{location.address}</Text> : null}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  mapFrame: {
    height: 180,
    width: '100%',
    backgroundColor: '#e2e8f0',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  markerCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  controlsRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  controlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  locAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
  },
  openMapsText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  expandedContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  expandedMap: {
    width: '100%',
    height: 280,
  },
});
