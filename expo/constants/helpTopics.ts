import type { Href } from "expo-router";

export const HELP_TOPICS: { id: string; title: string; body: string; action: string; href: Href }[] = [
  { id: "today", title: "Today", body: "Choose your daily count. The next selection arrives at 4 a.m. and draws from sources you follow.", action: "Videos in Today", href: "/settings/today" },
  { id: "creators", title: "Sources", body: "Open Sources and add a channel link or @handle. Managed profiles can request a creator for the Owner to review.", action: "Open Sources", href: "/(tabs)/sources" },
  { id: "interests", title: "Discover", body: "Choose topics and prioritize up to three for the next edition. Your current suggestions stay available in Discover.", action: "Weekly interests", href: "/settings/interests" },
  { id: "saved", title: "Saved videos", body: "Open Videos in Saved. Continue watching shows where you left off. Use Search & filter to find a saved title or source, or Edit Saved to remove one.", action: "Saved videos", href: { pathname: "/(tabs)/saved", params: { section: "videos" } } },
  { id: "sessions", title: "Sessions", body: "In Saved, choose Sessions. Arrange saved videos and set a playback limit. Frame pauses when that time is up.", action: "Open Sessions", href: { pathname: "/(tabs)/saved", params: { section: "sessions" } } },
  { id: "requests", title: "Profile requests", body: "In Settings, choose the pending requests for that profile. The Owner can approve one video or all videos from a requested source.", action: "View Settings", href: "/(tabs)/settings" },
];
