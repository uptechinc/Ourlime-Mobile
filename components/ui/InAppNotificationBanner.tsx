import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';
import { inAppNotificationService, type InAppNotificationPayload } from '@/lib/services/InAppNotificationService';
import { notificationDestinationRegistry } from '@/lib/navigation/NotificationDestinationRegistry';

type BannerData = InAppNotificationPayload;

const MAX_QUEUED_BANNERS = 4;

/** Draft reminders carry a longer message and an action, so they stay up longer (same as the website). */
function displayDurationMs(banner: BannerData): number {
  if (banner.tone === 'danger') return 12_000;
  if (banner.tone === 'warning' || banner.destination.type === 'draft_reminder') return 8_000;
  return 4_500;
}

export default function InAppNotificationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useAppTheme();

  const [activeBanner, setActiveBanner] = useState<BannerData | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Banners that arrive while one is showing wait their turn instead of replacing it (a draft reminder used to be
  // wiped by a message banner arriving at the same moment).
  const queueRef = useRef<BannerData[]>([]);
  const isShowingRef = useRef(false);
  const presentRef = useRef<(banner: BannerData) => void>(() => undefined);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    isShowingRef.current = false;
    const next = queueRef.current.shift();
    if (next) presentRef.current(next);
    else setActiveBanner(null);
  }, []);

  const present = useCallback((banner: BannerData) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    isShowingRef.current = true;
    setActiveBanner(banner);
    dismissTimerRef.current = setTimeout(() => {
      dismiss();
    }, displayDurationMs(banner));
  }, [dismiss]);

  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const showBanner = useCallback((banner: BannerData) => {
    if (!isShowingRef.current) {
      present(banner);
      return;
    }
    queueRef.current = [...queueRef.current.filter((queued) => queued.id !== banner.id), banner].slice(-MAX_QUEUED_BANNERS);
  }, [present]);

  useEffect(() => {
    const unsub = inAppNotificationService.subscribe((payload) => {
      // A message from the chat that is already open needs no banner.
      const isInThisChat = Boolean(payload.peerId) && (
        pathname.includes(`/chat/${payload.peerId}`) ||
        pathname.includes(`/chat/${encodeURIComponent(payload.peerId ?? '')}`)
      );
      if (!isInThisChat) {
        showBanner(payload);
      }
    });
    return () => unsub();
  }, [pathname, showBanner]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -8,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -15) {
          dismiss();
        }
      },
    })
  ).current;

  if (!activeBanner) return null;

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 12 : 24);
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';

  const handlePress = () => {
    dismiss();
    if (activeBanner) router.push(notificationDestinationRegistry.resolve(activeBanner.destination).route);
  };

  if (!activeBanner) {
    return null;
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={dismiss}
    >
      <View
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      >
        <View
          pointerEvents="box-none"
          style={[
            styles.rootContainer,
            {
              top: topInset + 6,
            },
          ]}
        >
          {/* Reanimated entering animation: the old Animated slide/fade never reached the view in this app, so every
              banner stayed transparent above the screen. Keyed by banner so each one slides in. */}
          <Animated.View
            key={activeBanner.id}
            entering={FadeInDown.springify().damping(16)}
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                backgroundColor: activeBanner.tone === 'danger' ? (isDark ? '#3b0d12' : '#fef2f2') : activeBanner.tone === 'warning' ? (isDark ? '#3a2a07' : '#fffbeb') : cardBg,
                borderColor: activeBanner.tone === 'danger' ? '#ef4444' : activeBanner.tone === 'warning' ? '#f59e0b' : cardBorder,
              },
            ]}
          >
            <Pressable
              onPress={handlePress}
              style={({ pressed }) => [
                styles.pressableContent,
                {
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {/* Top meta row: App tag & time */}
              <View style={styles.topMetaRow}>
                <View style={styles.appTag}>
                  <View style={[styles.appIconCircle, activeBanner.tone === 'danger' ? { backgroundColor: '#ef4444' } : activeBanner.tone === 'warning' ? { backgroundColor: '#f59e0b' } : null]}>
                    <Ionicons name={activeBanner.kind === 'message' ? 'chatbubble-ellipses' : activeBanner.destination.type === 'draft_reminder' ? 'document-text' : 'notifications'} size={11} color="#ffffff" />
                  </View>
                  <Text style={styles.appNameText}>Ourlime</Text>
                </View>
                <View style={styles.rightMeta}>
                  <Text style={[styles.timeText, { color: colors.mutedText }]}>now</Text>
                  <Pressable onPress={dismiss} hitSlop={12} style={styles.closeBtn}>
                    <Ionicons name="close" size={16} color={colors.mutedText} />
                  </Pressable>
                </View>
              </View>

              {/* Message Row */}
              <View style={styles.messageRow}>
                <UserAvatar
                  profileImage={activeBanner.avatarUrl}
                  firstName={activeBanner.title || 'Ourlime'}
                  size={42}
                />

                <View style={styles.textContainer}>
                  <Text style={[styles.senderName, { color: activeBanner.tone === 'danger' ? '#ef4444' : colors.text }]} numberOfLines={1}>
                    {activeBanner.title || 'Ourlime'}
                  </Text>
                  <Text style={[styles.messagePreview, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={activeBanner.destination.type === 'draft_reminder' ? 6 : 2}>
                    {activeBanner.body}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 25,
    overflow: 'hidden',
  },
  pressableContent: {
    width: '100%',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '800',
  },
  messagePreview: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
