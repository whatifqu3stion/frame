import type { FollowedChannel, Video } from "../types";

// Fictional editorial data for visual evaluation. These are not YouTube identities.
const collection = [
  ["Fieldwork", "Nature, observation, and the quiet work of understanding our planet.", "photo-1441974231531-c6227db76b6e", ["What a forest remembers", "Learning to read the landscape", "A year beside the river"]],
  ["The Making Room", "Materials, patient hands, and the people who make things well.", "photo-1455390582262-044cdead277a", ["The beauty of making something slowly", "Inside a bookbinder’s workshop", "Why we still make things by hand"]],
  ["Open House", "Architecture and the small decisions that shape how we live.", "photo-1600210492486-724fe5c67fb0", ["A home designed around the light", "Small spaces, generous living", "The architecture of everyday life"]],
  ["Ways of Seeing", "Art history, close looking, and ideas that stay with you.", "photo-1577083552431-6e5fd01aa342", ["How to spend an hour with one painting", "The colour that changed modern art", "Learning to look again"]],
  ["Common Table", "Food, place, and the traditions passed from one kitchen to another.", "photo-1555939594-58d7cb561ad1", ["A meal worth taking your time over", "Bread, patience, and a little practice", "What a family recipe remembers"]],
  ["Farther Afield", "Journeys on foot, thoughtful travel, and stories from the landscape.", "photo-1464822759023-fed622ff2c3b", ["Walking the long way home", "A small mountain village in autumn", "Why we return to wild places"]],
  ["Listening Room", "The craft of music, from a first idea to a finished performance.", "photo-1511379938547-c1f69419868d", ["What makes a melody feel like home?", "An afternoon at the piano", "The space between the notes"]],
  ["Small Observatory", "Science explained through careful questions and practical experiments.", "photo-1446776811953-b23d57bd21aa", ["The surprisingly ordinary physics of wonder", "Looking back at Earth", "The questions a night sky can answer"]],
  ["Living History", "Objects, places, and the human stories behind them.", "photo-1481627834876-b7833e8f5570", ["The things we chose to keep", "A library through five centuries", "An ordinary day, two hundred years ago"]],
  ["Garden Journal", "Seasons, soil, and learning to grow a little more thoughtfully.", "photo-1416879595882-3373a0480b5b", ["A garden that changes with the seasons", "Starting small: a windowsill garden", "What healthy soil looks like"]],
] as const;

export function makePreviewLibrary(now: number) {
  const channels: FollowedChannel[] = collection.map(([title, description, photo], index) => ({
    id: `UCframepreview${String(index).padStart(10, "0")}`, title, description,
    thumbnailUrl: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=160&h=160&q=80`,
    followedAt: now - index * 86400000, source: "manual", fetchedAt: now,
  }));
  const videos: Video[] = collection.flatMap(([, , photo, titles], index) => titles.map((title, position) => ({
    id: `mockv${String(index * 3 + position).padStart(6, "0")}`, title,
    channelId: channels[index].id, channelTitle: channels[index].title,
    thumbnailUrl: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=960&h=540&q=85&crop=${position === 1 ? "left" : "center"}`,
    publishedAt: new Date(now - (index + position * 8 + 1) * 86400000).toISOString(),
    durationSeconds: [1084, 1637, 2224, 847, 1362, 1948, 1546, 1238, 2445, 1775][index] + position * 173,
    description: `${channels[index].description} Fictional sample video for evaluating Frame’s layout; the photography is illustrative.`,
    fetchedAt: now, madeForKids: null,
  })));
  return { channels, videos };
}
export const isPreviewVideo = (id: string) => /^mockv\d{6}$/.test(id);
