import { createDiscoveryRun } from "./discoveryRun";
import { byokWeeklyPicks } from "./byokWeeklyPicksInstance";

export const discoveryRun = createDiscoveryRun(byokWeeklyPicks);
