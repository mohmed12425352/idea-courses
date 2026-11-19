import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import r1 from "@/assets/reviews/r1.jpg";
import r2 from "@/assets/reviews/r2.jpg";
import r3 from "@/assets/reviews/r3.jpg";
import r4 from "@/assets/reviews/r4.jpg";
import r5 from "@/assets/reviews/r5.jpg";
import r6 from "@/assets/reviews/r6.jpg";
import r7 from "@/assets/reviews/r7.jpg";
import r8 from "@/assets/reviews/r8.jpg";
import r9 from "@/assets/reviews/r9.jpg";
import r10 from "@/assets/reviews/r10.jpg";

const defaults = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10];

const AUTOPLAY_MS = 3500;

export function ReviewsMarquee() {
  const { isEn } = useI18n();
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [all, setAll] = useState<string[]>(defaults);
  const total = all.length;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("success_stories")
        .select("image_url")
        .eq("is_published", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const urls = (data ?? []).map((s: any) => s.image_url).filter(Boolean);
      if (urls.length > 0) {
        setAll(urls);
        setActive(0);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setActive((p) => (p + 1) % total);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [total, active]);

  const go = (dir: 1 | -1) => setActive((p) => (p + dir + total) % total);

  // Pagination dots: show max 5 dots on mobile, all on desktop (up to 12)
  const maxDots = isMobile ? 5 : Math.min(total, 12);
  const halfDots = Math.floor(maxDots / 2);
  let dotStart = Math.max(0, active - halfDots);
  let dotEnd = dotStart + maxDots;
  if (dotEnd > total) {
    dotEnd = total;
    dotStart = Math.max(0, dotEnd - maxDots);
  }
  const visibleDotIndices = Array.from({ length: dotEnd - dotStart }, (_, i) => dotStart + i);

  return (
    <div className="relative select-none px-4 pb-6 md:pb-8 overflow-visible">
      {/* Warm glow behind the stage */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[420px] w-[720px] max-w-[90%] rounded-full bg-gold/15 blur-[120px]" />
      </div>

      {/* 3D stage */}
      <div
        className="relative grid h-[360px] sm:h-[480px] md:h-[520px] place-items-center overflow-visible"
        style={{ perspective: "1400px" }}
      >
        {all.map((src, i) => {
          let offset = i - active;
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          const abs = Math.abs(offset);
          const visible = isMobile ? abs <= 1 : abs <= 2;

          const spacing = isMobile ? 0 : 250;
          const translateX = offset * spacing;
          const translateZ = -abs * (isMobile ? 0 : 120);
          const rotateY = offset * (isMobile ? 0 : -14);
          const scale = abs === 0 ? 1 : 1 - abs * (isMobile ? 0 : 0.12);
          const opacity = visible ? (abs === 0 ? 1 : 1 - abs * (isMobile ? 1 : 0.35)) : 0;
          const z = 100 - abs;

          return (
            <button
              key={i}
              type="button"
              aria-label={`عرض الريفيو رقم ${i + 1}`}
              onClick={() => setActive(i)}
              className="relative col-start-1 row-start-1 will-change-transform focus:outline-none"
              style={{
                transform: `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                transformStyle: "preserve-3d",
                transition: "transform 1100ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms ease, filter 900ms ease",
                opacity,
                zIndex: z,
                pointerEvents: visible ? "auto" : "none",
                backfaceVisibility: "hidden",
              }}
            >
              <div
                style={{
                  filter: abs === 0 ? "none" : `blur(${Math.min(abs * 0.6, 1.5)}px) saturate(0.9)`,
                  transition: "filter 900ms ease",
                  willChange: "filter",
                }}
                className={`relative w-[185px] sm:w-[230px] md:w-[260px] aspect-[9/16] rounded-3xl overflow-hidden bg-card border ${
                  abs === 0
                    ? "border-gold shadow-[0_30px_80px_-20px_oklch(0.65_0.18_60/0.55)] ring-2 ring-gold/60 ring-offset-4 ring-offset-transparent"
                    : "border-border/50 shadow-xl"
                }`}
              >
                {abs === 0 && (
                  <>
                    <div className="absolute -top-3 -right-3 z-20 grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-full bg-gold text-gold-foreground shadow-lg ring-4 ring-background animate-scale-in">
                      <Quote className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
                  </>
                )}
                <img
                  src={src}
                  alt={isEn ? `Student review ${i + 1}` : `ريفيو طالب ${i + 1}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-contain bg-card"
                  draggable={false}
                />
                {abs !== 0 && (
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation arrows */}
      <button
        type="button"
        aria-label={isEn ? "Previous" : "السابق"}
        onClick={() => go(-1)}
        className="absolute top-1/2 -translate-y-1/2 right-0 md:right-6 z-50 grid h-9 w-9 md:h-11 md:w-11 place-items-center rounded-full bg-background/90 border border-border shadow-lg hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all"
      >
        <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
      </button>
      <button
        type="button"
        aria-label={isEn ? "Next" : "التالي"}
        onClick={() => go(1)}
        className="absolute top-1/2 -translate-y-1/2 left-0 md:left-6 z-50 grid h-9 w-9 md:h-11 md:w-11 place-items-center rounded-full bg-background/90 border border-border shadow-lg hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all"
      >
        <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
      </button>

      {/* Counter + limited dots */}
      <div className="relative z-50 flex flex-col items-center gap-2.5 mt-5 md:mt-6">
        <div className="text-xs font-bold tracking-widest text-gold/80">
          {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {/* Show ellipsis if dots are cut from start */}
          {dotStart > 0 && (
            <span className="text-[8px] text-muted-foreground/40 leading-none px-0.5">···</span>
          )}
          {visibleDotIndices.map((i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                aria-label={`اذهب للريفيو ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  isActive
                    ? "w-8 md:w-10 bg-gradient-to-r from-gold via-gold to-gold/70 shadow-[0_0_12px_oklch(0.75_0.15_70/0.6)]"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            );
          })}
          {/* Show ellipsis if dots are cut from end */}
          {dotEnd < total && (
            <span className="text-[8px] text-muted-foreground/40 leading-none px-0.5">···</span>
          )}
        </div>
      </div>
    </div>
  );
}