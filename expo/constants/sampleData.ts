import type { Channel, Video } from "@/types";

// These fallback entries use metadata verified against YouTube's public oEmbed
// response. Unknown dates and durations stay blank instead of being invented.
export const SAMPLE_CHANNELS: Channel[] = [
  {
    id: "UCsXVk37bltHxD1rDPwtNM8Q",
    title: "Kurzgesagt – In a Nutshell",
    description: "Animated science and big-picture ideas.",
    thumbnailUrl: "https://yt3.googleusercontent.com/ytc/AIdro_kJk5dQ6tA8r2X3qDgVUu0pVw=s240-c-k-c0x00ffffff-no-rj",
  },
  {
    id: "UCBJycsmduvYEL83R_U4JriQ",
    title: "Marques Brownlee",
    description: "Technology videos and reviews.",
    thumbnailUrl: "https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIEAQ9StK0qOST7fiA=s240-c-k-c0x00ffffff-no-rj",
  },
  {
    id: "UCsooa4yRKGN_zEE8iknghZA",
    title: "TED-Ed",
    description: "Animated lessons and ideas.",
    thumbnailUrl: "https://yt3.googleusercontent.com/Vy6KL7EM_apxPSxF0pPS6w_xR7VlfFLqHpRG7XQYZyAyk0vJl-h0pjKr3rGfgu5e0p7T-fQX=s240-c-k-c0x00ffffff-no-rj",
  },
];

export const SAMPLE_VIDEOS: Video[] = [
  {
    id: "LXb3EKWsInQ",
    title: "COSTA RICA IN 4K 60fps HDR (ULTRA HD)",
    channelId: "",
    channelTitle: "Jacob + Katie Schwarz",
    thumbnailUrl: "https://i.ytimg.com/vi/LXb3EKWsInQ/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "5MgBikgcWnY",
    title: "The first 20 hours -- how to learn anything | Josh Kaufman | TEDxCSU",
    channelId: "",
    channelTitle: "TEDx Talks",
    thumbnailUrl: "https://i.ytimg.com/vi/5MgBikgcWnY/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    channelId: "",
    channelTitle: "Rick Astley",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "jNQXAC9IVRw",
    title: "Me at the zoo",
    channelId: "",
    channelTitle: "jawed",
    thumbnailUrl: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "M7lc1UVf-VE",
    title: "YouTube Developers Live: Embedded Web Player Customization",
    channelId: "",
    channelTitle: "Google for Developers",
    thumbnailUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "aqz-KE-bpKQ",
    title: "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
    channelId: "",
    channelTitle: "Blender",
    thumbnailUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
  {
    id: "9bZkp7q19f0",
    title: "PSY - GANGNAM STYLE(강남스타일) M/V",
    channelId: "",
    channelTitle: "officialpsy",
    thumbnailUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    publishedAt: "",
    durationSeconds: 0,
  },
];

export const SAMPLE_TOPIC_VIDEOS: Record<string, string[]> = {
  tech: ["M7lc1UVf-VE"],
  science: [],
  design: ["M7lc1UVf-VE"],
  film: ["aqz-KE-bpKQ"],
  photography: ["LXb3EKWsInQ"],
  architecture: [],
  philosophy: ["5MgBikgcWnY"],
  art: ["aqz-KE-bpKQ"],
  nature: ["LXb3EKWsInQ"],
  music: ["dQw4w9WgXcQ", "9bZkp7q19f0"],
  history: ["jNQXAC9IVRw"],
  literature: [],
  essays: ["5MgBikgcWnY"],
  interviews: ["5MgBikgcWnY"],
  cooking: [],
  travel: ["LXb3EKWsInQ"],
  writing: ["5MgBikgcWnY"],
  craft: ["aqz-KE-bpKQ"],
};
