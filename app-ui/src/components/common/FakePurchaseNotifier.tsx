import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const NAMES = [
  "أحمد محمد", "محمود علي", "سارة إبراهيم", "منى حسن", "يوسف خالد",
  "عبدالرحمن سامي", "نور الدين", "فاطمة السيد", "خالد عبدالله", "مصطفى رضا",
  "هبة مجدي", "إسلام طارق", "دينا فاروق", "كريم أشرف", "ريم صلاح",
  "عمر ياسر", "ندى ممدوح", "زياد حاتم", "ملك عادل", "أنس شريف",
  "روان وليد", "حسام الدين", "مريم عاطف", "طارق حسني", "لينا كمال",
  "أسماء فتحي", "عبدالله ناصر", "شروق رأفت", "بسمة نبيل", "هاني جمال",
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function agoLabel(): string {
  const n = Math.floor(Math.random() * 20) + 1;
  const unit = n === 1 ? "دقيقة" : n === 2 ? "دقيقتين" : n <= 10 ? "دقائق" : "دقيقة";
  return `منذ ${n} ${unit}`;
}

function initialFromName(name: string): string {
  return name.trim().charAt(0) || "م";
}

const AVATAR_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-fuchsia-500",
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

type Notice = { id: number; name: string; ago: string };

export function FakePurchaseNotifier({ courseTitle }: { courseTitle: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!courseTitle) return;
    let cancelled = false;
    const timers: number[] = [];

    const showOne = () => {
      if (cancelled) return;
      setNotice({
        id: Date.now(),
        name: rand(NAMES),
        ago: agoLabel(),
      });
      const hide = window.setTimeout(() => {
        if (!cancelled) setNotice(null);
      }, 6000);
      timers.push(hide);
    };

    const schedule = (delay: number) => {
      const t = window.setTimeout(() => {
        showOne();
        schedule(25000 + Math.floor(Math.random() * 30000));
      }, delay);
      timers.push(t);
    };

    schedule(20000);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [courseTitle]);

  return (
    <div
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[100] w-[min(94vw,420px)] bottom-4 md:bottom-auto md:top-5 px-2"
      aria-live="polite"
    >
      <div
        key={notice?.id ?? "empty"}
        className={`transition-all duration-500 ease-out will-change-transform ${
          notice
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
        }`}
      >
        {notice && (
          <div
            dir="rtl"
            className="pointer-events-auto flex items-center gap-2 md:gap-3 rounded-2xl md:rounded-full border border-gold/20 bg-card/95 px-2 py-2 shadow-2xl backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card) / 0.88), hsl(var(--card) / 0.72))",
              boxShadow: "0 12px 40px -12px color-mix(in oklab, var(--gold) 25%, transparent)",
            }}
          >
            <div className="relative shrink-0">
              <div
                className={`grid h-9 w-9 md:h-10 md:w-10 place-items-center rounded-full bg-gradient-to-br ${avatarGradient(notice.name)} text-white shadow-inner ring-2 ring-background`}
              >
                <span className="text-sm font-bold">{initialFromName(notice.name)}</span>
              </div>
              <span className="absolute -bottom-0.5 -left-0.5 grid h-4 w-4 place-items-center rounded-full bg-success text-white ring-2 ring-background">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold/25" />
            </div>
            <div className="min-w-0 flex-1 ps-1 pe-2 leading-tight">
              <p className="text-[12px] md:text-sm text-card-foreground/90 line-clamp-2 md:truncate">
                <span className="font-semibold text-gold">{notice.name}</span>
                <span className="text-card-foreground/80"> اشترك في كورس </span>
                <span className="font-semibold text-gold">{courseTitle}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                {notice.ago}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
