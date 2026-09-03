import { DailyAllowanceService } from "@/domain/DailyAllowanceService";
import { readManagedAllowanceRecord, upsertManagedAllowanceRecord } from "@/db/database";

/** Process-wide local service so every player entry uses one accounting session. */
export const dailyAllowanceService = new DailyAllowanceService({
  read: readManagedAllowanceRecord,
  write: upsertManagedAllowanceRecord,
});
