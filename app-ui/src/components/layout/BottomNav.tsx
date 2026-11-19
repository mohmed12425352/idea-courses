import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, GraduationCap, User } from "lucide-react";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (path !== "/courses" && (path.startsWith("/courses/") || path.startsWith("/learn/") || path.startsWith("/admin"))) {
    return null;
  }

  const tabs = [
    { to: "/", label: "الرئيسية", icon: Home, active: path === "/" },
    { to: "/courses", label: "الكورسات", icon: BookOpen, active: path === "/courses" },
    { to: "/dashboard", label: "مذاكرتي", icon: GraduationCap, active: path === "/dashboard" },
    { to: "/login", label: "حسابي", icon: User, active: path === "/login" || path === "/register" },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-[#131012]/95 backdrop-blur-xl border-t border-white/10 md:hidden flex items-center justify-around px-2 pt-1.5 pb-2 shadow-[0_-8px_25px_rgba(0,0,0,0.65)]"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center justify-center flex-1 py-1 gap-1 rounded-xl transition-all ${
              tab.active ? "text-[#e50914] font-bold" : "text-white/60 hover:text-white"
            }`}
          >
            <Icon className={`w-5 h-5 ${tab.active ? "scale-110" : ""} transition-transform`} />
            <span className="text-[11px]">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
