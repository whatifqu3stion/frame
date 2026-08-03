import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type {
  YouTubePlaybackState,
  YouTubePlayerError,
  YouTubePlayerHandle,
  YouTubePlayerProps,
} from "@/components/YouTubePlayer.types";

const API_SCRIPT_ID = "frame-youtube-iframe-api";
const API_SCRIPT_URL = "https://www.youtube.com/iframe_api";

const STATE_MAP: Record<number, YouTubePlaybackState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getIframe: () => HTMLIFrameElement;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayerInstance };
type YouTubeStateEvent = YouTubePlayerEvent & { data: number };
type YouTubeErrorEvent = YouTubePlayerEvent & { data: number };

type YouTubePlayerOptions = {
  videoId: string;
  host: string;
  playerVars: Record<string, number | string>;
  events: {
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange: (event: YouTubeStateEvent) => void;
    onError: (event: YouTubeErrorEvent) => void;
  };
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }

  interface Document {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
  }
}

let iframeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = (): void => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API loaded without a player constructor."));
    };

    const existingScript = document.getElementById(API_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");
    const handleError = (): void => reject(new Error("YouTube API could not be loaded."));
    script.addEventListener("error", handleError, { once: true });
    if (!existingScript) {
      script.id = API_SCRIPT_ID;
      script.src = API_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    iframeApiPromise = null;
    throw error;
  });

  return iframeApiPromise;
}

function youtubeError(code?: number): YouTubePlayerError {
  if (code === 100) return { code, message: "This video was removed or is private." };
  if (code === 101 || code === 150) return { code, message: "This creator does not allow this video to play inside Frame." };
  if (code === 153) return { code, message: "YouTube could not verify this player. Please retry or open the video in YouTube." };
  if (code === 2) return { code, message: "This YouTube link is not valid." };
  if (code === 5) return { code, message: "This video could not play in this browser." };
  return { code, message: "The player could not load this video." };
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  props,
  ref,
) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const stateRef = useRef<YouTubePlaybackState>("unstarted");
  const callbacksRef = useRef<YouTubePlayerProps>(props);
  callbacksRef.current = props;

  const reportProgress = useCallback((): void => {
    const player = playerRef.current;
    if (!player) return;
    try {
      callbacksRef.current.onProgress(
        Math.max(0, Number(player.getCurrentTime()) || 0),
        Math.max(0, Number(player.getDuration()) || 0),
      );
    } catch {
      // A player can disappear between a route change and the final progress poll.
    }
  }, []);

  const exitFullscreen = useCallback((): void => {
    const exit = document.exitFullscreen?.bind(document) ?? document.webkitExitFullscreen?.bind(document);
    if (exit) void Promise.resolve(exit()).catch(() => {});
  }, []);

  useImperativeHandle(ref, () => ({
    pause: (): void => {
      playerRef.current?.pauseVideo();
      reportProgress();
    },
    play: (): void => playerRef.current?.playVideo(),
    seekTo: (seconds: number): void => {
      playerRef.current?.seekTo(Math.max(0, Math.floor(seconds)), true);
      reportProgress();
    },
    requestProgress: reportProgress,
    exitFullscreen,
  }), [exitFullscreen, reportProgress]);

  useEffect(() => {
    let disposed = false;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    const target = targetRef.current;
    if (!target) return undefined;

    void loadIframeApi()
      .then((YT) => {
        if (disposed || !targetRef.current) return;
        const origin = window.location.origin;
        const player = new YT.Player(targetRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId: props.videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            fs: 1,
            playsinline: 1,
            rel: 0,
            start: Math.max(0, Math.floor(props.startSeconds)),
            origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              const iframe = event.target.getIframe();
              iframe.setAttribute("title", "YouTube video player");
              iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
              iframe.setAttribute("allowfullscreen", "true");
              iframe.style.width = "100%";
              iframe.style.height = "100%";
              iframe.style.border = "0";
              callbacksRef.current.onReady(Math.max(0, Number(event.target.getDuration()) || 0));
              reportProgress();
              progressTimer = setInterval(() => {
                if (stateRef.current === "playing") reportProgress();
              }, 1000);
            },
            onStateChange: (event) => {
              if (disposed) return;
              const nextState = STATE_MAP[event.data] ?? "unstarted";
              stateRef.current = nextState;
              reportProgress();
              callbacksRef.current.onStateChange(nextState);
              if (nextState === "ended") callbacksRef.current.onEnded();
            },
            onError: (event) => {
              if (!disposed) callbacksRef.current.onError(youtubeError(Number(event.data) || undefined));
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!disposed) callbacksRef.current.onError({ message: "YouTube could not be reached. Check your connection and retry." });
      });

    return () => {
      disposed = true;
      if (progressTimer) clearInterval(progressTimer);
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
      stateRef.current = "unstarted";
    };
  }, [props.startSeconds, props.videoId, reportProgress]);

  useEffect(() => {
    const reportConnectivity = (): void => callbacksRef.current.onConnectivityChange(navigator.onLine !== false);
    reportConnectivity();
    window.addEventListener("online", reportConnectivity);
    window.addEventListener("offline", reportConnectivity);
    return () => {
      window.removeEventListener("online", reportConnectivity);
      window.removeEventListener("offline", reportConnectivity);
    };
  }, []);

  useEffect(() => {
    const reportFullscreen = (): void => {
      const fullscreenElement = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      let isPlayerFullscreen = false;
      try {
        isPlayerFullscreen = fullscreenElement === playerRef.current?.getIframe();
      } catch {}
      callbacksRef.current.onFullscreenChange(isPlayerFullscreen);
    };
    document.addEventListener("fullscreenchange", reportFullscreen);
    document.addEventListener("webkitfullscreenchange", reportFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", reportFullscreen);
      document.removeEventListener("webkitfullscreenchange", reportFullscreen);
    };
  }, []);

  return React.createElement(
    "div",
    {
      style: { width: "100%", height: "100%", backgroundColor: "#000" },
      "data-testid": "youtube-player",
    },
    React.createElement("div", { ref: targetRef, style: { width: "100%", height: "100%" } }),
  );
});

export default YouTubePlayer;
