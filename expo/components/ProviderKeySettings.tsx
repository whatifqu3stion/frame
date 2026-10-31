import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import InlineHelp from "@/components/InlineHelp";
import Heading from "@/components/Heading";
import SettingsRow from "@/components/SettingsRow";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { providerKeyState, unavailableKeyStorageMessage } from "@/domain/providerKeyStatus";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, View } from "react-native";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { providerKeyStore } from "@/storage/providerKeyStore";
import { KEY_PROVIDERS, type KeyProvider } from "@/storage/providerKeys";
import { byokYouTube, providerTransport } from "@/services/byok";
import { ProviderError } from "@/services/providerRequest";

const setupLinks = {
  youtube: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  gemini: "https://aistudio.google.com/api-keys",
};

export default function ProviderKeySettings() {
  const { palette, type } = useFrameTheme();
  const { activeProfile, activeProfileId, authorizeProtectedAction } = useApp();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const status = useProviderKeyStatus();
  const storageState = providerKeyState(status);
  const storageReady = storageState === "ready";
  const [editing, setEditing] = useState<KeyProvider | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ provider: KeyProvider; text: string } | null>(null);
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const profile = useRef(activeProfileId);
  profile.current = activeProfileId;
  useEffect(() => {
    alive.current = focused;
    setDraft(""); setEditing(null); setBusy(false); setMessage(null);
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") { operation.current?.abort(); setDraft(""); setEditing(null); setBusy(false); setMessage(null); }
    });
    return () => { alive.current = false; operation.current?.abort(); listener.remove(); };
  }, [focused, activeProfileId]);

  const act = async (provider: KeyProvider, action: "edit" | "save" | "remove") => {
    if (operation.current || activeProfile?.role !== "owner" || !storageReady) return;
    const controller = new AbortController(); operation.current = controller;
    const id = activeProfileId;
    const current = () => alive.current && profile.current === id && !controller.signal.aborted;
    setBusy(true); setMessage(null);
    try {
      if (!await authorizeProtectedAction(id, true) || !current()) return;
      if (action === "edit") { setDraft(""); setEditing(provider); return; }
      if (action === "remove") await providerKeyStore.remove(provider);
      else {
        const key = draft.trim();
        if (!/^[A-Za-z0-9_-]{20,256}$/.test(key)) { setMessage({ provider, text: "Paste the API key only, without spaces or a URL." }); return; }
        if (provider === "youtube") await byokYouTube.validateKey(key, controller.signal);
        else await providerTransport.validateGemini(key, controller.signal);
        if (!current()) return;
        await providerKeyStore.save(provider, key);
      }
      if (!current()) return;
      setDraft(""); setEditing(null);
      setMessage({ provider, text: action === "remove" ? "Key removed from this device. Revoke it in your provider account if you no longer need it." : "Key verified and saved securely on this device." });
      // Retry failed metadata reads with the new credential. No AI generation occurs on a read.
      await queryClient.invalidateQueries({ predicate: (query) => ["provider-key-status", "today", "cached-channel", "weekly-picks", "onboarding-picks"].includes(String(query.queryKey[0])) });
    } catch (error) {
      if (current()) setMessage({ provider, text: error instanceof ProviderError ? error.message : "Secure storage could not complete this change. Try again on your device." });
    } finally {
      if (operation.current === controller) operation.current = null;
      if (current()) setBusy(false);
    }
  };
  const buttonStyle = { minHeight: 48, justifyContent: "center" as const, paddingVertical: spacing.sm };
  if (activeProfile?.role !== "owner") return <Text style={type.bodySoft}>Switch to the Owner profile to manage the keys used on this device.</Text>;
  return <View style={{ gap: spacing.lg }}>
    
    <View style={{ gap: spacing.sm }}>
    <Text style={type.bodySoft}>Keys are shared by profiles on this device and sent directly to Google. Your provider’s limits and charges apply.</Text>
    {storageState === "checking" ? <ActivityIndicator accessibilityLabel="Checking secure storage" color={palette.active} /> : storageState === "error" || (storageState === "unavailable" && Platform.OS !== "web") ? <SettingsRow title="Try secure storage again" summary={storageState === "error" ? "Key status couldn’t load." : unavailableKeyStorageMessage(false)} busy={status.isFetching} onPress={() => { void status.refetch(); }} navigation={false} /> : storageState === "unavailable" ? <Text style={type.bodySoft}>{unavailableKeyStorageMessage(true)}</Text> : null}
    </View>
    {KEY_PROVIDERS.map((provider) => <View key={provider} style={{ gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.borderSoft }}>
      <Heading style={type.heading}>{provider === "youtube" ? "YouTube Data API" : "Gemini API · optional"}</Heading>
      <Text style={type.bodySoft}>{provider === "youtube" ? "Required for sources and video details." : "For weekly source suggestions."}</Text>
      <Text style={type.label}>{status.isPending ? "Checking key status…" : status.isError || !status.data?.available ? "Key status unavailable" : status.data[provider] ? "Key saved on this device" : "No key saved"}</Text>
      <>{status.data?.[provider] && editing !== provider ? <InlineHelp label="Setup guidance"><Text style={type.bodySoft}>{setupGuidance(provider)}</Text></InlineHelp> : <Text style={type.bodySoft}>{setupGuidance(provider)}</Text>}</>
      <SettingsRow title={provider === "youtube" ? "Google Cloud setup" : "Google AI Studio"} accessibilityRole="link" onPress={() => { setDraft(""); setEditing(null); setMessage(null); void Linking.openURL(setupLinks[provider]).catch(() => { if (alive.current && profile.current === activeProfileId && AppState.currentState === "active") setMessage({ provider, text: "Couldn’t open the provider’s setup page." }); }); }} />
      {message?.provider === provider ? <Text style={type.bodySoft} accessibilityLiveRegion="polite" testID={`key-feedback-${provider}`}>{message.text}</Text> : null}
      {editing === provider ? <>
        <TextField value={draft} onChangeText={(value) => { setDraft(value); setMessage(null); }} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no" maxLength={256} editable={!busy} accessibilityLabel={`${provider} API key`} placeholder="Paste your API key" placeholderTextColor={palette.inkMuted} testID={`key-input-${provider}`}  />
        <Text style={type.bodySoft}>Verify & save makes one provider request. It does not generate AI content. An existing key is replaced only after this succeeds.</Text>
        <Pressable disabled={busy || !storageReady || !draft.trim()} accessibilityState={{ disabled: busy || !storageReady || !draft.trim(), busy }} accessibilityRole="button" style={[buttonStyle, { alignItems: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep, opacity: busy || !storageReady || !draft.trim() ? 0.5 : 1 }]} onPress={() => { void act(provider, "save"); }} testID={`key-save-${provider}`}><Text style={[type.label, { color: palette.onDark }]}>{busy ? "Checking…" : "Verify & save"}</Text></Pressable>
        <Pressable disabled={busy} accessibilityRole="button" style={buttonStyle} onPress={() => { setDraft(""); setEditing(null); setMessage(null); }}><Text style={type.label}>Cancel</Text></Pressable>
      </> : <Pressable disabled={busy || !storageReady} accessibilityState={{ disabled: busy || !storageReady }} accessibilityRole="button" style={[buttonStyle, { alignItems: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep, opacity: busy || !storageReady ? 0.5 : 1 }]} onPress={() => { void act(provider, "edit"); }} testID={`key-edit-${provider}`}><Text style={[type.label, { color: palette.onDark }]}>{storageReady && status.data?.[provider] ? "Replace key" : "Add key"}</Text></Pressable>}
      {storageReady && status.data?.[provider] ? <Pressable disabled={busy} accessibilityRole="button" style={buttonStyle} onPress={() => { void act(provider, "remove"); }} testID={`key-remove-${provider}`}><Text style={[type.label, { color: palette.danger }]}>Remove key from device</Text></Pressable> : null}
    </View>)}
    <InlineHelp label="Key storage and removal"><Text style={type.bodySoft}>Keys are kept in secure storage. Remove or replace them here; erasing Frame data removes both keys. Removing a key from Frame does not revoke it at Google. Secure storage cannot protect a key on a compromised device.</Text></InlineHelp>
  </View>;
}

function setupGuidance(provider: KeyProvider) {
  return provider === "youtube"
    ? "Enable YouTube Data API v3. Create a separate key restricted to that API."
    : "Create a separate key restricted to the Generative Language API. Set provider quotas before generating suggestions; budget alerts do not stop charges.";
}
