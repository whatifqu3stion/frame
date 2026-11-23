import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providerKeyStore } from "@/storage/providerKeyStore";

/** Only presence is exposed to UI; credentials remain in SecureStore. */
export function useProviderKeyStatus(enabled = true) {
  const focused = useIsFocused();
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["provider-key-status"],
    queryFn: () => providerKeyStore.status(),
    enabled: enabled && focused,
    networkMode: "always",
    retry: false,
  });
  const { refetch } = status;
  useEffect(() => { if (enabled && focused) void refetch(); }, [enabled, focused, refetch]);
  useEffect(() => providerKeyStore.subscribe(() => {
    void client.invalidateQueries({ queryKey: ["provider-key-status"] });
  }), [client]);
  return status;
}
