import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { CourseCard } from "@/components/common/CourseCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWishlist } from "@/hooks/use-wishlist";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "المفضلة — فكرة ديزاين" },
      { name: "description", content: "شاهد الكورسات التي أضفتها إلى المفضلة على منصة فكرة ديزاين." },
    ],
    links: [{ rel: "canonical", href: "https://fekradesign.shalaby3.online/wishlist" }],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { t, dir } = useI18n();
  const { ids } = useWishlist();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const idsKey = Array.from(ids).sort().join(",");

  const loadWishlistCourses = async () => {
    const selectedIds = Array.from(ids);
    if (selectedIds.length === 0) {
      setCourses([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    const { data, error: coursesError } = await supabase
      .from("courses")
      .select("id,slug,title,title_en,short_description,short_description_en,image_url,price,discount_price,duration,instructor_name,rating,category,students_count")
      .eq("status", "published")
      .in("id", selectedIds);

    if (coursesError) {
      setError(true);
      setLoading(false);
      return;
    }

    const order = new Map(selectedIds.map((id, index) => [id, index]));
    setCourses(((data ?? []) as any[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    setLoading(false);
  };

  useEffect(() => {
    loadWishlistCourses();
  }, [idsKey]);

  return (
    <SiteShell>
      <main className="min-h-[calc(100vh-60px)] bg-[#231f20] text-white py-10 md:py-14" dir={dir}>
        <div className="container-page">
          <header className={`mb-10 ${dir === "rtl" ? "text-right" : "text-left"}`}>
            <h1 className="text-3xl md:text-4xl font-extrabold">{t("wishlist.title")}</h1>
            <p className="mt-4 inline-block border-b-2 border-gold pb-4 text-sm md:text-base font-semibold text-white/90">
              {t("wishlist.subtitle")}
            </p>
          </header>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: Math.max(1, Math.min(ids.size, 3)) }).map((_, index) => (
                <Card key={index} className="overflow-hidden border-white/10 bg-white/5">
                  <Skeleton className="aspect-video rounded-none bg-white/10" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4 bg-white/10" />
                    <Skeleton className="h-4 w-full bg-white/10" />
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="border-white/10 bg-white/5 p-10 text-center text-white">
              <RefreshCw className="mx-auto mb-3 h-12 w-12 text-white/50" />
              <p className="mb-4 text-white/75">{t("wishlist.errorLoad")}</p>
              <Button onClick={loadWishlistCourses} className="bg-gold text-gold-foreground hover:bg-gold/90">{t("common.retry")}</Button>
            </Card>
          ) : courses.length === 0 ? (
            <Card className="border-white/10 bg-white/5 p-10 text-center text-white">
              <Heart className="mx-auto mb-3 h-12 w-12 text-gold" />
              <p className="mb-5 text-white/80">{t("wishlist.empty")}</p>
              <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Link to="/courses">{t("wishlist.browse")}</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </main>
    </SiteShell>
  );
}