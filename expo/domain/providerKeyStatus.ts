import type { ProviderKeyStore } from "@/storage/providerKeys";

type KeyStatus = Awaited<ReturnType<ProviderKeyStore["status"]>>;
type StatusQuery = { isPending: boolean; isError: boolean; data?: KeyStatus };
export type ProviderKeyState = "checking" | "error" | "unavailable" | "ready";

/** A failed refresh must not make cached presence look like a successful storage read. */
export function providerKeyState(query: StatusQuery): ProviderKeyState {
  if (query.isPending) return "checking";
  if (query.isError || !query.data) return "error";
  return query.data.available ? "ready" : "unavailable";
}

export function unavailableKeyStorageMessage(web: boolean): string {
  return web
    ? "Add keys in the iPhone or Android app. This browser preview cannot securely save provider keys."
    : "Secure storage is unavailable on this device. Unlock your device and try again. If this continues, restart Frame.";
}
