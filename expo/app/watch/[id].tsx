import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { Bookmark, ChevronLeft, ListPlus, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { SAMPLE_VIDEOS } from "@/constants/sampleData";
import { palette, spacing, type } from "@/constants/theme";
import { upsertResume, getResume, clearResume } from "@/db/database";
import { useApp } from "@/providers/AppProvider";
import { formatDuration, formatRelativeDate } from "@/services/youtube";
import type { Video } from "@/types";

const { width: SCREEN_W } = Dimensions.get("window");

const PLAYER_HTML = (videoId: string, startSeconds: number) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#player{position:absolute;inset:0}</style>
</head><body>
<div id="player"></div>
<script>
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
  var player, lastPosted = -1;
  function post(msg){ if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(msg));} }
  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: '${videoId}',
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 1, fs: 1, iv_load_policy: 3, start: ${Math.floor(startSeconds)} },
      events: {
        onReady: function(e){ post({type:'ready'}); setInterval(function(){ try { var t = player.getCurrentTime(); if (Math.abs(t-lastPosted) >= 1) { lastPosted = t; post({type:'time', t:t}); } } catch(e){} }, 1500); },
        onStateChange: function(e){ post({type:'state', s:e.data}); }
      }
    });
  }
  window.addEventListener('message', function(ev){
    try { var d = JSON.parse(ev.data); if (d.cmd==='play') player.playVideo(); if (d.cmd==='pause') player.pauseVideo(); if (d.cmd==='seek') player.seekTo(d.t, true); } catch(e){}
  });
</script>
</body></html>`;

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedVideos, saveVideo, unsaveVideo, requirePurchase, prefs } = useApp();

  const video: Video | undefined = useMemo(() => {
    return savedVideos.find((v) => v.id === id) ?? SAMPLE_VIDEOS.find((v) => v.id === id);
  }, [id, savedVideos]);

  const [startAt, setStartAt] = useState<number>(0);
  const [resumeReady, setResumeReady] = useState<boolean>(false);
  const [ended, setEnded] = useState<boolean>(false);
  const currentTimeRef = useRef<number>(0);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    getResume(id).then((r) => {
      if (!mounted) return;
      setStartAt(r?.timestampSeconds ?? 0);
      setResumeReady(true);
    }).catch(() => mounted && setResumeReady(true));
    return () => { mounted = false; };
  }, [id]);

  const persist = useCallback(async () => {
    if (!video) return;
    const t = currentTimeRef.current;
    if (!prefs.hasPurchased) return;
    if (t > 5 && (video.durationSeconds === 0 || t < video.durationSeconds - 5)) {
      await upsertResume(video, t);
    }
  }, [video, prefs.hasPurchased]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void persist();
    });
    return () => sub.remove();
  }, [persist]);

  useEffect(() => () => { void persist(); }, [persist]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type: string; t?: number; s?: number };
      if (data.type === "time" && typeof data.t === "number") {
        currentTimeRef.current = data.t;
      }
      if (data.type === "state" && data.s === 0) {
        setEnded(true);
        if (video && prefs.hasPurchased) void clearResume(video.id);
      }
    } catch {}
  };

  const isSaved = video ? savedVideos.some((v) => v.id === video.id) : false;

  const toggleSave = async () => {
    if (!video) return;
    if (!isSaved) {
      if (!requirePurchase()) return;
      await saveVideo(video);
    } else {
      await unsaveVideo(video.id);
    }
  };

  const onAddToQueue = () => {
    if (!video) return;
    if (!requirePurchase()) return;
    router.push({ pathname: "/add-to-queue", params: { id: video.id } });
  };

  const onRewatch = () => {
    setEnded(false);
    webRef.current?.injectJavaScript("try{player.seekTo(0,true);player.playVideo();}catch(e){};true;");
  };

  if (!video) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.wall, justifyContent: "center", padding: spacing.lg }}>
        <Text style={type.heading}>Video unavailable</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={[type.caption, { color: palette.accent }]}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.wall }}>
      <View style={[styles.playerWrap, { width: SCREEN_W, height: (SCREEN_W * 9) / 16, marginTop: insets.top }]}>
        {resumeReady && (
          <WebView
            ref={webRef}
            originWhitelist={["*"]}
            source={{ html: PLAYER_HTML(video.id, startAt), baseUrl: "https://www.youtube-nocookie.com" }}
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            onMessage={onMessage}
            style={{ backgroundColor: "#000" }}
          />
        )}
        <Pressable onPress={() => router.back()} style={[styles.backFab, { top: insets.top + spacing.sm }]} hitSlop={12} testID="watch-back">
          <BlurView intensity={Platform.OS === "ios" ? 60 : 90} tint="dark" style={styles.backFabBlur}>
            <ChevronLeft color={palette.wall} size={22} />
          </BlurView>
        </Pressable>
        {ended && (
          <View style={styles.endedOverlay}>
            <Text style={[type.caption, { color: palette.wall, opacity: 0.7 }]}>The end</Text>
            <Text style={[type.title, { color: palette.wall, marginTop: spacing.sm, textAlign: "center" }]}>That's it.</Text>
            <Pressable onPress={onRewatch} style={styles.rewatchBtn} testID="rewatch">
              <RotateCcw size={14} color={palette.wall} strokeWidth={1.6} />
              <Text style={[type.label, { color: palette.wall }]}>Watch again</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={type.caption}>{video.channelTitle}</Text>
        <Text style={[type.title, { marginTop: spacing.sm }]}>{video.title}</Text>
        <Text style={[type.caption, { marginTop: spacing.md, color: palette.inkMuted }]}>
          {formatRelativeDate(video.publishedAt)} · {formatDuration(video.durationSeconds)}
        </Text>

        <View style={styles.actionRow}>
          <Pressable onPress={toggleSave} style={styles.actionBtn} testID="action-save">
            <Bookmark size={16} color={isSaved ? palette.accent : palette.ink} strokeWidth={1.6} fill={isSaved ? palette.accent : "transparent"} />
            <Text style={[type.label, isSaved && { color: palette.accent }]}>{isSaved ? "Saved" : "Save"}</Text>
          </Pressable>
          <Pressable onPress={onAddToQueue} style={styles.actionBtn} testID="action-queue">
            <ListPlus size={16} color={palette.ink} strokeWidth={1.6} />
            <Text style={type.label}>Add to queue</Text>
          </Pressable>
        </View>

        {video.description ? (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={type.caption}>Notes</Text>
            <Text style={[type.body, { marginTop: spacing.sm, color: palette.inkSoft }]}>{video.description}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push({ pathname: "/channel/[id]", params: { id: video.channelId } })}
          style={styles.channelLink}
        >
          <Text style={type.caption}>Channel</Text>
          <Text style={[type.heading, { marginTop: spacing.xs }]}>{video.channelTitle}</Text>
          <Text style={[type.caption, { color: palette.accent, marginTop: spacing.md }]}>View channel →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  playerWrap: { backgroundColor: "#000", position: "relative" },
  backFab: { position: "absolute", left: spacing.md, overflow: "hidden" },
  backFabBlur: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  rewatchBtn: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(250,249,246,0.4)",
  },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: palette.surface,
  },
  channelLink: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: palette.surface,
  },
});
