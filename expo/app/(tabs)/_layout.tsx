import TabIconSurface from "@/components/motion/TabIconSurface";
import { expandedNavigationWidth } from "@/constants/layout";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Bookmark, CalendarDays, Settings, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function TabLayout() {
  const { palette } = useFrameTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const sidebar = width >= expandedNavigationWidth + 208 * Math.max(0, fontScale - 1);
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarShowLabel: true,
        tabBarPosition: sidebar ? "left" : "bottom",
        tabBarLabelPosition: sidebar ? "beside-icon" : "below-icon",
        tabBarLabel: ({ color, children }) => <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, lineHeight: 16, color, textAlign: sidebar ? "left" : "center", marginStart: sidebar ? 12 : 0, flexShrink: 1 }}>{children}</Text>,
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, minHeight: sidebar ? 64 * fontScale : 48 },
        tabBarStyle: {
          backgroundColor: palette.surfaceHigh,
          borderTopWidth: sidebar ? 0 : StyleSheet.hairlineWidth,
          borderRightWidth: sidebar ? StyleSheet.hairlineWidth : 0,
          borderRightColor: palette.border,
          borderTopColor: palette.border,
          elevation: 0,
          ...(sidebar ? { width: 208 * Math.max(1, fontScale), paddingTop: insets.top + 16 } : { height: 64 + Math.max(0, fontScale - 1) * 48 + bottomInset, paddingTop: 8 }),
          paddingBottom: sidebar ? insets.bottom : bottomInset,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarAccessibilityLabel: "Today tab", tabBarIcon: ({ color, focused }) => <TabIconSurface focused={focused}><CalendarDays size={22} color={color} strokeWidth={2} /></TabIconSurface> }} />
      <Tabs.Screen name="sources" options={{ title: "Sources", tabBarAccessibilityLabel: "Sources tab", tabBarIcon: ({ color, focused }) => <TabIconSurface focused={focused}><Users size={22} color={color} strokeWidth={2} /></TabIconSurface> }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarAccessibilityLabel: "Saved tab", tabBarIcon: ({ color, focused }) => <TabIconSurface focused={focused}><Bookmark size={22} color={color} strokeWidth={2} /></TabIconSurface> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarAccessibilityLabel: "Settings tab", tabBarIcon: ({ color, focused }) => <TabIconSurface focused={focused}><Settings size={22} color={color} strokeWidth={2} /></TabIconSurface> }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}

