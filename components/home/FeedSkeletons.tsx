import { Image, Platform, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBox, SkeletonCircle } from '@/components/ui/Skeleton';
import { SkeletonPostCard, SkeletonTextLine } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Mirrors the Home tab AppHeader (logo + wordmark, 34 avatar, bell and menu buttons). */
export function SkeletonHomeAppHeader() {
  const { isDark } = useAppTheme();
  // Same literal colours AppHeader uses so the bar does not shift when the real header mounts.
  const surfaceColor = isDark ? '#0f172a' : '#ffffff';
  const controlColor = isDark ? '#1e293b' : '#f8f9fa';
  const contentColor = isDark ? '#f8fafc' : '#333333';
  const borderColor = isDark ? '#334155' : '#e5e5e5';

  return (
    <SafeAreaView style={{ backgroundColor: surfaceColor }} edges={['top', 'left', 'right']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: surfaceColor,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 3,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Image source={require('@/assets/images/logo.png')} style={{ height: 32, width: 32, resizeMode: 'contain' }} />
          <Image source={require('@/assets/images/logo-long.png')} style={{ height: 32, width: 120, resizeMode: 'contain' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SkeletonCircle size={34} />
          <View style={{ padding: 8, borderRadius: 8, backgroundColor: controlColor }}>
            <Ionicons name="notifications-outline" size={22} color={contentColor} />
          </View>
          <View style={{ padding: 8, borderRadius: 8, backgroundColor: controlColor }}>
            <Ionicons name="menu" size={24} color={contentColor} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Mirrors the feed's create-post card: 52 avatar, prompt pill, Gallery / Feeling quick actions. */
export function SkeletonCreatePostCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 18,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonCircle size={52} style={{ marginRight: 14 }} />
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 9999,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.surface,
          }}
        >
          <SkeletonTextLine fontSize={14} lineHeight={19} width="72%" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14, paddingLeft: 4 }}>
        {[50, 54].map((labelWidth) => (
          <View key={labelWidth} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SkeletonBox width={18} height={18} borderRadius={5} />
            <SkeletonTextLine fontSize={14} lineHeight={19} width={labelWidth} />
          </View>
        ))}
      </View>
    </View>
  );
}

const FILTER_CHIP_LABEL_WIDTHS = [20, 46, 44, 42, 72] as const;

/** Mirrors FeedsFilterSection: Home / Friends / Communities toggle, "Filters" label, content-type chips. */
export function SkeletonFeedFilters() {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.control, borderRadius: 14, padding: 3, marginBottom: 14 }}>
        {[46, 52, 92].map((labelWidth) => (
          <View
            key={labelWidth}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 5 }}
          >
            <SkeletonBox width={14} height={14} borderRadius={4} />
            <SkeletonTextLine fontSize={13} lineHeight={17} width={labelWidth} />
          </View>
        ))}
      </View>
      <SkeletonTextLine fontSize={15} lineHeight={20} width={50} style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', overflow: 'hidden' }}>
        {FILTER_CHIP_LABEL_WIDTHS.map((labelWidth) => (
          <View
            key={labelWidth}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginRight: 10,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <SkeletonBox width={16} height={16} borderRadius={4} />
            <SkeletonTextLine fontSize={14} lineHeight={19} width={labelWidth} style={{ marginLeft: 7 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** The scrolling feed content as MiddleSection lays it out (paddingTop 16, cards inset 12). */
export function SkeletonFeedList() {
  return (
    <View style={{ paddingTop: 16 }}>
      <SkeletonCreatePostCard />
      <SkeletonFeedFilters />
      <View style={{ paddingHorizontal: 12 }}>
        <SkeletonPostCard />
        <SkeletonPostCard />
      </View>
    </View>
  );
}

/**
 * Full Home-tab page skeleton: app header, then the feed. Renders its own safe-area top inset
 * and canvas background, so it should be mounted edge-to-edge (no padding wrapper).
 */
export function FeedPageSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SkeletonHomeAppHeader />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <SkeletonFeedList />
      </View>
    </View>
  );
}

type HomeTabBarItem = { label: string; icon: 'grid' | 'compass-outline' | 'logo' | 'chatbubbles-outline' | 'person-outline' };

/** The (tabs) bar items in order; Feeds is the focused tab on launch. */
const HOME_TAB_BAR_ITEMS: readonly HomeTabBarItem[] = [
  { label: 'Feeds', icon: 'grid' },
  { label: 'Discover', icon: 'compass-outline' },
  { label: 'Limes', icon: 'logo' },
  { label: 'Chat', icon: 'chatbubbles-outline' },
  { label: 'Profile', icon: 'person-outline' },
];

/**
 * Mirrors the (tabs) bottom bar with Feeds focused: 56 px + bottom inset, navigation colours,
 * PlayfulTabIcon pill (46 × 34, focused tint, lift and scale) and 11 px labels.
 */
export function SkeletonHomeTabBar() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);
  return (
    <View
      style={{
        flexDirection: 'row',
        height: 56 + bottomInset,
        paddingTop: 6,
        paddingBottom: bottomInset,
        backgroundColor: colors.navigation,
        borderTopWidth: 1,
        borderTopColor: colors.navigationBorder,
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      }}
    >
      {HOME_TAB_BAR_ITEMS.map((tabItem, tabIndex) => {
        const isFocused = tabIndex === 0;
        const tintColor = isFocused ? colors.accent : colors.mutedText;
        return (
          <View key={tabItem.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 46,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isFocused ? 'rgba(16,185,129,0.14)' : 'transparent',
                transform: isFocused ? [{ translateY: -2 }, { scale: 1.1 }] : [],
              }}
            >
              {tabItem.icon === 'logo'
                ? <Image source={require('@/assets/images/logo.png')} style={{ width: 26, height: 26, resizeMode: 'contain' }} />
                : <Ionicons name={tabItem.icon} size={isFocused ? 23 : 22} color={tintColor} />}
            </View>
            <Text style={{ marginTop: 2, fontSize: 11, fontWeight: '600', color: tintColor }}>{tabItem.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Launch placeholder for a signed-in user on their way to the Home tab: the full Home page
 * skeleton above the bottom tab bar, so nothing moves when (tabs) mounts.
 */
export function HomeStartupSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <FeedPageSkeleton />
      <SkeletonHomeTabBar />
    </View>
  );
}
