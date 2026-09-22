export type YouTubePlaybackState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued";

export type YouTubePlayerError = {
  code?: number;
  message: string;
};

export type YouTubePlayerHandle = {
  pause: () => void;
  play: () => void;
  seekTo: (seconds: number) => void;
  requestProgress: () => void;
  exitFullscreen: () => void;
};

export type YouTubePlayerProps = {
  videoId: string;
  startSeconds: number;
  onReady: (durationSeconds: number) => void;
  onProgress: (currentSeconds: number, durationSeconds: number) => void;
  onStateChange: (state: YouTubePlaybackState) => void;
  onEnded: () => void;
  onError: (error: YouTubePlayerError) => void;
  onFullscreenChange: (isFullscreen: boolean) => void;
  onConnectivityChange: (isOnline: boolean) => void;
  onOpenExternal: (url: string) => Promise<void>;
};
