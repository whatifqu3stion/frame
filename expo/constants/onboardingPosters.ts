export const onboardingPosters = {
  owl: require("../assets/video-posters/owl-teal-print.webp"),
  brush: require("../assets/video-posters/fine-art-brush-padded.webp"),
  bust: require("../assets/video-posters/sculpture-greek-marble.webp"),
  shell: require("../assets/video-posters/science-nautilus.webp"),
  stamps: require("../assets/video-posters/music-stamps.webp"),
} as const;

export function posterForTopic(topic?: string) {
  switch (topic) {
    case "science": return onboardingPosters.shell;
    case "design":
    case "making": return onboardingPosters.brush;
    case "history": return onboardingPosters.bust;
    case "music":
    case "film": return onboardingPosters.stamps;
    default: return onboardingPosters.owl;
  }
}
