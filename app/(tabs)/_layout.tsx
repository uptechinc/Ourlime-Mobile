import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Platform } from "react-native";

const TabLayout = () => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#10B981",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
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
          title: "Feed",
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
