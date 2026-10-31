export const SETTINGS_TITLES = {
  today: "Today’s selection",
  interests: "Interests",
  appearance: "Appearance & feedback",
  google: "Google connection",
  privacy: "Privacy & data",
  about: "About & help",
  keys: "Your API keys",
} as const;

export type SettingsSection = keyof typeof SETTINGS_TITLES;

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SETTINGS_TITLES, value));
}
