import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronRight, Key, Link2, Lock, LogOut, RefreshCw, RotateCcw, Shield, Trash2, UserCircle2 } from "lucide-react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddChannelModal from "@/components/AddChannelModal";
import ScreenHeader from "@/components/ScreenHeader";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { palette, spacing, type } from "@/constants/theme";
import { useApp } from "@/providers/AppProvider";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    interests,
    toggleInterest,
    prefs,
    setApiKey,
    setPaywallOpen,
    markPurchased,
    wipeAllData,
    googleConfigured,
    googleConnected,
    googleEmail,
    importing,
    signInWithGoogle,
    signOutGoogle,
    refreshSubscriptions,
    followedChannels,
  } = useApp();
  const [apiInput, setApiInput] = useState<string>(prefs.youtubeApiKey ?? "");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [accountBusy, setAccountBusy] = useState<boolean>(false);

  const onConnect = async () => {
    setAccountBusy(true);
    const result = await signInWithGoogle();
    setAccountBusy(false);
    Alert.alert(result.ok ? "Connected" : "Sign-in", result.message);
  };

  const onRefresh = async () => {
    setAccountBusy(true);
    const result = await refreshSubscriptions();
    setAccountBusy(false);
    Alert.alert(result.ok ? "Synced" : "Sync", result.message);
  };

  const onSignOut = () => {
    Alert.alert("Sign out?", "Imported channels stay on your shelf. You can sign in again anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOutGoogle() },
    ]);
  };

  const onSaveKey = async () => {
    await setApiKey(apiInput);
    Alert.alert("Saved", apiInput ? "YouTube API key updated." : "API key cleared. Sample content will be used.");
  };

  const onWipe = () => {
    Alert.alert("Delete all data?", "This removes saved videos, queues, resume positions and preferences.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => wipeAllData() },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.wall }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader eyebrow="Settings" title={"Frame\nsettings."} />
      </View>

      <Section label="Account" hint="Optional. Bring in the channels you already follow.">
        {googleConnected ? (
          <>
            <View style={styles.accountRow}>
              <UserCircle2 size={20} color={palette.accent} strokeWidth={1.6} />
              <View style={{ flex: 1 }}>
                <Text style={type.label} numberOfLines={1}>{googleEmail ?? "Google account"}</Text>
                <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>
                  {followedChannels.length} channel{followedChannels.length === 1 ? "" : "s"} on your shelf
                </Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              <Pressable onPress={onRefresh} style={styles.accountBtn} disabled={accountBusy || importing} testID="refresh-subs">
                {accountBusy || importing ? (
                  <ActivityIndicator size="small" color={palette.accent} />
                ) : (
                  <>
                    <RefreshCw size={14} color={palette.accent} strokeWidth={1.8} />
                    <Text style={[type.label, { color: palette.accent }]}>Refresh</Text>
                  </>
                )}
              </Pressable>
              <Pressable onPress={onSignOut} style={styles.accountBtn} testID="sign-out">
                <LogOut size={14} color={palette.inkMuted} strokeWidth={1.8} />
                <Text style={[type.label, { color: palette.inkMuted }]}>Sign out</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={onConnect} style={styles.cta} disabled={accountBusy || importing} testID="connect-google">
            {accountBusy || importing ? (
              <ActivityIndicator color={palette.wall} />
            ) : (
              <>
                <Text style={styles.ctaTitle}>Sign in with Google</Text>
                <Text style={styles.ctaSub}>
                  {googleConfigured ? "Import the channels you already follow." : "Needs setup — add your keys below to enable."}
                </Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable onPress={() => setAddOpen(true)} style={styles.linkRow} testID="settings-add-channel">
          <Link2 size={14} color={palette.accent} strokeWidth={1.8} />
          <Text style={[type.label, { color: palette.accent }]}>Add a channel by link</Text>
        </Pressable>
      </Section>

      <Section label="Purchase">
        {prefs.hasPurchased ? (
          <Row icon={<Lock size={16} color={palette.accent} strokeWidth={1.6} />} title="Frame unlocked" subtitle="Thank you. Everything is yours." />
        ) : (
          <Pressable onPress={() => setPaywallOpen(true)} style={styles.cta}>
            <Text style={styles.ctaTitle}>Unlock Frame</Text>
            <Text style={styles.ctaSub}>One-time purchase. No subscription.</Text>
          </Pressable>
        )}
        <Pressable onPress={() => markPurchased()} style={styles.linkRow}>
          <RotateCcw size={14} color={palette.inkMuted} strokeWidth={1.6} />
          <Text style={[type.caption, { color: palette.inkMuted }]}>Restore Purchase</Text>
        </Pressable>
      </Section>

      <Section label="Interests" hint="Seeds the Explore tab.">
        <View style={styles.interestsGrid}>
          {INTEREST_LIBRARY.map((i) => {
            const active = interests.some((s) => s.id === i.id);
            return (
              <Pressable
                key={i.id}
                onPress={() => toggleInterest(i.id)}
                style={[styles.interestChip, active && styles.interestChipActive]}
                testID={`interest-${i.id}`}
              >
                <Text style={[styles.interestEmoji, active && { color: palette.wall }]}>{i.emoji}</Text>
                <Text style={[styles.interestLabel, active && { color: palette.wall }]}>{i.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="YouTube" hint="Optional. Without a key, Frame uses a curated sample.">
        <View style={styles.apiRow}>
          <Key size={16} color={palette.inkMuted} strokeWidth={1.6} />
          <TextInput
            value={apiInput}
            onChangeText={setApiInput}
            placeholder="YouTube Data API v3 key"
            placeholderTextColor={palette.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showKey}
            style={styles.apiInput}
            testID="api-key-input"
          />
          <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={8}>
            <Text style={[type.caption, { color: palette.accent }]}>{showKey ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onSaveKey} style={styles.saveBtn} testID="save-api-key">
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </Section>

      <Section label="Privacy" hint="Frame is built to leave you alone.">
        <View style={styles.simpleRow}>
          <Shield size={16} color={palette.accent} strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Nothing leaves this device</Text>
            <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]}>
              No accounts, no analytics, no tracking. Embeds use youtube-nocookie.com.
            </Text>
          </View>
        </View>
      </Section>

      <Section label="Data">
        <Pressable onPress={onWipe} style={styles.dangerRow} testID="wipe-data">
          <Trash2 size={16} color="#8C3A2E" strokeWidth={1.6} />
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: "#8C3A2E" }]}>Delete all on-device data</Text>
            <Text style={[type.bodySoft, { color: palette.inkMuted, marginTop: 2 }]}>
              Saved, queues, resume, preferences.
            </Text>
          </View>
          <ChevronRight size={16} color={palette.inkMuted} />
        </Pressable>
      </Section>

      <Section label="About">
        <Text style={[type.bodySoft, { maxWidth: 320 }]}>
          Frame is a clean YouTube viewer. No accounts. No tracking. No autoplay. When a video ends, that's it.
        </Text>
        <Text style={[type.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>Version 1.0</Text>
      </Section>

      <AddChannelModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </ScrollView>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.caption}>{label}</Text>
      {hint ? <Text style={[type.bodySoft, { marginTop: spacing.xs }]}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.lg }}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={styles.simpleRow}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{title}</Text>
        {subtitle ? <Text style={[type.bodySoft, { marginTop: 2, color: palette.inkMuted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cta: {
    backgroundColor: palette.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  ctaTitle: { color: palette.wall, fontFamily: "Georgia", fontSize: 22 },
  ctaSub: { color: "rgba(250,249,246,0.7)", fontSize: 13, marginTop: spacing.xs },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: spacing.sm },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  accountActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  accountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: palette.surface,
  },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.surface,
  },
  interestChipActive: { backgroundColor: palette.ink },
  interestEmoji: { color: palette.accent, fontSize: 14 },
  interestLabel: { ...type.label, fontSize: 13 },
  apiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  apiInput: { flex: 1, ...type.body, padding: 0, fontSize: 14 },
  saveBtn: { marginTop: spacing.md, backgroundColor: palette.ink, paddingVertical: 14, alignItems: "center" },
  saveText: { color: palette.wall, fontFamily: "Georgia", fontSize: 15 },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
});
