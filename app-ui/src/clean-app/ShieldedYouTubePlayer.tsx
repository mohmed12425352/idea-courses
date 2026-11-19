import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  SkipBack,
  SkipForward,
  AlertTriangle,
  ListVideo,
  Loader2,
} from "lucide-react";
import { apiFetch } from "./api";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytLoaderPromise?: Promise<void>;
  }
}

function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (window.__ytLoaderPromise) return window.__ytLoaderPromise;

  window.__ytLoaderPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    } else {
      const check = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(check);
          resolve();
        }
      }, 60);
    }
  });
  return window.__ytLoaderPromise;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface PlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
}

interface Props {
  lessonId?: string;
  videoId: string; // 11-char YouTube ID, "list:<playlistId>", OR "bunny:<libId>:<guid>"
  title: string;
  posterUrl?: string;
  watermark: string;
  startAt?: number;
  onProgress?: (data: { position: number; duration: number; deltaWatched: number; firstPlay?: boolean }) => void;
  onEnded?: () => void;
}

export function ShieldedYouTubePlayer({
  lessonId,
  videoId,
  title,
  posterUrl,
  watermark,
  startAt = 0,
  onProgress,
  onEnded,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  const isBunny = videoId.startsWith("bunny:");
  const isPlaylist = videoId.startsWith("list:");
  const playlistId = isPlaylist ? videoId.slice(5) : "";

  const [bunnyEmbedUrl, setBunnyEmbedUrl] = useState<string>("");
  const [bunnyError, setBunnyError] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(isPlaylist);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(startAt || 0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const isFullscreenRef = useRef(false);
  isFullscreenRef.current = isFullscreen || pseudoFullscreen;
  const firstPlayFiredRef = useRef(false);
  const hideTimerRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

  // Resolve YouTube playlist into clean individual 11-char video IDs
  useEffect(() => {
    let cancelled = false;
    setPlaylistIndex(0);
    setAutoPlayNext(false);
    if (!isPlaylist) {
      setPlaylistItems([]);
      setPlaylistLoading(false);
      return;
    }

    setPlaylistLoading(true);
    apiFetch<{ items: PlaylistItem[] }>(`/api/youtube/playlist/${encodeURIComponent(playlistId)}`)
      .then((res) => {
        if (cancelled) return;
        setPlaylistItems(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => {
        if (!cancelled) setPlaylistItems([]);
      })
      .finally(() => {
        if (!cancelled) setPlaylistLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, isPlaylist, playlistId]);

  const activeSingleVideoId = isPlaylist ? playlistItems[playlistIndex]?.videoId || "" : videoId;
  const activeEpisodeTitle = isPlaylist ? playlistItems[playlistIndex]?.title || title : title;

  // Pause immediately if Desktop RecorderGuard triggers
  useEffect(() => {
    const off = window.edunovaDesktop?.onSecurityStatus?.((st) => {
      if (st?.locked) {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      }
    });
    return () => off?.();
  }, []);

  const exitFsClean = async () => {
    setPseudoFullscreen(false);
    setIsFullscreen(false);
    document.body.style.overflow = "";
    try {
      window.EdunovaMobileNative?.exitFullscreen?.();
    } catch {}
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {}
  };

  useEffect(() => {
    const onFs = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && !window.EdunovaMobileNative) {
        document.body.style.overflow = "";
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreenRef.current) {
        void exitFsClean();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKeyDown);

    window.__edunovaExitFullscreen = () => {
      if (isFullscreenRef.current) {
        void exitFsClean();
        return true;
      }
      return false;
    };

    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKeyDown);
      if (window.__edunovaExitFullscreen) {
        delete window.__edunovaExitFullscreen;
      }
      if (isFullscreenRef.current) {
        document.body.style.overflow = "";
        try {
          window.EdunovaMobileNative?.exitFullscreen?.();
        } catch {}
      }
    };
  }, []);

  // Resolve Bunny Stream Embed URL (with SHA-256 Token Auth signature if configured on backend)
  useEffect(() => {
    if (!isBunny) {
      setBunnyEmbedUrl("");
      setBunnyError(null);
      return;
    }
    let cancelled = false;
    setBunnyError(null);
    const parts = videoId.split(":");
    const fallbackUrl =
      parts.length === 3
        ? `https://iframe.mediadelivery.net/embed/${parts[1]}/${parts[2]}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
        : "";

    if (!lessonId) {
      setBunnyEmbedUrl(fallbackUrl);
      return;
    }

    apiFetch<{ embedUrl: string }>(`/api/student/bunny-embed/${encodeURIComponent(lessonId)}`)
      .then((res) => {
        if (!cancelled) setBunnyEmbedUrl(res?.embedUrl || fallbackUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          if (fallbackUrl) setBunnyEmbedUrl(fallbackUrl);
          else setBunnyError(err?.message || "تعذّر تحميل فيديو Bunny");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBunny, videoId, lessonId]);

  // Mount clean YouTube Player for the resolved single videoId (or playlist fallback if feed empty)
  useEffect(() => {
    if (isBunny) return;
    if (playlistLoading) return;
    if (!activeSingleVideoId && !isPlaylist) return;

    let destroyed = false;
    setReady(false);
    setPlaying(false);
    setBuffering(false);
    setEnded(false);
    setYtError(null);
    setDuration(0);
    setCurrentTime(!isPlaylist && startAt > 5 ? startAt : 0);
    firstPlayFiredRef.current = false;

    loadYouTubeIframeAPI().then(() => {
      if (destroyed || !mountRef.current) return;
      mountRef.current.innerHTML = "";

      // Create an explicit clean <iframe> with strict-origin-when-cross-origin referrer policy
      const originParam =
        window.location.protocol === "https:" || window.location.hostname === "localhost"
          ? `&origin=${encodeURIComponent(window.location.origin)}`
          : "";

      const startParam = !isPlaylist && startAt > 5 ? `&start=${Math.floor(startAt)}` : "";
      const embedSrc = activeSingleVideoId
        ? `https://www.youtube.com/embed/${encodeURIComponent(activeSingleVideoId)}?enablejsapi=1&autoplay=${autoPlayNext ? 1 : 0}&controls=0&disablekb=1&rel=0&modestbranding=1&iv_load_policy=3&fs=0&playsinline=1${startParam}${originParam}`
        : `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&enablejsapi=1&autoplay=0&controls=0&disablekb=1&rel=0&modestbranding=1&iv_load_policy=3&fs=0&playsinline=1${originParam}`;

      const iframeEl = document.createElement("iframe");
      iframeEl.src = embedSrc;
      iframeEl.title = activeEpisodeTitle;
      iframeEl.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframeEl.referrerPolicy = "strict-origin-when-cross-origin";
      mountRef.current.appendChild(iframeEl);

      playerRef.current = new window.YT.Player(iframeEl, {
        events: {
          onReady: (ev: any) => {
            if (destroyed) return;
            setReady(true);
            const dur = Number(ev.target?.getDuration?.() || 0);
            if (dur > 0) setDuration(dur);
            if (speed !== 1) {
              try {
                ev.target?.setPlaybackRate?.(speed);
              } catch {}
            }
            if (autoPlayNext) {
              try {
                ev.target?.playVideo?.();
              } catch {}
            }
          },
          onStateChange: (ev: any) => {
            if (destroyed) return;
            const state = ev.data;
            const dur = Number(ev.target?.getDuration?.() || 0);
            if (dur > 0) setDuration(dur);

            if (state === 1) {
              setPlaying(true);
              setBuffering(false);
              setEnded(false);
              setYtError(null);
              if (!firstPlayFiredRef.current) {
                firstPlayFiredRef.current = true;
                onProgressRef.current?.({
                  position: Number(ev.target?.getCurrentTime?.() || 0),
                  duration: dur,
                  deltaWatched: 0,
                  firstPlay: true,
                });
              }
            } else if (state === 3) {
              setBuffering(true);
            } else if (state === 2) {
              setPlaying(false);
              setBuffering(false);
            } else if (state === 0) {
              setPlaying(false);
              setBuffering(false);
              if (isPlaylist && playlistIndex < playlistItems.length - 1) {
                setAutoPlayNext(true);
                setPlaylistIndex((idx) => idx + 1);
              } else {
                setEnded(true);
                onEndedRef.current?.();
              }
            }
          },
          onError: (ev: any) => {
            const code = Number(ev?.data || 0);
            setBuffering(false);
            setPlaying(false);
            if (code === 101 || code === 150 || code === 153) {
              setYtError(
                "إعدادات هذا الفيديو على يوتيوب تمنع التضمين الخارجي — فعّل خيار (Allow embedding / السماح بالتضمين) من إعدادات الفيديو في استوديو يوتيوب.",
              );
            } else {
              setYtError("تعذّر تشغيل هذا الفيديو — تأكد أن الفيديو (عام أو غير مدرج Unlisted) وليس خاصاً Private.");
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [activeSingleVideoId, playlistLoading, playlistId, isPlaylist]);

  useEffect(() => {
    let accSeconds = 0;
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      const cur = Number(p.getCurrentTime() || 0);
      const dur = Number(p.getDuration?.() || duration || 0);
      if (cur >= 0) setCurrentTime(cur);
      if (dur > 0) setDuration(dur);

      if (dur > 10 && cur >= dur - 1.2 && playing) {
        try {
          p.pauseVideo();
        } catch {}
        setPlaying(false);
        if (isPlaylist && playlistIndex < playlistItems.length - 1) {
          setAutoPlayNext(true);
          setPlaylistIndex((idx) => idx + 1);
        } else {
          setEnded(true);
          onEndedRef.current?.();
        }
        return;
      }

      if (playing) {
        accSeconds += 1;
        if (accSeconds >= 8) {
          onProgressRef.current?.({
            position: cur,
            duration: dur,
            deltaWatched: accSeconds,
          });
          accSeconds = 0;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playing, duration, isPlaylist, playlistIndex, playlistItems.length]);

  const bumpControls = () => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3200);
    }
  };

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p || !ready) return;
    setYtError(null);
    if (ended) {
      p.seekTo(0, true);
      setEnded(false);
      setBuffering(true);
      p.playVideo();
      return;
    }
    if (playing) {
      p.pauseVideo();
    } else {
      setBuffering(true);
      p.playVideo();
    }
    bumpControls();
  };

  const seekTo = (nextSec: number) => {
    const p = playerRef.current;
    if (!p || !ready) return;
    const clamped = Math.max(0, Math.min(duration || 0, nextSec));
    setCurrentTime(clamped);
    setEnded(false);
    p.seekTo(clamped, true);
    bumpControls();
  };

  const changeSpeed = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(speed) + 1) % rates.length];
    setSpeed(next);
    try {
      playerRef.current?.setPlaybackRate?.(next);
    } catch {}
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      setMuted(false);
    } else {
      p.mute?.();
      setMuted(true);
    }
  };

  const changeVolume = (val: number) => {
    setVolume(val);
    const p = playerRef.current;
    if (!p) return;
    p.setVolume?.(val);
    if (val === 0) {
      p.mute?.();
      setMuted(true);
    } else if (muted) {
      p.unMute?.();
      setMuted(false);
    }
  };

  const toggleFs = async () => {
    if (isFullscreenRef.current) {
      await exitFsClean();
      return;
    }

    // Native Android Mobile App: hide OS status & navigation bars + auto-rotate landscape + true edge-to-edge fixed viewport!
    if (window.EdunovaMobileNative?.enterFullscreen) {
      try {
        window.EdunovaMobileNative.enterFullscreen();
      } catch {}
      document.body.style.overflow = "hidden";
      setPseudoFullscreen(true);
      setIsFullscreen(true);
      bumpControls();
      return;
    }

    const el = wrapperRef.current as any;
    if (!el) return;
    try {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        await req.call(el);
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch {}
        return;
      }
    } catch {}

    // Fallback CSS fullscreen (iOS / restricted WebViews)
    document.body.style.overflow = "hidden";
    setPseudoFullscreen(true);
    setIsFullscreen(true);
    bumpControls();
  };

  const fullActive = isFullscreen || pseudoFullscreen;

  // Dedicated Protected Cinema Player for Bunny.net Stream HLS Videos
  if (isBunny) {
    return (
      <div
        ref={wrapperRef}
        onContextMenu={(e) => e.preventDefault()}
        className={
          pseudoFullscreen
            ? "fixed inset-0 z-[99999] w-screen h-[100dvh] bg-black overflow-hidden select-none"
            : "relative w-full aspect-video bg-black rounded-xl overflow-hidden select-none border border-white/10 shadow-2xl"
        }
      >
        {/* Top Floating Bar with Title & Native Immersive Fullscreen Toggle */}
        <div className="absolute top-2.5 inset-x-3 z-40 flex items-center justify-between gap-2 pointer-events-none">
          <div className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/15 text-[10.5px] font-bold text-white truncate max-w-[65%]">
            {title}
          </div>
          <button
            type="button"
            onClick={toggleFs}
            className="yt-ctrl-btn pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/75 hover:bg-rose-600 border border-white/20 text-white text-[10.5px] font-extrabold cursor-pointer"
          >
            {fullActive ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span>{fullActive ? "تصغير الشاشة" : "ملء الشاشة"}</span>
          </button>
        </div>

        {bunnyError ? (
          <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-5 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-xs sm:text-sm font-bold text-white max-w-md">{bunnyError}</p>
          </div>
        ) : !bunnyEmbedUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <span className="text-xs font-bold">جاري تجهيز بث Bunny المحمي...</span>
          </div>
        ) : (
          <iframe
            src={bunnyEmbedUrl}
            title={title}
            loading="lazy"
            className="w-full h-full border-0 block"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
          />
        )}

        {/* Forensic Student Protection Watermark floating above Bunny player */}
        {watermark && (
          <>
            <div className="yt-wm-a absolute z-30 pointer-events-none text-white text-[10px] sm:text-[11px] font-bold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {watermark}
            </div>
            <div className="yt-wm-b absolute z-30 pointer-events-none text-amber-200 text-[9.5px] font-semibold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {watermark}
            </div>
          </>
        )}
      </div>
    );
  }

  const coverImg =
    (activeSingleVideoId ? `https://i.ytimg.com/vi/${activeSingleVideoId}/hqdefault.jpg` : "") || posterUrl || "";

  return (
    <div className="space-y-3">
      {/* Main Video Stage — Immersive Edge-to-Edge Fullscreen on Mobile + Clean Aspect-Video Normally */}
      <div
        ref={wrapperRef}
        onMouseMove={bumpControls}
        onTouchStart={bumpControls}
        onContextMenu={(e) => e.preventDefault()}
        className={
          pseudoFullscreen
            ? "fixed inset-0 z-[99999] w-screen h-[100dvh] bg-black overflow-hidden select-none"
            : "relative w-full aspect-video bg-black rounded-xl overflow-hidden select-none border border-white/10 shadow-2xl"
        }
      >
        {/* Top Bar inside Fullscreen for effortless Exit + Episode Title */}
        {fullActive && (
          <div
            className={`absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/90 via-black/45 to-transparent px-4 sm:px-6 pt-3 pb-6 flex items-center justify-between gap-3 transition-opacity duration-200 ${
              controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[70%] drop-shadow">
              {activeEpisodeTitle}
            </div>
            <button
              type="button"
              onClick={() => void exitFsClean()}
              className="yt-ctrl-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-rose-600 border border-white/20 text-white text-[11px] font-extrabold cursor-pointer"
            >
              <Minimize className="w-3.5 h-3.5" />
              <span>تصغير الشاشة</span>
            </button>
          </div>
        )}
        {/* Shielded IFrame (pointer-events-none prevents any link/URL leak) */}
        <div ref={mountRef} className="yt-stage-mount absolute inset-0 w-full h-full pointer-events-none" />

        {/* Error State Overlay */}
        {ytError && (
          <div className="absolute inset-0 z-30 bg-black/95 flex flex-col items-center justify-center p-5 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-xs sm:text-sm font-bold text-white max-w-md leading-relaxed">{ytError}</p>
          </div>
        )}

        {/* Cover Curtain when paused/loading/ended (opaque, zero backdrop-blur over iframe) */}
        {!ytError && (playlistLoading || !ready || (!playing && !buffering) || ended) && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 z-20 bg-[#08070b] flex flex-col items-center justify-center cursor-pointer p-4 text-center"
          >
            {coverImg && (
              <img src={coverImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/50 pointer-events-none" />
            <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_35px_rgba(225,29,72,0.7)] transition-transform active:scale-95">
              {playlistLoading || !ready ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : ended ? (
                <RotateCcw className="w-7 h-7" />
              ) : (
                <Play className="w-7 h-7 ml-0.5 fill-white" />
              )}
            </div>
            <p className="relative z-10 mt-2.5 text-xs sm:text-sm font-extrabold text-white max-w-md line-clamp-2">
              {playlistLoading || !ready
                ? "جاري تجهيز المشغّل المحمي..."
                : ended
                  ? "انتهى الدرس — اضغط للإعادة"
                  : activeEpisodeTitle}
            </p>
          </div>
        )}

        {/* Click-to-pause shield during playback */}
        {(playing || buffering) && (
          <div onClick={togglePlay} onDoubleClick={toggleFs} className="absolute inset-0 z-10 cursor-pointer" />
        )}

        {/* Subtle Student Protection Watermark (Zero inline <style> tag) */}
        {watermark && playing && (
          <>
            <div className="yt-wm-a absolute z-30 pointer-events-none text-white text-[10px] sm:text-[11px] font-bold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {watermark}
            </div>
            <div className="yt-wm-b absolute z-30 pointer-events-none text-amber-200 text-[9.5px] font-semibold whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {watermark}
            </div>
          </>
        )}

        {/* Custom Cinema Control Bar (dir="ltr" isolated strictly to controls) */}
        <div
          dir="ltr"
          style={
            fullActive
              ? {
                  paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))",
                  paddingLeft: "max(1.1rem, env(safe-area-inset-left))",
                  paddingRight: "max(1.1rem, env(safe-area-inset-right))",
                }
              : undefined
          }
          className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-2.5 sm:px-4 pt-6 pb-2 transition-opacity duration-200 ${
            controlsVisible || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.min(Math.floor(currentTime), Math.max(1, Math.floor(duration)))}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full h-1.5 accent-rose-600 cursor-pointer mb-2"
          />

          <div className="flex items-center justify-between gap-1.5 text-white text-[11px]">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="yt-ctrl-btn p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 transition-colors cursor-pointer flex items-center justify-center"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              </button>

              {isPlaylist && playlistItems.length > 1 && (
                <>
                  <button
                    type="button"
                    disabled={playlistIndex <= 0}
                    onClick={() => {
                      setAutoPlayNext(true);
                      setPlaylistIndex((i) => Math.max(0, i - 1));
                    }}
                    className="yt-ctrl-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 cursor-pointer flex items-center justify-center"
                    title="الجزء السابق"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={playlistIndex >= playlistItems.length - 1}
                    onClick={() => {
                      setAutoPlayNext(true);
                      setPlaylistIndex((i) => Math.min(playlistItems.length - 1, i + 1));
                    }}
                    className="yt-ctrl-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 cursor-pointer flex items-center justify-center"
                    title="الجزء التالي"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    {playlistIndex + 1}/{playlistItems.length}
                  </span>
                </>
              )}

              <button
                type="button"
                onClick={() => seekTo(currentTime - 10)}
                className="yt-ctrl-btn p-1.5 rounded-lg hover:bg-white/10 cursor-pointer flex items-center justify-center"
                title="رجوع 10 ثوانٍ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => seekTo(currentTime + 10)}
                className="yt-ctrl-btn p-1.5 rounded-lg hover:bg-white/10 cursor-pointer flex items-center justify-center"
                title="تقديم 10 ثوانٍ"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="yt-ctrl-btn p-1 hover:text-rose-400 cursor-pointer flex items-center justify-center"
                >
                  {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="w-14 h-1 accent-white cursor-pointer"
                />
              </div>

              <span className="font-mono text-[10px] sm:text-[11px] text-slate-300">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={changeSpeed}
                className="yt-ctrl-btn inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-[10px] cursor-pointer"
              >
                <Gauge className="w-3 h-3 text-amber-400" />
                <span>{speed}x</span>
              </button>

              <button
                type="button"
                onClick={toggleFs}
                className="yt-ctrl-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center"
                title={fullActive ? "تصغير الشاشة" : "ملء الشاشة"}
              >
                {fullActive ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Parts Selector (when lesson is a YouTube Playlist) */}
      {isPlaylist && playlistItems.length > 1 && (
        <div className="rounded-2xl bg-[#15121a] border border-amber-500/25 p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-amber-300">
              <ListVideo className="w-4 h-4" />
              <span>فيديوهات هذه القائمة ({playlistItems.length} جزء)</span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              تُشاهد الآن الجزء {playlistIndex + 1} من {playlistItems.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {playlistItems.map((item, idx) => {
              const active = idx === playlistIndex;
              return (
                <button
                  key={item.videoId}
                  type="button"
                  onClick={() => {
                    setAutoPlayNext(true);
                    setPlaylistIndex(idx);
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-right transition-all cursor-pointer ${
                    active
                      ? "bg-rose-600/20 border-rose-500 text-white"
                      : "bg-black/30 border-white/10 hover:border-white/25 text-slate-300"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                      active ? "bg-rose-600 text-white" : "bg-white/10 text-amber-300"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold line-clamp-1 flex-1">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
