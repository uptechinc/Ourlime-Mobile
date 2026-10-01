import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gift, Package, Sun, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type Promotion = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  colors: readonly [string, string];
};

type PromotionSliderProps = {
  onSelect?: (promotionId: string) => void;
};

const PROMOTIONS: readonly Promotion[] = Object.freeze([
  { id: 'summer', name: 'Summer Collection', description: 'Discover our latest summer essentials', icon: Sun, colors: ['#ff6b6b', '#ff8e53'] },
  { id: 'best-sellers', name: 'Best Sellers', description: 'Shop trending items everyone loves', icon: TrendingUp, colors: ['#a855f7', '#ec4899'] },
  { id: 'new-arrivals', name: 'New Arrivals', description: 'Fresh picks and latest additions', icon: Package, colors: ['#3b82f6', '#06b6d4'] },
  { id: 'offers', name: 'Special Offers', description: 'Limited time deals and discounts', icon: Gift, colors: ['#10b981', '#34d399'] },
]);

export default function PromotionSlider({ onSelect }: PromotionSliderProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardWidth = Math.min(Math.max(width - 52, 260), 420);

  return (
    <View accessibilityLabel="Marketplace promotions" style={styles.container}>
      <ScrollView
        horizontal
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 12}
        contentContainerStyle={styles.track}
      >
        {PROMOTIONS.map((promotion) => {
          const Icon = promotion.icon;
          return (
            <Pressable
              key={promotion.id}
              accessibilityRole="button"
              accessibilityLabel={`${promotion.name}. ${promotion.description}`}
              onPress={() => onSelect?.(promotion.id)}
              style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}
            >
              <LinearGradient colors={[...promotion.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
                <View style={styles.iconSurface}><Icon color="#ffffff" size={20} /></View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{promotion.name}</Text>
                  <Text numberOfLines={1} style={styles.description}>{promotion.description}</Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { marginHorizontal: -14 },
  track: { paddingHorizontal: 14, gap: 12 },
  card: { height: 132, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  gradient: { flex: 1, padding: 16, justifyContent: 'space-between' },
  iconSurface: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  copy: { gap: 3 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  description: { color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '600' },
});
