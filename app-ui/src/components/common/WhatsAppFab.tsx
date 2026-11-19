import whatsappIcon from "@/assets/whatsapp-fab-icon.png.asset.json";

const PHONE = "201026533835"; // 01026533835 بصيغة دولية
const MESSAGE = "";

export function WhatsAppFab() {
  const text = encodeURIComponent(MESSAGE);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    // على الموبايل: افتح تطبيق واتساب مباشرة
    // على الديسكتوب: افتح واتساب ويب (أكثر استقراراً من wa.me/api.whatsapp.com)
    const url = isMobile
      ? `whatsapp://send?phone=${PHONE}&text=${text}`
      : `https://web.whatsapp.com/send?phone=${PHONE}&text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // fallback href لو JS متعطل
  const fallbackHref = `https://wa.me/${PHONE}?text=${text}`;

  return (
    <a
      href={fallbackHref}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا على واتساب"
      className="fixed bottom-5 right-5 z-50 group block"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366]/50 animate-ping" aria-hidden />
      <img
        src={whatsappIcon.url}
        alt="واتساب"
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        className="relative h-14 w-14 object-contain drop-shadow-2xl transition-transform group-hover:scale-110"
      />
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
        كلّمنا واتساب
      </span>
    </a>
  );
}