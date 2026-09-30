export const SETTINGS_TITLES = {
  interests: "Interests",
  appearance: "Appearance & feedback",
  google: "Google connection",
  privacy: "Privacy & data",
  about: "About & help",
  premium: "Premium",
} as const;

export type SettingsSection = keyof typeof SETTINGS_TITLES;

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SETTINGS_TITLES, value));
}
