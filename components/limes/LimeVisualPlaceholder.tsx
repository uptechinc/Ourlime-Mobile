import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Film } from 'lucide-react-native';

type LimeVisualPlaceholderProps = {
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function LimeVisualPlaceholder({ isLoading = false, style }: LimeVisualPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Decorative ambient background accents */}
      <View style={styles.ambientTopGlow} pointerEvents="none" />
      <View style={styles.ambientBottomGlow} pointerEvents="none" />

      {/* Branded Center Badge */}
      <View style={styles.centerBadge}>
        <View style={styles.iconCircle}>
          <Text style={styles.emoji}>🍋</Text>
        </View>
        <View style={styles.brandRow}>
          <Film size={13} color="#10b981" />
          <Text style={styles.brandText}>Ourlime</Text>
        </View>
      </View>

      {/* Optional Loading Feedback Overlay */}
      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#10b981" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#07170e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ambientTopGlow: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  ambientBottomGlow: {
    position: 'absolute',
    bottom: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
  },
  centerBadge: {
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 78, 59, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    color: 'rgba(16, 185, 129, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
