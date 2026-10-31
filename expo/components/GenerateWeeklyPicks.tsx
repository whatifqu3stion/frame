import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppState, Pressable, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";
import { byokWeeklyPicks } from "@/services/byokWeeklyPicksInstance";
import { providerKeyStore } from "@/storage/providerKeyStore";
import { ProviderError } from "@/services/providerRequest";

export default function GenerateWeeklyPicks({ hasEdition = false }: { hasEdition?: boolean }) {
  const { palette, type } = useFrameTheme();
  const { activeProfile, activeProfileId, interests, authorizeProtectedAction } = useApp();
  const focused = useIsFocused();
  const client = useQueryClient();
  const retryQuery = useQuery({ queryKey: ["weekly-recovery", activeProfileId], queryFn: () => byokWeeklyPicks.canRetryEmpty(activeProfileId), enabled: focused && activeProfile?.role === "owner", networkMode: "always" });
  const keyStatus = useQuery({ queryKey: ["provider-key-status"], queryFn: () => providerKeyStore.status(), enabled: focused && activeProfile?.role === "owner" && (!hasEdition || retryQuery.data === true), networkMode: "always", retry: false });

  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => providerKeyStore.subscribe(() => { void client.invalidateQueries({ queryKey: ["provider-key-status"] }); }), [client]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const operation = useRef<AbortController | null>(null);
  const interestKey = interests.map((item) => item.id).sort().join(",");
  useEffect(() => {
    setBusy(false); setMessage(""); setDetailsOpen(false);
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") { operation.current?.abort(); setBusy(false); } });
    return () => { operation.current?.abort(); listener.remove(); };
  }, [activeProfileId, focused, interestKey]);
  const generate = async () => {
    if (operation.current || !focused || activeProfile?.role !== "owner") return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setMessage("");
    try {
      if (!await authorizeProtectedAction(activeProfileId, true) || controller.signal.aborted) return;
      await byokWeeklyPicks.generate(interests.map((item) => item.id), controller.signal, activeProfileId);
      if (controller.signal.aborted) return;
      await client.invalidateQueries({ predicate: (query) => ["weekly-picks", "onboarding-picks"].includes(String(query.queryKey[0])) });
      const result = await byokWeeklyPicks.getWeeklyPicks(interests.map((item) => item.id), activeProfileId);
      if (controller.signal.aborted) return;
      await retryQuery.refetch();
      setMessage(result.status === "success" ? result.response.message ?? "This week’s suggestions are ready." : "Picks could not be loaded. Try again later.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof ProviderError ? error.message : "Picks could not be prepared. Check both keys, select interests, and wait a minute before trying again.");
    } finally {
      void retryQuery.refetch();
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  if (activeProfile?.role !== "owner") return <Text style={type.bodySoft}>The Owner can generate suggestions with the keys on this device.</Text>;
  const keysReady = keyStatus.data?.available && keyStatus.data.youtube && keyStatus.data.gemini;
  const buttonStyle = { minHeight: 48, justifyContent: "center" as const };
  return <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
    {!hasEdition || retryQuery.data ? <>
      {!interests.length ? <Pressable accessibilityRole="button" onPress={() => router.push("/settings/interests")} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Choose interests for your picks</Text></Pressable>
        : keyStatus.isPending ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">Checking discovery setup…</Text>
        : keyStatus.isError ? <><Text style={type.bodySoft}>Discovery setup couldn’t be checked.</Text><Pressable accessibilityRole="button" onPress={() => { void keyStatus.refetch(); }} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Check setup again</Text></Pressable></>
        : !keyStatus.data?.available ? <Text style={type.bodySoft}>Prepare weekly picks in the iPhone or Android app, where your keys can be stored securely.</Text>
        : !keysReady ? <><Text style={type.bodySoft}>Add YouTube and Gemini keys once to prepare your weekly picks.</Text><Pressable accessibilityRole="button" onPress={() => router.push("/settings/keys")} style={buttonStyle}><Text style={[type.label, { color: palette.active }]}>Set up discovery</Text></Pressable></>
        : <>
          <Text style={type.bodySoft}>Gemini receives your interests and public channel/video descriptions. Provider charges may apply.</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} aria-busy={busy} disabled={busy} onPress={() => { void generate(); }} style={buttonStyle} testID="generate-byok-picks"><Text style={[type.label, { color: palette.active }]}>{busy ? "Preparing and verifying…" : retryQuery.data ? "Try once more for this week" : "Generate this week’s picks"}</Text></Pressable>
        </>}
    </> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} aria-expanded={detailsOpen} onPress={() => setDetailsOpen(!detailsOpen)} style={[buttonStyle, { flexDirection: "row", alignItems: "center", gap: spacing.sm }]}><Text style={[type.label, { color: palette.active, flex: 1 }]}>How weekly picks work</Text><DisclosureIndicator expanded={detailsOpen} color={palette.active} /></Pressable>
    {detailsOpen ? <MotionView enter style={{ gap: spacing.sm }}>
      <Text style={type.bodySoft}>Sources for learning, craft and inspiration, with videos of four minutes or longer. Frame reviews a recent upload sample and skips weak or uncertain picks. Quality judgments can miss things.</Text>
      <Text style={type.bodySoft}>Up to twelve reviewed sources per week, shown three at a time when you ask. Generate an edition when you’re ready; nothing replenishes automatically. An empty edition has one recovery attempt. Interest edits apply to the next edition.</Text>
      <Text style={type.bodySoft}>Generation sends your interests and public channel/video descriptions to Gemini for review. Provider charges may apply. Manage your keys in Settings → Your API keys.</Text>
    </MotionView> : null}
    {message ? <MotionView enter changeKey={message}><Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text></MotionView> : null}
  </View>;
}
