import { useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import type { PostLocation } from '@/lib/services/PostService';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PostLocationMapProps = {
  location: PostLocation;
};

export default function PostLocationMap({ location }: PostLocationMapProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const latitude = location.coordinates?.latitude ?? location.latitude ?? location.lat;
  const longitude = location.coordinates?.longitude ?? location.longitude ?? location.lng;
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';
  const presentation = useMemo(
    () => linkPresentationService.presentLocation(location.name, location.address),
    [location.address, location.name],
  );
  const mapTileUrl = hasCoordinates
    ? `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=14&l=map&size=600,300&pt=${longitude},${latitude},pm2gnm`
    : null;

  const handleOpenLocation = async () => {
    if (presentation.url) {
      await Linking.openURL(presentation.url);
      return;
    }

    const locationLabel = encodeURIComponent(presentation.title);
    const mapsUrl = hasCoordinates
      ? Platform.select({
        ios: `maps:0,0?q=${locationLabel}@${latitude},${longitude}`,
        default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${locationLabel})`,
      })
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address || location.name)}`;
    if (mapsUrl) await Linking.openURL(mapsUrl);
  };

  return (
    <View style={styles.container}>
      {mapTileUrl ? (
        <View style={styles.mapFrame}>
          <Image source={{ uri: mapTileUrl }} style={styles.mapImage} resizeMode="cover" />
          <View style={styles.markerCenter}>
            <View style={styles.pinBubble}>
              <Icon name="map-pin" size={20} color="#ffffff" />
            </View>
          </View>
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={() => setExpanded(true)} style={styles.controlButton}>
              <Icon name="maximize-2" size={12} color="#1e293b" />
              <Text style={styles.controlText}>Expand</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.detailsCard}>
        <View style={styles.iconCircle}>
          <Icon name={presentation.isOnline ? 'link' : 'map-pin'} size={16} color={presentation.isOnline ? colors.accent : '#8b5cf6'} />
        </View>
        <View style={styles.locationCopy}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.locationName}>{presentation.title}</Text>
          {presentation.detail ? (
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.locationAddress}>{presentation.detail}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => void handleOpenLocation()}
          style={styles.openButton}
          accessibilityRole="link"
          accessibilityLabel={presentation.isOnline ? `Open ${presentation.detail}` : `Open ${presentation.title} in maps`}
        >
          <Icon name={presentation.isOnline ? 'external-link' : 'navigation'} size={15} color={colors.successText} />
          <Text style={styles.openButtonText}>{presentation.isOnline ? 'Open Link' : 'Directions'}</Text>
        </TouchableOpacity>
      </View>

      {expanded && mapTileUrl ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.expandedContainer}>
              <View style={styles.modalHeader}>
                <Text numberOfLines={1} style={styles.modalTitle}>{presentation.title}</Text>
                <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeButton}>
                  <Icon name="x" size={22} color={colors.icon} />
                </TouchableOpacity>
              </View>
              <Image source={{ uri: mapTileUrl.replace('600,300', '600,600') }} style={styles.expandedMap} resizeMode="cover" />
              <View style={styles.expandedDetails}>
                <Text numberOfLines={1} style={styles.locationName}>{presentation.title}</Text>
                {presentation.detail ? <Text numberOfLines={2} style={styles.locationAddress}>{presentation.detail}</Text> : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: 12, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  mapFrame: { height: 180, width: '100%', backgroundColor: colors.control, position: 'relative' },
  mapImage: { width: '100%', height: '100%' },
  markerCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pinBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  controlsRow: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  controlButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.92)' },
  controlText: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  detailsCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.control },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 },
  locationName: { fontSize: 15, fontWeight: '800', color: colors.text },
  locationAddress: { fontSize: 12, color: colors.mutedText, marginTop: 2 },
  openButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.successSurface },
  openButtonText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: colors.modalScrim, alignItems: 'center', justifyContent: 'center', padding: 20 },
  expandedContainer: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { flex: 1, marginRight: 12, fontSize: 16, fontWeight: '800', color: colors.text },
  closeButton: { padding: 4 },
  expandedMap: { width: '100%', height: 280 },
  expandedDetails: { padding: 16 },
});
