import { OWNER_PIN_COOLDOWN_MS, OWNER_PIN_MAX_FAILURES } from "./ownerAuthorization";

export type OwnerPinRecord = { version: 1; salt: string; verifier: string; failedAttempts?: number; cooldownUntil?: number };

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
    if (parsed.version !== 1 || typeof parsed.salt !== "string" || typeof parsed.verifier !== "string" || !/^[0-9a-f]{64}$/i.test(parsed.salt) || !/^[0-9a-f]{64}$/i.test(parsed.verifier)) throw new Error("The protected Owner PIN record is unreadable.");
    const failedAttempts = parsed.failedAttempts ?? 0;
    const cooldownUntil = parsed.cooldownUntil ?? 0;
    if (!Number.isSafeInteger(failedAttempts) || failedAttempts < 0 || failedAttempts >= OWNER_PIN_MAX_FAILURES
      || !Number.isSafeInteger(cooldownUntil) || cooldownUntil < 0) throw new Error("The protected Owner PIN record is unreadable.");
    return { version: 1, salt: parsed.salt, verifier: parsed.verifier, failedAttempts, cooldownUntil };
  } catch (error) {
    throw error instanceof Error ? error : new Error("The protected Owner PIN record is unreadable.");
  }
}

const verificationQueues = new WeakMap<ProtectedPinStorage, Map<string, Promise<unknown>>>();

/** Creates a testable salted-verifier service without coupling its core to native modules. */
export function createOwnerPinVerifier(storage: ProtectedPinStorage, crypto: PinCrypto, storageKey: string, now: () => number = Date.now) {
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
    verify(pin: string): Promise<boolean> {
      // Serialize attempts so simultaneous callers cannot overwrite each other's failures.
      const queues = verificationQueues.get(storage) ?? new Map<string, Promise<unknown>>();
      verificationQueues.set(storage, queues);
      const pending = (queues.get(storageKey) ?? Promise.resolve()).catch(() => undefined).then(async () => {
        if (!validateOwnerPin(pin)) return false;
        const record = await read();
        if (!record) return false;
        if ((record.cooldownUntil ?? 0) > now()) return false;
        const candidate = await verifier(pin, record.salt);
        if (candidate.length !== record.verifier.length) return false;
        let mismatch = 0;
        for (let index = 0; index < candidate.length; index += 1) mismatch |= candidate.charCodeAt(index) ^ record.verifier.charCodeAt(index);
        const matches = mismatch === 0;
        const failures = matches ? 0 : (record.failedAttempts ?? 0) + 1;
        // Persist before returning: force-quitting must not reset the guessing limit.
        await storage.setItem(storageKey, JSON.stringify({
          ...record,
          failedAttempts: failures >= OWNER_PIN_MAX_FAILURES ? 0 : failures,
          cooldownUntil: failures >= OWNER_PIN_MAX_FAILURES ? now() + OWNER_PIN_COOLDOWN_MS : 0,
        }));
        return matches;
      });
      queues.set(storageKey, pending);
      return pending;
    },
    remove: (): Promise<void> => storage.removeItem(storageKey),
  };
}
