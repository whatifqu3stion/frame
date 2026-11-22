import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providerKeyStore } from "@/storage/providerKeyStore";

/** Only presence is exposed to UI; credentials remain in SecureStore. */
export function useProviderKeyStatus() {
  const focused = useIsFocused();
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["provider-key-status"],
    queryFn: () => providerKeyStore.status(),
    enabled: focused,
    networkMode: "always",
    retry: false,
  });
  const { refetch } = status;
  useEffect(() => { if (focused) void refetch(); }, [focused, refetch]);
  useEffect(() => providerKeyStore.subscribe(() => {
    void client.invalidateQueries({ queryKey: ["provider-key-status"] });
  }), [client]);
  return status;
}
