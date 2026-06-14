import { Tabs } from "expo-router";
import { Compass, Home, Library, Settings } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import { palette, fonts } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: fonts.sans,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontWeight: "600",
        },
        tabBarStyle: {
          backgroundColor: palette.wall,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <Compass size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) => <Library size={20} color={color} strokeWidth={1.6} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings size={20} color={color} strokeWidth={1.6} />,
        }}
      />
    </Tabs>
  );
}
