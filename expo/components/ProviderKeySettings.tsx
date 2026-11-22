import { useFeedback } from "@/hooks/useFeedback";
import InfoDisclosure from "@/components/InfoDisclosure";
import { confirmUser } from "@/services/notifyUser";
import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import ConnectionWalkthrough, { TvKeyEntryTip } from "@/components/ConnectionWalkthrough";
import TextField from "@/components/TextField";
import InlineHelp from "@/components/InlineHelp";
import Heading from "@/components/Heading";
import SettingsRow from "@/components/SettingsRow";
import SettingsGroup from "@/components/SettingsGroup";
import { useProviderKeyStatus } from "@/hooks/useProviderKeyStatus";
import { providerKeyState, unavailableKeyStorageMessage } from "@/domain/providerKeyStatus";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, AppState, Linking, Platform, Pressable, View } from "react-native";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";
import { localKeyPreview, providerKeyStore } from "@/storage/providerKeyStore";
import { isProviderKey, KEY_PROVIDERS, MAX_PROVIDER_KEY_LENGTH, type KeyProvider } from "@/storage/providerKeys";
import { byokYouTube, providerTransport } from "@/services/byok";
import { setupGuidance } from "@/domain/providerSetupGuide";
import { ProviderError } from "@/services/providerRequest";

const setupLinks = {
  youtube: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  gemini: "https://aistudio.google.com/api-keys",
};
const setupGuideLinks = {
  youtube: "https://developers.google.com/youtube/registering_an_application",
  gemini: "https://ai.google.dev/gemini-api/docs/api-key",
};

type Props = { onBusyChange?(busy: boolean): void; onboarding?: boolean; selectedProvider?: KeyProvider; youtubeGuide?: "credentials"; onYouTubeGuideChange?(step: "credentials" | undefined): void };
export default function ProviderKeySettings({ onBusyChange, onboarding = false, selectedProvider = "youtube", youtubeGuide, onYouTubeGuideChange }: Props = {}) {
  const { palette, type } = useFrameTheme();
  const { activeProfile, activeProfileId, authorizeProtectedAction } = useApp();
  const focused = useIsFocused();
  const feedback = useFeedback(focused);
  const queryClient = useQueryClient();
  const status = useProviderKeyStatus();
  const storageState = providerKeyState(status);
  const storageReady = storageState === "ready";
  const [editing, setEditing] = useState<KeyProvider | null>(null);
  const [draft, setDraft] = useState("");
  const [inputKeys, setInputKeys] = useState({ youtube: "", gemini: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const [message, setMessage] = useState<{ provider: KeyProvider; text: string } | null>(null);
  useEffect(() => {
    if (Platform.OS === "ios" && focused && message) AccessibilityInfo.announceForAccessibility(message.text);
  }, [focused, message]);
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const profile = useRef(activeProfileId);
  profile.current = activeProfileId;
  useEffect(() => {
    alive.current = focused;
    setDraft(""); setInputKeys({ youtube: "", gemini: "" }); setEditing(null); setBusy(false); setMessage(null);
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") { operation.current?.abort(); setDraft(""); setInputKeys({ youtube: "", gemini: "" }); setEditing(null); setBusy(false); setMessage(null); }
    });
    return () => { alive.current = false; operation.current?.abort(); listener.remove(); };
  }, [focused, activeProfileId]);

  const act = async (provider: KeyProvider, action: "edit" | "save" | "remove") => {
    if (operation.current || activeProfile?.role !== "owner" || !storageReady) return;
    const key = action === "save" ? (onboarding ? inputKeys[provider] : draft).trim() : "";
    if (action === "save" && !isProviderKey(provider, key)) {
      setMessage({ provider, text: "Paste only the key you copied from Google. A link or project name won’t work." });
      return;
    }
    const acknowledge = feedback.capture();
    const controller = new AbortController(); operation.current = controller;
    const id = activeProfileId;
    const current = () => alive.current && profile.current === id && !controller.signal.aborted;
    setBusy(true); setMessage(null);
    try {
      if (!await authorizeProtectedAction(id, true) || !current()) return;
      if (action === "edit") { setDraft(""); setEditing(provider); return; }
      if (action === "remove") await providerKeyStore.remove(provider);
      else {
        if (provider === "youtube") await byokYouTube.validateKey(key, controller.signal);
        else await providerTransport.validateGemini(key, controller.signal);
        if (!current()) return;
        await providerKeyStore.save(provider, key);
      }
      if (!current()) return;
      setDraft(""); setEditing(null);
      setInputKeys(previous => ({ ...previous, [provider]: "" }));
      const saved = localKeyPreview ? "Key verified for this tab." : "Key verified and saved on this device.";
      setMessage({ provider, text: action === "remove"
        ? "Key removed. Revoke it at Google if you no longer need it."
        : provider === "gemini" ? saved + " Generation is checked when you request picks." : saved });
      if (action === "save") acknowledge("commit");
      // Retry failed metadata reads with the new credential. No AI generation occurs on a read.
      await queryClient.invalidateQueries({ predicate: (query) => ["provider-key-status", "today", "cached-channel", "weekly-picks", "onboarding-picks"].includes(String(query.queryKey[0])) });
    } catch (error) {
      if (current()) setMessage({ provider, text:
        onboarding && action === "save" && provider === "youtube" && error instanceof ProviderError && error.kind === "access"
          ? "YouTube didn’t accept this key. Check that YouTube Data API v3 is enabled in the project that owns the key and is allowed by its restrictions. Then verify again."
          : error instanceof ProviderError ? error.message : "Secure storage could not complete this change. Try again on your device." });
    } finally {
      if (operation.current === controller) operation.current = null;
      if (current()) setBusy(false);
    }
  };
  const buttonStyle = { minHeight: 48, justifyContent: "center" as const, paddingVertical: spacing.sm };
  const storageNotice = <View style={{ gap: spacing.sm }}>
    {!onboarding && <Text style={type.bodySoft}>{Platform.OS === "web" ? "On your phone, the Owner’s keys are shared across profiles and sent to Google. Provider limits and charges apply." : "Keys are shared on this device and sent to Google. Provider limits and charges apply."}</Text>}
    {storageState === "checking" ? <ActivityIndicator accessibilityLabel="Checking secure storage" color={palette.active} /> : storageState === "error" || (storageState === "unavailable" && Platform.OS !== "web") ? <SettingsRow title="Try secure storage again" summary={storageState === "error" ? "Key status couldn’t load." : unavailableKeyStorageMessage(false)} busy={status.isFetching} onPress={() => { void status.refetch(); }} navigation={false} /> : storageState === "unavailable" ? <Text style={type.bodySoft}>{unavailableKeyStorageMessage(true)}</Text> : null}
  </View>;
  const setupLink = (provider: KeyProvider, guide = false) => <SettingsRow title={guide ? "Google’s setup instructions" : provider === "youtube" ? "Open Google Cloud" : "Open Google AI Studio"} disabled={busy} accessibilityRole="link" onPress={() => { setDraft(""); setEditing(null); setMessage(null); void Linking.openURL(guide ? setupGuideLinks[provider] : setupLinks[provider]).catch(() => { if (alive.current && profile.current === activeProfileId && AppState.currentState === "active") setMessage({ provider, text: "Couldn’t open the provider’s setup page." }); }); }} />;
  const guidance = (provider: KeyProvider) => <View style={{ gap: spacing.sm }}>{setupGuidance(provider).map((step, index) => <Text key={step} style={type.bodySoft}>{index + 1}. {step}</Text>)}{setupLink(provider, true)}</View>;
  if (activeProfile?.role !== "owner") return <View style={{ gap: spacing.md }}>
    {onboarding && <Heading level={1} style={type.title}>Your connections.</Heading>}
    <Text style={type.bodySoft}>Switch to the Owner profile to manage the keys used on this device.</Text>
  </View>;
  if (onboarding) {
    return <View style={{ gap: spacing.sm }}>
      <ConnectionWalkthrough provider={selectedProvider} youtubeGuide={youtubeGuide} onYouTubeGuideChange={onYouTubeGuideChange}
        saved={storageReady && Boolean(status.data?.[selectedProvider])} editable={storageReady}
        draft={inputKeys[selectedProvider]} busy={busy} feedback={message}
        onChange={(value) => { setInputKeys(previous => ({ ...previous, [selectedProvider]: value })); setMessage(null); }}
        onSave={(provider) => { void act(provider, "save"); }} />
      {!storageReady && storageNotice}
    </View>;
  }
  if (!storageReady) return <View style={{ gap: spacing.md }}>
    <Heading style={type.heading}>{Platform.OS === "web" ? "Set up on your phone" : "Device connections"}</Heading>
    <Text style={type.bodySoft}>YouTube supplies videos and channel details. Gemini is optional and helps find new sources.</Text>
    {storageNotice}
  </View>;
  return <View style={{ gap: spacing.lg }}>
    <SettingsGroup label="Connections">
      {KEY_PROVIDERS.filter(provider => !editing || editing === provider).map(provider => <View key={provider}>
        {!editing && <SettingsRow grouped last={provider === "gemini"} title={provider === "youtube" ? "YouTube" : "Gemini"}
          summary={`${provider === "youtube" ? "Videos and channels" : "AI discovery · optional"}${status.data?.[provider] ? " · Key saved" : ""}`}
          value={status.data?.[provider] ? "Manage key" : "Add key"}
          disabled={busy || editing !== null}
          onPress={() => { void act(provider, "edit"); }} testID={`key-edit-${provider}`} />}
        {message?.provider === provider ? <Text style={[type.bodySoft, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]} accessibilityLiveRegion="polite" testID={`key-feedback-${provider}`}>{message.text}</Text> : null}
        {editing === provider ? <View style={{ gap: spacing.sm, padding: spacing.md }}>
          <Heading style={type.heading}>{status.data?.[provider] ? "Replace" : "Add"} {provider === "youtube" ? "YouTube" : "Gemini"} key</Heading>
          <Text style={type.bodySoft}>{status.data?.[provider] ? "Your current key stays in place until the new one verifies." : "Paste your key below. We’ll check it before saving."}</Text>
          <TextField value={draft} onChangeText={(value) => { setDraft(value); setMessage(null); }} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no" maxLength={MAX_PROVIDER_KEY_LENGTH} editable={!busy} accessibilityLabel={`${provider} API key`} placeholder="Paste your API key" placeholderTextColor={palette.inkMuted} testID={`key-input-${provider}`}  />
          <TvKeyEntryTip />

          <PrimaryAction depth={palette.primaryButtonDepth} disabled={busy || !storageReady || !draft.trim()} accessibilityState={{ disabled: busy || !storageReady || !draft.trim(), busy }} accessibilityRole="button" style={[buttonStyle, { alignItems: "center", borderRadius: radii.control, backgroundColor: palette.accentDeep, opacity: busy || !storageReady || !draft.trim() ? 0.5 : 1 }]} onPress={() => { void act(provider, "save"); }} testID={`key-save-${provider}`}><Text style={[type.label, { color: palette.onDark }]}>{busy ? "Checking…" : "Verify & save"}</Text></PrimaryAction>
          <Pressable disabled={busy} accessibilityRole="button" style={buttonStyle} onPress={() => { setDraft(""); setEditing(null); setMessage(null); }}><Text style={type.label}>Cancel</Text></Pressable>
          <InlineHelp label={`How to get a ${provider === "youtube" ? "YouTube" : "Gemini"} key`}>{guidance(provider)}{setupLink(provider)}</InlineHelp>
          <InfoDisclosure label="About key verification" anchor={<Text style={type.bodySoft}>Verification doesn’t generate AI content.</Text>}>
            <Text style={type.bodySoft}>Verification makes one provider request.{provider === "gemini" ? " It checks access to Frame’s configured model. Generation limits and billing are checked when you request picks." : " It checks access to public YouTube channel data."} A saved key is not a guarantee of future access.</Text>
          </InfoDisclosure>
        {storageReady && status.data?.[provider] ? <Pressable disabled={busy} accessibilityRole="button" style={buttonStyle} onPress={() => confirmUser("Remove this key from Frame?", "All profiles on this device will lose access to this connection. The key stays active at Google.", "Remove key", (accepted) => { if (accepted) void act(provider, "remove"); }, true)} testID={`key-remove-${provider}`}><Text style={[type.label, { color: palette.danger }]}>Remove key from device</Text></Pressable> : null}
        </View> : null}
      </View>)}
    </SettingsGroup>
    <View style={{ gap: spacing.xs }}>
      <InfoDisclosure label="Key storage and removal" anchor={<Text style={type.bodySoft}>{localKeyPreview ? "Keys last until you refresh this tab." : "Keys are shared on this device."}</Text>}>
        <Text style={type.bodySoft}>{localKeyPreview ? "Refresh or close this local preview to clear both keys. You can revoke a key at Google." : "Keys are kept in secure storage. Remove or replace them here; erasing Frame data removes both keys. Removing a key from Frame does not revoke it at Google. Secure storage cannot protect a key on a compromised device."}</Text>
      </InfoDisclosure>
      <Text style={type.bodySoft}>Keys are sent to Google. Provider limits and charges apply.</Text>
    </View>
  </View>;
}
