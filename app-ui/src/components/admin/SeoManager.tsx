import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Share2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  RefreshCw,
  Upload,
  Sparkles,
  Smartphone,
  Monitor,
  Eye,
  FileCode,
  ShieldCheck,
  Check,
} from "lucide-react";
import { DEFAULT_SEO_SETTINGS, normalizeSeoSettings, SEO_SETTINGS_KEY, SeoSettings } from "@/lib/seo";

export function SeoManager() {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SEO_SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        console.error("Failed to load SEO settings:", error);
      } else if (data?.value) {
        const normalized = normalizeSeoSettings(data.value);
        setSettings(normalized);
        setInitialSettings(normalized);
      }
    } catch (err) {
      console.error("Error loading SEO settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.site_title.trim()) {
      toast.error("يرجى إدخال عنوان الموقع (Title)");
      return;
    }
    if (!settings.meta_description.trim()) {
      toast.error("يرجى إدخال وصف الموقع (Meta Description)");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: SEO_SETTINGS_KEY,
        value: settings as any,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        toast.error("فشل حفظ إعدادات الـ SEO: " + error.message);
      } else {
        setInitialSettings(settings);
        toast.success("تم حفظ إعدادات الـ SEO بنجاح! سيتم تطبيقها في نتائج البحث.");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("هل أنت متأكد من استعادة إعدادات الـ SEO الافتراضية المقترحة؟")) {
      setSettings(DEFAULT_SEO_SETTINGS);
      toast.info("تمت استعادة الإعدادات الافتراضية. لا تنس الضغط على 'حفظ التعديلات'.");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `seo-share-${Date.now()}.${ext}`;
      const filePath = `seo/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("course-assets")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("course-assets")
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setSettings((prev) => ({ ...prev, og_image: urlData.publicUrl }));
        toast.success("تم رفع صورة المشاركة بنجاح!");
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل رفع الصورة");
    } finally {
      setUploadingImage(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("تم النسخ للحافظة!");
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      toast.error("فشل النسخ");
    }
  };

  const titleLength = settings.site_title.length;
  const descLength = settings.meta_description.length;
  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const canonicalDomain = settings.canonical_url.replace(/^https?:\/\//, "");
  const sitemapUrl = `${settings.canonical_url}/sitemap.xml`;
  const robotsUrl = `${settings.canonical_url}/robots.txt`;

  if (loading) {
    return (
      <div className="py-16 text-center text-white/50 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#f5c518]" />
        <p className="text-sm">جاري تحميل إعدادات محركات البحث (SEO)...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#1e1b1b] border border-[#393434] shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#f5c518]/15 text-[#f5c518] shrink-0">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">إدارة تحسين محركات البحث (SEO)</h2>
              <Badge className="bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 text-[10px] font-bold">
                Google Ready
              </Badge>
              {settings.robots_indexing === "noindex" && (
                <Badge className="bg-[#e50914]/20 text-[#e50914] border border-[#e50914]/30 text-[10px] font-bold">
                  الفهرسة معطلة (Noindex)
                </Badge>
              )}
            </div>
            <p className="text-xs text-white/60 mt-1">
              تحكم كامل في كيفية ظهور موقعك في نتائج بحث Google وبطاقات المشاركة في السوشيال ميديا وخرائط الموقع.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="rounded-xl text-xs bg-[#252121] border-[#393434] text-white/80 hover:bg-[#2e2929] hover:text-white"
          >
            استعادة الافتراضي
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`rounded-xl text-xs font-bold px-4 gap-1.5 shadow-lg transition-all ${
              isDirty
                ? "bg-[#25D366] text-black hover:bg-[#20b858] shadow-[#25D366]/20 animate-pulse"
                : "bg-[#252121] text-white/40 border border-[#393434] cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin ml-1" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 ml-1" />
                {isDirty ? "حفظ التعديلات" : "تم الحفظ"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left / Main Column: Settings Form */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Google Meta Info */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 font-bold text-white text-sm">
              <Globe className="h-4 w-4 text-[#f5c518]" />
              <span>بيانات الظهور في جوجل (Meta Tags)</span>
            </div>

            {/* Site Title */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-white/90 font-bold">
                  عنوان الصفحة الرئيسية (Site Title) <span className="text-red-400">*</span>
                </Label>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    titleLength >= 40 && titleLength <= 60
                      ? "text-[#25D366] bg-[#25D366]/10"
                      : titleLength > 60
                      ? "text-red-400 bg-red-400/10"
                      : "text-white/50 bg-white/5"
                  }`}
                >
                  {titleLength} / 60 حرف {titleLength > 60 && "(طويل وقد يُقص في جوجل)"}
                </span>
              </div>
              <Input
                value={settings.site_title}
                onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
                placeholder="منصة فكرة | كورسات احترافية في التصميم والمونتاج والذكاء الاصطناعي"
                className="bg-[#252121] border-[#393434] text-white focus:border-[#f5c518]"
              />
              <p className="text-[11px] text-white/50">
                العنوان الأزرق الكبير الذي يظهر للزوار في نتائج بحث جوجل. يُفضل أن يكون بين 40 إلى 60 حرفاً.
              </p>
            </div>

            {/* Title Suffix */}
            <div className="space-y-1.5">
              <Label className="text-white/90 text-xs font-bold">
                لاحقة عناوين الصفحات الفرعية (Title Suffix)
              </Label>
              <Input
                value={settings.title_suffix}
                onChange={(e) => setSettings({ ...settings, title_suffix: e.target.value })}
                placeholder=" — Idea Courses"
                className="bg-[#252121] border-[#393434] text-white focus:border-[#f5c518]"
                dir="ltr"
              />
              <p className="text-[11px] text-white/50">
                يُضاف تلقائياً في نهاية عنوان كل كورس أو صفحة فرعية (مثال: اسم الكورس + لاحقة العنوان).
              </p>
            </div>

            {/* Meta Description */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <Label className="text-white/90 font-bold">
                  الوصف التعريفي (Meta Description) <span className="text-red-400">*</span>
                </Label>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    descLength >= 120 && descLength <= 160
                      ? "text-[#25D366] bg-[#25D366]/10"
                      : descLength > 160
                      ? "text-red-400 bg-red-400/10"
                      : "text-white/50 bg-white/5"
                  }`}
                >
                  {descLength} / 160 حرف {descLength > 160 && "(طويل وقد يُقتطع في جوجل)"}
                </span>
              </div>
              <Textarea
                rows={3}
                value={settings.meta_description}
                onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
                placeholder="اكتب وصفاً جذاباً للمنصة يحتوي على أهم التخصصات والكورسات..."
                className="bg-[#252121] border-[#393434] text-white focus:border-[#f5c518] resize-none leading-relaxed text-xs"
              />
              <p className="text-[11px] text-white/50">
                النص الرمادي الذي يقرأه الزائر أسفل الرابط في جوجل. اجعله جذاباً لزيادة نسبة النقر (CTR).
              </p>
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <Label className="text-white/90 text-xs font-bold">
                الكلمات المفتاحية المستهدفة (Meta Keywords)
              </Label>
              <Textarea
                rows={2}
                value={settings.meta_keywords}
                onChange={(e) => setSettings({ ...settings, meta_keywords: e.target.value })}
                placeholder="كورسات تصميم, موشن جرافيك, مونتاج, وايت بورد انيميشن, ذكاء اصطناعي..."
                className="bg-[#252121] border-[#393434] text-white focus:border-[#f5c518] text-xs resize-none"
              />
              <p className="text-[11px] text-white/50">
                افصل بين كل كلمة بفاصلة (، أو ,). تساعد محركات البحث الإقليمية وتصنيف المحتوى.
              </p>
            </div>

            {/* Canonical Base URL */}
            <div className="space-y-1.5">
              <Label className="text-white/90 text-xs font-bold">
                الرابط الرسمي الأساسي (Canonical URL)
              </Label>
              <Input
                value={settings.canonical_url}
                onChange={(e) => setSettings({ ...settings, canonical_url: e.target.value })}
                placeholder="https://fekradesign.shalaby3.online"
                className="bg-[#252121] border-[#393434] text-white focus:border-[#f5c518] font-mono text-xs text-left"
                dir="ltr"
              />
              <p className="text-[11px] text-white/50">
                الرابط الأصلي للنطاق لمنع تكرار المحتوى وتوجيه عناكب بحث Google للرابط الصحيح دائماً.
              </p>
            </div>
          </Card>

          {/* Social Sharing Image & OpenGraph */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 font-bold text-white text-sm">
              <Share2 className="h-4 w-4 text-[#f5c518]" />
              <span>صورة المشاركة على السوشيال ميديا (Social Share Image)</span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-white/90 text-xs font-bold">
                    رابط الصورة (og:image)
                  </Label>
                  <Input
                    value={settings.og_image}
                    onChange={(e) => setSettings({ ...settings, og_image: e.target.value })}
                    placeholder="/logo.png أو رابط صورة كامل https://..."
                    className="bg-[#252121] border-[#393434] text-white font-mono text-xs text-left"
                    dir="ltr"
                  />
                </div>
                <div className="pt-5 shrink-0">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      disabled={uploadingImage}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-xl text-xs gap-1.5 bg-[#252121] border-[#393434] text-white hover:bg-[#2e2929]"
                      disabled={uploadingImage}
                    >
                      <span>
                        <Upload className="h-3.5 w-3.5 text-[#f5c518]" />
                        {uploadingImage ? "جاري الرفع..." : "رفع صورة جديدة"}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              <p className="text-[11px] text-white/50">
                الصورة التي تظهر عند إرسال رابط موقعك في واتساب، فيسبوك، أو منصة X. الحجم الموصى به: 1200×630 بكسل.
              </p>
            </div>
          </Card>

          {/* Webmaster Verification & Robots Directives */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 font-bold text-white text-sm">
              <ShieldCheck className="h-4 w-4 text-[#f5c518]" />
              <span>إثبات الملكية وتوجيهات الفهرسة (Webmaster Verification)</span>
            </div>

            {/* Google Site Verification */}
            <div className="space-y-1.5">
              <Label className="text-white/90 text-xs font-bold">
                كود التحقق من Google Search Console
              </Label>
              <Input
                value={settings.google_site_verification}
                onChange={(e) => setSettings({ ...settings, google_site_verification: e.target.value })}
                placeholder="GtLv3hDYxGbJpwJ0rqAEjfdyNWm8qwQHzv6fCzQC40s"
                className="bg-[#252121] border-[#393434] text-white font-mono text-xs text-left"
                dir="ltr"
              />
              <p className="text-[11px] text-white/50">
                الكود المستخرج من Google Search Console لإثبات ملكيتك للموقع عبر وسام HTML tag (google-site-verification).
              </p>
            </div>

            {/* Robots Indexing Directive */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#252121] border border-[#393434]">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>السماح لعناكب Google بفهرسة الموقع</span>
                  {settings.robots_indexing === "all" ? (
                    <Badge className="bg-[#25D366]/20 text-[#25D366] text-[10px]">مفعل (Index, Follow)</Badge>
                  ) : (
                    <Badge className="bg-[#e50914]/20 text-[#e50914] text-[10px]">معطل (Noindex)</Badge>
                  )}
                </div>
                <div className="text-[11px] text-white/50 mt-0.5">
                  اترك هذا الخيار مفعلاً دائماً ليظهر الموقع في نتائج البحث. قم بتعطيله فقط في حال كانت المنصة تحت الصيانة.
                </div>
              </div>
              <Switch
                checked={settings.robots_indexing === "all"}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, robots_indexing: checked ? "all" : "noindex" })
                }
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Live Previews & Sitemap tools */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Google Search Snippet Preview */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Eye className="h-4 w-4 text-[#f5c518]" />
                <span>معاينة نتيجة بحث Google المباشرة</span>
              </div>
              <div className="flex items-center gap-1 bg-[#252121] p-0.5 rounded-lg border border-[#393434]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    previewDevice === "desktop" ? "bg-[#393434] text-white" : "text-white/50 hover:text-white"
                  }`}
                  title="كمبيوتر"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    previewDevice === "mobile" ? "bg-[#393434] text-white" : "text-white/50 hover:text-white"
                  }`}
                  title="موبايل"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Google SERP Card Mockup */}
            <div
              className={`p-4 rounded-xl bg-[#202124] border border-[#303134] text-right font-sans transition-all ${
                previewDevice === "mobile" ? "max-w-[340px] mx-auto text-xs" : "text-sm"
              }`}
              dir="rtl"
            >
              {/* Favicon & Breadcrumb */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                  <img src="/logo.png" alt="" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-white text-xs font-medium truncate">منصة فكرة</div>
                  <div className="text-[#9aa0a6] text-[11px] truncate font-mono" dir="ltr">
                    https://{canonicalDomain}
                  </div>
                </div>
              </div>

              {/* Blue Link Title */}
              <h3 className="text-[#8ab4f8] hover:underline cursor-pointer font-medium leading-snug line-clamp-2 text-sm sm:text-base mb-1">
                {settings.site_title || "عنوان الموقع الرئيسي في جوجل"}
              </h3>

              {/* Snippet Description */}
              <p className="text-[#bdc1c6] text-xs leading-relaxed line-clamp-3">
                {settings.meta_description || "وصف المنصة الذي يظهر للمستخدمين عند البحث في جوجل..."}
              </p>
            </div>

            <div className="text-[11px] text-white/40 flex items-center gap-1.5 justify-center pt-1">
              <Sparkles className="h-3.5 w-3.5 text-[#f5c518]" />
              <span>هذه المعاينة تحاكي تماماً شكل ظهور موقعك في نتائج بحث Google</span>
            </div>
          </Card>

          {/* Social Share Card Preview */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 font-bold text-white text-sm">
              <Share2 className="h-4 w-4 text-[#f5c518]" />
              <span>معاينة كارت السوشيال ميديا (واتساب / فيسبوك)</span>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#393434] bg-[#252121]">
              <div className="w-full aspect-[1.91/1] bg-[#1a1818] relative flex items-center justify-center overflow-hidden">
                {settings.og_image ? (
                  <img
                    src={settings.og_image}
                    alt="Social Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-center p-4 text-white/30 text-xs">
                    لم يتم تحديد صورة بعد
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="text-[11px] font-mono text-[#f5c518] uppercase tracking-wider truncate" dir="ltr">
                  {canonicalDomain}
                </div>
                <div className="font-bold text-white text-xs sm:text-sm line-clamp-1">
                  {settings.site_title}
                </div>
                <div className="text-white/60 text-xs line-clamp-2 leading-relaxed">
                  {settings.meta_description}
                </div>
              </div>
            </div>
          </Card>

          {/* Sitemap & Robots.txt Direct Actions */}
          <Card className="p-5 rounded-2xl bg-[#1e1b1b] border-[#393434] shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 font-bold text-white text-sm">
              <FileCode className="h-4 w-4 text-[#f5c518]" />
              <span>ملفات الفهرسة وخرائط الموقع</span>
            </div>

            {/* Sitemap action */}
            <div className="p-3 rounded-xl bg-[#252121] border border-[#393434] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#25D366]" />
                  <span className="text-xs font-bold text-white">خريطة الموقع (Sitemap XML)</span>
                </div>
                <Badge className="bg-[#25D366]/15 text-[#25D366] text-[10px]">ديناميكية تلقائية</Badge>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                ملف يتم تحديثه تلقائياً ويحتوي على كافة صفحات الموقع والكورسات المنشورة لإرشاد محركات البحث.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={sitemapUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-[#1e1b1b] border-[#393434] text-white/80"
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(sitemapUrl, "sitemap")}
                  className="h-8 text-xs rounded-lg bg-[#2e2929] border-[#443e3e] text-white"
                >
                  {copiedKey === "sitemap" ? <Check className="h-3.5 w-3.5 text-[#25D366]" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs rounded-lg bg-[#2e2929] border-[#443e3e] text-white"
                >
                  <a href={sitemapUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Robots.txt action */}
            <div className="p-3 rounded-xl bg-[#252121] border border-[#393434] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#25D366]" />
                  <span className="text-xs font-bold text-white">ملف الروبوتس (robots.txt)</span>
                </div>
                <Badge className="bg-white/10 text-white text-[10px]">جاهز</Badge>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                يسمح لمحركات البحث بفهرسة الموقع العام ويمنعها من الدخول لصفحات لوحة الإدارة وحسابات الطلاب الخاصة.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={robotsUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-[#1e1b1b] border-[#393434] text-white/80"
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs rounded-lg bg-[#2e2929] border-[#443e3e] text-white"
                >
                  <a href={robotsUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Google Search Console Direct Link Button */}
            <div className="pt-1">
              <Button
                asChild
                className="w-full bg-[#f5c518] hover:bg-[#e0b414] text-black font-bold text-xs rounded-xl h-10 shadow-lg shadow-[#f5c518]/10"
              >
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  <span>فتح Google Search Console لتقديم الـ Sitemap</span>
                  <ExternalLink className="h-3.5 w-3.5 mr-auto" />
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
