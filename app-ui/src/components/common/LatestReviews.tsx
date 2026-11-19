import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Row = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  courses: { title: string | null; slug: string | null } | null;
  profile: { name: string | null; avatar_url: string | null } | null;
};

export function LatestReviews() {
  const { t, isEn } = useI18n();
  const [reviews, setReviews] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rev } = await supabase.rpc("get_public_reviews", { _limit: 100 });
      const rows = ((rev ?? []) as any[]).filter((r) => r.comment != null && r.comment !== "");
      const courseIds = Array.from(new Set(rows.map((r) => r.course_id).filter(Boolean)));
      let courseMap: Record<string, { title: string | null; slug: string | null }> = {};
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id,title,slug")
          .in("id", courseIds);
        for (const c of (courses ?? []) as any[]) {
          courseMap[c.id] = { title: c.title, slug: c.slug };
        }
      }
      setReviews(
        rows.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          courses: courseMap[r.course_id] ?? null,
          profile: { name: r.author_name, avatar_url: r.author_avatar_url },
        })) as Row[],
      );
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 h-40 bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-muted-foreground text-sm">{t("home.latestReviewsEmpty")}</p>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: horizontal scroll carousel */}
      <div className="flex sm:hidden gap-3 scroll-snap-x pb-2 -mx-4 px-4">
        {reviews.map((r) => (
          <Card key={r.id} className="snap-start shrink-0 w-[78vw] max-w-[300px] p-4 flex flex-col gap-2.5">
            <div className="flex gap-0.5 text-gold">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 line-clamp-4 flex-1">{r.comment}</p>
            <div className="pt-2.5 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] font-bold shrink-0">
                    {r.profile?.name?.[0] ?? (isEn ? "S" : "ط")}
                  </div>
                )}
                <span className="font-semibold text-foreground/80 truncate">{r.profile?.name ?? t("home.student")}</span>
              </div>
              {r.courses?.slug && (
                <Link to="/courses/$slug" params={{ slug: r.courses.slug }} className="text-gold hover:underline truncate max-w-[50%] text-[11px]">
                  {r.courses.title}
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map((r) => (
          <Card key={r.id} className="p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
            <div className="flex gap-0.5 text-gold">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 line-clamp-4">{r.comment}</p>
            <div className="mt-auto pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] font-bold">
                    {r.profile?.name?.[0] ?? (isEn ? "S" : "ط")}
                  </div>
                )}
                <span className="font-semibold text-foreground/80 truncate">{r.profile?.name ?? t("home.student")}</span>
              </div>
              {r.courses?.slug && (
                <Link to="/courses/$slug" params={{ slug: r.courses.slug }} className="text-gold hover:underline truncate max-w-[60%]">
                  {r.courses.title}
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}