import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ============================================================
 * Performance tier detection + live FPS monitoring
 * ============================================================
 * Tiers:
 *  - "high"  → كل التأثيرات (blur, parallax, elastic, stagger كامل)
 *  - "low"   → fade/slide بسيط، بدون blur، بدون parallax، durations أقصر
 *  - "off"   → بدون أنيميشن (احترام prefers-reduced-motion أو هواتف ضعيفة جداً)
 */

type PerfTier = "high" | "low" | "off";

let cachedTier: PerfTier | null = null;
let liveMonitorStarted = false;

function detectInitialTier(): PerfTier {
  if (typeof window === "undefined") return "high";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return "off";

  // sessionStorage cache — لتجنب إعادة الكشف على كل route
  try {
    const cached = sessionStorage.getItem("fd-perf-tier");
    if (cached === "high" || cached === "low" || cached === "off") return cached;
  } catch {
    /* ignore */
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };

  const mem = nav.deviceMemory ?? 8; // GB
  const cores = navigator.hardwareConcurrency ?? 8;
  const saveData = nav.connection?.saveData === true;
  const slowNet = ["slow-2g", "2g", "3g"].includes(nav.connection?.effectiveType ?? "");
  const smallScreen = window.innerWidth < 480;

  // إشارات جهاز ضعيف
  if (saveData) return "low";
  if (mem <= 2) return "low";
  if (cores <= 4 && smallScreen) return "low";
  if (slowNet) return "low";

  return "high";
}

export function getPerfTier(): PerfTier {
  if (cachedTier) return cachedTier;
  cachedTier = detectInitialTier();
  try {
    sessionStorage.setItem("fd-perf-tier", cachedTier);
  } catch {
    /* ignore */
  }
  return cachedTier;
}

/**
 * مراقبة FPS الحيّة. لو الـ FPS قلّ تحت العتبة لمدة كافية،
 * ننزل الـ tier إلى "low" ونعيد كل الـ ScrollTriggers.
 */
function startLiveFpsMonitor() {
  if (liveMonitorStarted || typeof window === "undefined") return;
  liveMonitorStarted = true;

  let frames = 0;
  let lastTime = performance.now();
  let badSamples = 0;
  const SAMPLE_MS = 1000;
  const FPS_THRESHOLD = 40;
  const BAD_SAMPLES_LIMIT = 3; // 3 ثوانٍ متتالية تحت العتبة

  const tick = (now: number) => {
    frames += 1;
    const elapsed = now - lastTime;
    if (elapsed >= SAMPLE_MS) {
      const fps = (frames * 1000) / elapsed;
      frames = 0;
      lastTime = now;

      if (fps < FPS_THRESHOLD) {
        badSamples += 1;
        if (badSamples >= BAD_SAMPLES_LIMIT && cachedTier === "high") {
          downgradeTier("low");
          return; // نوقف المراقبة بعد التخفيض
        }
      } else {
        badSamples = Math.max(0, badSamples - 1);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function downgradeTier(to: PerfTier) {
  cachedTier = to;
  try {
    sessionStorage.setItem("fd-perf-tier", to);
  } catch {
    /* ignore */
  }
  // نطفي كل التأثيرات الثقيلة الحالية
  ScrollTrigger.getAll().forEach((st) => st.kill());
  // نشيل أي blur/parallax متبقي
  document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    gsap.set(el, { clearProps: "transform" });
  });
  // نخلي العناصر اللي اتأنّمت في حالتها النهائية
  gsap.set("section h1, section h2, section p, section li, [data-reveal]", {
    clearProps: "all",
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fd:perf-downgrade", { detail: { tier: to } }));
  }
  // eslint-disable-next-line no-console
  console.info("[GSAP] Performance downgraded → tier:", to);
}

/**
 * Auto-attaches dramatic GSAP reveal animations to common elements
 * within the given root. Runs once per route/page mount.
 *
 * Targets:
 *  - [data-reveal]                → custom controlled reveal
 *  - section h1, section h2       → split-style scale + slide
 *  - section p, section li        → soft fade-up
 *  - .grid > *, [data-stagger] > *→ stagger reveal
 *  - [data-parallax]              → scroll-linked parallax
 */
export function useGsapReveal(deps: ReadonlyArray<unknown> = []) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = rootRef.current ?? document.body;
    const tier = getPerfTier();
    if (tier === "off") return;

    const isLow = tier === "low";
    const D = isLow ? 0.5 : 1; // duration multiplier

    const animatedAll: HTMLElement[] = [];
    const refreshTimers: number[] = [];
    let failsafe: number | undefined;

    const ctx = gsap.context(() => {
      // Headings — clean GPU-accelerated slide-up + fade
      const headings = gsap.utils.toArray<HTMLElement>(
        "section h1:not([data-no-anim]), section h2:not([data-no-anim])"
      );
      headings.forEach((el) => {
        animatedAll.push(el);
        gsap.from(el, {
          y: isLow ? 16 : 28,
          opacity: 0,
          duration: isLow ? 0.45 : 0.65,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
            fastScrollEnd: true,
          },
        });
      });

      // Paragraphs and list items — soft fade-up
      const paragraphs = gsap.utils.toArray<HTMLElement>(
        "section p:not([data-no-anim]), section li:not([data-no-anim])"
      );
      paragraphs.forEach((el) => {
        animatedAll.push(el);
        gsap.from(el, {
          y: isLow ? 10 : 18,
          opacity: 0,
          duration: isLow ? 0.4 : 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
            once: true,
            fastScrollEnd: true,
          },
        });
      });

      // Grids — stagger children with lightweight translate
      const grids = gsap.utils.toArray<HTMLElement>(
        "[data-stagger], section .grid"
      );
      grids.forEach((grid) => {
        // Skip hero grids — they are handled by playHeroIntro
        if (grid.closest("[data-no-anim]") || grid.querySelector("[data-hero-visual], [data-hero-title], [data-hero-badge]")) {
          return;
        }
        const children = Array.from(grid.children) as HTMLElement[];
        if (!children.length) return;
        children.forEach((c) => animatedAll.push(c));
        gsap.from(children, {
          y: isLow ? 14 : 24,
          opacity: 0,
          duration: isLow ? 0.4 : 0.55,
          ease: "power2.out",
          stagger: isLow ? 0.03 : 0.05,
          scrollTrigger: {
            trigger: grid,
            start: "top 88%",
            once: true,
            fastScrollEnd: true,
          },
        });
      });

      // Generic [data-reveal]
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      reveals.forEach((el) => {
        animatedAll.push(el);
        const dir = el.getAttribute("data-reveal") || "up";
        const dist = isLow ? 16 : 28;
        const from: gsap.TweenVars = {
          opacity: 0,
          duration: isLow ? 0.45 : 0.65,
          ease: "power2.out",
        };
        if (dir === "up") from.y = dist;
        if (dir === "down") from.y = -dist;
        if (dir === "left") from.x = dist;
        if (dir === "right") from.x = -dist;
        if (dir === "scale") from.scale = 0.95;
        gsap.from(el, {
          ...from,
          scrollTrigger: {
            trigger: el,
            start: "top 90%",
            once: true,
            fastScrollEnd: true,
          },
        });
      });

      // Parallax — only for high tier and minimal scrub
      if (!isLow) {
        const parallaxItems = gsap.utils.toArray<HTMLElement>("[data-parallax]");
        parallaxItems.forEach((el) => {
          const speed = parseFloat(el.getAttribute("data-parallax") || "0.15");
          gsap.to(el, {
            yPercent: -speed * 50,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.3,
            },
          });
        });
      }
    }, root);

    // Single delayed refresh for late layout/images
    refreshTimers.push(
      window.setTimeout(() => ScrollTrigger.refresh(), 300)
    );

    // FAILSAFE: any element still invisible after 800ms gets forcibly revealed.
    failsafe = window.setTimeout(() => {
      animatedAll.forEach((el) => {
        const cs = window.getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.05) {
          gsap.set(el, { clearProps: "all" });
        }
      });
    }, 800);

    // Throttled ResizeObserver to prevent layout thrashing
    let roTimeout: number | undefined;
    const ro = new ResizeObserver(() => {
      if (roTimeout) return;
      roTimeout = window.setTimeout(() => {
        roTimeout = undefined;
        ScrollTrigger.refresh();
      }, 250);
    });
    if (rootRef.current) {
      ro.observe(rootRef.current);
    }

    // Start FPS monitor once
    startLiveFpsMonitor();

    return () => {
      refreshTimers.forEach((t) => window.clearTimeout(t));
      if (failsafe) window.clearTimeout(failsafe);
      if (roTimeout) window.clearTimeout(roTimeout);
      ro.disconnect();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rootRef;
}

/**
 * Clean & fast hero entrance — call from a hero section once on mount.
 */
export function playHeroIntro(scope: HTMLElement) {
  if (typeof window === "undefined") return;
  const tier = getPerfTier();
  if (tier === "off") return;
  const isLow = tier === "low";

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    tl.from("[data-hero-badge]", { y: 15, opacity: 0, duration: isLow ? 0.35 : 0.5 })
      .from(
        "[data-hero-title] > *",
        { y: isLow ? 20 : 35, opacity: 0, stagger: 0.06, duration: isLow ? 0.45 : 0.7 },
        "-=0.2"
      )
      .from("[data-hero-desc]", { y: 15, opacity: 0, duration: isLow ? 0.35 : 0.55 }, "-=0.3")
      .from("[data-hero-cta]:not([data-no-anim]) > *", { y: 12, opacity: 0, stagger: 0.05, duration: isLow ? 0.3 : 0.5 }, "-=0.3")
      .from("[data-hero-stat]", { y: 12, opacity: 0, scale: 0.95, stagger: 0.05, duration: isLow ? 0.3 : 0.5 }, "-=0.2")
      .from(
        "[data-hero-visual]",
        { scale: 0.92, opacity: 0, duration: isLow ? 0.45 : 0.7, ease: "power2.out" },
        "-=0.5"
      );
  }, scope);

  // Failsafe: ensure hero is visible even if timeline fails
  const failsafe = window.setTimeout(() => {
    const sel = "[data-hero-badge], [data-hero-title] > *, [data-hero-desc], [data-hero-cta] > *, [data-hero-stat], [data-hero-visual]";
    scope.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (parseFloat(cs.opacity) < 0.8) {
        gsap.set(el, { clearProps: "all", opacity: 1, visibility: "visible" });
      }
    });
  }, 800);

  return () => {
    window.clearTimeout(failsafe);
    ctx.revert();
  };
}