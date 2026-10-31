import AsyncStorage from "@react-native-async-storage/async-storage";
import { ViewingHistoryStore } from "@/domain/viewingHistory";

export const viewingHistoryStore = new ViewingHistoryStore(AsyncStorage);
