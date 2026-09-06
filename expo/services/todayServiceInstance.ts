import { todayRepository } from "@/repositories/todayRepository";
import { sourceFeedClient } from "@/services/sourceFeedClientInstance";
import { createTodayService } from "@/services/todayService";

export const todayService = createTodayService(todayRepository, sourceFeedClient);
