import { PlaybackControlsService } from "@/domain/PlaybackControlsService";
import {
  readProfilePlaybackControls,
  readProfileSessionUsage,
  upsertProfilePlaybackControls,
  upsertProfileSessionUsage,
} from "@/db/database";

/** Process-wide boundary so every playback origin shares one Managed session. */
export const playbackControlsService = new PlaybackControlsService({
  readControls: readProfilePlaybackControls,
  writeControls: upsertProfilePlaybackControls,
  readSessionUsage: readProfileSessionUsage,
  writeSessionUsage: upsertProfileSessionUsage,
});
