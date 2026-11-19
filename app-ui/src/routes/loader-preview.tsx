import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { MascotLoader } from "@/components/common/MascotLoader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Maximize2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/loader-preview")({
  component: LoaderPreviewPage,
  head: () => ({
    meta: [
      { title: "معاينة أنيميشن التحميل الذكي — فكرة ديزاين" },
    ],
  }),
});

function LoaderPreviewPage() {
  const [fullscreen, setFullscreen] = useState(false);
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [progress, setProgress] = useState<number>(45);
  const [withProgress, setWithProgress] = useState(true);

  // Auto simulate progress loading
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 5));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <SiteShell>
      <div className="container-page py-12 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-bold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> مؤشر التحميل الذكي
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">
            معاينة مؤشر التحميل (Brand Loader)
          </h1>
          <p className="text-sm text-muted-foreground">
            مؤشر التحميل السلس والأنيق الخاص بالمنصة
          </p>
        </div>

        {/* Live Interactive Preview Box */}
        <Card className="p-8 md:p-12 mb-8 bg-card/60 backdrop-blur-md border-border/80 flex flex-col items-center justify-center min-h-[360px] shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

          <MascotLoader
            size={size}
            progress={withProgress ? progress : undefined}
          />
        </Card>

        {/* Controls Card */}
        <Card className="p-6 bg-secondary/30 border-border/60 space-y-6">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            🎛️ أدوات التحكم والتجربة
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Fullscreen Trigger */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">تجربة وضع ملء الشاشة</label>
              <Button
                onClick={() => {
                  setFullscreen(true);
                  setTimeout(() => setFullscreen(false), 5000);
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Maximize2 className="h-4 w-4" /> فتح ملء الشاشة (5 ثوانٍ)
              </Button>
            </div>

            {/* Size Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">الحجم (Size)</label>
              <div className="flex gap-2">
                {(["sm", "md", "lg"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={size === s ? "default" : "outline"}
                    onClick={() => setSize(s)}
                    className="flex-1 text-xs"
                  >
                    {s === "sm" ? "صغير" : s === "md" ? "متوسط" : "كبير"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Progress Bar Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">شريط النسبة المئوية</label>
              <Button
                variant={withProgress ? "default" : "outline"}
                onClick={() => setWithProgress(!withProgress)}
                className="w-full text-xs"
              >
                {withProgress ? "✅ مع شريط التقدم" : "❌ بدون شريط التقدم"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Fullscreen Overlay Test */}
        {fullscreen && (
          <MascotLoader
            fullscreen
            progress={progress}
            size="lg"
          />
        )}
      </div>
    </SiteShell>
  );
}
