import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Platform } from "react-native";
import { BlurView } from "expo-blur";

const TabLayout = () => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#10B981",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 75,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          // backgroundColor: "#FFFFFF",
          // borderTopWidth: 1,
          // borderTopColor: "#E5E5EA",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={0}
            tint="dark"
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              // shadowColor: "#000",
              // shadowOffset: {
              //   width: 0,
              //   height: 8,
              // },
              // shadowOpacity: 0.3,
              // shadowRadius: 20,
              // elevation: 15,
            }}
          />
        ),
        tabBarItemStyle: {
          paddingVertical: 2,
          borderRadius: 20,
          marginHorizontal: 4,
          marginVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 6,
          color: "#FFFFFF",
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={focused ? "#10B981" : "#8E8E93"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={size}
              color={focused ? "#10B981" : "#8E8E93"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="Limes"
        options={{
          title: "Limes",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={size}
              color={focused ? "#10B981" : "#8E8E93"}
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
              size={size}
              color={focused ? "#10B981" : "#8E8E93"}
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
              size={size}
              color={focused ? "#10B981" : "#8E8E93"}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
