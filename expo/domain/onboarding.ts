import type { TodaySnapshotItem, TodaySourceRule } from "../models/today";
import { isMetadataCurrent } from "./metadataRetention";
import { visibleTodayItems } from "./today";

/** Retain only this profile’s eligible selection and fresh cards saved in this reveal. */
export function onboardingSelection(items: readonly TodaySnapshotItem[], profileId: string, sources: ReadonlySet<string>, rules: ReadonlyMap<string, TodaySourceRule>, now: number, savedHere: ReadonlySet<string>): TodaySnapshotItem[] {
  const scoped = items.filter((item) => item.profileId === profileId);
  const visible = visibleTodayItems(scoped, sources, rules, now);
  const visibleIds = new Set(visible.map((item) => item.id));
  const justSaved = scoped.filter((item) => savedHere.has(item.id) && item.disposition === "saved" && sources.has(item.sourceId) && (rules.get(item.sourceId)?.mutedUntil ?? 0) <= now && isMetadataCurrent(item.fetchedAt, now) && !visibleIds.has(item.id));
  return [...visible, ...justSaved].sort((a, b) => a.position - b.position);
}

/** Completion goes to useful content; replay always returns to Settings. */
export function onboardingDestination(sourceCount: number, replay: boolean, savedCount: number = 0) {
  return replay ? "/(tabs)/settings" as const : savedCount > 0 ? "/(tabs)/saved" as const : sourceCount > 0 ? "/(tabs)" as const : "/(tabs)/sources" as const;
}

/** Illustrative prices only. Never pass these identifiers to billing. */
export const DEMO_PLANS = [
  { id: "annual", title: "Yearly", price: "$39.99", period: "per year", detail: "USD · sample price" },
  { id: "monthly", title: "Monthly", price: "$4.99", period: "per month", detail: "USD · sample price" },
] as const;
export type DemoPlanId = typeof DEMO_PLANS[number]["id"];
export type DemoCheckoutState = { plan: DemoPlanId; completed: boolean };
export function demoCheckoutReducer(state: DemoCheckoutState, action: { type: "select"; plan: DemoPlanId } | { type: "preview" } | { type: "reset" }): DemoCheckoutState {
  if (action.type === "select") return { plan: action.plan, completed: false };
  if (action.type === "preview") return { ...state, completed: true };
  return { ...state, completed: false };
}
