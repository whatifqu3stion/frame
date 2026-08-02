import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type {
  YouTubePlaybackState,
  YouTubePlayerHandle,
  YouTubePlayerProps,
} from "@/components/YouTubePlayer.types";

const STATE_MAP: Record<number, YouTubePlaybackState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, startSeconds, onReady, onProgress, onStateChange, onEnded, onError, onFullscreenChange },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const origin = typeof window === "undefined" ? "https://rork.com" : window.location.origin;
  const src = useMemo<string>(() => {
    const params = new URLSearchParams({
      autoplay: "0",
      controls: "1",
      enablejsapi: "1",
      fs: "1",
      playsinline: "1",
      rel: "0",
      start: String(Math.max(0, Math.floor(startSeconds))),
      origin,
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }, [origin, startSeconds, videoId]);

  const command = useCallback((func: string, args: number[] = []): void => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
  }, []);

  useImperativeHandle(ref, () => ({
    pause: () => command("pauseVideo"),
    play: () => command("playVideo"),
    seekTo: (seconds: number) => command("seekTo", [Math.max(0, Math.floor(seconds)), 1]),
  }), [command]);

  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (!event.origin.includes("youtube")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) as {
          event?: string;
          info?: { currentTime?: number; duration?: number; playerState?: number } | number;
        } : null;
        if (!data) return;
        if (data.event === "onReady") {
          onReady(0);
          return;
        }
        if (data.event === "infoDelivery" && typeof data.info === "object") {
          onProgress(data.info.currentTime ?? 0, data.info.duration ?? 0);
          if (typeof data.info.playerState === "number") {
            const state = STATE_MAP[data.info.playerState] ?? "unstarted";
            onStateChange(state);
            if (state === "ended") onEnded();
          }
          return;
        }
        if (data.event === "onError") {
          onError({ code: typeof data.info === "number" ? data.info : undefined, message: "This video could not play in Frame." });
        }
      } catch {}
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onEnded, onError, onProgress, onReady, onStateChange]);

  useEffect(() => {
    const reportFullscreen = (): void => {
      onFullscreenChange(document.fullscreenElement === iframeRef.current);
    };
    document.addEventListener("fullscreenchange", reportFullscreen);
    return () => document.removeEventListener("fullscreenchange", reportFullscreen);
  }, [onFullscreenChange]);

  const handleLoad = useCallback((): void => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "frame-player" }), "https://www.youtube-nocookie.com");
    onReady(0);
  }, [onReady]);

  return React.createElement("iframe", {
    ref: iframeRef,
    src,
    title: "YouTube video player",
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share",
    allowFullScreen: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    onLoad: handleLoad,
    onError: () => onError({ message: "YouTube could not be reached. Check your connection and retry." }),
    style: { width: "100%", height: "100%", border: 0, backgroundColor: "#000" },
    "data-testid": "youtube-player",
  });
});

export default YouTubePlayer;
