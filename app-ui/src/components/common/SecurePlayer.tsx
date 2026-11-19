import { useEffect, useRef, useState } from "react";
import { getDesktopBridge } from "@/lib/desktop";

type Props = {
  url: string;
  title?: string;
  poster?: string | null;
  onEnded?: () => void;
  watermark?: string;
  startAt?: number;
  onProgress?: (info: { position: number; duration: number; deltaWatched: number; source?: string; isPlaying?: boolean }) => void;
  onPlaybackEvent?: (event: {
    type: "ready" | "start" | "pause" | "seek" | "complete" | "error";
    position: number;
    duration: number;
    source: string;
    note?: string;
  }) => void;
  progressIntervalMs?: number;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiLoading?: boolean;
  }
}

const loadYouTubeAPI = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return resolve();
    if (window.__ytApiLoading) {
      const i = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(i);
          resolve();
        }
      }, 50);
      return;
    }
    window.__ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });

const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
};

const extractVimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
};

const extractDriveId = (url: string): string | null => {
  // matches /file/d/{id}/  OR  ?id={id}  OR  /d/{id}
  const m1 = url.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m2) return m2[1];
  return null;
};

const isDriveUrl = (url: string) => /drive\.google\.com/i.test(url);

const isStorageRef = (url: string) => !url.startsWith("http");

// Direct media file we can play with <video>
const isDirectMedia = (url: string) =>
  /\.(mp4|webm|mov|mkv|m4v|m3u8)(\?|$)/i.test(url) || isStorageRef(url);

// Generic third-party embed URL (e.g. Bunny mediadelivery, custom players)
const isGenericEmbed = (url: string) =>
  /^https?:\/\//i.test(url) && /(mediadelivery\.net|bunnycdn\.com|iframe\.|player\.|\/embed\/)/i.test(url);

const normalizePlayerUrl = (input: string) => {
  const decoded = input
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
  const iframeMatch = decoded.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  const extracted = (iframeMatch ? iframeMatch[1] : decoded).trim();
  let normalized = extracted.replace(/^https?:\/\/player\.mediadelivery\.net\//i, "https://iframe.mediadelivery.net/");
  // Force safe Bunny Stream params so playback is reliable across browsers:
  // no autoplay (browsers force-mute autoplaying video → "no sound" reports),
  // audio unmuted, preload on so the video actually starts when clicked.
  if (/iframe\.mediadelivery\.net/i.test(normalized)) {
    try {
      const u = new URL(normalized);
      u.searchParams.set("autoplay", "false");
      u.searchParams.set("muted", "false");
      u.searchParams.set("preload", "true");
      u.searchParams.set("responsive", "true");
      u.searchParams.set("loop", "false");
      normalized = u.toString();
    } catch {}
  }
  return normalized;
};

export function SecurePlayer({ url, title, poster, onEnded, watermark, startAt, onProgress, onPlaybackEvent, progressIntervalMs = 10000 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const lastReportedRef = useRef<number>(0);
  const seekedRef = useRef<boolean>(false);
  const heartbeatPosRef = useRef<number>(startAt ?? 0);
  const heartbeatStartedRef = useRef<boolean>(false);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  const onPlaybackEventRef = useRef(onPlaybackEvent);
  const initialStartAtRef = useRef(startAt ?? 0);
  const block = (e: React.SyntheticEvent | Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    onEndedRef.current = onEnded;
    onProgressRef.current = onProgress;
    onPlaybackEventRef.current = onPlaybackEvent;
  }, [onEnded, onProgress, onPlaybackEvent]);

  // Immediately pause playback if Official Desktop App detects a screen-recording process
  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    return bridge.onSecurityStatus((status) => {
      if (status?.locked) {
        try {
          videoRef.current?.pause();
        } catch {}
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      }
    });
  }, []);

  // Listen for Bunny Stream / iframe postMessages (timeupdate, play, pause, ended)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch {}
        }
        if (!data || typeof data !== "object") return;
        const ev = data.event || data.type;
        const currentTime = data.currentTime ?? data.position ?? data.seconds;
        if (typeof currentTime === "number" && Number.isFinite(currentTime) && currentTime > 0) {
          heartbeatPosRef.current = currentTime;
        }
        if (ev === "ended" || ev === "complete") {
          onEndedRef.current?.();
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const toggleFullscreen = async () => {
    try {
      const el = wrapperRef.current as any;
      if (!el) return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        await req?.call(el);
      }
    } catch {}
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Manual sources (storage / direct file / vimeo) handled separately
  const playerUrl = normalizePlayerUrl(url);
  const ytId = extractYouTubeId(playerUrl);
  const vmId = extractVimeoId(playerUrl);
  const drId = isDriveUrl(playerUrl) ? extractDriveId(playerUrl) : null;
  const playerSource = ytId
    ? "youtube-api"
    : vmId
      ? "vimeo-iframe-fallback"
      : drId
        ? "drive-iframe-fallback"
        : playerUrl && isGenericEmbed(playerUrl) && !isDirectMedia(playerUrl)
          ? "bunny-or-embed-fallback"
          : "html5-video";

  const emitPlaybackEvent = (
    type: "ready" | "start" | "pause" | "seek" | "complete" | "error",
    details: { position?: number; duration?: number; source?: string; note?: string } = {},
  ) => {
    onPlaybackEventRef.current?.({
      type,
      position: Number.isFinite(details.position ?? 0) ? (details.position ?? 0) : 0,
      duration: Number.isFinite(details.duration ?? 0) ? (details.duration ?? 0) : 0,
      source: details.source ?? playerSource,
      note: details.note,
    });
  };

  // Initialize YouTube player programmatically (so the URL is never present
  // as a static `src` attribute the user can copy from the rendered HTML).
  useEffect(() => {
    if (!ytId || !containerRef.current) return;
    let destroyed = false;
    let removeListeners: (() => void) | null = null;

    (async () => {
      await loadYouTubeAPI();
      if (destroyed || !containerRef.current) return;
      // create a fresh mount point
      containerRef.current.innerHTML = "";
      const mount = document.createElement("div");
      mount.style.width = "100%";
      mount.style.height = "100%";
      containerRef.current.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: ytId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          controls: 1,
          disablekb: 1,
          showinfo: 0,
          cc_load_policy: 0,
          autohide: 1,
          color: "white",
          start: initialStartAtRef.current > 3 ? Math.floor(initialStartAtRef.current) : undefined,
        },
        events: {
          onReady: () => {
            setReady(true);
            emitPlaybackEvent("ready", { source: "youtube-api" });
            try {
              if (initialStartAtRef.current > 3) playerRef.current?.seekTo?.(Math.floor(initialStartAtRef.current), true);
            } catch {}
          },
          onStateChange: (e: any) => {
            // 0 = ended
            if (e.data === 0) {
              const position = playerRef.current?.getCurrentTime?.() ?? 0;
              const duration = playerRef.current?.getDuration?.() ?? 0;
              emitPlaybackEvent("complete", { position, duration, source: "youtube-api" });
              onEndedRef.current?.();
            }
            // 1 = playing
            if (e.data === 1) {
              lastTickRef.current = Date.now();
              emitPlaybackEvent("start", {
                position: playerRef.current?.getCurrentTime?.() ?? 0,
                duration: playerRef.current?.getDuration?.() ?? 0,
                source: "youtube-api",
              });
            } else {
              if (e.data === 2) {
                emitPlaybackEvent("pause", {
                  position: playerRef.current?.getCurrentTime?.() ?? 0,
                  duration: playerRef.current?.getDuration?.() ?? 0,
                  source: "youtube-api",
                });
              }
              lastTickRef.current = null;
            }
          },
        },
      });

      // After the YouTube iframe is created, harden it: strip target=_blank and
      // intercept any link clicks bubbling out to the parent document.
      requestAnimationFrame(() => {
        const iframe = containerRef.current?.querySelector("iframe");
        if (!iframe) return;
        // Remove any anchor-style attributes on the iframe wrapper
        iframe.setAttribute("title", title ?? "lesson");
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.setAttribute("allow", "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen");

        // Block context menu on the iframe element itself
        const onCtx = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        iframe.addEventListener("contextmenu", onCtx);
        // Also block middle-click (which opens a new tab from links)
        const onAux = (ev: MouseEvent) => {
          if (ev.button === 1) {
            ev.preventDefault();
            ev.stopPropagation();
          }
        };
        iframe.addEventListener("auxclick", onAux);
        removeListeners = () => {
          iframe.removeEventListener("contextmenu", onCtx);
          iframe.removeEventListener("auxclick", onAux as any);
        };
      });
    })();

    return () => {
      destroyed = true;
      removeListeners?.();
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [ytId, title]);

  // Periodic progress reporter — works for both YouTube and HTML5 video
  useEffect(() => {
    if (!onProgressRef.current) return;
    const id = setInterval(() => {
      try {
        let position = 0;
        let duration = 0;
        let isPlaying = false;
        if (ytId && playerRef.current?.getCurrentTime) {
          position = playerRef.current.getCurrentTime() ?? 0;
          duration = playerRef.current.getDuration?.() ?? 0;
          isPlaying = playerRef.current.getPlayerState?.() === 1;
        } else if (videoRef.current) {
          position = videoRef.current.currentTime ?? 0;
          duration = videoRef.current.duration ?? 0;
          isPlaying = !videoRef.current.paused && !videoRef.current.ended;
        } else {
          // Cross-origin iframe (Google Drive / Vimeo) — we cannot read the
          // real play position. Fall back to a heartbeat that counts time
          // while the tab is visible & focused as an approximation so admin
          // dashboards still show student activity.
          const visible = typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
          if (!visible) {
            lastTickRef.current = null;
            return;
          }
          isPlaying = true;
          if (!heartbeatStartedRef.current) {
            heartbeatStartedRef.current = true;
            emitPlaybackEvent("start", {
              position: heartbeatPosRef.current,
              duration: 0,
              source: playerSource,
              note: "iframe heartbeat fallback",
            });
          }
          heartbeatPosRef.current += progressIntervalMs / 1000;
          position = heartbeatPosRef.current;
          duration = 0;
        }
        const now = Date.now();
        let deltaWatched = 0;
        if (isPlaying && lastTickRef.current) {
          deltaWatched = Math.min((now - lastTickRef.current) / 1000, progressIntervalMs / 1000 + 2);
        }
        lastTickRef.current = isPlaying ? now : null;
        // ignore huge jumps (seek)
        if (Math.abs(position - lastReportedRef.current) > 30) {
          deltaWatched = 0;
          emitPlaybackEvent("seek", {
            position,
            duration,
            source: playerSource,
            note: `jump ${Math.round(position - lastReportedRef.current)}s`,
          });
        }
        lastReportedRef.current = position;
        onProgressRef.current?.({ position, duration, deltaWatched, source: playerSource, isPlaying });
      } catch {}
    }, progressIntervalMs);
    return () => clearInterval(id);
  }, [ytId, progressIntervalMs, playerSource]);

  // Save on unload
  useEffect(() => {
    if (!onProgressRef.current) return;
    const flush = () => {
      try {
        let position = 0; let duration = 0;
        if (ytId && playerRef.current?.getCurrentTime) {
          position = playerRef.current.getCurrentTime() ?? 0;
          duration = playerRef.current.getDuration?.() ?? 0;
        } else if (videoRef.current) {
          position = videoRef.current.currentTime ?? 0;
          duration = videoRef.current.duration ?? 0;
        } else if (heartbeatPosRef.current > 0) {
          position = heartbeatPosRef.current;
        }
        if (position > 0) onProgressRef.current?.({ position, duration, deltaWatched: 0, source: playerSource });
      } catch {}
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [ytId, playerSource]);

  // Document-level guard: while the player is mounted, intercept any window.open
  // call that points at youtube and block it. Also block links that try to open
  // youtube in a new tab via target="_blank".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalOpen = window.open;
    window.open = function (...args: any[]) {
      const target = String(args[0] ?? "");
      if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(target)) {
        return null;
      }
      return originalOpen.apply(window, args as any);
    } as any;

    const onClickCapture = (ev: MouseEvent) => {
      const path = ev.composedPath?.() ?? [];
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          const href = node.getAttribute("href") ?? "";
          if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(href)) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
          }
        }
      }
    };
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("auxclick", onClickCapture as any, true);

    return () => {
      window.open = originalOpen;
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("auxclick", onClickCapture as any, true);
    };
  }, []);

  // Stable iframe URLs: computed on mount and updated whenever playerUrl or vmId changes to a different video,
  // while remaining strictly immutable during playback of the same video.
  const lastVmIdRef = useRef<string | null>(null);
  const initialVimeoSrcRef = useRef<string | null>(null);
  if (lastVmIdRef.current !== vmId) {
    lastVmIdRef.current = vmId;
    initialStartAtRef.current = startAt ?? 0;
    heartbeatPosRef.current = startAt ?? 0;
    seekedRef.current = false;
    heartbeatStartedRef.current = false;
    if (vmId) {
      const sAt = startAt ?? 0;
      initialVimeoSrcRef.current = `https://player.vimeo.com/video/${vmId}?title=0&byline=0&portrait=0${sAt && sAt > 3 ? `#t=${Math.floor(sAt)}s` : ""}`;
    } else {
      initialVimeoSrcRef.current = null;
    }
  }

  const lastPlayerUrlRef = useRef<string | null>(null);
  const initialEmbedSrcRef = useRef<string | null>(null);
  if (lastPlayerUrlRef.current !== playerUrl) {
    lastPlayerUrlRef.current = playerUrl;
    initialStartAtRef.current = startAt ?? 0;
    heartbeatPosRef.current = startAt ?? 0;
    seekedRef.current = false;
    heartbeatStartedRef.current = false;
    if (playerUrl) {
      const sAt = startAt ?? 0;
      if (!sAt || sAt <= 3) {
        initialEmbedSrcRef.current = playerUrl;
      } else {
        try {
          const u = new URL(playerUrl);
          u.searchParams.set("t", String(Math.floor(sAt)));
          initialEmbedSrcRef.current = u.toString();
        } catch {
          const sep = playerUrl.includes("?") ? "&" : "?";
          initialEmbedSrcRef.current = `${playerUrl}${sep}t=${Math.floor(sAt)}`;
        }
      }
    } else {
      initialEmbedSrcRef.current = null;
    }
  }

  // Vimeo / direct file fallbacks
  if (!ytId && vmId) {
    return (
      <div ref={wrapperRef} className="absolute inset-0 select-none" onContextMenu={block}>
        <iframe
          src={initialVimeoSrcRef.current || `https://player.vimeo.com/video/${vmId}?title=0&byline=0&portrait=0`}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={() => emitPlaybackEvent("ready", { source: "vimeo-iframe-fallback", note: "cross-origin iframe" })}
        />
      </div>
    );
  }

  // Google Drive preview embed
  if (!ytId && drId) {
    return (
      <div ref={wrapperRef} className="absolute inset-0 bg-black select-none" onContextMenu={block}>
        <iframe
          src={`https://drive.google.com/file/d/${drId}/preview`}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={title ?? "lesson"}
          onLoad={() => emitPlaybackEvent("ready", { source: "drive-iframe-fallback", note: "cross-origin iframe" })}
        />
        {/* Block top-right "Open in new tab" button on Drive player */}
        <div
          className="absolute top-0 right-0 w-28 h-12 z-30"
          onClick={block}
          onAuxClick={block}
          onMouseDown={block}
          onContextMenu={block}
          aria-hidden
        />
        {watermark && (
          <>
            <div className="secure-watermark absolute z-40 pointer-events-none select-none text-white/60 text-sm md:text-base font-semibold whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {watermark}
            </div>
            <style>{`
              @keyframes secureWmMove {
                0%   { top: 8%;  left: 6%; }
                25%  { top: 14%; left: 70%; }
                50%  { top: 70%; left: 60%; }
                75%  { top: 78%; left: 8%; }
                100% { top: 8%;  left: 6%; }
              }
              .secure-watermark { animation: secureWmMove 41s linear infinite; }
            `}</style>
          </>
        )}
      </div>
    );
  }

  // Generic iframe embed (Bunny Stream / mediadelivery, custom players, etc.)
  if (!ytId && playerUrl && isGenericEmbed(playerUrl) && !isDirectMedia(playerUrl)) {
    return (
      <div ref={wrapperRef} className="absolute inset-0 bg-black select-none" onContextMenu={block}>
        <iframe
          src={initialEmbedSrcRef.current || playerUrl}
          className="absolute inset-0 w-full h-full"
          frameBorder={0}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={title ?? "video"}
          onLoad={(e) => {
            emitPlaybackEvent("ready", { source: "bunny-or-embed-fallback", note: "cross-origin iframe" });
            const sAt = initialStartAtRef.current;
            if (sAt && sAt > 3) {
              const cw = (e.currentTarget as HTMLIFrameElement)?.contentWindow;
              if (cw) {
                setTimeout(() => {
                  try {
                    cw.postMessage(JSON.stringify({ event: "command", func: "setCurrentTime", args: [Math.floor(sAt)] }), "*");
                    cw.postMessage({ method: "setCurrentTime", value: Math.floor(sAt) }, "*");
                    cw.postMessage(JSON.stringify({ method: "setCurrentTime", value: Math.floor(sAt) }), "*");
                  } catch {}
                }, 750);
              }
            }
          }}
        />
        {watermark && (
          <>
            <div className="secure-watermark absolute z-40 pointer-events-none select-none text-white/60 text-sm md:text-base font-semibold whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {watermark}
            </div>
            <div className="secure-watermark-2 absolute z-40 pointer-events-none select-none text-white/40 text-xs md:text-sm whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {watermark}
            </div>
            <style>{`
              @keyframes secureWmMove {
                0%   { top: 8%;  left: 6%; }
                20%  { top: 14%; left: 70%; }
                40%  { top: 70%; left: 60%; }
                60%  { top: 78%; left: 8%; }
                80%  { top: 40%; left: 35%; }
                100% { top: 8%;  left: 6%; }
              }
              @keyframes secureWmMove2 {
                0%   { top: 78%; left: 70%; }
                25%  { top: 12%; left: 40%; }
                50%  { top: 50%; left: 8%; }
                75%  { top: 30%; left: 75%; }
                100% { top: 78%; left: 70%; }
              }
              .secure-watermark   { animation: secureWmMove  37s linear infinite; }
              .secure-watermark-2 { animation: secureWmMove2 53s linear infinite; }
            `}</style>
          </>
        )}
      </div>
    );
  }

  if (!ytId && playerUrl) {
    // direct file or storage path resolved by parent (we expect parent to pass full URL)
    const src = isStorageRef(playerUrl) ? playerUrl : playerUrl;
    return (
      <div ref={wrapperRef} className="absolute inset-0 bg-black select-none" onContextMenu={block}>
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el && startAt && startAt > 3 && !seekedRef.current) {
              const onMeta = () => { try { el.currentTime = startAt; seekedRef.current = true; } catch {} };
              el.addEventListener("loadedmetadata", onMeta, { once: true });
            }
          }}
          src={src}
          poster={poster ?? undefined}
          controls
          controlsList="nodownload noremoteplayback nofullscreen"
          disablePictureInPicture
          className="absolute inset-0 w-full h-full bg-black object-contain"
          onContextMenu={block}
          onLoadedMetadata={(e) => emitPlaybackEvent("ready", { position: e.currentTarget.currentTime, duration: e.currentTarget.duration, source: "html5-video" })}
          onEnded={(e) => {
            emitPlaybackEvent("complete", { position: e.currentTarget.currentTime, duration: e.currentTarget.duration, source: "html5-video" });
            onEnded?.();
          }}
          onPlay={(e) => {
            lastTickRef.current = Date.now();
            emitPlaybackEvent("start", { position: e.currentTarget.currentTime, duration: e.currentTarget.duration, source: "html5-video" });
          }}
          onPause={(e) => {
            lastTickRef.current = null;
            if (!e.currentTarget.ended) emitPlaybackEvent("pause", { position: e.currentTarget.currentTime, duration: e.currentTarget.duration, source: "html5-video" });
          }}
          onSeeked={(e) => emitPlaybackEvent("seek", { position: e.currentTarget.currentTime, duration: e.currentTarget.duration, source: "html5-video" })}
        />
        {watermark && (
          <>
            <div className="secure-watermark absolute z-40 pointer-events-none select-none text-white/60 text-sm md:text-base font-semibold whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {watermark}
            </div>
            <div className="secure-watermark-2 absolute z-40 pointer-events-none select-none text-white/40 text-xs md:text-sm whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {watermark}
            </div>
            <style>{`
              @keyframes secureWmMove {
                0%   { top: 8%;  left: 6%; }
                20%  { top: 14%; left: 70%; }
                40%  { top: 70%; left: 60%; }
                60%  { top: 78%; left: 8%; }
                80%  { top: 40%; left: 35%; }
                100% { top: 8%;  left: 6%; }
              }
              @keyframes secureWmMove2 {
                0%   { top: 78%; left: 70%; }
                25%  { top: 12%; left: 40%; }
                50%  { top: 50%; left: 8%; }
                75%  { top: 30%; left: 75%; }
                100% { top: 78%; left: 70%; }
              }
              .secure-watermark   { animation: secureWmMove  37s linear infinite; }
              .secure-watermark-2 { animation: secureWmMove2 53s linear infinite; }
            `}</style>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 bg-black select-none"
      onContextMenu={block}
      onDragStart={block}
    >
      {/* programmatic YouTube mount */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading veil until ready (also hides the brief title flash) */}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-white/70 text-sm bg-black">
          جاري تحميل الفيديو…
        </div>
      )}

      {/* Top strip — covers YouTube title + channel logo (which open youtube in new tab) */}
      <div
        className="absolute top-0 left-0 right-0 h-16 z-30"
        onClick={block}
        onAuxClick={block}
        onMouseDown={block}
        onContextMenu={block}
        aria-hidden
      />
      {/* Bottom-right — covers the "Watch on YouTube" button area */}
      <div
        className="absolute bottom-10 right-0 w-60 h-14 z-30"
        onClick={block}
        onAuxClick={block}
        onMouseDown={block}
        onContextMenu={block}
        aria-hidden
      />
      {/* Top-right — covers the "Share" / channel avatar overlay that may appear on pause */}
      <div
        className="absolute top-12 right-0 w-44 h-20 z-30"
        onClick={block}
        onAuxClick={block}
        onMouseDown={block}
        onContextMenu={block}
        aria-hidden
      />

      {/* Moving watermark with the user's identity — deters screen recording */}
      {watermark && (
        <>
          <div className="secure-watermark absolute z-40 pointer-events-none select-none text-white/60 text-sm md:text-base font-semibold whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            {watermark}
          </div>
          <div className="secure-watermark-2 absolute z-40 pointer-events-none select-none text-white/40 text-xs md:text-sm whitespace-nowrap" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            {watermark}
          </div>
          <style>{`
            @keyframes secureWmMove {
              0%   { top: 8%;  left: 6%; }
              20%  { top: 14%; left: 70%; }
              40%  { top: 70%; left: 60%; }
              60%  { top: 78%; left: 8%; }
              80%  { top: 40%; left: 35%; }
              100% { top: 8%;  left: 6%; }
            }
            @keyframes secureWmMove2 {
              0%   { top: 78%; left: 70%; }
              25%  { top: 12%; left: 40%; }
              50%  { top: 50%; left: 8%; }
              75%  { top: 30%; left: 75%; }
              100% { top: 78%; left: 70%; }
            }
            .secure-watermark   { animation: secureWmMove  37s linear infinite; }
            .secure-watermark-2 { animation: secureWmMove2 53s linear infinite; }
          `}</style>
        </>
      )}
    </div>
  );
}
