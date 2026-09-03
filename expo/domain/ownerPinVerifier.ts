export type OwnerPinRecord = { version: 1; salt: string; verifier: string };

export type ProtectedPinStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type PinCrypto = {
  randomBytes(length: number): Promise<Uint8Array>;
  digest(value: string): Promise<string>;
};

export function validateOwnerPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function parseRecord(raw: string | null): OwnerPinRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerPinRecord>;
    if (parsed.version !== 1 || typeof parsed.salt !== "string" || typeof parsed.verifier !== "string") return null;
    return { version: 1, salt: parsed.salt, verifier: parsed.verifier };
  } catch {
    return null;
  }
}

/** Creates a testable salted-verifier service without coupling its core to native modules. */
export function createOwnerPinVerifier(storage: ProtectedPinStorage, crypto: PinCrypto, storageKey: string) {
  const read = async (): Promise<OwnerPinRecord | null> => parseRecord(await storage.getItem(storageKey));
  const verifier = (pin: string, salt: string): Promise<string> => crypto.digest(`${salt}:${pin}`);
  return {
    read,
    async set(pin: string): Promise<void> {
      if (!validateOwnerPin(pin)) throw new Error("Use four to six numbers.");
      const bytes = await crypto.randomBytes(32);
      const salt = Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, "0")).join("");
      const record: OwnerPinRecord = { version: 1, salt, verifier: await verifier(pin, salt) };
      await storage.setItem(storageKey, JSON.stringify(record));
    },
    async verify(pin: string): Promise<boolean> {
      if (!validateOwnerPin(pin)) return false;
      const record = await read();
      if (!record) return false;
      const candidate = await verifier(pin, record.salt);
      if (candidate.length !== record.verifier.length) return false;
      let mismatch = 0;
      for (let index = 0; index < candidate.length; index += 1) mismatch |= candidate.charCodeAt(index) ^ record.verifier.charCodeAt(index);
      return mismatch === 0;
    },
    remove: (): Promise<void> => storage.removeItem(storageKey),
  };
}
