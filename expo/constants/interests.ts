import type { InterestTopic } from "@/types";

export const INTEREST_LIBRARY: readonly InterestTopic[] = [
  { id: "tech", name: "Technology", emoji: "◆" },
  { id: "science", name: "Science & Nature", emoji: "◇" },
  { id: "history", name: "History & Society", emoji: "✦" },
  { id: "learning", name: "Ideas & Learning", emoji: "◫" },
  { id: "business", name: "Business & Money", emoji: "▰" },
  { id: "health", name: "Health & Fitness", emoji: "●" },
  { id: "design", name: "Arts & Design", emoji: "◯" },
  { id: "film", name: "Film & Culture", emoji: "▣" },
  { id: "music", name: "Music", emoji: "♪" },
  { id: "cooking", name: "Food & Cooking", emoji: "▲" },
  { id: "travel", name: "Travel & Adventure", emoji: "◐" },
  { id: "making", name: "Home, DIY & Making", emoji: "◑" },
  { id: "gaming", name: "Gaming", emoji: "◈" },
  { id: "sports", name: "Sports", emoji: "◎" },
  { id: "life", name: "Life & Relationships", emoji: "❦" },
];

export const INTEREST_GROUPS = [
  { label: "Ideas & discovery", ids: ["tech", "science", "history", "learning", "business"] },
  { label: "Arts & culture", ids: ["design", "film", "music", "gaming"] },
  { label: "Everyday & beyond", ids: ["health", "cooking", "travel", "making", "sports", "life"] },
] as const;
