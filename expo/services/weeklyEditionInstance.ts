import AsyncStorage from "@react-native-async-storage/async-storage";
import { byokWeeklyPicks } from "./byokWeeklyPicksInstance";
import { createWeeklyEditionService } from "./weeklyEdition";

export const weeklyEditionService = createWeeklyEditionService(byokWeeklyPicks, AsyncStorage);
