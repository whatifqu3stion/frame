import { parsePlayerBridgeMessage } from "@/domain/playerBridge";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";
import type {
  YouTubePlaybackState,
  YouTubePlayerError,
  YouTubePlayerHandle,
  YouTubePlayerProps,
} from "@/components/YouTubePlayer.types";

const PLAYER_ORIGIN = "https://frame-video-viewer-backend.rork.app";
const VALID_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const STATE_MAP: Record<number, YouTubePlaybackState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued",
};

function playerHtml(videoId: string, startSeconds: number): string {
  const safeId = VALID_VIDEO_ID.test(videoId) ? videoId : "";
  const safeStart = Math.max(0, Math.floor(Number.isFinite(startSeconds) ? startSeconds : 0));
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>html,body,#player{margin:0;padding:0;background:#000;width:100%;height:100%;overflow:hidden}</style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player = null;
    var timer = null;
    var lastPosted = -1;
    var isFullscreen = false;
    var isOnline = navigator.onLine !== false;
    function post(message) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
    function reportFullscreen(nextFullscreen) {
      var next = !!nextFullscreen;
      if (next === isFullscreen) return;
      isFullscreen = next;
      post({ type: 'fullscreen', isFullscreen: next });
    }
    function reportConnectivity(nextOnline) {
      var next = !!nextOnline;
      isOnline = next;
      post({ type: 'connectivity', isOnline: next });
    }
    function stopProgressTimer() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
    function startProgressTimer() {
      if (timer) return;
      timer = setInterval(reportProgress, 1000);
    }
    function disposePlayer() {
      stopProgressTimer();
      exitFullscreen();
      reportFullscreen(false);
      try {
        if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
        if (player && typeof player.destroy === 'function') player.destroy();
      } catch (error) {}
      player = null;
    }
    function detectFullscreen() {
      reportFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    }
    function reportProgress() {
      if (!player || typeof player.getCurrentTime !== 'function') return;
      try {
        var current = Number(player.getCurrentTime()) || 0;
        var duration = Number(player.getDuration()) || 0;
        if (Math.abs(current - lastPosted) >= 0.75) {
          lastPosted = current;
          post({ type: 'progress', current: current, duration: duration });
        }
      } catch (error) {}
    }
    function exitFullscreen() {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen();
          return;
        }
        if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } catch (error) {}
    }
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        host: 'https://www.youtube-nocookie.com',
        videoId: ${JSON.stringify(safeId)},
        playerVars: {
          autoplay: 0,
          controls: 1,
          enablejsapi: 1,
          fs: 1,
          playsinline: 1,
          rel: 0,
          start: ${safeStart},
          origin: ${JSON.stringify(PLAYER_ORIGIN)}
        },
        events: {
          onReady: function() {
            var duration = Number(player.getDuration()) || 0;
            post({ type: 'ready', duration: duration });
            reportConnectivity(navigator.onLine !== false);
          },
          onStateChange: function(event) {
            reportProgress();
            if (event.data === 1) startProgressTimer();
            else stopProgressTimer();
            post({ type: 'state', state: event.data });
          },
          onError: function(event) {
            post({ type: 'error', code: Number(event.data) || 0 });
          }
        }
      });
    }
    window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    document.addEventListener('fullscreenchange', detectFullscreen);
    document.addEventListener('webkitfullscreenchange', detectFullscreen);
    document.addEventListener('webkitbeginfullscreen', function() { reportFullscreen(true); }, true);
    document.addEventListener('webkitendfullscreen', function() { reportFullscreen(false); }, true);
    window.addEventListener('online', function() { reportConnectivity(true); });
    window.addEventListener('offline', function() { reportConnectivity(false); });
    window.addEventListener('pagehide', disposePlayer);
    window.addEventListener('beforeunload', disposePlayer);
    reportConnectivity(navigator.onLine !== false);
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = function() { post({ type: 'shellError' }); };
    document.head.appendChild(tag);
  </script>
</body>
</html>`;
}

function youtubeError(code?: number): YouTubePlayerError {
  if (code === 100) return { code, message: "This video was removed or is private." };
  if (code === 101 || code === 150) return { code, message: "This creator does not allow this video to play inside Frame." };
  if (code === 153) return { code, message: "The video service could not verify this player. Try again or open the original video." };
  if (code === 2) return { code, message: "This video link is not valid." };
  if (code === 5) return { code, message: "This video could not play on this device." };
  return { code, message: "The player couldn’t load this video. Try again or open the original video." };
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, startSeconds, onReady, onProgress, onStateChange, onEnded, onError, onFullscreenChange, onConnectivityChange, onOpenExternal },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo<string>(() => playerHtml(videoId, startSeconds), [videoId, startSeconds]);

  const runCommand = useCallback((command: string): void => {
    webViewRef.current?.injectJavaScript(`try{if(player){${command}}}catch(error){};true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    pause: () => runCommand("player.pauseVideo();reportProgress();"),
    play: () => runCommand("player.playVideo();"),
    seekTo: (seconds: number) => runCommand(`player.seekTo(${Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))},true);reportProgress();`),
    requestProgress: () => runCommand("reportProgress();"),
    exitFullscreen: () => runCommand("exitFullscreen();"),
  }), [runCommand]);

  const handleMessage = useCallback((event: WebViewMessageEvent): void => {
    try {
      const data = parsePlayerBridgeMessage(event.nativeEvent.data);
      if (!data) return;
      if (data.type === "ready") {
        onReady(data.duration ?? 0);
        return;
      }
      if (data.type === "progress") {
        onProgress(data.current ?? 0, data.duration ?? 0);
        return;
      }
      if (data.type === "state" && typeof data.state === "number") {
        const nextState = STATE_MAP[data.state] ?? "unstarted";
        onStateChange(nextState);
        if (nextState === "ended") onEnded();
        return;
      }
      if (data.type === "error") {
        onError(youtubeError(data.code));
        return;
      }
      if (data.type === "fullscreen" && typeof data.isFullscreen === "boolean") {
        onFullscreenChange(data.isFullscreen);
        return;
      }
      if (data.type === "connectivity" && typeof data.isOnline === "boolean") {
        onConnectivityChange(data.isOnline);
        return;
      }
      if (data.type === "shellError") onError({ message: "The video service could not be reached. Check your connection and try again." });
    } catch {
      onError({ message: "The video player couldn’t respond. Try again." });
    }
  }, [onConnectivityChange, onEnded, onError, onFullscreenChange, onProgress, onReady, onStateChange]);

  useEffect(() => {
    const mountedWebView = webViewRef.current;
    return () => {
      mountedWebView?.injectJavaScript("try{exitFullscreen();disposePlayer();reportFullscreen(false);}catch(error){};true;");
    };
  }, []);

  const handleWebViewError = useCallback((_event: WebViewErrorEvent): void => {
    onError({ message: "The video service could not be reached. Check your connection and try again." });
  }, [onError]);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent): void => {
    onError({ code: event.nativeEvent.statusCode, message: "The video service couldn’t load the player. Try again." });
  }, [onError]);

  const shouldStart = useCallback((request: ShouldStartLoadRequest): boolean => {
    const url = request.url;
    if (url === "about:blank") return true;
    try {
      const parsed = new URL(url);
      const isFrameOrigin = parsed.origin === PLAYER_ORIGIN;
      const isTrustedYouTube = parsed.protocol === "https:"
        && (parsed.hostname === "www.youtube.com" || parsed.hostname === "www.youtube-nocookie.com");
      if (isFrameOrigin) return true;
      if (request.isTopFrame === false && isTrustedYouTube) return true;
      if (isTrustedYouTube) void onOpenExternal(url);
    } catch {}
    return false;
  }, [onOpenExternal]);

  return (
    <WebView
      ref={webViewRef}
      source={{ html, baseUrl: PLAYER_ORIGIN }}
      originWhitelist={[PLAYER_ORIGIN, "https://www.youtube.com", "https://www.youtube-nocookie.com", "about:blank"]}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      onMessage={handleMessage}
      onError={handleWebViewError}
      onHttpError={handleHttpError}
      onContentProcessDidTerminate={() => onError({ message: "The player stopped unexpectedly. Please retry." })}
      onRenderProcessGone={() => onError({ message: "The player stopped unexpectedly. Please retry." })}
      onShouldStartLoadWithRequest={shouldStart}
      style={styles.webView}
      testID="youtube-player"
    />
  );
});

export default YouTubePlayer;

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: "#000" },
});

