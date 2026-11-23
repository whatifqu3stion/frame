import Text from "@/components/FrameText";
import TabIconSurface from "@/components/motion/TabIconSurface";
import TvRailButton from "@/components/TvRailButton";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { LucideIcon } from "lucide-react-native";
import TabBarGlass from "@/components/TabBarGlass";
import PaperSurface from "@/components/PaperSurface";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { Platform, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Bookmark, CalendarDays, Settings, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

function tabOptions(title: string, Icon: LucideIcon): BottomTabNavigationOptions {
  const options = { title, tabBarAccessibilityLabel: title + " tab" };
  if (Platform.isTV) {
    return { ...options, tabBarButton: props => <TvRailButton {...props} title={title} icon={Icon} /> };
  }
  return { ...options, tabBarIcon: ({ color, focused }) => <TabIconSurface focused={focused}><Icon size={22} color={color} strokeWidth={2} /></TabIconSurface> };
}

export default function TabLayout() {
  const { palette, isDark } = useFrameTheme();
  const insets = useSafeAreaInsets();
  const { sidebar, fontScale, bottomInset, bottomBarHeight } = useNavigationLayout();

  const railWidth = (Platform.isTV ? 168 : 208) * Math.max(1, fontScale);
  const railRowHeight = (Platform.isTV ? 54 : 64) * fontScale;

  return (
    <Tabs
      initialRouteName="index"
      screenLayout={Platform.isTV ? undefined : ({ children }) => <PaperSurface>{children}</PaperSurface>}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: sidebar ? palette.active : isDark ? palette.accentSoft : palette.accentDeep,
        tabBarActiveBackgroundColor: sidebar ? palette.activeSoft : "transparent",
        tabBarInactiveTintColor: sidebar ? palette.inkMuted : palette.inkSoft,
        tabBarShowLabel: true,
        tabBarPosition: sidebar ? "left" : "bottom",
        tabBarLabelPosition: sidebar ? "beside-icon" : "below-icon",
        tabBarLabel: ({ color, children }) => <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, lineHeight: 16, color: sidebar ? color : palette.ink, textAlign: sidebar ? "left" : "center", marginStart: sidebar ? 12 : 0, flexShrink: 1 }}>{children}</Text>,
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, minHeight: sidebar ? railRowHeight : 48 },
        tabBarBackground: sidebar ? undefined : () => <TabBarGlass />,
        tabBarStyle: {
          backgroundColor: sidebar ? palette.surfaceHigh : "transparent",
          ...(Platform.isTV && sidebar ? { borderRadius: 8 } : {}),
          borderTopWidth: 0,
          borderRightWidth: sidebar ? StyleSheet.hairlineWidth : 0,
          borderRightColor: palette.border,
          borderTopColor: palette.border,
          elevation: 0,
          ...(sidebar ? { width: railWidth, minWidth: railWidth, paddingTop: insets.top + 16 } : { position: "absolute", height: bottomBarHeight, paddingTop: 8 }),
          paddingBottom: sidebar ? insets.bottom : bottomInset,
        },
      }}
    >
      <Tabs.Screen name="index" options={tabOptions("Today", CalendarDays)} />
      <Tabs.Screen name="sources" options={tabOptions("Sources", Users)} />
      <Tabs.Screen name="saved" options={tabOptions("Saved", Bookmark)} />
      <Tabs.Screen name="settings" options={tabOptions("Settings", Settings)} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}

