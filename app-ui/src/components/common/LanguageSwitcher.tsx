import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options: { value: Locale; label: string; short: string }[] = [
    { value: "ar", label: t("lang.ar"), short: t("lang.arShort") },
    { value: "en", label: t("lang.en"), short: t("lang.enShort") },
  ];

  return (
    <div className={`relative ${className ?? ""}`} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("lang.switch")}
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-1 rounded-md p-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Globe className="h-5 w-5" />
        <span className="hidden lg:inline text-xs">
          {locale === "ar" ? t("lang.arShort") : t("lang.enShort")}
        </span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setLocale(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${
                locale === opt.value ? "bg-secondary/70" : ""
              }`}
            >
              <span>{opt.label}</span>
              {locale === opt.value && <Check className="h-4 w-4 text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
