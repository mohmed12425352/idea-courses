import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy, MessageCircle, PlayCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "مركز المساعدة | فكرة ديزاين" },
      { name: "description", content: "فيديوهات شرح واستفسارات شائعة لمساعدة الطلاب في استخدام المنصة." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/help" } });
  },
  component: HelpPage,
});

type HelpVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
};

function isEmbed(url: string) {
  return /iframe\.mediadelivery\.net|youtube\.com\/embed|player\.vimeo\.com/i.test(url);
}

function toEmbed(url: string) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]+)/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

function HelpPage() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("help_videos")
        .select("id,title,description,video_url,is_active,sort_order,created_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (!error) setVideos((data as HelpVideo[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <SiteShell>
      <div className="container-page py-10 space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gold/15 text-gold mb-4">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">{t("help.title")}</h1>
          <p className="text-muted-foreground mt-3">{t("help.subtitle")}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <Button asChild variant="outline" size="sm">
              <Link to="/contact"><MessageCircle className="h-4 w-4 ml-1" /> {t("help.contactSupport")}</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center max-w-xl mx-auto">
            <PlayCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <div className="text-muted-foreground">{t("help.empty")}</div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {videos.map((v) => (
              <Card key={v.id} className="overflow-hidden flex flex-col">
                <div className="aspect-video bg-black">
                  {isEmbed(v.video_url) || /youtube|youtu\.be|vimeo/i.test(v.video_url) ? (
                    <iframe
                      src={toEmbed(v.video_url)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={v.title}
                    />
                  ) : (
                    <video src={v.video_url} controls className="w-full h-full" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="font-extrabold text-primary text-base">{v.title}</h2>
                  {v.description && <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}