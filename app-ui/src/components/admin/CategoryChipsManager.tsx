import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sparkles, Palette, Gift, Clapperboard, Mic, BookOpen, Star, Zap,
  Heart, Trophy, Globe, Music, Camera, Code, Brush, Layers,
  Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";

// ===== Available Icons =====
export const ICON_OPTIONS: { name: string; label: string; icon: React.ReactNode }[] = [
  { name: "Sparkles",    label: "بريق",       icon: <Sparkles className="h-5 w-5" /> },
  { name: "Palette",     label: "لوحة تلوين",  icon: <Palette className="h-5 w-5" /> },
  { name: "Gift",        label: "هدية",        icon: <Gift className="h-5 w-5" /> },
  { name: "Clapperboard",label: "مونتاج",      icon: <Clapperboard className="h-5 w-5" /> },
  { name: "Mic",         label: "ميكروفون",    icon: <Mic className="h-5 w-5" /> },
  { name: "BookOpen",    label: "كتاب",        icon: <BookOpen className="h-5 w-5" /> },
  { name: "Star",        label: "نجمة",        icon: <Star className="h-5 w-5" /> },
  { name: "Zap",         label: "برق",         icon: <Zap className="h-5 w-5" /> },
  { name: "Heart",       label: "قلب",         icon: <Heart className="h-5 w-5" /> },
  { name: "Trophy",      label: "كأس",         icon: <Trophy className="h-5 w-5" /> },
  { name: "Globe",       label: "كرة أرضية",   icon: <Globe className="h-5 w-5" /> },
  { name: "Music",       label: "موسيقى",      icon: <Music className="h-5 w-5" /> },
  { name: "Camera",      label: "كاميرا",      icon: <Camera className="h-5 w-5" /> },
  { name: "Code",        label: "كود",         icon: <Code className="h-5 w-5" /> },
  { name: "Brush",       label: "فرشاة",       icon: <Brush className="h-5 w-5" /> },
  { name: "Layers",      label: "طبقات",       icon: <Layers className="h-5 w-5" /> },
];

// ===== Color Presets =====
const COLOR_PRESETS = [
  { label: "ذهبي",     iconBg: "bg-gold/20",          iconColor: "text-gold",                        hoverBorder: "hover:border-gold/60",          hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(201,168,76,0.4)]" },
  { label: "أحمر",     iconBg: "bg-destructive/15",    iconColor: "text-destructive",                 hoverBorder: "hover:border-destructive/50",    hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(229,57,53,0.35)]" },
  { label: "أزرق",     iconBg: "bg-blue/15",           iconColor: "text-blue",                        hoverBorder: "hover:border-blue/50",           hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(52,152,219,0.35)]" },
  { label: "أخضر",     iconBg: "bg-success/15",        iconColor: "text-success",                     hoverBorder: "hover:border-success/50",        hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(34,197,94,0.35)]" },
  { label: "برتقالي",  iconBg: "bg-orange-500/15",     iconColor: "text-orange-600 dark:text-orange-400", hoverBorder: "hover:border-orange-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(251,146,60,0.4)]" },
  { label: "عنبري",    iconBg: "bg-amber-400/20",      iconColor: "text-amber-600 dark:text-amber-300",  hoverBorder: "hover:border-amber-400/60",  hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(252,211,77,0.4)]" },
  { label: "بنفسجي",   iconBg: "bg-purple-500/15",     iconColor: "text-purple-600 dark:text-purple-400", hoverBorder: "hover:border-purple-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(168,85,247,0.35)]" },
];

export type ChipData = {
  key: string;
  label: string;
  label_en?: string;

  iconName: string;
  iconBg: string;
  iconColor: string;
  hoverBorder: string;
  hoverShadow: string;
  category: string;
  visible: boolean;
  order: number;
};

const DB_KEY = "category_chips";

const DEFAULT_CHIPS: ChipData[] = [
  { key: "ai",      label: "الذكاء الاصطناعي", iconName: "Sparkles",     iconBg: "bg-gold/20",         iconColor: "text-gold",           hoverBorder: "hover:border-gold/60",       hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(201,168,76,0.4)]",   category: "ذكاء اصطناعي", visible: true,  order: 0 },
  { key: "design",  label: "التصميم",           iconName: "Palette",      iconBg: "bg-destructive/15",  iconColor: "text-destructive",    hoverBorder: "hover:border-destructive/50", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(229,57,53,0.35)]",   category: "كانفا",         visible: true,  order: 1 },
  { key: "free",    label: "الدورات المجانية",  iconName: "Gift",         iconBg: "bg-amber-400/20",    iconColor: "text-amber-600 dark:text-amber-300", hoverBorder: "hover:border-amber-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(252,211,77,0.4)]", category: "all",           visible: true,  order: 2 },
  { key: "montage", label: "المونتاج جرافيك",   iconName: "Clapperboard", iconBg: "bg-orange-500/15",   iconColor: "text-orange-600 dark:text-orange-400", hoverBorder: "hover:border-orange-400/60", hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(251,146,60,0.4)]", category: "مونتاج",       visible: true,  order: 3 },
  { key: "content", label: "صناعة المحتوى",     iconName: "Mic",          iconBg: "bg-blue/15",         iconColor: "text-blue",           hoverBorder: "hover:border-blue/50",       hoverShadow: "hover:shadow-[0_0_20px_-6px_rgba(52,152,219,0.35)]",  category: "marketing",     visible: true,  order: 4 },
];

function iconByName(name: string) {
  return ICON_OPTIONS.find((i) => i.name === name)?.icon ?? <Sparkles className="h-5 w-5" />;
}

// ===== Chip Form Dialog =====
function ChipFormDialog({
  chip,
  onSaved,
}: {
  chip?: ChipData;
  onSaved: (c: ChipData) => void;
}) {
  const isEdit = !!chip;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChipData>(
    chip ?? {
      key: `chip_${Date.now()}`,
      label: "",
      iconName: "Sparkles",
      iconBg: COLOR_PRESETS[0].iconBg,
      iconColor: COLOR_PRESETS[0].iconColor,
      hoverBorder: COLOR_PRESETS[0].hoverBorder,
      hoverShadow: COLOR_PRESETS[0].hoverShadow,
      category: "",
      visible: true,
      order: 99,
    }
  );

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setForm((f) => ({ ...f, iconBg: preset.iconBg, iconColor: preset.iconColor, hoverBorder: preset.hoverBorder, hoverShadow: preset.hoverShadow }));
  };

  const save = () => {
    if (!form.label.trim()) { toast.error("اكتب اسم القسم"); return; }
    if (!form.category.trim()) { toast.error("اكتب الكاتيجوري"); return; }
    onSaved(form);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" onClick={() => setForm(chip!)}><Pencil className="h-4 w-4 text-gold" /></Button>
        ) : (
          <Button className="btn-gold-gradient text-gold-foreground font-bold rounded-full gap-2">
            <Plus className="h-4 w-4" /> إضافة قسم
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل القسم" : "قسم جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Preview */}
          <div className="flex items-center justify-center py-3">
            <div className={`flex items-center gap-3 rounded-2xl border border-border/70 bg-card shadow-sm px-5 py-3.5 ${form.hoverBorder}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${form.iconBg} ${form.iconColor}`}>
                {iconByName(form.iconName)}
              </span>
              <span className="font-bold text-foreground text-lg">{form.label || "اسم القسم"}</span>
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <Label>اسم القسم</Label>
            <Input placeholder="مثال: التصميم" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="h-11 rounded-xl" />
          </div>

          {/* Category filter */}
          <div className="space-y-1">
            <Label>الكاتيجوري (يفتح في صفحة الكورسات)</Label>
            <Input placeholder="مثال: كانفا أو all أو marketing" dir="ltr" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-11 rounded-xl font-mono" />
            <p className="text-xs text-muted-foreground">اكتب الكلمة اللي بتفلتر بيها الكورسات — "all" بيعرض كل الكورسات</p>
          </div>

          {/* Icon picker */}
          <div className="space-y-1">
            <Label>الأيقونة</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_OPTIONS.map((opt) => (
                <button key={opt.name} type="button"
                  onClick={() => setForm((f) => ({ ...f, iconName: opt.name }))}
                  title={opt.label}
                  className={`grid h-9 w-9 place-items-center rounded-lg border transition-all ${form.iconName === opt.name ? "border-gold bg-gold/15 text-gold scale-110" : "border-border bg-secondary text-muted-foreground hover:border-gold/50"}`}>
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color preset */}
          <div className="space-y-1">
            <Label>اللون</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${form.iconBg === p.iconBg ? "border-gold bg-gold/15 text-gold" : "border-border bg-secondary text-foreground hover:border-gold/50"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={save} className="btn-gold-gradient text-gold-foreground font-bold rounded-full w-full">
            {isEdit ? "حفظ التغييرات" : "إضافة القسم"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== Main Manager =====
export function CategoryChipsManager() {
  const [chips, setChips] = useState<ChipData[]>([]);
  const [saving, setSaving] = useState(false);

  const loadChips = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", DB_KEY).maybeSingle();
    if (data?.value && Array.isArray((data.value as any).chips)) {
      setChips((data.value as any).chips);
    } else {
      setChips(DEFAULT_CHIPS);
    }
  };

  useEffect(() => { loadChips(); }, []);

  const save = async (updated: ChipData[]) => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: DB_KEY, value: { chips: updated }, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم الحفظ ✅"); setChips(updated); }
  };

  const toggleVisible = (key: string) => {
    const updated = chips.map((c) => c.key === key ? { ...c, visible: !c.visible } : c);
    save(updated);
  };

  const deleteChip = (key: string) => {
    if (!confirm("هتحذف القسم ده؟")) return;
    save(chips.filter((c) => c.key !== key));
  };

  const addOrUpdate = (chip: ChipData) => {
    const exists = chips.find((c) => c.key === chip.key);
    const updated = exists
      ? chips.map((c) => c.key === chip.key ? chip : c)
      : [...chips, { ...chip, order: chips.length }];
    save(updated);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...chips];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    save(updated.map((c, i) => ({ ...c, order: i })));
  };

  const moveDown = (idx: number) => {
    if (idx === chips.length - 1) return;
    const updated = [...chips];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    save(updated.map((c, i) => ({ ...c, order: i })));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-primary flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-gold" /> أقسام الصفحة الرئيسية
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">تحكم في الأقسام اللي بتظهر في قسم "تصفح الأقسام"</p>
        </div>
        <ChipFormDialog onSaved={addOrUpdate} />
      </div>

      {/* Preview */}
      <Card className="p-4 bg-secondary/50 border-dashed">
        <div className="text-xs text-muted-foreground mb-3 font-medium">معاينة مباشرة</div>
        <div className="flex flex-wrap gap-3">
          {chips.filter((c) => c.visible).map((chip) => (
            <div key={chip.key} className={`flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card shadow-sm px-4 py-2.5 ${chip.hoverBorder}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${chip.iconBg} ${chip.iconColor}`}>
                {iconByName(chip.iconName)}
              </span>
              <span className="font-bold text-foreground text-sm">{chip.label}</span>
            </div>
          ))}
          {chips.filter((c) => c.visible).length === 0 && (
            <p className="text-muted-foreground text-sm">كل الأقسام مخفية حالياً</p>
          )}
        </div>
      </Card>

      {/* Chips list */}
      <div className="space-y-2">
        {chips.map((chip, idx) => (
          <Card key={chip.key} className={`p-4 flex items-center gap-3 flex-wrap transition-all ${!chip.visible ? "opacity-50" : ""}`}>
            {/* Order controls */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-primary transition-colors" title="أعلى">↑</button>
              <button onClick={() => moveDown(idx)} disabled={idx === chips.length - 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-primary transition-colors" title="أسفل">↓</button>
            </div>

            {/* Icon preview */}
            <span className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${chip.iconBg} ${chip.iconColor}`}>
              {iconByName(chip.iconName)}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-primary">{chip.label}</div>
              <div className="text-xs text-muted-foreground">كاتيجوري: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">{chip.category}</code></div>
            </div>

            {/* Status */}
            <Badge className={`shrink-0 rounded-full text-[10px] font-bold border ${chip.visible ? "bg-success/15 text-success border-success/30" : "bg-secondary text-muted-foreground border-border"}`}>
              {chip.visible ? "ظاهر" : "مخفي"}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Switch checked={chip.visible} onCheckedChange={() => toggleVisible(chip.key)} title={chip.visible ? "إخفاء" : "إظهار"} />
              <ChipFormDialog chip={chip} onSaved={addOrUpdate} />
              <Button size="icon" variant="ghost" onClick={() => deleteChip(chip.key)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {chips.length === 0 && (
        <Card className="p-10 text-center border-dashed">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">لا توجد أقسام — اضغط "إضافة قسم"</p>
        </Card>
      )}
    </div>
  );
}