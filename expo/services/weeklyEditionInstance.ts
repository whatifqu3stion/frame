import AsyncStorage from "@react-native-async-storage/async-storage";
import { weeklyPicksClient } from "./weeklyPicksClient";
import { createWeeklyEditionService } from "./weeklyEdition";

export const weeklyEditionService = createWeeklyEditionService(weeklyPicksClient, AsyncStorage);
