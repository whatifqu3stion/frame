import TabIconSurface from "@/components/motion/TabIconSurface";
import { StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Bookmark, CalendarDays, Settings, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function TabLayout() {
  const { palette } = useFrameTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontFamily: fonts.sansSemibold, fontSize: 12 },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, minHeight: 48 },
        tabBarStyle: {
          backgroundColor: palette.surfaceHigh,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.border,
          elevation: 0,
          height: 64 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
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

