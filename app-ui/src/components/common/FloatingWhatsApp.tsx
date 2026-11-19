import { MessageCircle } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

export function FloatingWhatsApp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isCourseDetail = path !== "/courses" && path.startsWith("/courses/");

  return (
    <a
      href="https://wa.me/201026533835"
      target="_blank"
      rel="noopener noreferrer"
      className={`floating-whatsapp-btn group ${isCourseDetail ? "!bottom-[115px] md:!bottom-6" : ""}`}
      title="تواصل معنا عن طريق الواتساب"
      aria-label="تواصل معنا عن طريق الواتساب"
    >
      <MessageCircle className="w-7 h-7 fill-white text-[#25d366] group-hover:scale-110 transition-transform duration-200" />
      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400"></span>
      </span>
    </a>
  );
}
