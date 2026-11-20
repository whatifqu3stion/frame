import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { ArrowUpRight, CheckCircle2, Circle, KeyRound } from "lucide-react-native";
import SectionTabs from "@/components/SectionTabs";
import { localKeyPreview } from "@/storage/providerKeyStore";
import type { ProviderKeyState } from "@/domain/providerKeyStatus";
import Heading from "@/components/Heading";
import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import PrimaryAction from "@/components/PrimaryAction";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { MAX_PROVIDER_KEY_LENGTH, type KeyProvider } from "@/storage/providerKeys";

const guides = {
  youtube: {
    name: "YouTube",
    purpose: "Brings videos from your creators into Frame.",
    steps: [
      { title: "Enable YouTube Data API v3", image: require("../assets/key-guide/youtube-enable.png"), ratio: 1030 / 510, detail: "Select your project and tap Enable. Already enabled? Continue.", link: "API Library", url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com" },
      { title: "Create an API key", image: require("../assets/key-guide/youtube-create.png"), ratio: 1018 / 480, detail: "In Credentials, select Create credentials → API key.", link: "Credentials", url: "https://console.cloud.google.com/apis/credentials" },
      { title: "Restrict and copy", image: require("../assets/key-guide/youtube-copy.png"), ratio: 1110 / 526, detail: "Edit the key, restrict it to YouTube Data API v3, then save and copy it.", link: "Credentials", url: "https://console.cloud.google.com/apis/credentials" },
    ],
  },
  gemini: {
    name: "Gemini",
    purpose: "Finds video picks around your interests.",
    steps: [
      { title: "Open API keys", image: require("../assets/key-guide/gemini-create.png"), ratio: 695 / 183, detail: "In Google AI Studio, select Create API key.", link: "AI Studio", url: "https://aistudio.google.com/api-keys" },
      { title: "Choose your project", image: require("../assets/key-guide/gemini-project.png"), ratio: 970 / 372, detail: "Choose or import your project, create the key, then copy it into Frame.", link: "AI Studio", url: "https://aistudio.google.com/api-keys" },
    ],
  },
};

type GuideProps = {
  provider: KeyProvider;
  youtubeGuide?: "credentials";
  onYouTubeGuideChange?(step: "credentials" | undefined): void;
};

export function KeyGuide({ provider, youtubeGuide, onYouTubeGuideChange }: GuideProps) {
  const { palette, type } = useFrameTheme();
  const restoring = provider === "youtube" && youtubeGuide === "credentials";
  const [open, setOpen] = useState(restoring);
  const [index, setIndex] = useState(restoring ? 1 : 0);
  const [linkError, setLinkError] = useState(false);
  const guide = guides[provider];
  const step = guide.steps[index];
  function move(next: number) {
    setIndex(next);
    setLinkError(false);
    if (provider === "youtube") onYouTubeGuideChange?.(next >= 1 ? "credentials" : undefined);
  }
  function toggle() {
    setOpen(!open);
    if (open) move(0);
  }
  const linkText = [type.label, { color: palette.active }];
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} onPress={toggle} style={styles.link}>
      <Text style={linkText}>How to get a {guide.name} key</Text><DisclosureIndicator expanded={open} color={palette.active} />
    </Pressable>
    {open && <View style={[styles.guide, { borderColor: palette.borderSoft }]}>
      <View style={styles.guideHeading}><Text style={type.label}>{step.title}</Text><Text style={type.caption} accessibilityLiveRegion="polite">{index + 1} / {guide.steps.length}</Text></View>
      <View style={[styles.picture, { aspectRatio: step.ratio }]}><Image accessible={false} source={step.image} resizeMode="contain" style={{ width: "100%", height: "100%" }} /></View>
      <Text style={type.bodySoft}>{step.detail}</Text>
      {index === guide.steps.length - 1 && <Text style={type.caption}>Google’s usage limits and charges apply.</Text>}
      <View style={styles.guideNav}>
        <Pressable accessibilityRole="link" onPress={() => { setLinkError(false); void Linking.openURL(step.url).catch(() => setLinkError(true)); }} style={styles.link}>
          <Text style={linkText}>{step.link}</Text><ArrowUpRight size={15} color={palette.active} />
        </Pressable>
        <View style={styles.pager}>
          {index > 0 && <Pressable accessibilityRole="button" onPress={() => move(index - 1)} style={styles.link}><Text style={linkText}>Back</Text></Pressable>}
          <Pressable accessibilityRole="button" onPress={index + 1 === guide.steps.length ? toggle : () => move(index + 1)} style={styles.link}>
            <Text style={linkText}>{index + 1 === guide.steps.length ? "Close guide" : "Next"}</Text>
          </Pressable>
        </View>
      </View>
      {linkError && <Text accessibilityLiveRegion="polite" style={type.bodySoft}>Couldn’t open Google. Try the link again.</Text>}
    </View>}
  </View>;
}

type Presence = { youtube: boolean; gemini: boolean };
export function ConnectionHeader({ provider, presence, storageState, busy, showTitle, onSelect }: {
  provider: KeyProvider; presence: Presence; storageState: ProviderKeyState; busy: boolean; showTitle: boolean; onSelect(value: KeyProvider): void;
}) {
  const { palette, type } = useFrameTheme();
  return <View style={{ gap: spacing.md }}>
    {showTitle && <Heading level={1} style={type.title}>Connect Frame.</Heading>}
    <SectionTabs<KeyProvider> label="Provider connections" value={provider} onChange={onSelect} disabled={busy}
      tabs={(["youtube", "gemini"] as const).map(id => {
        const saved = storageState === "ready" && presence[id];
        const name = guides[id].name;
        const status = storageState === "checking" ? "Checking status" : storageState !== "ready" ? "Unavailable" : saved ? "Key verified" : "No key";
        return { value: id, label: name, accessibilityLabel: name + ", " + status, indicator: saved
          ? <CheckCircle2 size={16} color={palette.success} fill={palette.success} stroke={palette.surfaceHigh} />
          : <Circle size={11} color={palette.inkMuted} /> };
      })} />
  </View>;
}

type Props = GuideProps & {
  saved: boolean; draft: string; busy: boolean; editable: boolean;
  feedback: { provider: KeyProvider; text: string } | null;
  onChange(value: string): void;
  onSave(provider: KeyProvider): void;
};

export default function ConnectionWalkthrough({ provider, saved, draft, busy, editable, feedback, onSave, onChange, ...guideProps }: Props) {
  const { palette, type } = useFrameTheme();
  const guide = guides[provider];
  const disabled = busy || !editable || !draft.trim();
  return <View style={styles.section}>
    <View style={styles.field}>
      <Text style={type.label}>{guide.name} API key</Text>
      <Text style={type.bodySoft}>{guide.purpose}</Text>
      <TextField leading={<KeyRound size={17} color={palette.inkMuted} />} secureTextEntry value={draft} editable={editable && !busy}
        onChangeText={onChange} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" importantForAutofill="no"
        maxLength={MAX_PROVIDER_KEY_LENGTH} accessibilityLabel={guide.name + " API key"} placeholder={saved ? "Paste a replacement key" : "Paste your API key"} testID={"key-input-" + provider} />
      {editable && <Text style={type.caption}>Your keys power this demo. {localKeyPreview ? "This tab holds them until you refresh." : "They’re stored on your device."} We never see them.</Text>}
    </View>
    {feedback?.provider === provider && <Text accessibilityLiveRegion="polite" testID={"key-feedback-" + provider} style={type.bodySoft}>{feedback.text}</Text>}
    {editable && <PrimaryAction textured depth={palette.primaryButtonDepth} disabled={disabled} accessibilityState={{ busy, disabled }} onPress={() => onSave(provider)} testID={"key-save-" + provider} style={[styles.primary, { backgroundColor: palette.accentDeep, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[type.label, { color: palette.onDark }]}>{busy ? "Checking…" : localKeyPreview ? "Verify key" : "Verify & save"}</Text>
    </PrimaryAction>}
    <KeyGuide key={provider} provider={provider} {...guideProps} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  field: { gap: spacing.sm },
  primary: { minHeight: 48, marginTop: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.control },
  link: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  guide: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.xs },
  picture: { width: "100%", maxWidth: 360, alignSelf: "flex-start", marginVertical: spacing.xs, borderRadius: radii.small, overflow: "hidden" },
  guideHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  guideNav: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },
  pager: { flexDirection: "row", gap: spacing.md },
});
