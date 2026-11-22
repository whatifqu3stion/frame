import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import ActionReveal from "@/components/motion/ActionReveal";
import { isPointerActivation } from "@/components/motion/pointerActivation";
import { motion } from "@/constants/motion";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { ArrowRight, ChevronDown, ChevronUp, Square } from "lucide-react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import ChoiceOption from "@/components/ChoiceOption";
import TextField from "@/components/TextField";
import InfoDisclosure from "@/components/InfoDisclosure";
import MediaImage from "@/components/MediaImage";
import { listTodaySourceRules } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { radii, spacing } from "@/constants/theme";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { LIBRARY_ONLY_UNTIL } from "@/domain/today";
import { planSourceParticipation, sourceParticipationLabel } from "@/domain/sourceParticipation";

const filterLabels = { all: "All", included: "Included in Today", library: "Library only" } as const;
type Filter = keyof typeof filterLabels;

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [instantFilter, setInstantFilter] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const editButton = useRef<View>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const byId = new Map((rules.data ?? []).map((rule) => [rule.sourceId, rule]));
  const included = (id: string) => (byId.get(id)?.mutedUntil ?? 0) <= Date.now();
  const statusLabel = (id: string) => rules.data ? sourceParticipationLabel(byId.get(id)?.mutedUntil, Date.now()) : "";
  const includeCount = followedChannels.filter((channel) => selected.has(channel.id) && !included(channel.id)).length;
  const excludeCount = followedChannels.filter((channel) => selected.has(channel.id) && byId.get(channel.id)?.mutedUntil !== LIBRARY_ONLY_UNTIL).length;
  const count = followedChannels.filter((channel) => included(channel.id)).length;
  const matches = followedChannels.filter((channel) => channel.title.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || (filter === "included" ? included(channel.id) : !included(channel.id))));
  const lastPage = Math.max(0, Math.ceil(matches.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = matches.slice(currentPage * 20, (currentPage + 1) * 20);
  const visibleSelected = rows.filter((row) => selected.has(row.id)).length;
  const pageSelected = rows.length > 0 && visibleSelected === rows.length;
  const hiddenSelected = selected.size - visibleSelected;
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
        setManaging(false);
        if (Platform.OS === "web") requestAnimationFrame(() => editButton.current?.focus());
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
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <InfoDisclosure label="About Today inclusion" anchor={
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter followed sources: ${filterLabels[filter]}`}
            accessibilityState={{ expanded: filtersOpen, disabled: busy || !rules.data }} disabled={busy || !rules.data}
            aria-expanded={filtersOpen}
            onPress={event => { setInstantFilter(!isPointerActivation(event)); setFiltersOpen(open => !open); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={type.label}>{filter === "all" ? "All sources" : filterLabels[filter]}</Text>
            {filtersOpen ? <ChevronUp size={16} color={palette.inkMuted} /> : <ChevronDown size={16} color={palette.inkMuted} />}
          </Pressable>}>
          <Text style={type.bodySoft}>Today can pick videos from sources you include. You can browse library-only sources here anytime.</Text>
          {rules.data && <Text style={type.caption}>{count} of {PRODUCT_LIMITS.sourceFeedMaxSources} sources included in Today.</Text>}
        </InfoDisclosure>
      </View>
      <Pressable ref={editButton} accessibilityRole="button" accessibilityLabel={managing ? "Cancel selection" : "Edit Today sources"}
        accessibilityState={{ expanded: managing, disabled: busy || (!managing && !rules.data) }} disabled={busy || (!managing && !rules.data)} style={actionStyle}
        onPress={event => { if (filtersOpen) { setInstantFilter(!isPointerActivation(event)); setFiltersOpen(false); } setManaging(!managing); setSelected(new Set()); setMessage(""); }}>
        <Text style={[type.label, { color: palette.active }]}>{managing ? "Cancel" : "Edit Today"}</Text>
      </Pressable>
    </View>
    {rules.isError ? <><Text style={type.bodySoft}>Today settings couldn’t load.</Text><Pressable accessibilityRole="button" style={actionStyle} onPress={() => { void rules.refetch(); }}><Text style={type.label}>Try again</Text></Pressable></> : !rules.data && <Text style={type.bodySoft} accessibilityLiveRegion="polite">Loading Today settings…</Text>}
    <ActionReveal open={filtersOpen} instant={instantFilter} offset={-4}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Filter followed sources">
        {(["all", "included", "library"] as const).map((value) => <ChoiceOption key={value} variant="filter" testID={`source-filter-${value}`} label={filterLabels[value]} selected={filter === value} tabIndex={filtersOpen ? 0 : -1} focusable={filtersOpen} disabled={busy || !rules.data} onPress={() => { if (filtersOpen) { setFilter(value); setPage(0); } }} />)}
      </View>
    </ActionReveal>
    {followedChannels.length > 20 ? <TextField value={search} onChangeText={(value) => { setSearch(value); setPage(0); }} placeholder="Find a source" accessibilityLabel="Find a followed source" editable={!busy} /> : null}
    {managing && <View style={[styles.editor, { borderColor: palette.borderSoft }]}>
      <View style={styles.selectionHeader}>
        <Text style={type.label} accessibilityLiveRegion="polite">{busy ? "Saving changes…" : selected.size ? `${selected.size} selected` : "Choose sources"}</Text>
        {rows.length > 0 && <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => {
          setSelected((previous) => {
            const next = new Set(previous);
            for (const row of rows) {
              if (pageSelected) next.delete(row.id);
              else next.add(row.id);
            }
            return next;
          });
        }}>
          <Text style={[type.label, { color: palette.active }]}>
            {lastPage > 0 ? (pageSelected ? "Deselect page" : "Select page") : (pageSelected ? "Deselect all shown" : "Select all shown")}
          </Text>
        </Pressable>}
      </View>
      {hiddenSelected > 0 && <View style={styles.selectionHeader}>
        <Text style={type.caption}>{hiddenSelected} selected outside this view.</Text>
        <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setSelected(new Set())}>
          <Text style={[type.label, { color: palette.active }]}>Clear selection</Text>
        </Pressable>
      </View>}
      {selected.size === 0 ? <Text style={type.bodySoft}>Select the creators whose videos you want to include in or remove from Today.</Text> :
        <View style={styles.actions}>
          {([true, false] as const).map((include) => {
            const affected = include ? includeCount : excludeCount;
            if (!affected) return null;
            const label = include ? "Include in Today" : "Remove from Today";
            const detail = include ? "Available for the next daily selection." : "Videos leave Today now. Sources stay followed.";
            return <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
              accessibilityLabel={`${label}. ${affected} ${affected === 1 ? "source" : "sources"}. ${detail}`}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? palette.surfaceDeep : palette.surfaceHigh, borderColor: palette.border }]}
              onPress={() => { void apply(include); }}>
              <View style={styles.actionTitle}>
                <Text style={[type.label, { color: palette.active, flexShrink: 1 }]}>{label}</Text>
                {includeCount > 0 && excludeCount > 0 && <Text style={type.caption}>{affected} {affected === 1 ? "source" : "sources"}</Text>}
              </View>
              <Text style={type.caption}>{detail}</Text>
            </Pressable>;
          })}
        </View>}
    </View>}
    {message ? <Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text> : null}
    {rows.map((channel) => managing ? <ChoiceOption key={channel.id} role="checkbox" variant="ruled" unselectedMark={<Square size={16} color={palette.inkMuted} />} label={channel.title} detail={statusLabel(channel.id)} accessibilityLabel={`${channel.title}. ${statusLabel(channel.id)}`} selected={selected.has(channel.id)} disabled={busy} onPress={() => toggle(channel.id)} /> : <MotionView key={channel.id} changeKey={arrivals.has(channel.id)} active={arrivals.has(channel.id)} distance={12} duration={motion.artwork}><Pressable testID={`source-${channel.id}`} accessibilityRole="button" accessibilityLabel={[`Open ${channel.title} source`, statusLabel(channel.id)].filter(Boolean).join(". ")} onPress={() => router.push({ pathname: "/channel/[id]", params: { id: channel.id } })} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.borderSoft }}>
      <MediaImage source={channel.thumbnailUrl ? { uri: channel.thumbnailUrl } : null} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" cachePolicy="none" />
      <View style={{ flex: 1, gap: spacing.xs }}><Text style={type.label}>{channel.title}</Text><Text style={type.caption}>{statusLabel(channel.id)}</Text></View><ArrowRight size={17} color={palette.inkMuted} />
    </Pressable></MotionView>)}
    {matches.length === 0 ? <Text style={type.bodySoft}>No sources match this view.</Text> : null}
    {matches.length > 20 ? <View><Text style={type.bodySoft}>{currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, matches.length)} of {matches.length} sources</Text><View style={{ flexDirection: "row", gap: spacing.lg }}>{currentPage > 0 ? <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setPage(currentPage - 1)}><Text style={type.label}>Previous</Text></Pressable> : null}{currentPage < lastPage ? <Pressable accessibilityRole="button" disabled={busy} style={actionStyle} onPress={() => setPage(currentPage + 1)}><Text style={type.label}>Next</Text></Pressable> : null}</View></View> : null}
  </View>;
}


const styles = StyleSheet.create({
  editor: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.md, gap: spacing.xs },
  selectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 180, minHeight: 48, justifyContent: "center", gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderRadius: radii.control },
  actionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", columnGap: spacing.sm },
});
