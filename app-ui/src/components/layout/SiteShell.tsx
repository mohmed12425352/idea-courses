import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { BottomNav } from "./BottomNav";
import { FloatingWhatsApp } from "@/components/common/FloatingWhatsApp";
import { AppCloudSyncAgent } from "@/components/common/AppCloudSyncAgent";
import { useGsapReveal } from "@/lib/animations/useGsapReveal";
import { isMobileNativeShell } from "@/lib/apps-runtime";
import { isOfficialDesktopApp } from "@/lib/desktop";

export function SiteShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const rootRef = useGsapReveal([location.pathname]);
  const isMobileApp = isMobileNativeShell();
  const isNativeShell = isMobileApp || isOfficialDesktopApp();

  return (
    <div className="flex min-h-screen flex-col bg-[#252121] text-white">
      <AppCloudSyncAgent />
      <div className={isMobileApp ? "pt-7" : ""}>
        <Header />
      </div>
      <div ref={rootRef} className={`flex-1 flex flex-col ${isMobileApp ? "pt-[96px]" : "pt-[70px]"}`}>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        {!isNativeShell && <Footer />}
        <BottomNav />
        {!isMobileApp && <FloatingWhatsApp />}
      </div>
    </div>
  );
}
