import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';
import { inAppNotificationService } from '@/lib/services/InAppNotificationService';

type BannerData = {
  peerId: string;
  senderName: string;
  avatarUrl: string | null;
  messageText: string;
};

export default function InAppNotificationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useAppTheme();

  const [activeBanner, setActiveBanner] = useState<BannerData | null>(null);
  const slideAnim = useRef(new Animated.Value(-160)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -160,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveBanner(null);
    });
  }, [slideAnim, opacityAnim]);

  const showBanner = useCallback((banner: BannerData) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setActiveBanner(banner);
    slideAnim.setValue(-160);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    dismissTimerRef.current = setTimeout(() => {
      dismiss();
    }, 4500);
  }, [dismiss, slideAnim, opacityAnim]);

  useEffect(() => {
    const unsub = inAppNotificationService.subscribe((payload) => {
      const isInThisChat =
        pathname.includes(`/chat/${payload.peerId}`) ||
        pathname.includes(`/chat/${encodeURIComponent(payload.peerId)}`);
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
    if (activeBanner?.peerId) {
      router.push({ pathname: '/chat/[id]', params: { id: activeBanner.peerId } });
    }
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
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
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
                  <View style={styles.appIconCircle}>
                    <Ionicons name="chatbubble-ellipses" size={11} color="#ffffff" />
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
                  firstName={activeBanner.senderName || 'User'}
                  size={42}
                />

                <View style={styles.textContainer}>
                  <Text style={[styles.senderName, { color: colors.text }]} numberOfLines={1}>
                    {activeBanner.senderName || 'Ourlime User'}
                  </Text>
                  <Text style={[styles.messagePreview, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={2}>
                    {activeBanner.messageText}
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
