export const SETTINGS_TITLES = {
  today: "Viewing preferences",
  interests: "Weekly interests",
  appearance: "Appearance",
  google: "Subscription import",
  privacy: "Privacy & device data",
  about: "Help & about",
  keys: "YouTube & Gemini",
} as const;

export type SettingsSection = keyof typeof SETTINGS_TITLES;

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SETTINGS_TITLES, value));
}
