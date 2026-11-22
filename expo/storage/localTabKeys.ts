import { createProviderKeyStore } from "./providerKeys";

/** A fresh page gets a fresh store. Keys never go into browser storage. */
export function createLocalTabKeys(development: boolean, hostname: string) {
  if (!development || !["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return null;
  const values = new Map<string, string>();
  return createProviderKeyStore({
    getItemAsync: async name => values.get(name) ?? null,
    setItemAsync: async (name, value) => { values.set(name, value); },
    deleteItemAsync: async name => { values.delete(name); },
  }, async () => true);
}
