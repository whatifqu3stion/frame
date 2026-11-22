import AsyncStorage from "@react-native-async-storage/async-storage";
import { providerKeyStore } from "../storage/providerKeyStore";
import { byokYouTube, providerTransport } from "./byok";
import { createByokWeeklyPicks } from "./byokWeeklyPicks";

export const byokWeeklyPicks = createByokWeeklyPicks(providerTransport, providerKeyStore, AsyncStorage, byokYouTube.resolve, byokYouTube.inspectDiscoverySource);
