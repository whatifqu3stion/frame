import { ChevronRight } from "lucide-react-native";
import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppState, Pressable, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { byokWeeklyPicks } from "@/services/byokWeeklyPicksInstance";
import { providerKeyStore } from "@/storage/providerKeyStore";
import type { DiscoveryRunSnapshot } from "@/services/discoveryRun";
import { discoveryRun } from "@/services/discoveryRunInstance";
import { useDiscoveryRun } from "@/hooks/useDiscoveryRun";
import { CuratingSelection } from "@/components/motion/CuratingSelection";

export default function GenerateWeeklyPicks({ hasEdition = false, onSetUpKeys, onBusyChange, onPrepared, onPresentationStage }: { hasEdition?: boolean; onSetUpKeys?(): void; onBusyChange?(busy: boolean): void; onPrepared?(hasPicks: boolean): void; onPresentationStage?(stage: DiscoveryRunSnapshot | null): void }) {
  const { palette, type } = useFrameTheme();
  const { activeProfile, activeProfileId, interests, authorizeProtectedAction } = useApp();
  const focused = useIsFocused();
  const client = useQueryClient();
  const retryQuery = useQuery({ queryKey: ["weekly-recovery", activeProfileId], queryFn: () => byokWeeklyPicks.canRetryEmpty(activeProfileId), enabled: focused && activeProfile?.role === "owner", networkMode: "always" });
  const keyStatus = useQuery({ queryKey: ["provider-key-status"], queryFn: () => providerKeyStore.status(), enabled: focused && activeProfile?.role === "owner" && (!hasEdition || retryQuery.data === true), networkMode: "always", retry: false });

  useEffect(() => providerKeyStore.subscribe(() => { void client.invalidateQueries({ queryKey: ["provider-key-status"] }); }), [client]);
  const search = useDiscoveryRun();
  const interestKey = interests.map(item => item.id).sort().join(",");
  const mine = search.profileId === activeProfileId && search.interestKey === interestKey;
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizationError, setAuthorizationError] = useState("");
  const contextVersion = useRef(0);
  useEffect(() => { contextVersion.current += 1; }, [activeProfileId, focused, interestKey]);
  const mounted = useRef(true);
  const authorization = useRef(false);
  const prepared = useRef<number | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const running = mine && search.status === "running";
  const busy = authorizing || (running && !search.available);
  const presentedStage = running && !search.available ? search : null;
  const message = authorizationError || (mine ? search.message : "");
  useEffect(() => { onPresentationStage?.(presentedStage); }, [onPresentationStage, presentedStage]);
  useEffect(() => () => onPresentationStage?.(null), [onPresentationStage]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!mine || !onPrepared || prepared.current === search.startedAt || !(search.available || search.status === "complete")) return;
    prepared.current = search.startedAt;
    onBusyChange?.(false);
    onPrepared(search.available);
  }, [mine, onPrepared, onBusyChange, search.available, search.startedAt, search.status]);
  const generate = async () => {
    if (authorization.current || search.status === "running" || !focused || activeProfile?.role !== "owner") return;
    authorization.current = true; setAuthorizing(true); setAuthorizationError("");
    const version = contextVersion.current;
    try {
      if (await authorizeProtectedAction(activeProfileId, true) && mounted.current && version === contextVersion.current && AppState.currentState === "active") {
        void discoveryRun.start(activeProfileId, interests.map(item => item.id));
      }
    } catch {
      if (mounted.current) setAuthorizationError("Couldn’t confirm access. Please try again.");
    } finally {
      authorization.current = false;
      if (mounted.current) setAuthorizing(false);
    }
  };
  if (activeProfile?.role !== "owner") return <Text style={type.bodySoft}>The Owner can generate suggestions with the keys on this device.</Text>;
  const keysReady = keyStatus.data?.available && keyStatus.data.youtube && keyStatus.data.gemini;
  const buttonStyle = { minHeight: 48, justifyContent: "center" as const };
  if (busy) return <View style={{ gap: spacing.sm }}>
    {presentedStage ? !onPresentationStage && <CuratingSelection stage={presentedStage.stage} reviewedCount={presentedStage.reviewedCount} startedAt={presentedStage.startedAt} /> : <Text accessibilityLiveRegion="polite" style={type.bodySoft}>Preparing…</Text>}
    <Pressable accessibilityRole="button" onPress={() => discoveryRun.cancel()} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Cancel</Text></Pressable>
  </View>;
  if (running && search.available) return <View style={{ gap: spacing.xs }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">Your first picks are ready. Looking for a few more…</Text>
    <Pressable accessibilityRole="button" onPress={() => discoveryRun.cancel()} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Stop searching</Text></Pressable>
  </View>;
  return <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
    {!hasEdition || retryQuery.data ? <>
      {!interests.length ? <Pressable accessibilityRole="button" onPress={() => router.push("/settings/interests")} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Choose interests for your picks</Text></Pressable>
        : keyStatus.isPending ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">Checking discovery setup…</Text>
        : keyStatus.isError ? <><Text style={type.bodySoft}>Discovery setup couldn’t be checked.</Text><Pressable accessibilityRole="button" onPress={() => { void keyStatus.refetch(); }} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Check setup again</Text></Pressable></>
        : !keyStatus.data?.available ? <Text style={type.bodySoft}>Prepare weekly picks in the iPhone or Android app, where your keys can be stored securely.</Text>
        : !keysReady ? <Pressable testID="discovery-connection-prompt" accessibilityRole="button"
          accessibilityHint="Opens key setup to find weekly picks for your interests."
          onPress={onSetUpKeys ?? (() => router.push("/settings/keys"))}
          style={({ pressed }) => ({
            alignSelf: "flex-start", maxWidth: "100%", minHeight: 48, flexDirection: "row", alignItems: "center",
            gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            borderRadius: radii.pill, borderCurve: "continuous", backgroundColor: pressed ? palette.surfaceDeep : palette.activeSoft,
          })}>
          <Text style={[type.label, { color: palette.active, flexShrink: 1 }]}>Connect YouTube &amp; Gemini</Text>
          <ChevronRight size={16} color={palette.active} />
        </Pressable>
        : <>
          <Text style={type.bodySoft}>{onSetUpKeys ? "Gemini reviews your interests and public video details. Up to 25 Gemini requests; charges may apply." : "Gemini receives your interests and public channel/video descriptions. Provider charges may apply."}</Text>
          <PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" onPress={() => { void generate(); }} style={[buttonStyle, { backgroundColor: palette.accentDeep, alignItems: "center", borderRadius: radii.control }]} testID="generate-byok-picks"><Text style={[type.label, { color: palette.onDark }]}>{retryQuery.data ? "Try once more for this week" : onSetUpKeys ? "Find my picks" : "Generate this week’s picks"}</Text></PrimaryAction>
        </>}
    </> : null}
    {message ? <MotionView enter changeKey={message}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text></MotionView> : null}
  </View>;
}
