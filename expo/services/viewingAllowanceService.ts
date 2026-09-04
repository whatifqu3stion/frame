import { ViewingAllowanceService } from "@/domain/ViewingAllowanceService";
import { readProfilePlaybackLimit, readProfilePlaybackUsage, upsertProfilePlaybackLimit, upsertProfilePlaybackUsage } from "@/db/database";

/** Process-wide local service so every playback origin shares one accounting session. */
export const viewingAllowanceService = new ViewingAllowanceService({
  readLimit: readProfilePlaybackLimit,
  writeLimit: upsertProfilePlaybackLimit,
  readUsage: readProfilePlaybackUsage,
  writeUsage: upsertProfilePlaybackUsage,
});
