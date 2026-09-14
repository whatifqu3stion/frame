/** Idempotent bookmarking: cache refreshes, not repeated Save actions, update existing metadata. */
export const SAVE_VIDEO_SQL = `INSERT INTO saved_videos (profileId,id,title,channelId,channelTitle,thumbnailUrl,publishedAt,durationSeconds,description,savedAt,fetchedAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(profileId,id) DO NOTHING`;

/** Removes only the bookmark; progress, Today dispositions and Session membership stay intact. */
export const UNSAVE_VIDEO_SQL = "DELETE FROM saved_videos WHERE profileId = ? AND id = ?";
