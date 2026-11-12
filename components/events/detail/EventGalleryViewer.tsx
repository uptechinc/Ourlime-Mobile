import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EventGalleryViewerProps = { images: string[]; index: number | null; onChange: (index: number) => void; onClose: () => void };

/** Full-screen event gallery with previous / next and a counter (the website's gallery modal). */
export default function EventGalleryViewer({ images, index, onChange, onClose }: EventGalleryViewerProps) {
  const styles = useMemo(() => createStyles(), []);
  const current = index === null ? null : images[index];
  return (
    <Modal visible={current !== null && current !== undefined} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.counter}>{index === null ? '' : `${index + 1} / ${images.length}`}</Text>
          <TouchableOpacity accessibilityLabel="Close gallery" hitSlop={10} onPress={onClose}><X size={26} color="#ffffff" /></TouchableOpacity>
        </View>
        <View style={styles.stage}>
          {current ? <Image source={{ uri: current }} contentFit="contain" style={styles.image} /> : null}
          {index !== null && images.length > 1 ? (
            <>
              <TouchableOpacity accessibilityLabel="Previous image" onPress={() => onChange((index - 1 + images.length) % images.length)} style={[styles.nav, styles.navLeft]}><ChevronLeft size={28} color="#ffffff" /></TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Next image" onPress={() => onChange((index + 1) % images.length)} style={[styles.nav, styles.navRight]}><ChevronRight size={28} color="#ffffff" /></TouchableOpacity>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  counter: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  stage: { flex: 1, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  nav: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  navLeft: { left: 12 },
  navRight: { right: 12 },
});
