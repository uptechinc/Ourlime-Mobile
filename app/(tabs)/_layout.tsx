import { useState, useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Platform } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthService } from '@/lib/services/AuthService';
import { ConversationResourceService } from '@/lib/services/ConversationResourceService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const authService = AuthService.getInstance();
const conversationResourceService = ConversationResourceService.getInstance();

const TabLayout = () => {
  const [isDeveloper, setIsDeveloper] = useState(false);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);
  const tabBarHeight = 56 + bottomInset;

  const conversations = useResourceStore((state) => state.conversations.data);
  const unreadChatCount = (conversations ?? []).reduce((sum, item) => sum + (item.unreadCount || 0), 0);

  useEffect(() => {
    const unsub = authService.subscribeToVerifiedAuthState((user) => {
      if (!user) {
        setIsDeveloper(false);
        conversationResourceService.stopRealtime();
        return;
      }
      conversationResourceService.startRealtime(user.uid);
      void conversationResourceService.hydrate(user.uid).then(() => conversationResourceService.refresh(user.uid));
      void authService.getUserProfile(user.uid).then((profile) => {
        const role = profile?.accountType?.toLowerCase() ?? '';
        setIsDeveloper(role === 'developer' || role === 'dev' || profile?.isDeveloper === true);
      }).catch(() => setIsDeveloper(false));
    });
    return () => unsub();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          backgroundColor: colors.navigation,
          borderTopWidth: 1,
          borderTopColor: colors.navigationBorder,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feeds",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={focused ? 23 : 21}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "compass" : "compass-outline"}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Limes"
        options={{
          title: "Limes",
          href: isDeveloper ? undefined : null,
          tabBarStyle: {
            backgroundColor: colors.navigation,
            borderTopWidth: 1,
            borderTopColor: colors.navigationBorder,
            height: tabBarHeight,
            paddingBottom: bottomInset,
            paddingTop: 6,
            elevation: 10,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.mutedText,
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/logo.png')}
              style={{
                width: focused ? 30 : 26,
                height: focused ? 30 : 26,
                resizeMode: 'contain',
              }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Chat"
        options={{
          title: "Chat",
          tabBarBadge: unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.onAccent,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />

      {/* Hide Search from bottom tabs layout, accessible via router */}
      <Tabs.Screen
        name="Search"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
