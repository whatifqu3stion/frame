import { Tabs } from "expo-router";
import { Compass, Home, Library, Settings } from "lucide-react-native";
import { Platform } from "react-native";
import { fonts } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function TabLayout() {
  const { palette } = useFrameTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontFamily: fonts.sansSemibold, fontSize: 10, letterSpacing: 1.15, textTransform: "uppercase" },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3 },
        tabBarStyle: { backgroundColor: palette.surfaceHigh, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.borderSoft, elevation: 0, height: Platform.OS === "ios" ? 86 : 68, paddingTop: 9 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color }) => <Compass size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: ({ color }) => <Library size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <Settings size={20} color={color} strokeWidth={1.7} /> }} />
    </Tabs>
  );
}

import { StyleSheet } from "react-native";
