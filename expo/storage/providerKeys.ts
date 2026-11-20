export type KeyProvider = "youtube" | "gemini";
export const KEY_PROVIDERS: readonly KeyProvider[] = ["youtube", "gemini"];
export const MAX_PROVIDER_KEY_LENGTH = 2048;
export function isProviderKey(provider: KeyProvider, key: string): boolean {
  if (key.length < 20 || key.length > MAX_PROVIDER_KEY_LENGTH) return false;
  // AI Studio authorization keys start with AQ. and may be longer than a standard key.
  if (provider === "gemini" && key.startsWith("AQ.")) return /^AQ\.[A-Za-z0-9_.-]+$/.test(key);
  return /^[A-Za-z0-9_-]{20,256}$/.test(key);
}

export type KeyStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export function providerKeyName(provider: KeyProvider): string { return `frame.byok.${provider}.v1`; }

/** Keys never enter public app state. Changes invalidate requests before touching storage. */
export function createProviderKeyStore(storage: KeyStorage, available: () => Promise<boolean>) {
  let revision = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const changed = () => { revision += 1; listeners.forEach((listener) => listener()); };
  const requireStorage = async () => { if (!await available()) throw new Error("Secure key storage requires the native app on this device."); };
  const mutate = (work: () => Promise<void>) => {
    changed();
    const pending = writes.catch(() => {}).then(async () => { await requireStorage(); await work(); });
    writes = pending;
    return pending.finally(changed);
  };
  return {
    available,
    revision: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async read(provider: KeyProvider) { await writes.catch(() => {}); await requireStorage(); return storage.getItemAsync(providerKeyName(provider)); },
    async status() {
      await writes.catch(() => {});
      if (!await available()) return { available: false, youtube: false, gemini: false };
      const [youtube, gemini] = await Promise.all(KEY_PROVIDERS.map((provider) => storage.getItemAsync(providerKeyName(provider))));
      return { available: true, youtube: Boolean(youtube), gemini: Boolean(gemini) };
    },
    save(provider: KeyProvider, value: string) {
      const key = value.trim();
      if (!isProviderKey(provider, key)) return Promise.reject(new Error("Enter a valid API key, without spaces or a URL."));
      return mutate(() => storage.setItemAsync(providerKeyName(provider), key));
    },
    remove(provider: KeyProvider) { return mutate(() => storage.deleteItemAsync(providerKeyName(provider))); },
    clear() { return mutate(async () => { await Promise.all(KEY_PROVIDERS.map((provider) => storage.deleteItemAsync(providerKeyName(provider)))); }); },
  };
}
export type ProviderKeyStore = ReturnType<typeof createProviderKeyStore>;
