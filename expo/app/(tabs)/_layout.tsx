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
          borderTopWidth: 1,
          borderTopColor: palette.borderSoft,
          elevation: 0,
          height: 58 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarAccessibilityLabel: "Today tab", tabBarIcon: ({ color }) => <CalendarDays size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="sources" options={{ title: "Sources", tabBarAccessibilityLabel: "Sources tab", tabBarIcon: ({ color }) => <Users size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarAccessibilityLabel: "Saved tab", tabBarIcon: ({ color }) => <Bookmark size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarAccessibilityLabel: "Settings tab", tabBarIcon: ({ color }) => <Settings size={20} color={color} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}

