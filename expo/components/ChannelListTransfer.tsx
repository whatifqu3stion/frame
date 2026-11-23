import AsyncStorage from "@react-native-async-storage/async-storage";
import ChoiceOption from "./ChoiceOption";
import { readDiscoveryBrief } from "@/domain/discoveryBrief";
import { CUSTOM_INTEREST_LIMIT, isCustomInterest } from "@/domain/interests";
import { addedInterests, exportProfile, parseProfile, type ProfileTransfer } from "@/domain/profileTransfer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, View } from "react-native";
import Text from "@/components/FrameText";
import TextField from "@/components/TextField";
import SettingsRow from "@/components/SettingsRow";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useApp } from "@/providers/AppProvider";
import { channelListId, ChannelListError } from "@/domain/channelList";
import { listTransferFiles, pickChannelFile, readTransferFile, saveChannelFile, type TransferFolder } from "@/services/channelListFiles";
import type { Profile } from "@/models/profile";

type ImportView = { kind: "folder"; contents: TransferFolder } | { kind: "paste" } | { kind: "review"; file: ProfileTransfer };
const quantity = (n: number) => `${n} ${n === 1 ? "channel" : "channels"}`;

export default function ChannelListTransfer({ profile }: { profile: Profile }) {
  const { followedChannels, sourcesLoading, sourcesError, importProfile, interests, authorizeProtectedAction, hasOwnerPin, isOwnerAuthorized } = useApp();
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ["discovery-brief", profile.id], networkMode: "always", queryFn: () => readDiscoveryBrief(AsyncStorage, profile.id) });
  const [choice, setChoice] = useState<"device" | "file" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const room = Math.max(0, CUSTOM_INTEREST_LIMIT - interests.filter(topic => isCustomInterest(topic.id)).length);
  const exportable = followedChannels.filter(channel => channelListId.test(channel.id));
  const { type, palette } = useFrameTheme();
  const { busy, run, capture } = useScreenAction(profile.id);
  const [step, setStep] = useState<ImportView | null>(null);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);
  function close() {
    setStep(null);
    setDraft("");
    setMessage("");
    setShowAll(false);
  }
  function read(text: string) {
    const file = parseProfile(text);
    const { custom } = addedInterests(interests, file.interests);
    setChoice(null);
    setSelected(custom.length <= room ? custom.map(topic => topic.id) : []);
    setStep({ kind: "review", file });
    setShowAll(false);
    setDraft("");
  }
  function act(action: (current: () => boolean) => Promise<void>) {
    const current = capture();
    setMessage("");
    void run(async () => {
      try { await action(current); }
      catch (error) {
        if (current()) setMessage(error instanceof ChannelListError ? error.message : "Couldn’t finish the transfer. Check the file or folder and try again.");
      }
    }, () => {}, () => {});
  }
  function chooseFile() {
    act(async current => {
      if (Platform.isTV) {
        try {
          const contents = await listTransferFiles();
          if (current()) setStep({ kind: "folder", contents });
        } catch {
          if (current()) { setStep({ kind: "paste" }); setMessage("The transfer folder couldn’t open. You can paste Markdown here."); }
        }
      } else {
        const text = await pickChannelFile();
        if (text !== null && current()) read(text);
      }
    });
  }
  function exportFile() {
    act(async current => {
      if (profile.role === "managed" && !await authorizeProtectedAction(profile.id)) return;
      if (!current()) return;
      if (!saved.data) return;
      const text = exportProfile(profile.name, exportable, interests, saved.data);
      const name = profile.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 40) || "profile";
      const path = await saveChannelFile(`Frame-${name}-${Date.now()}.md`, text);
      if (current() && path) setMessage(`Exported ${profile.name}’s profile.\n${path}`);
    });
  }

  const ids = new Set(followedChannels.map(channel => channel.id));
  const incoming = step?.kind === "review" ? step.file.channels.filter(channel => !ids.has(channel.id)) : [];
  const { standard, custom } = addedInterests(interests, step?.kind === "review" ? step.file.interests : []);
  const conflict = step?.kind === "review" && step.file.brief !== null && step.file.brief !== saved.data;
  const selectedCustom = custom.filter(topic => selected.includes(topic.id));
  const changes = incoming.length + standard.length + selectedCustom.length > 0 || (conflict && choice === "file");
  if (profile.role === "managed" && (!hasOwnerPin || !isOwnerAuthorized)) {
    return <View style={{ gap: spacing.sm }}>
      <Text style={type.bodySoft}>{hasOwnerPin ? `Unlock Owner access to transfer ${profile.name}’s profile.` : "To transfer this viewer’s profile, add an Owner PIN in Settings under Profiles & viewing limits."}</Text>
      {hasOwnerPin && <SettingsRow title="Unlock Owner access" onPress={() => act(async () => { await authorizeProtectedAction(profile.id); })} disabled={busy} />}
    </View>;
  }
  if (saved.isError) return <SettingsRow title="Retry loading discovery wording" onPress={() => { void saved.refetch(); }} />;
  if (sourcesError) return <SettingsRow title="Retry loading channels" summary="Frame couldn’t open this profile’s library." busy={busy} onPress={() => act(async () => { await queryClient.refetchQueries({ queryKey: ["library", profile.id, "channels"] }); })} />;
  return <View style={{ gap: spacing.sm }}>
    {!step && <>
      <Text style={type.bodySoft}>Move {profile.name}’s channels, interests and discovery wording between devices. API keys and the Owner PIN stay on this device.</Text>
      <SettingsRow title="Export profile" summary="Save a Markdown file." onPress={exportFile} disabled={busy || sourcesLoading || !saved.isSuccess} />
      <SettingsRow title="Import into this profile" summary="Review what will be added." onPress={chooseFile} disabled={busy || sourcesLoading || !saved.isSuccess} />
    </>}
    {step?.kind === "folder" && <>
      <Text style={type.label}>Choose a Markdown file</Text>
      <Text style={type.bodySoft}>Use a TV file manager to copy your .md file from a USB drive into this folder, then refresh.</Text>
      <Text selectable style={type.body}>{step.contents.folder}</Text>
      <SettingsRow title="Paste Markdown instead" summary="Use the keyboard on your phone remote." onPress={() => { setStep({ kind: "paste" }); setMessage(""); }} disabled={busy} />
      {step.contents.files.map(name => <SettingsRow key={name} title={name} disabled={busy} onPress={() => act(async current => { const text = await readTransferFile(name); if (current()) read(text); })} />)}
      {!step.contents.files.length && <Text style={type.bodySoft}>No Markdown files in this folder yet.</Text>}
      <SettingsRow title="Refresh files" onPress={chooseFile} disabled={busy} navigation={false} />
    </>}
    {step?.kind === "paste" && <>
      <Text style={type.label}>Paste your exported Markdown</Text>
      <TextField value={draft} onChangeText={setDraft} multiline accessibilityLabel="Profile Markdown" placeholder="Paste exported Markdown" />
      <SettingsRow title="Review import" disabled={!draft.trim() || busy} onPress={() => act(async () => read(draft))} />
    </>}
    {step?.kind === "review" && <>
      <Text style={type.label}>Merge into {profile.name}</Text>
      <Text style={type.bodySoft}>{profile.role === "managed" ? "Existing choices and Owner viewing permissions stay in place." : "Existing channels and interests stay in place."}</Text>
      <Text style={type.label}>{quantity(incoming.length)} to add</Text>
      {(showAll ? incoming : incoming.slice(0, 3)).map(channel => <Text key={channel.id} style={type.body}>{channel.title}</Text>)}
      {incoming.length > 3 && <SettingsRow title={showAll ? "Show fewer" : `See all ${incoming.length} channels`} onPress={() => setShowAll(!showAll)} disabled={busy} navigation={false} />}
      {standard.length > 0 && <Text style={type.body}>New interests · {standard.map(topic => topic.name).join(", ")}</Text>}
      {custom.length > 0 && (custom.length <= room ? <Text style={type.body}>New custom interests · {custom.map(topic => topic.name).join(", ")}</Text> : <>
        <Text style={type.label}>{room ? `Choose up to ${room} custom interests` : "Your custom interests are full"}</Text>
        <Text style={type.bodySoft}>Each profile has room for eight. You can still import the other settings.</Text>
        {room > 0 && custom.map(topic => <ChoiceOption key={topic.id} role="checkbox" label={topic.name} selected={selected.includes(topic.id)} disabled={busy || (!selected.includes(topic.id) && selected.length >= room)}
          onPress={() => setSelected(ids => ids.includes(topic.id) ? ids.filter(id => id !== topic.id) : [...ids, topic.id])} />)}
      </>)}
      {conflict && <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <Text style={type.label}>Which discovery wording should Frame use?</Text>
        <ChoiceOption label="Keep this device’s wording" detail={saved.data} selected={choice === "device"} disabled={busy} onPress={() => setChoice("device")} />
        <ChoiceOption label="Use the file’s wording" detail={step.file.brief!} selected={choice === "file"} disabled={busy} onPress={() => setChoice("file")} />
      </View>}
      {!conflict && !changes && <Text style={type.bodySoft}>This profile already has everything it can add from this file.</Text>}
      {(changes || conflict) && <SettingsRow title="Confirm import" busy={busy} disabled={conflict && !choice} onPress={() => act(async current => {
        await importProfile(profile.id, step.file.channels, [...standard, ...selectedCustom], conflict && choice === "file" ? { previous: saved.data!, next: step.file.brief! } : undefined);
        if (current()) { close(); setMessage(`Import complete for ${profile.name}.`); }
      })} /> }
    </>}
    {step && <SettingsRow title={step.kind === "review" && !changes && !conflict ? "Done" : "Cancel"} navigation={false} onPress={close} disabled={busy} />}
    {!!message && <Text accessibilityLiveRegion="polite" role="status" selectable style={[type.body, { color: palette.ink }]}>{message}</Text>}
  </View>;
}
