import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, Palette, Gift, Clapperboard, Mic, BookOpen, Star, Zap, Heart, Trophy, Globe, Music, Camera, Code, Brush, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ChipData } from "@/components/admin/CategoryChipsManager";
import { useI18n } from "@/lib/i18n";

const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="h-5 w-5 md:h-6 md:w-6" />,
  Palette: <Palette className="h-5 w-5 md:h-6 md:w-6" />,
  Gift: <Gift className="h-5 w-5 md:h-6 md:w-6" />,
  Clapperboard: <Clapperboard className="h-5 w-5 md:h-6 md:w-6" />,
  Mic: <Mic className="h-5 w-5 md:h-6 md:w-6" />,
  BookOpen: <BookOpen className="h-5 w-5 md:h-6 md:w-6" />,
  Star: <Star className="h-5 w-5 md:h-6 md:w-6" />,
  Zap: <Zap className="h-5 w-5 md:h-6 md:w-6" />,
  Heart: <Heart className="h-5 w-5 md:h-6 md:w-6" />,
  Trophy: <Trophy className="h-5 w-5 md:h-6 md:w-6" />,
  Globe: <Globe className="h-5 w-5 md:h-6 md:w-6" />,
  Music: <Music className="h-5 w-5 md:h-6 md:w-6" />,
  Camera: <Camera className="h-5 w-5 md:h-6 md:w-6" />,
  Code: <Code className="h-5 w-5 md:h-6 md:w-6" />,
  Brush: <Brush className="h-5 w-5 md:h-6 md:w-6" />,
  Layers: <Layers className="h-5 w-5 md:h-6 md:w-6" />,
};

const FALLBACK_CHIPS: ChipData[] = [
  { key: "ai", label: "الذكاء الاصطناعي", iconName: "Sparkles", iconBg: "bg-gold/20", iconColor: "text-gold", hoverBorder: "hover:border-gold/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(201,168,76,0.4)]", category: "ذكاء اصطناعي", visible: true, order: 0 },
  { key: "design", label: "التصميم", iconName: "Palette", iconBg: "bg-destructive/15", iconColor: "text-destructive", hoverBorder: "hover:border-destructive/50", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(229,57,53,0.35)]", category: "كانفا", visible: true, order: 1 },
  { key: "free", label: "الدورات المجانية", iconName: "Gift", iconBg: "bg-amber-400/20", iconColor: "text-amber-600 dark:text-amber-300", hoverBorder: "hover:border-amber-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(252,211,77,0.4)]", category: "all", visible: true, order: 2 },
  { key: "montage", label: "المونتاج جرافيك", iconName: "Clapperboard", iconBg: "bg-orange-500/15", iconColor: "text-orange-600 dark:text-orange-400", hoverBorder: "hover:border-orange-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(251,146,60,0.4)]", category: "مونتاج", visible: true, order: 3 },
  { key: "content", label: "صناعة المحتوى", iconName: "Mic", iconBg: "bg-blue/15", iconColor: "text-blue", hoverBorder: "hover:border-blue/50", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(52,152,219,0.35)]", category: "marketing", visible: true, order: 4 },
];

export function CategoryChips() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();
  const [chips, setChips] = useState<ChipData[]>(FALLBACK_CHIPS);
  const { t, isEn } = useI18n();

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "category_chips").maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray((data.value as any).chips)) {
          const loaded: ChipData[] = (data.value as any).chips;
          setChips(loaded.filter((c) => c.visible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        }
      });
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? el.clientWidth * 0.6 : -(el.clientWidth * 0.6), behavior: "smooth" });
  };

  const handleClick = (chip: ChipData) => {
    nav({ to: "/courses", search: { category: chip.category } });
  };

  const visibleChips = chips.filter((c) => c.visible);
  if (visibleChips.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => scroll("right")} aria-label={isEn ? "Scroll right" : "تصفح لليمين"}
        className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 hidden md:grid h-11 w-11 place-items-center rounded-full bg-gold text-gold-foreground shadow-lg hover:scale-110 hover:bg-gold/90 transition-transform">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <div ref={trackRef}
        className="flex gap-2.5 md:gap-4 overflow-x-auto scroll-smooth px-1 py-2 md:px-10 md:py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleChips.map((chip) => {
          const chipLabel = isEn
            ? (t(`cat.${chip.key}`) !== `cat.${chip.key}` ? t(`cat.${chip.key}`) : (chip.label_en || chip.label))
            : chip.label;
          return (
            <button key={chip.key} type="button" onClick={() => handleClick(chip)}
              className={`group flex flex-none items-center gap-2 md:gap-3 rounded-2xl border border-border/70 bg-card shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 active:scale-95 px-3 py-2 md:px-5 md:py-3.5 ${chip.hoverBorder} ${chip.hoverShadow}`}>
              <span className={`grid h-9 w-9 md:h-11 md:w-11 shrink-0 place-items-center rounded-lg md:rounded-xl transition-transform duration-300 group-hover:scale-110 ${chip.iconBg} ${chip.iconColor}`}>
                {ICON_MAP[chip.iconName] ?? <Sparkles className="h-5 w-5 md:h-6 md:w-6" />}
              </span>
              <span className="whitespace-nowrap text-sm md:text-base font-bold text-foreground">{chipLabel}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => scroll("left")} aria-label={isEn ? "Scroll left" : "تصفح لليسار"}
        className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 hidden md:grid h-11 w-11 place-items-center rounded-full bg-gold text-gold-foreground shadow-lg hover:scale-110 hover:bg-gold/90 transition-transform">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}