export const INSTALLATION_IDENTITY_KEY = "frame.installationIdentity.v1";
const tokenPattern = /^[0-9a-f]{64}$/;

export type InstallationIdentityStore = {
  getOrCreate(): Promise<string>;
  remove(): Promise<void>;
};

export type InstallationStringStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type InstallationIdentityOptions = {
  storage: InstallationStringStore;
  randomBytes(length: number): Promise<Uint8Array>;
};

/** Creates one private installation identity for billing and bounded source actions. */
export function createInstallationIdentityStore(options: InstallationIdentityOptions): InstallationIdentityStore {
  let inFlight: Promise<string> | null = null;
  return {
    getOrCreate(): Promise<string> {
      if (inFlight) return inFlight;
      inFlight = (async (): Promise<string> => {
        const existing = await options.storage.getItem(INSTALLATION_IDENTITY_KEY);
        if (existing && tokenPattern.test(existing)) return existing;
        const bytes = await options.randomBytes(32);
        if (bytes.length !== 32) throw new Error("installation identity generation failed");
        const token = Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, "0")).join("");
        await options.storage.setItem(INSTALLATION_IDENTITY_KEY, token);
        return token;
      })().finally(() => { inFlight = null; });
      return inFlight;
    },
    remove(): Promise<void> { return options.storage.removeItem(INSTALLATION_IDENTITY_KEY); },
  };
}
