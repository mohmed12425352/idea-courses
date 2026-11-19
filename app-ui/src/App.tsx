import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Toaster, toast } from "sonner";
import { apiFetch, connectLiveSocket, getToken, setToken } from "./clean-app/api";
import { AuthScreen } from "./clean-app/AuthScreen";
import { StudentWorkspace } from "./clean-app/StudentWorkspace";
import { AdminWorkspace } from "./clean-app/AdminWorkspace";

export function App() {
  const [booting, setBooting] = useState(true);
  const [securityLock, setSecurityLock] = useState<{ locked: boolean; detected: string[] }>({
    locked: false,
    detected: [],
  });
  const [user, setUser] = useState<any | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [publicConfig, setPublicConfig] = useState<any>({
    app_name: "Idea Courses",
    instructor_name: "بشمهندس ميدو شلبي",
    welcome_subtitle: "منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل",
    whatsapp_number: "201026533835",
  });

  const [studentData, setStudentData] = useState<{ courses: any[]; notifications: any[]; paymentRequests: any[] }>({
    courses: [],
    notifications: [],
    paymentRequests: [],
  });
  const [adminOverview, setAdminOverview] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"student" | "admin">(() =>
    typeof window !== "undefined" && window.location.pathname.startsWith("/admin") ? "admin" : "student",
  );

  const loadAllData = useCallback(async (activeUser?: any) => {
    const token = getToken();
    if (!token) {
      try {
        const pub = await apiFetch("/api/config");
        if (pub?.config) setPublicConfig(pub.config);
      } catch {}
      setBooting(false);
      return;
    }

    try {
      const me = activeUser ? { user: activeUser, devices: [] } : await apiFetch("/api/auth/me");
      const currentUser = me.user;
      setUser(currentUser);
      if (me.devices) setDevices(me.devices);

      const boot = await apiFetch("/api/student/bootstrap");
      if (boot.config) setPublicConfig(boot.config);
      setStudentData({
        courses: boot.courses || [],
        notifications: boot.notifications || [],
        paymentRequests: boot.payment_requests || [],
      });

      if (currentUser.role === "admin") {
        const adm = await apiFetch("/api/admin/overview");
        setAdminOverview(adm);
        if (window.location.pathname.startsWith("/admin")) {
          setViewMode("admin");
        }
      } else {
        setViewMode("student");
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const off = window.edunovaDesktop?.onSecurityStatus?.((st) => {
      if (st) setSecurityLock({ locked: Boolean(st.locked), detected: st.detected || [] });
    });
    return () => off?.();
  }, []);

  // Connect live WebSocket for instant real-time updates ("تسمّع لحظياً في الديسكتوب والموبايل")
  useEffect(() => {
    if (!user) return;
    const disconnect = connectLiveSocket((ev) => {
      if (ev.type === "live_notification" && ev.payload) {
        toast.info(ev.payload.title || "إشعار جديد 🔔", {
          description: ev.payload.body,
          duration: 9000,
        });
        void loadAllData();
      } else if (ev.type === "payments_changed") {
        if (user?.role === "admin" && ev.payload?.status === "pending") {
          toast.success(`💳 وصل طلب دفع جديد لكورس "${ev.payload?.courseTitle || ""}" — راجعه من تبويب طلبات الدفع!`);
        } else if (user?.role !== "admin" && ev.payload?.userId === user?.id) {
          if (ev.payload?.status === "approved") {
            toast.success("🎉 مبروك! تم قبول إيصال الدفع وتفعيل الكورس في حسابك الآن!");
          } else if (ev.payload?.status === "rejected") {
            toast.error("تم رفض إيصال الدفع — يرجى مراجعة الملاحظة وإعادة المحاولة.");
          }
        }
        void loadAllData();
      } else if (
        ["courses_changed", "lessons_changed", "enrollments_changed", "config_changed", "users_changed", "presence_changed", "youtube_changed", "bunny_changed"].includes(
          ev.type,
        )
      ) {
        void loadAllData();
      }
    });
    return () => disconnect();
  }, [user?.id, loadAllData]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setAdminOverview(null);
    toast.info("تم تسجيل الخروج بنجاح");
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#0b090d] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
        <p className="text-xs font-bold text-slate-400">جاري الاتصال السحابي بالمنصة...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors dir="rtl" />
      {securityLock.locked && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[99999] bg-[#0b0709]/98 flex flex-col items-center justify-center p-6 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-black text-white">تم إيقاف التشغيل مؤقتاً لحماية المحتوى</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
            اكتشف درع الحماية وجود برنامج لتسجيل أو تصوير الشاشة يعمل في الخلفية (
            <span className="text-amber-300 font-bold">{securityLock.detected.join(" • ") || "Recorder"}</span>). يرجى
            إغلاق برنامج التسجيل تماماً وسيعود التطبيق للعمل تلقائياً.
          </p>
        </div>
      )}
      {!user ? (
        <AuthScreen
          appName={publicConfig.app_name || "Idea Courses"}
          instructorName={publicConfig.instructor_name || "بشمهندس ميدو شلبي"}
          subtitle={publicConfig.welcome_subtitle || "منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل"}
          onAuthed={(u) => {
            setUser(u);
            if (u.role === "admin") setViewMode("admin");
            void loadAllData(u);
          }}
        />
      ) : user.role === "admin" && viewMode === "admin" && adminOverview ? (
        <AdminWorkspace
          user={user}
          overview={adminOverview}
          onRefresh={() => loadAllData()}
          onSwitchToStudentView={() => setViewMode("student")}
          onLogout={handleLogout}
        />
      ) : (
        <StudentWorkspace
          user={user}
          devices={devices}
          config={publicConfig}
          courses={studentData.courses}
          notifications={studentData.notifications}
          paymentRequests={studentData.paymentRequests}
          onRefresh={() => loadAllData()}
          onLogout={handleLogout}
          onSwitchToAdmin={user.role === "admin" ? () => setViewMode("admin") : undefined}
        />
      )}
    </>
  );
}
