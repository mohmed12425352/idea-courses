import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Megaphone,
  Wrench,
  AlertTriangle,
  Info,
  Sparkles,
  Save,
  Image as ImageIcon,
  ExternalLink,
  Upload,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getBroadcastAnnouncement,
  saveBroadcastAnnouncement,
  type BroadcastAnnouncement,
} from "@/lib/announcements";

export function BroadcastAnnouncementManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [active, setActive] = useState(false);
  const [type, setType] = useState<"maintenance" | "warning" | "info" | "promotion">("maintenance");
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [message, setMessage] = useState("");
  const [messageEn, setMessageEn] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionLabelEn, setActionLabelEn] = useState("");
  const [actionUrl, setActionUrl] = useState("");

  useEffect(() => {
    getBroadcastAnnouncement().then((ann) => {
      if (ann) {
        setActive(ann.active);
        setType(ann.type || "maintenance");
        setTitle(ann.title || "");
        setTitleEn(ann.title_en || "");
        setMessage(ann.message || "");
        setMessageEn(ann.message_en || "");
        setImageUrl(ann.image_url || "");
        setActionLabel(ann.action_label || "");
        setActionLabelEn(ann.action_label_en || "");
        setActionUrl(ann.action_url || "");
      }
      setLoading(false);
    });
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `announcements/ann_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // Fallback: create public URL or direct data URL
        const { data: pubData } = supabase.storage.from("course-materials").getPublicUrl(fileName);
        if (pubData?.publicUrl) {
          setImageUrl(pubData.publicUrl);
          toast.success("تم رفع الصورة بنجاح");
          return;
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("course-materials").getPublicUrl(fileName);
      setImageUrl(urlData.publicUrl);
      toast.success("تم رفع الصورة بنجاح");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("تعذر رفع الصورة، يمكنك وضع رابط مباشر للصورة بدلاً من ذلك");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (active && !title.trim() && !message.trim() && !imageUrl.trim()) {
      toast.error("يرجى كتابة عنوان أو نص للرسالة أو إضافة صورة قبل تفعيل الإشعار");
      return;
    }

    setSaving(true);
    const res = await saveBroadcastAnnouncement({
      active,
      type,
      title: title.trim(),
      title_en: titleEn.trim(),
      message: message.trim(),
      message_en: messageEn.trim(),
      image_url: imageUrl.trim(),
      action_label: actionLabel.trim(),
      action_label_en: actionLabelEn.trim(),
      action_url: actionUrl.trim(),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(
        active
          ? "تم حفظ وتفعيل الإشعار العام للمنصة بنجاح 🎉 سيظهر لجميع المستخدمين المسجلين."
          : "تم حفظ الإعدادات (الإشعار معطل حالياً)",
      );
    } else {
      toast.error(res.error || "حدث خطأ أثناء حفظ الإشعار");
    }
  };

  const setPresetMaintenance = () => {
    setType("maintenance");
    setTitle("تنبيه: صيانة دورية وتحديثات في المنصة");
    setTitleEn("Maintenance Notice: Platform Updates");
    setMessage("هناك صيانة وتحديثات في المنصة حالياً لتطوير وتحسين تجربة التعلم، وسيتم الانتهاء منها خلال 24 ساعة. نعتذر عن أي إزعاج مؤقت.");
    setMessageEn("We are performing routine maintenance to improve your learning experience. It will be completed within 24 hours. Thank you for your patience!");
    setActive(true);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">جاري تحميل إعدادات الإشعار...</div>;
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <Card className="bg-[#121a2a] border-slate-800 text-slate-100 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 bg-[#0d1424] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  رسالة وإشعار عام للمنصة (Popup & Banner)
                  {active && (
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                      نشط حالياً على المنصة
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  إرسال رسائل فورية أو تنبيهات صيانة أو عروض ترويجية تظهر لجميع الطلاب المسجلين بالمنصة كنافذة منبثقة.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto bg-[#070b14] p-2.5 rounded-xl border border-slate-800">
              <Label htmlFor="active-toggle" className="text-xs font-bold cursor-pointer select-none">
                {active ? "الإشعار مفعّل (ظاهر)" : "الإشعار معطّل"}
              </Label>
              <Switch
                id="active-toggle"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 md:p-6 space-y-6">
          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold">نماذج سريعة جاهزة:</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={setPresetMaintenance}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs h-8 rounded-lg"
            >
              <Wrench className="w-3.5 h-3.5 ml-1.5" />
              نموذج: إشعار صيانة المنصة (24 ساعة)
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">نوع وطبيعة الإشعار</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="bg-[#0b1220] border-slate-700 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1424] border-slate-800 text-slate-200">
                  <SelectItem value="maintenance">🛠️ صيانة وتحديثات مجدولة (Maintenance)</SelectItem>
                  <SelectItem value="warning">⚠️ تنبيه هام وملاحظة أمان (Warning)</SelectItem>
                  <SelectItem value="info">📢 إشعار وتحديث عام (Announcement)</SelectItem>
                  <SelectItem value="promotion">✨ عرض خاص وكوبون (Special Offer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image URL or Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">صورة الإشعار (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="رابط الصورة https://..."
                  className="bg-[#0b1220] border-slate-700 text-slate-200 text-xs"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingImage}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs shrink-0"
                    asChild
                  >
                    <span>
                      <Upload className="w-3.5 h-3.5 ml-1" />
                      {uploadingImage ? "جاري الرفع..." : "رفع صورة"}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          {/* Title Arabic & English */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">عنوان الإشعار (بالعربية)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تنبيه بخصوص صيانة المنصة"
                className="bg-[#0b1220] border-slate-700 text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">Title (English - Optional)</Label>
              <Input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="e.g. Platform Maintenance Notice"
                dir="ltr"
                className="bg-[#0b1220] border-slate-700 text-slate-200"
              />
            </div>
          </div>

          {/* Message Arabic & English */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">نص الرسالة والتفاصيل (بالعربية)</Label>
              <Textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب تفاصيل الإشعار هنا... مثال: هناك صيانة في المنصة حالياً وسيتم الانتهاء منها في خلال 24 ساعة."
                className="bg-[#0b1220] border-slate-700 text-slate-200 leading-relaxed text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">Message Content (English - Optional)</Label>
              <Textarea
                rows={4}
                value={messageEn}
                onChange={(e) => setMessageEn(e.target.value)}
                placeholder="Write message details in English here..."
                dir="ltr"
                className="bg-[#0b1220] border-slate-700 text-slate-200 leading-relaxed text-sm"
              />
            </div>
          </div>

          {/* Optional Action Button */}
          <div className="p-4 rounded-xl bg-[#0b1220] border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-yellow-500" />
              <span>زر إجراء اختياري (Call to Action Button)</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-400">نص الزر بالعربية</Label>
                <Input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="مثال: مشاهدة التفاصيل"
                  className="bg-[#121a2a] border-slate-700 text-slate-200 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-400">Button Label (English)</Label>
                <Input
                  value={actionLabelEn}
                  onChange={(e) => setActionLabelEn(e.target.value)}
                  placeholder="e.g. View Details"
                  dir="ltr"
                  className="bg-[#121a2a] border-slate-700 text-slate-200 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-400">رابط الزر (URL)</Label>
                <Input
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://... أو /courses"
                  dir="ltr"
                  className="bg-[#121a2a] border-slate-700 text-slate-200 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-yellow-500" />
              <span>معاينة حية لشكل الإشعار كما سيظهر للطلاب:</span>
            </div>
            <div className="border border-slate-700/80 rounded-2xl bg-[#080e1b] overflow-hidden max-w-md mx-auto shadow-2xl p-0">
              {imageUrl && (
                <div className="w-full max-h-40 overflow-hidden bg-black flex items-center justify-center border-b border-slate-800">
                  <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover max-h-40" />
                </div>
              )}
              <div className="p-5 space-y-3 text-right" dir="rtl">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {type === "maintenance" ? "🛠️ صيانة مجدولة" : type === "warning" ? "⚠️ تنبيه هام" : type === "promotion" ? "✨ عرض خاص" : "📢 إشعار وتحديث"}
                </span>
                <h4 className="font-bold text-base text-white">{title || "عنوان الإشعار يظهر هنا..."}</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {message || "تفاصيل الرسالة ومحتوى الإشعار ستظهر هنا للطلاب عند فتح المنصة..."}
                </p>
                <div className="pt-2 flex justify-end gap-2 border-t border-slate-800/80">
                  {actionUrl && actionLabel && (
                    <span className="bg-yellow-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg">
                      {actionLabel}
                    </span>
                  )}
                  <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700">
                    حسناً، فهمت
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95 text-sm"
            >
              <Save className="w-4 h-4 ml-1.5" />
              {saving ? "جاري الحفظ والتطبيق..." : "حفظ وتطبيق الإشعار"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
