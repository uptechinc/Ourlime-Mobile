import type { ReactNode } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { LimeVisualPlaceholder } from '@/components/limes/LimeVisualPlaceholder';

/** Placeholder bars on the dark Lime canvas. */
const BAR_COLOR = 'rgba(255, 255, 255, 0.22)';
const ACCENT_BAR_COLOR = 'rgba(16, 185, 129, 0.55)';

type LimesFeedSkeletonProps = {
  /**
   * 'feed'         — Limes tab: For You | Following toggle, Discover button, green Create button.
   * 'sharedViewer' — Limes tab opened from a chat share: back button, "Limes / Swipe for more" title.
   * 'profile'      — /profile/limes: back button and sound toggle.
   * 'none'         — no top bar (the real one is already drawn above, e.g. the empty-feed slot).
   */
  header?: 'feed' | 'sharedViewer' | 'profile' | 'none';
  /** Page height; required inside a list (ListEmptyComponent), where flex: 1 collapses. */
  height?: number;
  /** Lets the back button work while the page loads. */
  onBackPress?: () => void;
};

function Bar({ width, height, color = BAR_COLOR, radius }: { width: number | `${number}%`; height: number; color?: string; radius?: number }): ReactNode {
  return <Skeleton width={width} height={height} borderRadius={radius ?? Math.min(6, height / 2)} style={{ backgroundColor: color }} />;
}

function BackButton({ size, onBackPress }: { size: number; onBackPress?: () => void }): ReactNode {
  const buttonStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: size === 42 ? 'rgba(0,0,0,0.42)' : 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: size === 42 ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.15)',
  };
  if (!onBackPress) return <View style={buttonStyle} />;
  return (
    <TouchableOpacity onPress={onBackPress} style={buttonStyle} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Go back">
      <ChevronLeft size={size === 42 ? 25 : 24} color="#ffffff" />
    </TouchableOpacity>
  );
}

/** One right-rail action: icon (sized like the real one) with an optional count under it. */
function RailAction({ iconSize, withCount }: { iconSize: number; withCount: boolean }): ReactNode {
  return (
    <View style={styles.railAction}>
      <SkeletonCircle size={iconSize} style={{ backgroundColor: BAR_COLOR }} />
      {withCount ? (
        <View style={styles.railCount}>
          <Bar width={18} height={10} />
        </View>
      ) : null}
    </View>
  );
}

/** Full-screen vertical Lime while the feed loads: same top bar, right action rail, creator row, caption and sound row as ReelItem. */
export function LimesFeedSkeleton({ header = 'feed', height, onBackPress }: LimesFeedSkeletonProps): ReactNode {
  return (
    <View style={[styles.container, height ? { height, flex: undefined } : null]} accessibilityLabel="Loading Limes">
      {/* Branded base the real reel shows until its poster/video arrives */}
      <LimeVisualPlaceholder isLoading={false} />

      {header === 'feed' ? (
        <SafeAreaView style={styles.topHeader} edges={['top', 'left', 'right']}>
          <View style={styles.tabToggleRow}>
            {/* For You (active: 16pt + 3px indicator) */}
            <View style={styles.tabBtn}>
              <View style={styles.tabTextBox}><Bar width={58} height={14} /></View>
              <View style={styles.activeTabIndicator} />
            </View>
            <View style={styles.tabDivider} />
            <View style={styles.tabBtn}>
              <View style={styles.tabTextBox}><Bar width={74} height={14} /></View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Discover: 8 padding + 18 icon + 1 border */}
            <View style={styles.iconHeaderBtn}>
              <Bar width={18} height={18} radius={9} />
            </View>
            {/* Create: green pill, + icon and 13pt label */}
            <Skeleton width={93} height={33} borderRadius={20} style={{ backgroundColor: ACCENT_BAR_COLOR }} />
          </View>
        </SafeAreaView>
      ) : null}

      {header === 'sharedViewer' ? (
        <SafeAreaView style={styles.topHeader} edges={['top', 'left', 'right']}>
          <BackButton size={42} onBackPress={onBackPress} />
          <View style={{ alignItems: 'center' }}>
            <View style={{ height: 21, justifyContent: 'center' }}><Bar width={48} height={15} /></View>
            <View style={{ height: 14, justifyContent: 'center', marginTop: 1 }}><Bar width={78} height={9} /></View>
          </View>
          <View style={{ width: 42, height: 42 }} />
        </SafeAreaView>
      ) : null}

      {header === 'profile' ? (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.profileTopBar} pointerEvents="box-none">
          <BackButton size={40} onBackPress={onBackPress} />
          <View style={styles.soundButton} />
        </SafeAreaView>
      ) : null}

      {/* Right action rail: mute, fullscreen, like, comment, repost, share, more */}
      <View style={styles.rightSidebar}>
        <RailAction iconSize={26} withCount={false} />
        <RailAction iconSize={24} withCount={false} />
        <RailAction iconSize={28} withCount />
        <RailAction iconSize={28} withCount />
        <RailAction iconSize={27} withCount />
        <RailAction iconSize={26} withCount />
        <RailAction iconSize={24} withCount={false} />
      </View>

      {/* Bottom overlay: creator row, two-line caption, original sound row */}
      <View style={styles.bottomOverlay}>
        <View style={styles.creatorRow}>
          <SkeletonCircle size={40} style={{ backgroundColor: BAR_COLOR }} />
          <View>
            <View style={{ height: 17, justifyContent: 'center' }}><Bar width={110} height={12} /></View>
            <View style={{ height: 15, justifyContent: 'center' }}><Bar width={78} height={10} /></View>
          </View>
          {/* Follow: min height 36, radius 16 */}
          <Skeleton width={64} height={36} borderRadius={16} style={{ marginLeft: 2, backgroundColor: ACCENT_BAR_COLOR }} />
        </View>
        <View style={styles.captionBlock}>
          <View style={styles.captionLine}><Bar width="94%" height={11} /></View>
          <View style={styles.captionLine}><Bar width="62%" height={11} /></View>
        </View>
        <View style={styles.soundRow}>
          <Bar width={14} height={14} radius={7} color={ACCENT_BAR_COLOR} />
          <View style={{ height: 15, justifyContent: 'center' }}><Bar width={170} height={10} /></View>
        </View>
      </View>

      {/* Seek bar track at the very bottom */}
      <View style={styles.seekTrack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tabBtn: {
    paddingVertical: 4,
  },
  tabTextBox: {
    height: 20,
    justifyContent: 'center',
  },
  activeTabIndicator: {
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 2,
    marginTop: 4,
  },
  tabDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  iconHeaderBtn: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    zIndex: 50,
  },
  soundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  rightSidebar: {
    position: 'absolute',
    right: 12,
    bottom: 40,
    alignItems: 'center',
    gap: 14,
    zIndex: 99,
  },
  railAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  railCount: {
    height: 16,
    marginTop: 4,
    justifyContent: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 54,
    right: 80,
    zIndex: 20,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  captionBlock: {
    marginBottom: 8,
  },
  captionLine: {
    height: 18,
    justifyContent: 'center',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seekTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: '#ffffff55',
  },
});
