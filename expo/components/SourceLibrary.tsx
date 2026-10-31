import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import { motion } from "@/constants/motion";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowRight, Square } from "lucide-react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import ChoiceOption from "@/components/ChoiceOption";
import TextField from "@/components/TextField";
import InlineHelp from "@/components/InlineHelp";
import MediaImage from "@/components/MediaImage";
import { listTodaySourceRules } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { LIBRARY_ONLY_UNTIL } from "@/domain/today";
import { planSourceParticipation } from "@/domain/sourceParticipation";

type Filter = "all" | "included" | "library";

export default function SourceLibrary() {
  const { activeProfileId } = useApp();
  return <ProfileSourceLibrary key={activeProfileId} />;
}

function ProfileSourceLibrary() {
  const { activeProfileId, followedChannels, sourcesLoading, changeSourceRule } = useApp();
  const { palette, type } = useFrameTheme();
  const rules = useQuery({ queryKey: ["today-rules", activeProfileId, followedChannels.length], networkMode: "always", queryFn: () => listTodaySourceRules(activeProfileId) });
  const knownSources = useRef<Set<string> | null>(null);
  const [arrivals, setArrivals] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (sourcesLoading) return;
    const next = new Set(followedChannels.map((channel) => channel.id));
    if (knownSources.current) setArrivals(new Set([...next].filter((id) => !knownSources.current!.has(id))));
    knownSources.current = next;
  }, [followedChannels, sourcesLoading]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const byId = new Map((rules.data ?? []).map((rule) => [rule.sourceId, rule]));
  const included = (id: string) => (byId.get(id)?.mutedUntil ?? 0) <= Date.now();
  const canInclude = followedChannels.some((channel) => selected.has(channel.id) && !included(channel.id));
  const canExclude = followedChannels.some((channel) => selected.has(channel.id) && byId.get(channel.id)?.mutedUntil !== LIBRARY_ONLY_UNTIL);
  const count = followedChannels.filter((channel) => included(channel.id)).length;
  const matches = followedChannels.filter((channel) => channel.title.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || (filter === "included" ? included(channel.id) : !included(channel.id))));
  const lastPage = Math.max(0, Math.ceil(matches.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = matches.slice(currentPage * 20, (currentPage + 1) * 20);
  const actionStyle = { minHeight: 48, justifyContent: "center" as const, paddingVertical: spacing.sm };
  const toggle = (id: string) => setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const apply = async (include: boolean) => {
    if (locked.current || !rules.data) return;
    locked.current = true; setBusy(true); setMessage("");
    let changed = 0;
    try {
      // Reload before planning so a stale list cannot silently exceed the limit.
      const latest = await listTodaySourceRules(activeProfileId);
      if (!alive.current) return;
      const changes = planSourceParticipation(activeProfileId, followedChannels.map((channel) => channel.id), latest, [...selected], include, Date.now());
      for (const rule of changes) {
        if (!alive.current) return;
        if (!await changeSourceRule(rule)) throw new Error("Change wasn’t authorized. Unlock the Owner profile and try again.");
        changed++;
        if (!alive.current) return;
        setSelected((previous) => { const next = new Set(previous); next.delete(rule.sourceId); return next; });
      }
      if (alive.current) {
        setSelected(new Set());
        setMessage(changed ? `${changed} ${changed === 1 ? "source" : "sources"} ${include ? "included for the next daily selection" : "moved to Library only"}.` : "No changes needed.");
      }
    } catch (error) {
      if (alive.current) setMessage(`${changed ? `${changed} saved. ` : ""}${error instanceof Error ? error.message : "Couldn’t save all changes. Try again."}`);
    } finally {
      locked.current = false;
      if (alive.current) { setBusy(false); void rules.refetch(); }
    }
  };
  return <View style={{ gap: spacing.sm }}>
    {rules.isError ? <><Text style={type.bodySoft}>Today settings couldn’t load.</Text><Pressable accessibilityRole="button" style={actionStyle} onPress={() => { void rules.refetch(); }}><Text style={type.label}>Try again</Text></Pressable></> : <Text style={type.bodySoft} accessibilityLiveRegion="polite">{rules.data ? `${count}/${PRODUCT_LIMITS.sourceFeedMaxSources} sources included in Today` : "Loading Today settings…"}</Text>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Filter followed sources">
      {(["all", "included", "library"] as const).map((value) => <ChoiceOption key={value} label={value === "all" ? "All" : value === "included" ? "Included" : "Library only"} selected={filter === value} disabled={busy || !rules.data} onPress={() => { setFilter(value); setPage(0); }} />)}
    </View>
    {followedChannels.length > 20 ? <TextField value={search} onChangeText={(value) => { setSearch(value); setPage(0); }} placeholder="Find a source" accessibilityLabel="Find a followed source" editable={!busy} /> : null}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: managing, disabled: busy || !rules.data }} disabled={busy || !rules.data} style={actionStyle} onPress={() => { setManaging(!managing); setSelected(new Set()); setMessage(""); }}><Text style={[type.label, { color: palette.active }]}>{managing ? "Done managing" : "Manage Today sources"}</Text></Pressable>
      {managing ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{selected.size} selected{busy ? " · Saving…" : ""}</Text> : null}
    </View>
    {managing ? <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg }}>
        <Pressable accessibilityRole="button" disabled={busy || rows.length === 0} style={actionStyle} onPress={() => setSelected((previous) => new Set([...previous, ...rows.map((row) => row.id)]))}><Text style={[type.label, { color: palette.active }]}>Select this page</Text></Pressable>
        {selected.size > 0 ? <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setSelected(new Set())}><Text style={[type.label, { color: palette.active }]}>Clear selection</Text></Pressable> : null}
      </View>
      {selected.size > 0 ? <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg }}>
          {[true, false].map((include) => {
            const disabled = busy || !(include ? canInclude : canExclude);
            return <Pressable key={String(include)} accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} style={[actionStyle, { opacity: disabled ? 0.5 : 1 }]} onPress={() => { void apply(include); }}><Text style={[type.label, { color: palette.active }]}>{include ? "Include in Today" : "Move to Library only"}</Text></Pressable>;
          })}
        </View>
        <Text style={type.bodySoft}>{canInclude && canExclude ? "Include: next daily selection. Library only: removed from Today now." : canInclude ? "Applies to the next daily selection." : "Removes their videos from Today now. Sources stay followed."}</Text>
      </> : null}
    </View> : null}
    {message ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text> : null}
    {rows.map((channel) => managing ? <ChoiceOption key={channel.id} role="checkbox" variant="ruled" unselectedMark={<Square size={16} color={palette.inkMuted} />} label={`${channel.title} · ${included(channel.id) ? "Included" : "Library only"}`} selected={selected.has(channel.id)} disabled={busy} onPress={() => toggle(channel.id)} /> : <MotionView key={channel.id} changeKey={arrivals.has(channel.id)} active={arrivals.has(channel.id)} distance={12} duration={motion.artwork}><Pressable testID={`source-${channel.id}`} accessibilityRole="button" accessibilityLabel={`Open ${channel.title} source`} onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderSoft }}>
      <MediaImage source={channel.thumbnailUrl ? { uri: channel.thumbnailUrl } : null} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" cachePolicy="none" />
      <View style={{ flex: 1 }}><Text style={type.label}>{channel.title}</Text><Text style={type.bodySoft}>{!rules.data ? "" : included(channel.id) ? "Included in Today" : "Library only"}</Text></View><ArrowRight size={17} color={palette.inkMuted} />
    </Pressable></MotionView>)}
    {matches.length === 0 ? <Text style={type.bodySoft}>No sources match this view.</Text> : null}
    {matches.length > 20 ? <View><Text style={type.bodySoft}>{currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, matches.length)} of {matches.length} sources</Text><View style={{ flexDirection: "row", gap: spacing.lg }}>{currentPage > 0 ? <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setPage(currentPage - 1)}><Text style={type.label}>Previous</Text></Pressable> : null}{currentPage < lastPage ? <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setPage(currentPage + 1)}><Text style={type.label}>Next</Text></Pressable> : null}</View></View> : null}
    {!managing ? <InlineHelp label="How Today sources work"><Text style={type.bodySoft}>Include up to {PRODUCT_LIMITS.sourceFeedMaxSources} sources. Library-only sources stay followed and can be browsed anytime. Including a source applies to the next daily selection.</Text></InlineHelp> : null}
  </View>;
}
