import { TODAY_MAX_ITEMS } from "@/constants/productConfig";

/** Existing profiles keep their twelve-video selection; invalid stored values cannot expand it. */
export function normalizeTodayVideoCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return TODAY_MAX_ITEMS;
  return Math.max(1, Math.min(TODAY_MAX_ITEMS, Math.round(value)));
}
