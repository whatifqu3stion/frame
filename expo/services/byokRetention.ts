const PREFIX = "frame.byok.weekly.";
type Storage = {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

/** AI pools include provider metadata. Remove expired pools even if never opened again. */
export async function pruneByokPicks(storage: Storage, now = Date.now()): Promise<void> {
  const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(PREFIX) || (key.startsWith("frame.profile.") && key.endsWith(".generatedPicks.v1")));
  for (const key of keys) {
    let keep = false;
    try {
      const raw = await storage.getItem(key);
      const period: unknown = raw ? JSON.parse(raw).period : null;
      const start = typeof period === "string" && /^\d{4}-\d{2}-\d{2}$/.test(period) ? Date.parse(`${period}T00:00:00Z`) : NaN;
      keep = Number.isFinite(start) && now >= start && now < start + 7 * 86_400_000;
    } catch { /* Invalid metadata is discarded. Storage removal must still succeed. */ }
    if (!keep) await storage.removeItem(key);
  }
}
