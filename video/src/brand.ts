// Values from expo/constants/theme.ts and README.md, kept local so this
// standalone render project does not load React Native into the browser.
export const brand = {
  wall: '#F3F0EA',
  darkWall: '#171513',
  ink: '#2C2825',
  inkSoft: '#625B54',
  mineralBlue: '#3B6073',
  paleBlue: '#8FB7CA',
  ivory: '#FAF4EA',
} as const;

export const video = {width: 1080, height: 1440, fps: 30, durationInFrames: 180};
