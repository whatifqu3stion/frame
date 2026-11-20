import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { discoveryRun } from "@/services/discoveryRunInstance";
import { providerKeyStore } from "@/storage/providerKeyStore";
import { useApp } from "@/providers/AppProvider";

export function useDiscoveryRun() {
  return useSyncExternalStore(discoveryRun.subscribe, discoveryRun.getSnapshot, discoveryRun.getSnapshot);
}

/** Mount once above routes, so leaving the loader cannot discard the authorized search. */
export function useDiscoveryRunLifecycle() {
  const client = useQueryClient();
  const { activeProfileId, interests, profileSwitching } = useApp();
  const interestKey = interests.map(item => item.id).sort().join(",");
  const run = useDiscoveryRun();
  useEffect(() => {
    if (run.status === "running" && (profileSwitching || activeProfileId !== run.profileId || interestKey !== run.interestKey)) discoveryRun.cancel();
  }, [activeProfileId, interestKey, profileSwitching, run.status, run.profileId, run.interestKey]);
  useEffect(() => {
    const app = AppState.addEventListener("change", state => { if (state !== "active") discoveryRun.cancel(); });
    const keys = providerKeyStore.subscribe(() => discoveryRun.cancel());
    return () => { app.remove(); keys(); discoveryRun.cancel(); };
  }, []);
  useEffect(() => {
    if (!run.revision) return;
    void client.invalidateQueries({ predicate: query => ["weekly-picks", "onboarding-picks", "weekly-recovery"].includes(String(query.queryKey[0])) });
  }, [client, run.revision]);
}
