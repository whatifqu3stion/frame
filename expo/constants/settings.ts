export const SETTINGS_TITLES = {
  today: "Max videos in Today",
  interests: "Weekly interests",
  topics: "Choose topics",
  brief: "Discovery brief",
  priorities: "Priority topics",
  channels: "Transfer profile",
  appearance: "Appearance",
  google: "Previous Google connection",
  privacy: "Privacy & device data",
  about: "Help & about",
  keys: "YouTube & Gemini",
} as const;

export type SettingsSection = keyof typeof SETTINGS_TITLES;

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SETTINGS_TITLES, value));
}
