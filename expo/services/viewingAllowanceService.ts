import { ViewingAllowanceService } from "@/domain/ViewingAllowanceService";
import { viewingHistoryStore } from "@/services/viewingHistoryService";
import { readProfilePlaybackLimit, readProfilePlaybackUsage, upsertProfilePlaybackLimit, upsertProfilePlaybackUsage } from "@/db/database";

/** Process-wide local service so every playback origin shares one accounting session. */
export const viewingAllowanceService = new ViewingAllowanceService({
  readLimit: readProfilePlaybackLimit,
  writeLimit: upsertProfilePlaybackLimit,
  readUsage: readProfilePlaybackUsage,
  writeUsage: upsertProfilePlaybackUsage,
}, (profileId, from, to) => viewingHistoryStore.record(profileId, from, to));
