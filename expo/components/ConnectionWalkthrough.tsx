import PrimaryAction from "@/components/PrimaryAction";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { ArrowUpRight } from "lucide-react-native";
import Heading from "@/components/Heading";
import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { KeyProvider } from "@/storage/providerKeys";

const instructions = {
  youtube: {
    name: "YouTube",
    title: "Connect YouTube.",
    purpose: "Your key lets Frame find creators and bring their videos into your library.",
    steps: [
      { title: "Enable video access", detail: "Open Google Cloud, choose a project or create one, then select Enable. If it’s already enabled, return here to continue.", link: "Open YouTube Data API v3", url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com", next: "I’ve enabled the API" },
      { title: "Create your key", detail: "In the same project, open Credentials and choose Create credentials → API key. Restrict it to YouTube Data API v3, then copy the key.", link: "Open Credentials", url: "https://console.cloud.google.com/apis/credentials", next: "Enter YouTube key" },
    ],
  },
  gemini: {
    name: "Gemini",
    title: "Add personal picks.",
    purpose: "Gemini uses your interests to suggest creators and review their videos. This key is optional.",
    steps: [
      { title: "Create your Gemini key", detail: "In Google AI Studio, choose Create API key, select your project, and copy the new key.", link: "Open Google AI Studio", url: "https://aistudio.google.com/api-keys", next: "Enter Gemini key" },
    ],
  },
};

type Props = {
  youtube: boolean;
  gemini: boolean;
  editing: KeyProvider | null;
  draft: string;
  busy?: boolean;
  preview?: boolean;
  weeklyPicksRequested?: boolean;
  youtubeGuide?: "credentials";
  onYouTubeGuideChange?(step: "credentials" | undefined): void;
  feedback?: { provider: KeyProvider; text: string } | null;
  onChange(value: string): void;
  onEdit(provider: KeyProvider): void;
  onSave(provider: KeyProvider): void;
  onCancel(): void;
};

export default function ConnectionWalkthrough(props: Props) {
  const { palette, type } = useFrameTheme();
  const [wantsPicks, setWantsPicks] = useState(false);
  const provider = !props.youtube ? "youtube" : !props.gemini ? "gemini" : null;
  if (!provider) return <View style={styles.section} accessibilityLiveRegion="polite">
    <Heading level={1} style={[type.title, styles.title]}>You’re connected.</Heading>
    <Text style={[type.bodySoft, styles.body]}>{props.preview ? "Both sample connections are ready." : "Your YouTube and Gemini keys are saved on this device."}</Text>
  </View>;
  if (provider === "gemini" && !wantsPicks && !props.weeklyPicksRequested) return <View style={styles.section}>
    <Heading level={1} style={[type.title, styles.title]}>{props.preview ? "YouTube connected in preview." : "YouTube is connected."}</Heading>
    <Text style={[type.bodySoft, styles.body]}>Paste a YouTube video link to watch, or choose a creator to follow.</Text>
    <Pressable accessibilityRole="button" onPress={() => setWantsPicks(true)} style={styles.link}>
      <Text style={[type.label, { color: palette.active }]}>Connect Gemini for weekly picks</Text>
    </Pressable>
  </View>;
  return <ProviderStep key={provider} {...props} provider={provider} />;
}

function ProviderStep({ provider, editing, draft, busy = false, preview, feedback, youtubeGuide, onYouTubeGuideChange, onChange, onEdit, onSave, onCancel }: Props & { provider: KeyProvider }) {
  const { palette, type } = useFrameTheme();
  const [step, setStep] = useState(provider === "youtube" && youtubeGuide === "credentials" ? 1 : 0);
  const move = (next: number) => {
    setLinkError(false); setStep(next);
    if (provider === "youtube") onYouTubeGuideChange?.(next === 1 ? "credentials" : undefined);
  };
  const [linkError, setLinkError] = useState(false);
  const guide = instructions[provider];
  const instruction = guide.steps[step];
  const entering = editing === provider;
  const last = step === guide.steps.length - 1;
  const disabled = busy || (entering && !draft.trim());

  return <View style={styles.section}>
    {provider === "gemini" && <Text accessibilityLiveRegion="polite" style={[type.label, { color: palette.active }]}>{preview ? "YouTube connected in preview" : "YouTube connected"}</Text>}
    <Heading level={1} style={[type.title, styles.title]}>{guide.title}</Heading>
    <Text style={[type.bodySoft, styles.body]}>{guide.purpose}</Text>
    <View style={[styles.task, { borderColor: palette.borderSoft }]}>
      <Text accessibilityLiveRegion="polite" style={type.caption}>{guide.name} setup · {entering ? guide.steps.length + 1 : step + 1} of {guide.steps.length + 1}</Text>
      <Heading style={type.heading}>{entering ? `Your ${guide.name} API key` : instruction.title}</Heading>
      {entering ? <>
        <TextField editable={!busy && !preview} secureTextEntry value={draft} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no" maxLength={256} accessibilityLabel={`${guide.name} API key`} placeholder="Paste your key here" testID={`key-input-${provider}`} />
        <Text style={type.bodySoft}>{preview ? "A sample key is filled in. Nothing is saved or sent to Google." : "Frame checks your key with Google and saves it securely on this device. Profiles share the key. Google’s usage limits and charges apply."}</Text>
        {!preview && provider === "gemini" && <Text style={type.bodySoft}>Generation access is checked when you request picks.</Text>}
      </> : <>
        <Text style={[type.body, styles.instruction]}>{instruction.detail}</Text>
        <Pressable accessibilityRole="link" disabled={busy} style={styles.externalLink} onPress={() => {
          setLinkError(false);
          void Linking.openURL(instruction.url).catch(() => setLinkError(true));
        }}><Text style={[type.label, { color: palette.active }]}>{instruction.link}</Text><ArrowUpRight size={15} color={palette.active} /></Pressable>
        {linkError && <Text accessibilityLiveRegion="polite" style={type.bodySoft}>Couldn’t open Google. Try the link again.</Text>}
      </>}
      {feedback?.provider === provider && <Text accessibilityLiveRegion="polite" testID={`key-feedback-${provider}`} style={type.bodySoft}>{feedback.text}</Text>}
      <PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" accessibilityState={{ busy, disabled }} disabled={disabled} testID={entering ? `key-save-${provider}` : undefined}
        style={[styles.primary, { backgroundColor: palette.accentDeep, opacity: disabled ? 0.55 : 1 }]}
        onPress={() => {
          if (entering) onSave(provider);
          else if (last) onEdit(provider);
          else move(step + 1);
        }}>
        <Text style={[type.label, { color: palette.onDark }]}>{busy ? "Checking…" : entering ? preview ? "Try verification" : "Verify & save" : instruction.next}</Text>
      </PrimaryAction>
      {(entering || !last || step > 0) && <Pressable accessibilityRole="button" disabled={busy} style={styles.link} onPress={() => {
        if (entering) onCancel();
        else if (step === 0) onEdit(provider);
        else move(step - 1);
      }}><Text style={[type.label, { color: palette.active }]}>{entering ? "Back to instructions" : step === 0 ? preview ? "Use a sample key" : "I already have a key" : "Show the previous step"}</Text></Pressable>}
    </View>
    {preview && !entering && <Text style={type.caption}>Preview with a sample key. No Google account needed.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, paddingTop: spacing.sm },
  title: { fontSize: 36, lineHeight: 43 },
  body: { fontSize: 18, lineHeight: 26, maxWidth: 490 },
  task: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  instruction: { fontSize: 17, lineHeight: 25, maxWidth: 490 },
  primary: { minHeight: 50, alignItems: "center", justifyContent: "center", padding: spacing.sm, borderRadius: radii.control },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  externalLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
});
