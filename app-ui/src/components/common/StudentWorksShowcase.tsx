import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { SecurePlayer } from "@/components/common/SecurePlayer";
import { PlayCircle, Film, Play, ExternalLink, Globe, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Work = {
  id: string;
  title: string;
  student_name: string | null;
  video_url: string;
  thumbnail_url: string | null;
};

function youtubeThumb(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

// Accept either a plain URL or a full <iframe ...> embed snippet.
// Returns the inner src so the rest of the pipeline can treat it as a URL.
function resolveEmbedUrl(input: string): string {
  if (!input) return input;
  const m = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return m ? m[1] : input;
}

function bunnyThumb(url: string): string | null {
  // https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?...
  // https://iframe.mediadelivery.net/play/{libraryId}/{videoId}
  const m = url.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([a-f0-9-]{8,})/i);
  if (!m) return null;
  return `https://vz-${m[1]}.b-cdn.net/${m[2]}/thumbnail.jpg`;
}

function isVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/<iframe|youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|mediadelivery\.net|iframe\.|player\.|\/embed\/|\.mp4($|\?)|\.webm($|\?)|\.mov($|\?)|\.mkv($|\?)|\.m3u8($|\?)/.test(u)) return true;
  return false;
}

function websiteScreenshot(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=800&h=500`;
}

export function StudentWorksShowcase({ courseId }: { courseId?: string } = {}) {
  const { isEn, dir } = useI18n();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Work | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("student_works")
        .select("id,title,student_name,video_url,thumbnail_url")
        .eq("is_published", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200);
      if (courseId) q = q.eq("course_id", courseId);
      const { data } = await q;
      const rawList = (data ?? []) as Work[];
      // Filter out duplicates with the same title so visitors see clean, distinct works
      const seenTitles = new Set<string>();
      const deduped: Work[] = [];
      for (const w of rawList) {
        const norm = (w.title || "").trim().toLowerCase();
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          deduped.push(w);
        }
      }
      setWorks(deduped);
      setLoading(false);
    })();
  }, [courseId]);

  // Auto-scroll marquee (JS-driven so arrow nav coexists with the animation).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || works.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const speed = 40; // px per second
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused && !active) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [works.length, paused, active]);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-video bg-muted animate-pulse" />
            <div className="p-4 h-16 bg-muted/40 animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Film className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">{isEn ? "No student works yet — check back soon!" : "لسه ما فيش أعمال طلاب — تابعونا قريباً!"}</p>
      </Card>
    );
  }

  // Duplicate list for seamless infinite marquee only when sufficient items exist
  const loop = works.length > 3 ? [...works, ...works] : works;
  const scrollBy = (scrollDir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // RTL-aware scroll: use card width step (~320px)
    el.scrollBy({ left: scrollDir * 340, behavior: "smooth" });
  };

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-background to-transparent" />

        {/* nav arrows */}
        <button
          type="button"
          aria-label={isEn ? "Next" : "التالي"}
          onClick={() => scrollBy(1)}
          className="absolute top-1/2 -translate-y-1/2 right-2 md:right-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-background/90 border border-border shadow-lg hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={isEn ? "Previous" : "السابق"}
          onClick={() => scrollBy(-1)}
          className="absolute top-1/2 -translate-y-1/2 left-2 md:left-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-background/90 border border-border shadow-lg hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          ref={trackRef}
          dir="ltr"
          className="flex gap-5 overflow-x-auto px-2 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {loop.map((w, idx) => {
          const key = `${w.id}-${idx}`;
          const resolvedUrl = resolveEmbedUrl(w.video_url);
          const isWebsite = !isVideoUrl(w.video_url);
          const thumb =
            w.thumbnail_url ||
            (isWebsite
              ? websiteScreenshot(resolvedUrl)
              : youtubeThumb(resolvedUrl) || bunnyThumb(resolvedUrl));
          const commonClass = `group shrink-0 w-[300px] sm:w-[320px] ${dir === "rtl" ? "text-right" : "text-left"} overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:border-gold/60 transition-all duration-300`;
          const inner = (
            <>
              <div className="relative aspect-video overflow-hidden bg-secondary">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={w.title}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="h-full w-full bg-navy-pattern" />
                )}
                <div className="absolute inset-0 grid place-items-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  {isWebsite ? (
                    <Globe className="h-14 w-14 text-white drop-shadow-lg" />
                  ) : (
                    <PlayCircle className="h-14 w-14 text-white drop-shadow-lg" />
                  )}
                </div>
              </div>
              <div dir={dir} className="p-4 space-y-3">
                <div className="font-bold text-primary line-clamp-2">{w.title}</div>
                {w.student_name && (
                  <div className="text-xs text-muted-foreground">{isEn ? `By ${w.student_name}` : `بواسطة ${w.student_name}`}</div>
                )}
                <div
                  className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-gold via-gold/90 to-gold px-5 py-3 text-base font-extrabold text-gold-foreground shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-0.5 group-hover:scale-[1.02]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-white/30 skew-x-12 group-hover:translate-x-full transition-transform duration-700 ease-out" />


                  {isWebsite ? (
                    <>
                      <ExternalLink className="h-5 w-5" />
                      <span className="relative">{isEn ? "Visit Website" : "زيارة الموقع"}</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 fill-current" />
                      <span className="relative">{isEn ? "Watch Now" : "شاهد الآن"}</span>
                    </>
                  )}
                </div>
              </div>
            </>
          );
          if (isWebsite) {
          return (
              <a
                key={key}
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={commonClass + " block"}
              >
                {inner}
              </a>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive({ ...w, video_url: resolvedUrl })}
              className={commonClass}
            >
              {inner}
            </button>
          );
        })}
        </div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button]:hidden">
          <DialogClose
            aria-label={isEn ? "Close" : "إغلاق"}
            className="group absolute left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold via-gold to-gold/80 text-gold-foreground shadow-[0_6px_20px_-4px_rgba(212,175,55,0.7)] ring-2 ring-white/30 transition-all duration-300 hover:scale-110 hover:rotate-90 hover:shadow-[0_10px_28px_-4px_rgba(212,175,55,0.9)] focus:outline-none focus:ring-4 focus:ring-gold/50 animate-scale-in"
          >
            <span className="absolute inset-0 rounded-full bg-gold/60 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
            <X className="relative h-5 w-5 stroke-[3] transition-transform duration-300 group-hover:scale-110" />
          </DialogClose>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className={dir === "rtl" ? "text-right" : "text-left"}>{active?.title}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            {active && <SecurePlayer url={active.video_url} title={active.title} />}
          </div>
          {active?.student_name && (
            <div className={`px-5 pb-4 text-sm text-muted-foreground ${dir === "rtl" ? "text-right" : "text-left"}`}>
              {isEn ? `By ${active.student_name}` : `بواسطة ${active.student_name}`}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}