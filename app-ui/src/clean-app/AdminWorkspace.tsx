import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Video,
  Users,
  KeyRound,
  Bell,
  Plus,
  Trash2,
  Edit3,
  Eye,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Ban,
  Unlock,
  Smartphone,
  Monitor,
  Copy,
  Send,
  ExternalLink,
  Youtube,
  FolderPlus,
  UserPlus,
  ImagePlus,
  Loader2,
  X,
  CreditCard,
  Wallet,
  XCircle,
  Upload,
  Link2,
  Unlink,
  CloudDownload,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiFetch,
  compressAndUploadCourseImage,
  extractYouTubeIdClient,
  resolveMediaUrl,
  uploadVideoToYouTubeUnlisted,
} from "./api";

interface Props {
  user: any;
  overview: any;
  onRefresh: () => Promise<void>;
  onSwitchToStudentView: () => void;
  onLogout: () => void;
}

export function AdminWorkspace({ user, overview, onRefresh, onSwitchToStudentView, onLogout }: Props) {
  const [tab, setTab] = useState<"overview" | "courses" | "payments" | "users" | "codes" | "settings">("overview");
  const [busy, setBusy] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Course Editor State
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [cTitle, setCTitle] = useState("");
  const [cSubtitle, setCSubtitle] = useState("");
  const [cCategory, setCCategory] = useState("موشن جرافيك وتصميم");
  const [cPrice, setCPrice] = useState("0");
  const [cThumb, setCThumb] = useState("");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [cPublished, setCPublished] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Section & YouTube Lesson Modal State
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [lessonModal, setLessonModal] = useState<{ courseId: string; sectionId: string; editing?: any } | null>(null);
  const [lessonMode, setLessonMode] = useState<"upload" | "link">("upload");
  const [lTitle, setLTitle] = useState("");
  const [lYoutubeUrl, setLYoutubeUrl] = useState("");
  const [lDuration, setLDuration] = useState("");
  const [lDesc, setLDesc] = useState("");
  const [lAttach, setLAttach] = useState("");
  const [lPdf, setLPdf] = useState("");
  const [lAppDownload, setLAppDownload] = useState("");
  const [lResourceLinks, setLResourceLinks] = useState("");
  const [lTask, setLTask] = useState("");
  const [lPreview, setLPreview] = useState(false);

  // Direct Video -> YouTube Unlisted Upload State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProg, setUploadProg] = useState<{ percent: number; uploadedMB: number; totalMB: number }>({
    percent: 0,
    uploadedMB: 0,
    totalMB: 0,
  });
  const [uploadWarningVideoId, setUploadWarningVideoId] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // YouTube Channel OAuth Setup Modal State
  const ytStatus = overview?.youtube || {};
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytClientId, setYtClientId] = useState(ytStatus.clientId || "");
  const [ytClientSecret, setYtClientSecret] = useState("");
  const [ytBusy, setYtBusy] = useState(false);

  // Bunny.net Stream Connector & Bulk Importer Modal State
  const bunnyStatus = overview?.bunny || {};
  const [bunnyModalOpen, setBunnyModalOpen] = useState(false);
  const [bunnyTab, setBunnyTab] = useState<"config" | "import">("config");
  const [bunnyLibId, setBunnyLibId] = useState(bunnyStatus.libraryId || "");
  const [bunnyApiKey, setBunnyApiKey] = useState("");
  const [bunnyCdnHost, setBunnyCdnHost] = useState(bunnyStatus.cdnHostname || "");
  const [bunnyTokenKey, setBunnyTokenKey] = useState("");
  const [bunnyBusy, setBunnyBusy] = useState(false);
  const [bunnyCollections, setBunnyCollections] = useState<Array<{ guid: string; name: string; videoCount: number }>>([]);
  const [bunnyVideos, setBunnyVideos] = useState<any[]>([]);
  const [bunnyFilterCol, setBunnyFilterCol] = useState("all");
  const [bunnySearch, setBunnySearch] = useState("");
  const [bunnySelectedGuids, setBunnySelectedGuids] = useState<string[]>([]);
  const [bunnyTargetMode, setBunnyTargetMode] = useState<"by_collection" | "new_course" | "existing">("by_collection");
  const [bunnyNewCourseTitle, setBunnyNewCourseTitle] = useState("");
  const [bunnyNewCoursePrice, setBunnyNewCoursePrice] = useState("0");
  const [bunnyTargetCourseId, setBunnyTargetCourseId] = useState("");
  const [bunnyTargetSectionId, setBunnyTargetSectionId] = useState("");
  const [migrationJob, setMigrationJob] = useState<any | null>(null);

  // Users Management State
  const [userSearch, setUserSearch] = useState("");
  const [enrollModalUser, setEnrollModalUser] = useState<any | null>(null);
  const [addUserModal, setAddUserModal] = useState(false);
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uPassword, setUPassword] = useState("");

  // Codes State
  const [codeCourseId, setCodeCourseId] = useState("");
  const [codeCount, setCodeCount] = useState("10");

  // Settings & Push State
  const cfg = overview?.config || {};
  const [appName, setAppName] = useState(cfg.app_name || "Idea Courses");
  const [instName, setInstName] = useState(cfg.instructor_name || "بشمهندس ميدو شلبي");
  const [welcomeSub, setWelcomeSub] = useState(cfg.welcome_subtitle || "");
  const [waNumber, setWaNumber] = useState(cfg.whatsapp_number || "201026533835");
  const [instapayAddr, setInstapayAddr] = useState(cfg.instapay_address || "01026533835");
  const [walletNum, setWalletNum] = useState(cfg.wallet_number || "01026533835");
  const [payHolderName, setPayHolderName] = useState(cfg.payment_holder_name || "بشمهندس ميدو شلبي");
  const [maxDev, setMaxDev] = useState(String(cfg.max_devices || 1));
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");

  const stats = overview?.stats || {};
  const courses: any[] = overview?.courses || [];
  const users: any[] = overview?.users || [];
  const codes: any[] = overview?.codes || [];
  const payments: any[] = overview?.payments || [];

  useEffect(() => {
    if (ytStatus.clientId && !ytClientId) {
      setYtClientId(ytStatus.clientId);
    }
  }, [ytStatus.clientId]);

  useEffect(() => {
    if (bunnyStatus.libraryId && !bunnyLibId) setBunnyLibId(bunnyStatus.libraryId);
    if (bunnyStatus.cdnHostname && !bunnyCdnHost) setBunnyCdnHost(bunnyStatus.cdnHostname);
  }, [bunnyStatus.libraryId, bunnyStatus.cdnHostname]);

  // Poll live Bunny -> YouTube migration status while running or when modal opens
  useEffect(() => {
    if (!bunnyModalOpen && !migrationJob?.running) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await apiFetch<{ job: any }>("/api/admin/bunny/migration-status");
        if (active && res?.job) {
          setMigrationJob(res.job);
        }
      } catch {}
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 2200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bunnyModalOpen, migrationJob?.running]);

  const handleMigrateBunnyToYouTube = async () => {
    if (!ytStatus.connected) {
      toast.error("اربط قناتك على يوتيوب أولاً ليتمكن السيرفر من رفع الفيديوهات عليها تلقائياً");
      setBunnyModalOpen(false);
      setYtModalOpen(true);
      return;
    }
    if (!bunnyStatus.cdnHostname) {
      toast.error("أدخل CDN Hostname في تبويب (1. بيانات مكتبة Bunny) ليتمكن السيرفر من سحب ملفات الفيديو");
      setBunnyTab("config");
      return;
    }
    const chosen = bunnyVideos.filter((v) => bunnySelectedGuids.includes(v.guid));
    if (chosen.length === 0) {
      toast.error("حدد فيديو واحداً على الأقل للنقل إلى يوتيوب");
      return;
    }
    if (bunnyTargetMode === "new_course" && !bunnyNewCourseTitle.trim()) {
      toast.error("اكتب اسم الكورس الجديد أولاً");
      return;
    }

    setBunnyBusy(true);
    try {
      const collectionsMap: Record<string, string> = {};
      for (const c of bunnyCollections) collectionsMap[c.guid] = c.name;

      await apiFetch("/api/admin/bunny/migrate-to-youtube", {
        method: "POST",
        body: JSON.stringify({
          targetMode: bunnyTargetMode,
          courseId: bunnyTargetCourseId,
          sectionId: bunnyTargetSectionId,
          newCourseTitle: bunnyNewCourseTitle.trim(),
          newCoursePrice: Number(bunnyNewCoursePrice) || 0,
          videos: chosen,
          collectionsMap,
        }),
      });
      toast.success(`🚀 بدأ النقل التلقائي السحابي لـ ${chosen.length} فيديو من Bunny ← YouTube (غير مدرج) ← المنصة!`);
      const st = await apiFetch<{ job: any }>("/api/admin/bunny/migration-status");
      if (st?.job) setMigrationJob(st.job);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر بدء النقل إلى يوتيوب");
    } finally {
      setBunnyBusy(false);
    }
  };

  const handleCancelMigration = async () => {
    try {
      await apiFetch("/api/admin/bunny/migration-cancel", { method: "POST" });
      toast.info("تم إرسال أمر إيقاف النقل");
    } catch {}
  };

  const loadBunnyLibrary = async () => {
    setBunnyBusy(true);
    try {
      const data = await apiFetch<{ collections: any[]; videos: any[] }>("/api/admin/bunny/library");
      const cols = Array.isArray(data.collections) ? data.collections : [];
      const vids = Array.isArray(data.videos) ? data.videos : [];
      setBunnyCollections(cols);
      setBunnyVideos(vids);
      setBunnySelectedGuids(vids.filter((v) => !v.alreadyImported).map((v) => v.guid));
      if (cols.length === 0 && bunnyTargetMode === "by_collection") {
        setBunnyTargetMode(courses.length > 0 ? "existing" : "new_course");
      }
      setBunnyTab("import");
      toast.success(`تم جلب ${vids.length} فيديو و ${cols.length} مجلد من مكتبة Bunny بنجاح ✓`);
    } catch (err: any) {
      toast.error(err?.message || "تعذّر جلب الفيديوهات من Bunny");
    } finally {
      setBunnyBusy(false);
    }
  };

  const openBunnyImporter = (initialTab?: "config" | "import") => {
    setBunnyModalOpen(true);
    if (courses.length > 0 && !bunnyTargetCourseId) {
      setBunnyTargetCourseId(courses[0].id);
      setBunnyTargetSectionId(courses[0].sections?.[0]?.id || "");
    }
    if (initialTab === "config" || !bunnyStatus.connected) {
      setBunnyTab("config");
    } else {
      setBunnyTab("import");
      void loadBunnyLibrary();
    }
  };

  const handleSaveBunnyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBunnyBusy(true);
    try {
      const res = await apiFetch<{ totalVideos: number }>("/api/admin/bunny/config", {
        method: "PUT",
        body: JSON.stringify({
          libraryId: bunnyLibId.trim(),
          apiKey: bunnyApiKey.trim(),
          cdnHostname: bunnyCdnHost.trim(),
          tokenAuthKey: bunnyTokenKey.trim() || undefined,
        }),
      });
      toast.success(`✓ تم الاتصال بمكتبة Bunny بنجاح! (وُجد ${res.totalVideos} فيديو)`);
      await onRefresh();
      await loadBunnyLibrary();
    } catch (err: any) {
      toast.error(err?.message || "فشل الاتصال بمكتبة Bunny");
    } finally {
      setBunnyBusy(false);
    }
  };

  const filteredBunnyVideos = useMemo(() => {
    const q = bunnySearch.trim().toLowerCase();
    return bunnyVideos.filter((v) => {
      if (bunnyFilterCol !== "all") {
        if (bunnyFilterCol === "__root__" && v.collectionId) return false;
        if (bunnyFilterCol !== "__root__" && v.collectionId !== bunnyFilterCol) return false;
      }
      if (q && !String(v.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bunnyVideos, bunnyFilterCol, bunnySearch]);

  const handleImportBunnyVideos = async () => {
    const chosen = bunnyVideos.filter((v) => bunnySelectedGuids.includes(v.guid));
    if (chosen.length === 0) {
      toast.error("حدد فيديو واحداً على الأقل للسحب");
      return;
    }
    if (bunnyTargetMode === "new_course" && !bunnyNewCourseTitle.trim()) {
      toast.error("اكتب اسم الكورس الجديد أولاً");
      return;
    }
    setBunnyBusy(true);
    try {
      const collectionsMap: Record<string, string> = {};
      for (const c of bunnyCollections) collectionsMap[c.guid] = c.name;

      const res = await apiFetch<{ importedCount: number; skippedCount: number; createdCourses: number }>(
        "/api/admin/bunny/import",
        {
          method: "POST",
          body: JSON.stringify({
            targetMode: bunnyTargetMode,
            courseId: bunnyTargetCourseId,
            sectionId: bunnyTargetSectionId,
            newCourseTitle: bunnyNewCourseTitle.trim(),
            newCoursePrice: Number(bunnyNewCoursePrice) || 0,
            videos: chosen,
            collectionsMap,
          }),
        },
      );
      toast.success(
        `🎉 تم سحب ونشر ${res.importedCount} فيديو من Bunny في منصتك بنجاح!${
          res.createdCourses ? ` (تم إنشاء ${res.createdCourses} كورس)` : ""
        }${res.skippedCount ? ` • تم تخطي ${res.skippedCount} مكرر` : ""}`,
      );
      setBunnyModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر استيراد الفيديوهات");
    } finally {
      setBunnyBusy(false);
    }
  };

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "yt_oauth_done") {
        if (ev.data.ok) {
          toast.success("🎉 تم ربط قناة يوتيوب بنجاح! يمكنك الآن رفع الفيديوهات مباشرة كغير مدرجة (باللينك فقط).");
          setYtModalOpen(false);
        }
        void onRefresh();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onRefresh]);

  const handleSaveAndConnectYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtBusy(true);
    try {
      await apiFetch("/api/admin/youtube/credentials", {
        method: "PUT",
        body: JSON.stringify({ clientId: ytClientId.trim(), clientSecret: ytClientSecret.trim() }),
      });
      const start = await apiFetch<{ authUrl: string }>("/api/admin/youtube/oauth/start");
      if (start?.authUrl) {
        window.open(start.authUrl, "yt_oauth_popup", "width=560,height=680");
        toast.info("أكمل اختيار قناتك والموافقة في نافذة جوجل التي فُتحت الآن...");
      }
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر بدء ربط قناة يوتيوب");
    } finally {
      setYtBusy(false);
    }
  };

  const handleDisconnectYouTube = async () => {
    if (!confirm("متأكد من فصل قناة يوتيوب الحالية؟")) return;
    setYtBusy(true);
    try {
      await apiFetch("/api/admin/youtube/disconnect", { method: "POST" });
      toast.info("تم فصل قناة يوتيوب");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setYtBusy(false);
    }
  };

  const adminBackRef = useRef({ tab, receiptPreviewUrl, lessonModal, enrollModalUser, addUserModal, ytModalOpen, bunnyModalOpen });
  adminBackRef.current = { tab, receiptPreviewUrl, lessonModal, enrollModalUser, addUserModal, ytModalOpen, bunnyModalOpen };

  useEffect(() => {
    const handleBack = (): boolean => {
      const s = adminBackRef.current;
      if (s.receiptPreviewUrl) {
        setReceiptPreviewUrl(null);
        return true;
      }
      if (s.bunnyModalOpen) {
        setBunnyModalOpen(false);
        return true;
      }
      if (s.ytModalOpen) {
        setYtModalOpen(false);
        return true;
      }
      if (s.lessonModal) {
        setLessonModal(null);
        return true;
      }
      if (s.enrollModalUser) {
        setEnrollModalUser(null);
        return true;
      }
      if (s.addUserModal) {
        setAddUserModal(false);
        return true;
      }
      if (s.tab !== "overview") {
        setTab("overview");
        return true;
      }
      return false;
    };
    window.__edunovaHandleBack = handleBack;
    return () => {
      if (window.__edunovaHandleBack === handleBack) delete window.__edunovaHandleBack;
    };
  }, []);

  const previewYtId = useMemo(() => extractYouTubeIdClient(lYoutubeUrl), [lYoutubeUrl]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  // Keep modal user fresh when overview reloads
  const liveModalUser = useMemo(() => {
    if (!enrollModalUser) return null;
    return users.find((u) => u.id === enrollModalUser.id) || enrollModalUser;
  }, [users, enrollModalUser]);

  // Handlers
  const openNewCourseForm = () => {
    setEditingCourse({ id: null });
    setCTitle("");
    setCSubtitle("");
    setCCategory("عام");
    setCPrice("0");
    setCThumb("");
    setCPublished(true);
  };

  const openEditCourseForm = (c: any) => {
    setEditingCourse(c);
    setCTitle(c.title || "");
    setCSubtitle(c.subtitle || "");
    setCCategory(c.category || "عام");
    setCPrice(String(c.price || 0));
    setCThumb(c.thumbnail_url || "");
    setCPublished(Boolean(c.is_published));
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title: cTitle,
        subtitle: cSubtitle,
        category: cCategory,
        price: Number(cPrice) || 0,
        thumbnail_url: cThumb,
        is_published: cPublished,
      };
      if (editingCourse?.id) {
        await apiFetch(`/api/admin/courses/${editingCourse.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("تم تحديث بيانات الكورس وتسميعها فوراً ✓");
      } else {
        const res = await apiFetch("/api/admin/courses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setExpandedCourseId(res.course.id);
        toast.success("تم إنشاء الكورس الجديد بنجاح 🎉");
      }
      setEditingCourse(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حفظ الكورس");
    } finally {
      setBusy(false);
    }
  };

  const deleteCourse = async (c: any) => {
    if (!confirm(`متأكد من حذف كورس "${c.title}" بكل دروسه؟`)) return;
    try {
      await apiFetch(`/api/admin/courses/${c.id}`, { method: "DELETE" });
      toast.success("تم حذف الكورس");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const addSection = async (courseId: string) => {
    if (!newSectionTitle.trim()) {
      toast.error("اكتب اسم الفصل / السيشن أولاً");
      return;
    }
    try {
      await apiFetch("/api/admin/sections", {
        method: "POST",
        body: JSON.stringify({ course_id: courseId, title: newSectionTitle.trim() }),
      });
      setNewSectionTitle("");
      toast.success("تمت إضافة الفصل بنجاح");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const openAddLesson = (courseId: string, sectionId: string, lesson?: any) => {
    setLessonModal({ courseId, sectionId, editing: lesson });
    setLessonMode(lesson ? "link" : ytStatus.connected ? "upload" : "upload");
    setVideoFile(null);
    setUploadingVideo(false);
    setUploadProg({ percent: 0, uploadedMB: 0, totalMB: 0 });
    setUploadWarningVideoId(null);
    setLTitle(lesson?.title || "");
    setLYoutubeUrl(lesson?.youtube_url || (lesson?.youtube_video_id ? `https://youtu.be/${lesson.youtube_video_id}` : ""));
    setLDuration(lesson?.duration_label || "");
    setLDesc(lesson?.description || "");
    setLAttach(lesson?.attachment_url || "");
    setLPdf(lesson?.pdf_url || "");
    setLAppDownload(lesson?.app_download_url || "");
    setLResourceLinks(lesson?.resource_links || "");
    setLTask(lesson?.task_description || "");
    setLPreview(Boolean(lesson?.is_free_preview));
  };

  const saveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonModal) return;

    let finalYoutubeUrl = lYoutubeUrl.trim();

    // Direct Video Upload to Connected YouTube Channel (Automatically Unlisted!)
    if (!lessonModal.editing && lessonMode === "upload" && !finalYoutubeUrl) {
      if (!ytStatus.connected) {
        toast.error("اربط قناة يوتيوب أولاً لرفع الفيديوهات مباشرة");
        setYtModalOpen(true);
        return;
      }
      if (!videoFile) {
        toast.error("اختر ملف الفيديو من جهازك أولاً");
        return;
      }

      const ac = new AbortController();
      uploadAbortRef.current = ac;
      setUploadingVideo(true);
      setUploadProg({ percent: 1, uploadedMB: 0, totalMB: Number((videoFile.size / (1024 * 1024)).toFixed(1)) });
      try {
        const upRes = await uploadVideoToYouTubeUnlisted(
          videoFile,
          { title: lTitle.trim() || videoFile.name.replace(/\.[^.]+$/, ""), description: lDesc.trim() },
          (p) => setUploadProg(p),
          ac.signal,
        );
        finalYoutubeUrl = upRes.youtubeUrl;
        setLYoutubeUrl(finalYoutubeUrl);
        if (upRes.forcedPrivateByUnverifiedApp) {
          setUploadWarningVideoId(upRes.videoId);
          toast.warning(
            "تم رفع الفيديو على يوتيوب بنجاح! ملاحظة: جوجل ضبطته Private مؤقتاً لحين توثيق مشروع Google Cloud — يمكنك تحويله إلى Unlisted بضغطة واحدة من استوديو يوتيوب.",
            { duration: 10000 },
          );
        } else {
          toast.success("🎬 تم رفع الفيديو إلى قناتك على يوتيوب تلقائياً كفيديو غير مدرج (باللينك فقط)!");
        }
      } catch (err: any) {
        toast.error(err?.message || "تعذّر رفع الفيديو إلى يوتيوب");
        setUploadingVideo(false);
        return;
      } finally {
        setUploadingVideo(false);
        uploadAbortRef.current = null;
      }
    }

    if (!extractYouTubeIdClient(finalYoutubeUrl)) {
      toast.error("يرجى رفع فيديو أو لصق رابط فيديو يوتيوب صحيح");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        course_id: lessonModal.courseId,
        section_id: lessonModal.sectionId,
        title: lTitle,
        youtube_url: finalYoutubeUrl,
        duration_label: lDuration,
        description: lDesc,
        attachment_url: lAttach,
        pdf_url: lPdf,
        app_download_url: lAppDownload,
        resource_links: lResourceLinks,
        task_description: lTask,
        is_free_preview: lPreview,
      };
      if (lessonModal.editing?.id) {
        await apiFetch(`/api/admin/lessons/${lessonModal.editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("تم تحديث المحاضرة وتسميعها على التطبيقات ✓");
      } else {
        await apiFetch("/api/admin/lessons", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("تم نشر المحاضرة فوراً للطلاب على الكمبيوتر والموبايل! 🚀");
      }
      setLessonModal(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("متأكد من حذف هذا الدرس؟")) return;
    await apiFetch(`/api/admin/lessons/${id}`, { method: "DELETE" });
    toast.success("تم حذف الدرس");
    await onRefresh();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: uName, email: uEmail, phone: uPhone, password: uPassword }),
      });
      setAddUserModal(false);
      setUName("");
      setUEmail("");
      setUPhone("");
      setUPassword("");
      toast.success("تم إنشاء حساب الطالب بنجاح ✓");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleUserEnrollment = async (userId: string, courseId: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/toggle-enrollment`, {
        method: "POST",
        body: JSON.stringify({ courseId }),
      });
      toast.success(res.enrolled ? "تم فتح الكورس للطالب فوراً ✓" : "تم إلغاء تفعيل الكورس للطالب");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    }
  };

  const resetUserDevices = async (u: any) => {
    await apiFetch(`/api/admin/users/${u.id}/reset-devices`, { method: "POST" });
    toast.success(`تم تصفير بصمة الجهاز للطالب "${u.name}" — يمكنه الدخول من جهازه الجديد الآن`);
    await onRefresh();
  };

  const toggleBanUser = async (u: any) => {
    const res = await apiFetch(`/api/admin/users/${u.id}/toggle-ban`, { method: "POST" });
    toast.success(res.user?.is_banned ? "تم إيقاف حساب الطالب" : "تم إعادة تفعيل حساب الطالب");
    await onRefresh();
  };

  const generateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCourse = codeCourseId || courses[0]?.id;
    if (!targetCourse) {
      toast.error("أنشئ كورساً أولاً لتوليد أكواد له");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/codes/generate", {
        method: "POST",
        body: JSON.stringify({ course_id: targetCourse, count: Number(codeCount) || 10 }),
      });
      toast.success(`تم توليد ${res.codes.length} كود تفعيل جديد بنجاح ✓`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const approvePayment = async (p: any) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/payments/${p.id}/approve`, { method: "POST" });
      toast.success(`✅ تم قبول الدفع وتفعيل كورس "${p.course_title}" للطالب ${p.user_name} فوراً!`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر قبول الطلب");
    } finally {
      setBusy(false);
    }
  };

  const rejectPayment = async (p: any) => {
    const note = prompt("سبب الرفض (اختياري — سيظهر للطالب):", "صورة الإيصال غير واضحة أو المبلغ غير مطابق");
    if (note === null) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/payments/${p.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNote: note }),
      });
      toast.info("تم رفض طلب الدفع وإبلاغ الطالب");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر رفض الطلب");
    } finally {
      setBusy(false);
    }
  };

  const savePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/admin/config", {
        method: "PUT",
        body: JSON.stringify({
          app_name: appName,
          instructor_name: instName,
          welcome_subtitle: welcomeSub,
          whatsapp_number: waNumber,
          instapay_address: instapayAddr,
          wallet_number: walletNum,
          payment_holder_name: payHolderName,
          max_devices: Number(maxDev) || 1,
        }),
      });
      toast.success("تم حفظ إعدادات المنصة وبيانات الدفع وتحديثها عند كل الطلاب ✓");
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const sendPushAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushBody.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({ title: pushTitle || "تنبيه جديد من المحاضر 🔔", body: pushBody }),
      });
      setPushBody("");
      setPushTitle("");
      toast.success(`تم إرسال الإشعار اللحظي فوراً (${res.sentToConnections} جهاز متصل حالياً)!`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const adminTabs = [
    { id: "overview", label: "الرئيسية والإحصائيات", icon: BarChart3 },
    { id: "payments", label: "طلبات الدفع", icon: CreditCard, badge: Number(stats.pendingPayments || 0) },
    { id: "courses", label: "الكورسات وفيديوهات يوتيوب", icon: Youtube },
    { id: "users", label: `المستخدمين والطلاب (${stats.totalStudents || 0})`, icon: Users },
    { id: "codes", label: "أكواد التفعيل", icon: KeyRound },
    { id: "settings", label: "الإشعارات والإعدادات", icon: Bell },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b090d] text-slate-100 flex flex-col">
      {/* Sticky Executive Command Bar */}
      <header className="sticky top-0 z-30 bg-[#131018]/95 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-500 flex items-center justify-center font-black text-white shadow-lg">
            إدارة
          </div>
          <div>
            <h1 className="text-sm md:text-base font-black text-white">
              لوحة تحكم المنصة السحابية — {cfg.app_name || "Idea Courses"}
            </h1>
            <p className="text-[11px] text-emerald-400 font-bold">
              متصلة سحابياً • التعديلات تسمّع لحظياً في تطبيق الكمبيوتر والموبايل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRefresh()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onSwitchToStudentView}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-extrabold hover:bg-amber-500/25 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>معاينة واجهة الطالب</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/15 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-600 hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      {/* Navigation Pills */}
      <div className="bg-[#110e15] border-b border-white/10 px-4 md:px-8 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {adminTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  active
                    ? "bg-gradient-to-l from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-950/50"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {"badge" in t && t.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black leading-none">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Container */}
      <main className="p-4 md:p-8 max-w-6xl w-full mx-auto space-y-6 flex-1">
        {/* ==================== TAB 1: OVERVIEW ==================== */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              {[
                { label: "متصلون الآن (لايف)", value: stats.onlineNow || 0, color: "text-emerald-400" },
                { label: "إجمالي الطلاب", value: stats.totalStudents || 0, color: "text-sky-400" },
                { label: "الكورسات المضافة", value: stats.totalCourses || 0, color: "text-amber-400" },
                { label: "فيديوهات يوتيوب", value: stats.totalLessons || 0, color: "text-rose-400" },
                { label: "اشتراكات مفعّلة", value: stats.totalEnrollments || 0, color: "text-purple-400" },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl bg-[#15121a] border border-white/10 p-4 md:p-5">
                  <div className={`text-2xl md:text-3xl font-black ${card.color}`}>{card.value}</div>
                  <div className="text-xs font-bold text-slate-300 mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#15121a] border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">إجراءات سريعة</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("courses");
                      openNewCourseForm();
                    }}
                    className="p-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة كورس وفيديوهات يوتيوب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("users");
                      setAddUserModal(true);
                    }}
                    className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة طالب جديد وتفعيل كورس</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-[#15121a] border border-white/10 p-5 space-y-3">
                <h3 className="text-sm font-black text-white">أحدث المستخدمين نشاطاً</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-xs bg-black/30 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${u.online ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
                        />
                        <span className="font-bold text-white">{u.name}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{u.phone || u.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: COURSES & YOUTUBE VIDEOS STUDIO ==================== */}
        {tab === "courses" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-black text-white">إدارة الكورسات وفيديوهات يوتيوب</h2>
                <p className="text-xs text-slate-400">
                  ارفع الفيديوهات مباشرة من جهازك على قناتك في يوتيوب (غير مدرجة باللينك فقط تلقائياً) أو الصق أي رابط يوتيوب جاهز.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewCourseForm}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة كورس جديد</span>
              </button>
            </div>

            {/* YouTube Channel Direct Upload Integration Banner */}
            <div
              className={`rounded-3xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                ytStatus.connected
                  ? "bg-emerald-950/25 border-emerald-500/35"
                  : "bg-gradient-to-l from-rose-950/35 to-[#15121a] border-rose-500/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {ytStatus.connected && ytStatus.channelThumbnail ? (
                  <img
                    src={ytStatus.channelThumbnail}
                    alt=""
                    className="w-11 h-11 rounded-2xl border border-emerald-400/40 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/35 text-rose-400 flex items-center justify-center shrink-0">
                    <Youtube className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {ytStatus.connected
                        ? `القناة المربوطة: ${ytStatus.channelTitle || "قناة يوتيوب"}`
                        : "ربط قناة يوتيوب للرفع المباشر التلقائي (غير مدرج / باللينك فقط)"}
                    </span>
                    {ytStatus.connected && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/35">
                        متصل ✓ • Unlisted تلقائي
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ytStatus.connected
                      ? "أي فيديو ترفعه من المنصة ينزل تلقائياً على قناتك غير مدرج (لا يظهر في القناة أو البحث) ويُربط بالدرس فوراً."
                      : "اربط قناتك مرة واحدة فقط بحساب جوجل، وبعدها ارفع المحاضرات من هنا مباشرة لتنزل Unlisted تلقائياً!"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setYtModalOpen(true)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                    ytStatus.connected
                      ? "bg-white/10 hover:bg-white/15 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{ytStatus.connected ? "إعدادات الربط" : "ربط قناة يوتيوب الآن"}</span>
                </button>
                {ytStatus.connected && (
                  <button
                    type="button"
                    disabled={ytBusy}
                    onClick={handleDisconnectYouTube}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold cursor-pointer"
                    title="فصل القناة"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>فصل</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bunny.net Stream Library Connector & Bulk Importer Banner */}
            <div
              className={`rounded-3xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                bunnyStatus.connected
                  ? "bg-amber-950/20 border-amber-500/40"
                  : "bg-gradient-to-l from-orange-950/35 to-[#15121a] border-orange-500/35"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/20 border border-orange-400/40 text-orange-400 flex items-center justify-center shrink-0">
                  <CloudDownload className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {bunnyStatus.connected
                        ? `مكتبة Bunny.net متصلة (Library #${bunnyStatus.libraryId})`
                        : "سحب واستيراد كل فيديوهاتك من Bunny.net (Bunny Stream)"}
                    </span>
                    {bunnyStatus.connected && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
                        متصل ✓ {bunnyStatus.hasTokenAuthKey ? "• محمي بـ Token Auth" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    اسحب فيديوهاتك من Bunny وارفعها تلقائياً على قناتك في يوتيوب (غير مدرج باللينك فقط) وتنزل فوراً في المنصة للطلاب — بدون استهلاك إنترنت جهازك!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => openBunnyImporter(bunnyStatus.connected ? "import" : "config")}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-orange-600 to-amber-500 hover:brightness-110 text-black font-black text-xs shadow-lg cursor-pointer"
                >
                  <CloudDownload className="w-4 h-4" />
                  <span>{bunnyStatus.connected ? "سحب ونقل فيديوهات Bunny ليوتيوب" : "ربط Bunny للنقل إلى يوتيوب"}</span>
                </button>
                {bunnyStatus.connected && (
                  <button
                    type="button"
                    onClick={() => openBunnyImporter("config")}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                  >
                    الإعدادات
                  </button>
                )}
              </div>
            </div>

            {/* Live Background Cloud Migration Banner (Bunny -> YouTube -> Platform) */}
            {migrationJob && (migrationJob.running || (migrationJob.total > 0 && migrationJob.logs?.length > 0)) && (
              <div className="rounded-3xl bg-[#171220] border border-amber-500/45 p-4 space-y-2.5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                    {migrationJob.running ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>
                      {migrationJob.running
                        ? `جاري النقل السحابي (Bunny ← يوتيوب غير مدرج ← المنصة): ${migrationJob.completed + 1} / ${migrationJob.total}`
                        : `اكتملت عملية النقل السحابي: نجح ${migrationJob.completed} من ${migrationJob.total}${
                            migrationJob.failed ? ` (فشل ${migrationJob.failed})` : ""
                          }`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openBunnyImporter("import")}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white cursor-pointer"
                    >
                      عرض التفاصيل
                    </button>
                    {migrationJob.running && (
                      <button
                        type="button"
                        onClick={handleCancelMigration}
                        className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold cursor-pointer"
                      >
                        إيقاف
                      </button>
                    )}
                  </div>
                </div>
                {migrationJob.running && (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="truncate max-w-[75%]">
                        {migrationJob.currentStage === "downloading_bunny"
                          ? "⬇️ سحب الفيديو من Bunny: "
                          : migrationJob.currentStage === "uploading_youtube"
                            ? "⬆️ رفع الفيديو على قناتك في يوتيوب (غير مدرج): "
                            : "✅ نشر الدرس في المنصة: "}
                        <strong>{migrationJob.currentTitle}</strong>
                      </span>
                      <span className="font-mono font-bold text-amber-300">{migrationJob.currentPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-rose-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${migrationJob.currentPercent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Course Add/Edit Form */}
            {editingCourse && (
              <form
                onSubmit={saveCourse}
                className="rounded-3xl bg-[#171320] border border-rose-500/40 p-5 md:p-6 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-black text-amber-300">
                    {editingCourse.id ? "تعديل بيانات الكورس" : "إنشاء كورس تدريبي جديد"}
                  </h3>
                  <button type="button" onClick={() => setEditingCourse(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">اسم الكورس *</label>
                    <input
                      required
                      value={cTitle}
                      onChange={(e) => setCTitle(e.target.value)}
                      placeholder="مثال: دبلومة المونتاج الاحترافي"
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">التصنيف</label>
                    <input
                      value={cCategory}
                      onChange={(e) => setCCategory(e.target.value)}
                      placeholder="مثال: مونتاج / جرافيك / برمجة"
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">نبذة مختصرة</label>
                    <input
                      value={cSubtitle}
                      onChange={(e) => setCSubtitle(e.target.value)}
                      placeholder="وصف سريع يظهر للطالب على كارت الكورس"
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">السعر (ج.م — اختياري)</label>
                    <input
                      type="number"
                      dir="ltr"
                      value={cPrice}
                      onChange={(e) => setCPrice(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-300 block">صورة غلاف الكورس</label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-extrabold cursor-pointer shrink-0 transition-colors">
                        {uploadingThumb ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري رفع الصورة...</span>
                          </>
                        ) : (
                          <>
                            <ImagePlus className="w-4 h-4" />
                            <span>رفع صورة من الجهاز / الموبايل</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingThumb}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            setUploadingThumb(true);
                            try {
                              const uploadedUrl = await compressAndUploadCourseImage(f);
                              setCThumb(uploadedUrl);
                              toast.success("تم رفع صورة غلاف الكورس بنجاح ✓");
                            } catch (err: any) {
                              toast.error(err?.message || "تعذّر رفع الصورة");
                            } finally {
                              setUploadingThumb(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </label>
                      <input
                        dir="ltr"
                        value={cThumb}
                        onChange={(e) => setCThumb(e.target.value)}
                        placeholder="أو الصق رابط صورة مباشر (أو اتركه ليُجلب من أول فيديو يوتيوب)"
                        className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
                      />
                    </div>
                    {cThumb && (
                      <div className="flex items-center gap-3 pt-1">
                        <img
                          src={resolveMediaUrl(cThumb)}
                          alt="معاينة الغلاف"
                          className="w-28 h-16 rounded-xl object-cover border border-white/15 bg-black"
                        />
                        <button
                          type="button"
                          onClick={() => setCThumb("")}
                          className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          إزالة الصورة
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cPublished}
                      onChange={(e) => setCPublished(e.target.checked)}
                      className="accent-rose-600"
                    />
                    <span>نشر الكورس للطلاب في التطبيقات</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCourse(null)}
                      className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer"
                    >
                      {busy ? "جاري الحفظ..." : "حفظ الكورس"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Courses List */}
            {courses.length === 0 ? (
              <div className="rounded-3xl bg-[#15121a] border border-dashed border-white/15 p-12 text-center space-y-3">
                <Youtube className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-base font-black text-white">قاعدة البيانات نظيفة وجاهزة لأول كورس لك!</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  اضغط على "إضافة كورس جديد" ثم الصق روابط فيديوهات يوتيوب لتسمّع في نفس الثانية على الديسكتوب والموبايل.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((c) => {
                  const isExpanded = expandedCourseId === c.id || courses.length === 1;
                  const lessonCount = (c.sections || []).reduce(
                    (acc: number, s: any) => acc + (s.lessons?.length || 0),
                    0,
                  );

                  return (
                    <div key={c.id} className="rounded-3xl bg-[#15121a] border border-white/10 overflow-hidden shadow-xl">
                      {/* Course Header */}
                      <div className="p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 bg-black/25">
                        <div className="flex items-center gap-3.5">
                          {c.thumbnail_url ? (
                            <img src={resolveMediaUrl(c.thumbnail_url)} alt="" className="w-16 h-11 rounded-xl object-cover bg-black" />
                          ) : (
                            <div className="w-16 h-11 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center font-black">
                              YT
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm md:text-base font-black text-white">{c.title}</h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  c.is_published
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-slate-600/30 text-slate-400"
                                }`}
                              >
                                {c.is_published ? "منشور" : "مخفي"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {c.category} • {lessonCount} فيديو يوتيوب • {c.enrolled_count || 0} طالب مشترك
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCourseId(isExpanded && courses.length > 1 ? null : c.id)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600/15 border border-rose-500/30 text-rose-300 text-xs font-extrabold cursor-pointer"
                          >
                            إدارة الفصول والفيديوهات
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCourseForm(c)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                            title="تعديل الكورس"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCourse(c)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-rose-600/25 text-rose-400 cursor-pointer"
                            title="حذف الكورس"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Course Sections & YouTube Lessons */}
                      {isExpanded && (
                        <div className="p-4 md:p-5 space-y-4 border-t border-white/10">
                          {(c.sections || []).map((sec: any) => (
                            <div key={sec.id} className="rounded-2xl bg-black/35 border border-white/10 p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-xs md:text-sm font-extrabold text-amber-300">{sec.title}</h4>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openAddLesson(c.id, sec.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>إضافة فيديو يوتيوب</span>
                                  </button>
                                  {(c.sections?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!confirm(`حذف فصل "${sec.title}"؟`)) return;
                                        await apiFetch(`/api/admin/sections/${sec.id}`, { method: "DELETE" });
                                        await onRefresh();
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {(sec.lessons || []).length === 0 ? (
                                <p className="text-[11px] text-slate-500">لا توجد فيديوهات في هذا الفصل بعد.</p>
                              ) : (
                                <div className="space-y-2">
                                  {(sec.lessons || []).map((l: any, idx: number) => (
                                    <div
                                      key={l.id}
                                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#16131d] border border-white/5"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        {l.youtube_video_id?.startsWith("list:") ? (
                                          <div className="w-12 h-9 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center text-[10px] font-black shrink-0">
                                            قائمة
                                          </div>
                                        ) : (
                                          <img
                                            src={`https://i.ytimg.com/vi/${l.youtube_video_id}/default.jpg`}
                                            alt=""
                                            className="w-12 h-9 rounded-lg object-cover bg-black shrink-0"
                                          />
                                        )}
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-white truncate">
                                            {idx + 1}. {l.title}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <span className="font-mono text-rose-400">YT: {l.youtube_video_id}</span>
                                            {l.duration_label && <span>• {l.duration_label}</span>}
                                            {l.is_free_preview && (
                                              <span className="text-emerald-400 font-bold">• معاينة مجانية</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => openAddLesson(c.id, sec.id, l)}
                                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteLesson(l.id)}
                                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/20 text-rose-400 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Add New Section Bar */}
                          <div className="flex gap-2 pt-1">
                            <input
                              value={newSectionTitle}
                              onChange={(e) => setNewSectionTitle(e.target.value)}
                              placeholder="اسم فصل / باب جديد (مثال: الفصل الثاني — التطبيق العملي)"
                              className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => addSection(c.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                            >
                              <FolderPlus className="w-4 h-4 text-amber-400" />
                              <span>إضافة فصل</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: USERS & STUDENTS MANAGEMENT ==================== */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ابحث باسم الطالب، الإيميل، أو رقم الموبايل..."
                className="flex-1 rounded-2xl bg-[#15121a] border border-white/10 focus:border-rose-500 px-4 py-3 text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setAddUserModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة طالب جديد يدوياً</span>
              </button>
            </div>

            <div className="space-y-3">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl bg-[#15121a] border border-white/10 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">{u.name}</span>
                      {u.role === "admin" && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                          أدمن المنصة
                        </span>
                      )}
                      {u.online ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          متصل الآن ({u.online.platform === "mobile" ? "موبايل" : u.online.platform === "desktop" ? "كمبيوتر" : "ويب"})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          آخر ظهور: {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString("ar-EG") : "لم يدخل بعد"}
                        </span>
                      )}
                      {u.is_banned && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600/30 text-rose-300 text-[10px] font-bold">
                          محظور
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="font-mono">{u.email}</span>
                      {u.phone && <span className="font-mono text-amber-300">📱 {u.phone}</span>}
                      <span>• الكورسات المفعّلة: {u.enrolled_course_ids?.length || 0}</span>
                      <span>• الدروس المكتملة: {u.completed_lessons_total || 0}</span>
                    </div>

                    {/* User's Hardware Devices */}
                    {u.devices?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {u.devices.map((d: any) => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-slate-300"
                          >
                            {d.platform === "mobile" ? (
                              <Smartphone className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Monitor className="w-3 h-3 text-sky-400" />
                            )}
                            <span>{d.device_label}</span>
                            {d.hw_short && <code className="text-amber-300 font-mono">[{d.hw_short}]</code>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Admin Quick Actions per User */}
                  {u.role !== "admin" && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEnrollModalUser(u)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer"
                      >
                        فتح / إدارة الكورسات ({u.enrolled_course_ids?.length || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => resetUserDevices(u)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold cursor-pointer"
                        title="إعادة تعيين بصمة الجهاز للطالب"
                      >
                        تصفير الجهاز ({u.devices?.length || 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleBanUser(u)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                          u.is_banned
                            ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
                            : "bg-white/5 border-white/10 text-slate-300 hover:text-rose-400"
                        }`}
                      >
                        {u.is_banned ? "فك الحظر" : "حظر"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: ACTIVATION CODES ==================== */}
        {tab === "codes" && (
          <div className="space-y-5">
            <form
              onSubmit={generateCodes}
              className="rounded-3xl bg-[#15121a] border border-white/10 p-5 flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-300">اختر الكورس لتوليد أكواد تفعيل له</label>
                <select
                  value={codeCourseId || courses[0]?.id || ""}
                  onChange={(e) => setCodeCourseId(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-32 space-y-1">
                <label className="text-xs font-bold text-slate-300">عدد الأكواد</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={codeCount}
                  onChange={(e) => setCodeCount(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3.5 py-2.5 text-xs text-center text-white outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || courses.length === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs cursor-pointer"
              >
                توليد الأكواد الآن
              </button>
            </form>

            {codes.some((c) => !c.is_used) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const unused = codes
                      .filter((c) => !c.is_used)
                      .map((c) => `${c.code} (${c.course_title || ""})`)
                      .join("\n");
                    navigator.clipboard.writeText(unused);
                    toast.success("تم نسخ جميع الأكواد المتاحة للحافظة ✓");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-amber-300 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ كل الأكواد غير المستخدمة</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {codes.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-3.5 flex items-center justify-between ${
                    c.is_used ? "bg-black/25 border-white/5 opacity-60" : "bg-[#15121a] border-amber-500/30"
                  }`}
                >
                  <div>
                    <code className="text-sm font-mono font-black text-amber-300">{c.code}</code>
                    <div className="text-[11px] text-slate-400 mt-0.5">{c.course_title}</div>
                    {c.is_used && (
                      <div className="text-[10px] text-emerald-400 mt-0.5">استخدمه: {c.used_by_name || c.used_by_email}</div>
                    )}
                  </div>
                  {!c.is_used && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(c.code);
                        toast.success(`تم نسخ الكود ${c.code}`);
                      }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB: STUDENT PAYMENT REQUESTS (INSTAPAY / WALLET) ==================== */}
        {tab === "payments" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span>طلبات الدفع وإيصالات التحويل ({payments.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  راجع صورة إيصال إنستا باي أو المحفظة واضغط قبول ليتم تفعيل الكورس للطالب فوراً في نفس اللحظة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold cursor-pointer"
              >
                تعديل أرقام إنستا باي والمحفظة
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-3xl bg-[#15121a] border border-dashed border-white/15 p-10 text-center space-y-2">
                <CreditCard className="w-10 h-10 text-slate-500 mx-auto" />
                <div className="text-sm font-extrabold text-white">لا توجد طلبات دفع مرسلة حتى الآن</div>
                <p className="text-xs text-slate-400">
                  عندما يضغط أي طالب على "ادفع الآن" ويرفع صورة التحويل ستظهر هنا فوراً مع إشعار مباشر.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {payments.map((p: any) => (
                  <div
                    key={p.id}
                    className={`rounded-3xl bg-[#15121a] border p-4 space-y-3 shadow-xl ${
                      p.status === "pending"
                        ? "border-amber-500/45"
                        : p.status === "approved"
                          ? "border-emerald-500/30"
                          : "border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white truncate">{p.user_name || "طالب"}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.user_email} {p.user_phone ? `• ${p.user_phone}` : ""}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                          p.status === "pending"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : p.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {p.status === "pending" ? "بانتظار المراجعة" : p.status === "approved" ? "مقبول ومفعّل ✓" : "مرفوض"}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-black/40 border border-white/5 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">الكورس:</span>
                        <span className="font-extrabold text-white text-left">{p.course_title}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">المبلغ:</span>
                        <span className="font-black text-emerald-400">{p.amount} ج.م</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">طريقة الدفع:</span>
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                          {p.method === "wallet" ? (
                            <>
                              <Wallet className="w-3.5 h-3.5" /> محفظة إلكترونية
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5" /> إنستا باي (InstaPay)
                            </>
                          )}
                        </span>
                      </div>
                      {p.sender_phone && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">المحوّل منه:</span>
                          <code dir="ltr" className="font-mono text-white">
                            {p.sender_phone}
                          </code>
                        </div>
                      )}
                      {p.notes && (
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-white/5">
                          ملاحظة الطالب: {p.notes}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 pt-0.5">
                        تاريخ الإرسال: {new Date(p.created_at).toLocaleString("ar-EG")}
                      </div>
                    </div>

                    {/* Receipt Screenshot Preview */}
                    {p.receipt_url && (
                      <button
                        type="button"
                        onClick={() => setReceiptPreviewUrl(resolveMediaUrl(p.receipt_url))}
                        className="w-full rounded-2xl overflow-hidden border border-white/15 bg-black/60 hover:border-amber-400 transition-colors cursor-pointer group relative"
                      >
                        <img
                          src={resolveMediaUrl(p.receipt_url)}
                          alt="إيصال التحويل"
                          className="w-full max-h-52 object-contain mx-auto"
                        />
                        <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 text-[10px] font-bold text-amber-300">
                          اضغط لتكبير صورة الإيصال 🔍
                        </span>
                      </button>
                    )}

                    {/* Action Buttons */}
                    {p.status !== "approved" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => approvePayment(p)}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>قبول وتفعيل الكورس فوراً</span>
                        </button>
                        {p.status === "pending" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => rejectPayment(p)}
                            className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/35 text-rose-300 hover:text-white font-extrabold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>رفض</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: PUSH & BRANDING SETTINGS ==================== */}
        {tab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <form onSubmit={sendPushAlert} className="rounded-3xl bg-[#15121a] border border-white/10 p-5 space-y-4">
              <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>إرسال إشعار فوري لحظي (يظهر حالاً على شاشات الكمبيوتر والموبايل)</span>
              </h3>
              <div className="space-y-3">
                <input
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="عنوان الإشعار (مثال: محاضرة جديدة نزلت الآن 🔥)"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
                />
                <textarea
                  rows={3}
                  required
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="اكتب رسالة التنبيه للطلاب..."
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer"
                >
                  بث الإشعار فوراً لكل الطلاب
                </button>
              </div>
            </form>

            <form onSubmit={savePlatformSettings} className="rounded-3xl bg-[#15121a] border border-white/10 p-5 space-y-3">
              <h3 className="text-sm font-black text-white">إعدادات اسم المنصة والحماية</h3>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-400">اسم المنصة / الأكاديمية</label>
                  <input
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400">اسم المحاضر</label>
                  <input
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400">الرسالة الترحيبية</label>
                  <input
                    value={welcomeSub}
                    onChange={(e) => setWelcomeSub(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400">رقم واتساب الإدارة (بكود الدولة)</label>
                    <input
                      dir="ltr"
                      value={waNumber}
                      onChange={(e) => setWaNumber(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400">عدد الأجهزة المسموح لكل طالب</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxDev}
                      onChange={(e) => setMaxDev(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-center text-white outline-none mt-1"
                    />
                  </div>
                </div>

                {/* Payment Accounts Configuration (InstaPay + E-Wallet) */}
                <div className="pt-2 border-t border-white/10 space-y-2.5">
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span>بيانات استقبال الدفع (تظهر للطلاب عند الضغط على "ادفع الآن")</span>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400">عنوان أو رقم إنستا باي (InstaPay)</label>
                    <input
                      dir="ltr"
                      value={instapayAddr}
                      onChange={(e) => setInstapayAddr(e.target.value)}
                      placeholder="010xxxxxxxx أو medoshalaby@instapay"
                      className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400">رقم المحفظة (فودافون كاش / محفظة)</label>
                      <input
                        dir="ltr"
                        value={walletNum}
                        onChange={(e) => setWalletNum(e.target.value)}
                        placeholder="010xxxxxxxx"
                        className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400">اسم صاحب الحساب (المستلم)</label>
                      <input
                        value={payHolderName}
                        onChange={(e) => setPayHolderName(e.target.value)}
                        placeholder="بشمهندس ميدو شلبي"
                        className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-xs text-white outline-none mt-1"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs mt-2 cursor-pointer"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* ==================== MODAL: ADD/EDIT YOUTUBE LESSON ==================== */}
      {lessonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={saveLesson}
            className="w-full max-w-lg rounded-3xl bg-[#16121d] border border-white/15 p-5 md:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Youtube className="w-5 h-5 text-rose-500" />
                <span>{lessonModal.editing ? "تعديل محاضرة يوتيوب" : "إضافة فيديو يوتيوب جديد"}</span>
              </h3>
              <button type="button" onClick={() => setLessonModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">عنوان المحاضرة *</label>
                <input
                  required
                  value={lTitle}
                  onChange={(e) => setLTitle(e.target.value)}
                  placeholder="مثال: المحاضرة الأولى — أساسيات التحريك"
                  className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>

              {/* Mode Switcher: Direct Upload to Connected YouTube Channel vs Paste Link */}
              {!lessonModal.editing && (
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/50 border border-white/10">
                  <button
                    type="button"
                    disabled={uploadingVideo}
                    onClick={() => setLessonMode("upload")}
                    className={`py-2 px-3 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      lessonMode === "upload"
                        ? "bg-rose-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع فيديو مباشر ليوتيوب</span>
                  </button>
                  <button
                    type="button"
                    disabled={uploadingVideo}
                    onClick={() => setLessonMode("link")}
                    className={`py-2 px-3 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      lessonMode === "link"
                        ? "bg-rose-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>لصق رابط يوتيوب جاهز</span>
                  </button>
                </div>
              )}

              {/* Direct Upload to YouTube (Automatically Unlisted!) */}
              {!lessonModal.editing && lessonMode === "upload" ? (
                <div className="space-y-2.5">
                  {!ytStatus.connected ? (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/35 p-4 text-center space-y-2.5">
                      <Youtube className="w-8 h-8 text-rose-500 mx-auto" />
                      <div className="text-xs font-extrabold text-white">اربط قناتك على يوتيوب أولاً للرفع المباشر</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        بعد ربط قناتك مرة واحدة، سترفع الفيديو من جهازك هنا وسينزل تلقائياً على يوتيوب <strong>غير مدرج (باللينك فقط)</strong> ويُضاف للدرس بدون أي خطوات يدوية!
                      </p>
                      <button
                        type="button"
                        onClick={() => setYtModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer"
                      >
                        ربط قناة يوتيوب الآن
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-300 font-bold">
                          ✓ الرفع التلقائي على قناة: <strong>{ytStatus.channelTitle}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/40 text-amber-300 font-bold text-[10px]">
                          غير مدرج (باللينك فقط)
                        </span>
                      </div>

                      <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-500/40 hover:border-rose-400 bg-black/40 p-5 cursor-pointer transition-colors">
                        <Upload className="w-8 h-8 text-rose-400" />
                        {videoFile ? (
                          <div className="text-center space-y-0.5">
                            <div className="text-xs font-black text-white">{videoFile.name}</div>
                            <div className="text-[11px] text-amber-300 font-bold">
                              {(videoFile.size / (1024 * 1024)).toFixed(1)} MB — اضغط لتغيير الملف
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-extrabold text-white">اضغط لاختيار ملف الفيديو من جهازك</span>
                            <span className="text-[10.5px] text-slate-400">MP4 / MOV / MKV — يُرفع مقسّماً بدون حد حجم</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="video/*"
                          disabled={uploadingVideo}
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setVideoFile(f);
                            if (f && !lTitle.trim()) {
                              setLTitle(f.name.replace(/\.[^.]+$/, ""));
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      {uploadingVideo && (
                        <div className="rounded-2xl bg-black/55 border border-amber-500/35 p-3.5 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-amber-300 flex items-center gap-1.5">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جاري الرفع على يوتيوب (غير مدرج)...
                            </span>
                            <span className="font-mono text-white">{uploadProg.percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-l from-rose-500 to-amber-400 transition-all duration-300"
                              style={{ width: `${uploadProg.percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {uploadProg.uploadedMB} MB / {uploadProg.totalMB} MB
                            </span>
                            <button
                              type="button"
                              onClick={() => uploadAbortRef.current?.abort()}
                              className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                            >
                              إلغاء الرفع
                            </button>
                          </div>
                        </div>
                      )}

                      {uploadWarningVideoId && (
                        <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 p-3 text-[11px] text-amber-200 space-y-1">
                          <div>تم الرفع لكن Google Cloud قيّد الخصوصية إلى Private لحين توثيق التطبيق:</div>
                          <a
                            href={`https://studio.youtube.com/video/${uploadWarningVideoId}/edit`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-black text-white underline"
                          >
                            افتح الفيديو في YouTube Studio لتحويله لـ Unlisted ←
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    رابط فيديو يوتيوب (Unlisted غير مدرج أو قائمة تشغيل) *
                  </label>
                  <input
                    required
                    dir="ltr"
                    value={lYoutubeUrl}
                    onChange={(e) => setLYoutubeUrl(e.target.value)}
                    placeholder="https://youtu.be/xxxxxxxxxxx أو https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* Instant Live YouTube Video / Playlist Preview */}
              {previewYtId && (
                <div className="rounded-2xl bg-black/50 border border-emerald-500/35 p-2.5 flex items-center gap-3">
                  {previewYtId.startsWith("list:") ? (
                    <div className="w-20 h-12 rounded-xl bg-rose-600/20 border border-rose-500/35 text-rose-300 flex items-center justify-center text-xs font-black shrink-0">
                      Playlist
                    </div>
                  ) : (
                    <img
                      src={`https://i.ytimg.com/vi/${previewYtId}/hqdefault.jpg`}
                      alt="YouTube Preview"
                      className="w-24 h-14 rounded-xl object-cover"
                    />
                  )}
                  <div className="text-xs min-w-0">
                    <div className="font-bold text-emerald-400">
                      {previewYtId.startsWith("list:")
                        ? "✓ تم التعرف على قائمة تشغيل يوتيوب كاملة!"
                        : "✓ تم التعرف على فيديو يوتيوب بنجاح!"}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">{previewYtId}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">مدة الفيديو (اختياري)</label>
                  <input
                    dir="ltr"
                    value={lDuration}
                    onChange={(e) => setLDuration(e.target.value)}
                    placeholder="25:00"
                    className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">ملحقات إضافية (اختياري)</label>
                  <input
                    dir="ltr"
                    value={lAttach}
                    onChange={(e) => setLAttach(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-rose-300 block mb-1">📄 رابط ملف PDF / ملخص (اختياري)</label>
                  <input
                    dir="ltr"
                    value={lPdf}
                    onChange={(e) => setLPdf(e.target.value)}
                    placeholder="https://.../summary.pdf"
                    className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">📱 رابط تثبيت التطبيق / البرنامج</label>
                  <input
                    dir="ltr"
                    value={lAppDownload}
                    onChange={(e) => setLAppDownload(e.target.value)}
                    placeholder="رابط المتجر أو https://.../app.exe"
                    className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-cyan-300 block mb-1">🔗 روابط ومراجع إضافية للدرس (اختياري)</label>
                <input
                  dir="ltr"
                  value={lResourceLinks}
                  onChange={(e) => setLResourceLinks(e.target.value)}
                  placeholder="https://example.com/reference"
                  className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">📝 نص التاسك / الواجب المطلوب من الطالب (اختياري)</label>
                <textarea
                  rows={2}
                  value={lTask}
                  onChange={(e) => setLTask(e.target.value)}
                  placeholder="اكتب التكليف العملي المطلوب من الطالب بعد مشاهدة هذه المحاضرة..."
                  className="w-full rounded-xl bg-purple-950/25 border border-purple-500/30 px-3.5 py-2 text-xs text-white outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">ملاحظات أو شرح أسفل الفيديو (اختياري)</label>
                <textarea
                  rows={2}
                  value={lDesc}
                  onChange={(e) => setLDesc(e.target.value)}
                  className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lPreview}
                  onChange={(e) => setLPreview(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>متاح كـ "معاينة مجانية" قبل الاشتراك في الكورس</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={uploadingVideo}
                onClick={() => setLessonModal(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-bold disabled:opacity-40"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy || uploadingVideo}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold text-xs cursor-pointer"
              >
                {uploadingVideo
                  ? `جاري الرفع (${uploadProg.percent}%)...`
                  : busy
                    ? "جاري النشر..."
                    : !lessonModal.editing && lessonMode === "upload" && !lYoutubeUrl
                      ? "رفع ليوتيوب (غير مدرج) ونشر الدرس 🚀"
                      : "حفظ ونشر الفيديو فوراً"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL: MANAGE STUDENT ENROLLMENTS ==================== */}
      {liveModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#16121d] border border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">تفعيل الكورسات للطالب: {liveModalUser.name}</h3>
                <p className="text-[11px] text-slate-400">{liveModalUser.email}</p>
              </div>
              <button type="button" onClick={() => setEnrollModalUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {courses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">أضف كورساً أولاً من تبويب الكورسات.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {courses.map((c) => {
                  const isEnrolled = (liveModalUser.enrolled_course_ids || []).includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10"
                    >
                      <span className="text-xs font-bold text-white">{c.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleUserEnrollment(liveModalUser.id, c.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                          isEnrolled
                            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                            : "bg-white/10 hover:bg-rose-600 text-white"
                        }`}
                      >
                        {isEnrolled ? "مفعّل ✓ (اضغط لإلغائه)" : "تفعيل للطالب"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD STUDENT MANUALLY ==================== */}
      {addUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md rounded-3xl bg-[#16121d] border border-white/15 p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">إنشاء حساب طالب جديد</h3>
              <button type="button" onClick={() => setAddUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              required
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              placeholder="اسم الطالب الثلاثي"
              className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-white outline-none"
            />
            <input
              required
              dir="ltr"
              value={uPhone}
              onChange={(e) => setUPhone(e.target.value)}
              placeholder="رقم الهاتف (010...)"
              className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-right text-white outline-none"
            />
            <input
              required
              type="email"
              dir="ltr"
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              placeholder="البريد الإلكتروني للطالب"
              className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-right text-white outline-none"
            />
            <input
              required
              dir="ltr"
              value={uPassword}
              onChange={(e) => setUPassword(e.target.value)}
              placeholder="كلمة المرور (6 أحرف على الأقل)"
              className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-right text-white outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer"
            >
              إنشاء حساب الطالب الآن
            </button>
          </form>
        </div>
      )}

      {/* ==================== MODAL: FULL-SIZE PAYMENT RECEIPT LIGHTBOX ==================== */}
      {receiptPreviewUrl && (
        <div
          onClick={() => setReceiptPreviewUrl(null)}
          className="fixed inset-0 z-[60] bg-black/92 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setReceiptPreviewUrl(null)}
              className="self-end px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
            <img
              src={receiptPreviewUrl}
              alt="إيصال التحويل بالحجم الكامل"
              className="max-w-full max-h-[82vh] rounded-2xl border border-white/20 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONNECT YOUTUBE CHANNEL (OAUTH SETUP) ==================== */}
      {ytModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveAndConnectYouTube}
            className="w-full max-w-xl rounded-3xl bg-[#16121d] border border-rose-500/35 p-5 md:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <Youtube className="w-5 h-5 text-rose-500" />
                <span>ربط قناة يوتيوب للرفع المباشر (غير مدرج تلقائياً)</span>
              </h3>
              <button type="button" onClick={() => setYtModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Easy Setup Steps */}
            <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-2 text-[11.5px] text-slate-300 leading-relaxed">
              <div className="font-black text-amber-300 text-xs">خطوات الربط لمرة واحدة فقط (مجاناً عبر Google Cloud):</div>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  افتح{" "}
                  <a
                    href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline font-bold"
                  >
                    Google Cloud Console
                  </a>{" "}
                  وأنشئ مشروعاً جديداً وفعّل <strong>YouTube Data API v3</strong>.
                </li>
                <li>
                  من قائمة <strong>APIs &amp; Services ← OAuth consent screen</strong> أضف بريد قناتك في <strong>Test users</strong>.
                </li>
                <li>
                  من <strong>Credentials ← Create Credentials ← OAuth client ID ← Web application</strong> أضف رابط العودة التالي في{" "}
                  <strong>Authorized redirect URIs</strong>:
                </li>
              </ol>

              <div className="flex items-center gap-2 bg-white/5 border border-amber-500/30 rounded-xl px-3 py-2 mt-1">
                <code dir="ltr" className="text-[11px] font-mono text-amber-300 truncate flex-1">
                  {ytStatus.redirectUri || "https://apps-backend-production-d2608a9b.up.railway.app/api/admin/youtube/oauth/callback"}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const uri =
                      ytStatus.redirectUri ||
                      "https://apps-backend-production-d2608a9b.up.railway.app/api/admin/youtube/oauth/callback";
                    navigator.clipboard?.writeText(uri).catch(() => {});
                    toast.success("تم نسخ رابط العودة (Redirect URI) ✓");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-black text-[10px] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>نسخ</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Google OAuth Client ID *</label>
                <input
                  required
                  dir="ltr"
                  value={ytClientId}
                  onChange={(e) => setYtClientId(e.target.value)}
                  placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                  className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-rose-500 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Google OAuth Client Secret {ytStatus.hasClientSecret ? "(محفوظ — اتركه فارغاً للإبقاء عليه)" : "*"}
                </label>
                <input
                  required={!ytStatus.hasClientSecret}
                  type="password"
                  dir="ltr"
                  value={ytClientSecret}
                  onChange={(e) => setYtClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-rose-500 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setYtModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={ytBusy}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-xs inline-flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Youtube className="w-4 h-4" />
                <span>{ytBusy ? "جاري التحضير..." : "حفظ وربط قناة يوتيوب بحساب جوجل الآن"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL: BUNNY.NET STREAM CONNECTOR & BULK IMPORTER ==================== */}
      {bunnyModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-[#16121d] border border-orange-500/40 p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <CloudDownload className="w-5 h-5 text-orange-400" />
                <span>سحب واستيراد الفيديوهات من Bunny.net (Bunny Stream)</span>
              </h3>
              <button
                type="button"
                onClick={() => setBunnyModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/50 border border-white/10">
              <button
                type="button"
                onClick={() => setBunnyTab("config")}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold cursor-pointer ${
                  bunnyTab === "config" ? "bg-orange-500 text-black" : "text-slate-400 hover:text-white"
                }`}
              >
                1. بيانات مكتبة Bunny (API)
              </button>
              <button
                type="button"
                disabled={!bunnyStatus.connected}
                onClick={() => {
                  setBunnyTab("import");
                  if (bunnyVideos.length === 0) void loadBunnyLibrary();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold disabled:opacity-40 cursor-pointer ${
                  bunnyTab === "import" ? "bg-orange-500 text-black" : "text-slate-400 hover:text-white"
                }`}
              >
                2. سحب واستيراد الفيديوهات ({bunnyVideos.length})
              </button>
            </div>

            {bunnyTab === "config" ? (
              <form onSubmit={handleSaveBunnyConfig} className="space-y-3.5">
                <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 text-[11.5px] text-slate-300 leading-relaxed space-y-1">
                  <div className="font-black text-amber-300 text-xs">من أين تحصل على البيانات من لوحة Bunny.net؟</div>
                  <div>
                    افتح <strong>dash.bunny.net ← Stream ← اختر مكتبة الفيديو ← API</strong> ستجد مباشرة:{" "}
                    <strong>Video Library ID</strong> و <strong>API Key</strong> و <strong>CDN Hostname</strong>.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Video Library ID (اختياري مع مفتاح الحساب العام)
                    </label>
                    <input
                      dir="ltr"
                      value={bunnyLibId}
                      onChange={(e) => setBunnyLibId(e.target.value)}
                      placeholder="مثال: 284915 (يُكتشف تلقائياً لو تركته فارغاً)"
                      className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-orange-400 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Bunny API Key (مفتاح الحساب العام أو مفتاح المكتبة) {bunnyStatus.hasApiKey ? "(محفوظ)" : "*"}
                    </label>
                    <input
                      required={!bunnyStatus.hasApiKey}
                      type="password"
                      dir="ltr"
                      value={bunnyApiKey}
                      onChange={(e) => setBunnyApiKey(e.target.value)}
                      placeholder="انسخ API Key من لوحة Bunny مباشرة"
                      className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-orange-400 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      CDN Hostname (يُكتشف تلقائياً مع مفتاح الحساب)
                    </label>
                    <input
                      dir="ltr"
                      value={bunnyCdnHost}
                      onChange={(e) => setBunnyCdnHost(e.target.value)}
                      placeholder="vz-xxxxxxxx-xxx.b-cdn.net"
                      className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-orange-400 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Token Authentication Key (اختياري — لو مفعّل حماية التوكن في Bunny)
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={bunnyTokenKey}
                      onChange={(e) => setBunnyTokenKey(e.target.value)}
                      placeholder="من Security ← Embed view token authentication"
                      className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setBunnyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={bunnyBusy}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-orange-600 to-amber-500 text-black font-black text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    {bunnyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                    <span>{bunnyBusy ? "جاري الاتصال وسحب القائمة..." : "حفظ وسحب كل فيديوهات Bunny الآن"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bunnyFilterCol}
                    onChange={(e) => setBunnyFilterCol(e.target.value)}
                    className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="all">كل المجلدات ({bunnyVideos.length} فيديو)</option>
                    {bunnyCollections.map((col) => (
                      <option key={col.guid} value={col.guid}>
                        📁 {col.name} ({col.videoCount})
                      </option>
                    ))}
                    <option value="__root__">فيديوهات بدون مجلد</option>
                  </select>

                  <input
                    value={bunnySearch}
                    onChange={(e) => setBunnySearch(e.target.value)}
                    placeholder="ابحث باسم الفيديو..."
                    className="flex-1 min-w-[160px] rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                  />

                  <button
                    type="button"
                    disabled={bunnyBusy}
                    onClick={() => void loadBunnyLibrary()}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${bunnyBusy ? "animate-spin" : ""}`} />
                    <span>تحديث</span>
                  </button>
                </div>

                {/* Selection Helpers */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBunnySelectedGuids(filteredBunnyVideos.map((v) => v.guid))}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold cursor-pointer"
                    >
                      تحديد المعروض ({filteredBunnyVideos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBunnySelectedGuids(filteredBunnyVideos.filter((v) => !v.alreadyImported).map((v) => v.guid))
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/35 text-emerald-300 font-bold cursor-pointer"
                    >
                      تحديد الجديد فقط
                    </button>
                    <button
                      type="button"
                      onClick={() => setBunnySelectedGuids([])}
                      className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                  <span className="font-black text-amber-300">المحدد للسحب: {bunnySelectedGuids.length} فيديو</span>
                </div>

                {/* Bunny Videos List */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-2xl bg-black/40 border border-white/10 p-2.5">
                  {bunnyBusy && bunnyVideos.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                      <span>جاري سحب قائمة الفيديوهات من Bunny.net...</span>
                    </div>
                  ) : filteredBunnyVideos.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">لا توجد فيديوهات مطابقة</div>
                  ) : (
                    filteredBunnyVideos.map((v) => {
                      const checked = bunnySelectedGuids.includes(v.guid);
                      const colName = bunnyCollections.find((c) => c.guid === v.collectionId)?.name;
                      return (
                        <label
                          key={v.guid}
                          className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-colors ${
                            checked ? "bg-orange-500/15 border-orange-400/50" : "bg-black/35 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setBunnySelectedGuids((prev) =>
                                prev.includes(v.guid) ? prev.filter((id) => id !== v.guid) : [...prev, v.guid],
                              )
                            }
                            className="accent-orange-500 shrink-0"
                          />
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt="" className="w-16 h-10 rounded-lg object-cover bg-black shrink-0" />
                          ) : (
                            <div className="w-16 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <Video className="w-4 h-4 text-orange-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">{v.title}</div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              {v.durationLabel && <span>⏱ {v.durationLabel}</span>}
                              {v.storageSizeMB > 0 && <span>• {v.storageSizeMB} MB</span>}
                              {colName && (
                                <span className="inline-flex items-center gap-0.5 text-amber-300">
                                  <FolderOpen className="w-3 h-3" /> {colName}
                                </span>
                              )}
                            </div>
                          </div>
                          {v.alreadyImported && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                              مستورد ✓
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Destination Mode Selector */}
                <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-3">
                  <div className="text-xs font-black text-amber-300">أين تريد تنزيل الفيديوهات المسحوبة؟</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBunnyTargetMode("by_collection")}
                      className={`p-2.5 rounded-xl border text-[11px] font-extrabold text-right cursor-pointer ${
                        bunnyTargetMode === "by_collection"
                          ? "bg-orange-500/20 border-orange-400 text-white"
                          : "bg-black/30 border-white/10 text-slate-400"
                      }`}
                    >
                      ✨ كل مجلد في Bunny يصبح كورساً تلقائياً
                    </button>
                    <button
                      type="button"
                      onClick={() => setBunnyTargetMode("new_course")}
                      className={`p-2.5 rounded-xl border text-[11px] font-extrabold text-right cursor-pointer ${
                        bunnyTargetMode === "new_course"
                          ? "bg-orange-500/20 border-orange-400 text-white"
                          : "bg-black/30 border-white/10 text-slate-400"
                      }`}
                    >
                      📁 إنشاء كورس جديد لكل المحدد
                    </button>
                    <button
                      type="button"
                      disabled={courses.length === 0}
                      onClick={() => setBunnyTargetMode("existing")}
                      className={`p-2.5 rounded-xl border text-[11px] font-extrabold text-right disabled:opacity-40 cursor-pointer ${
                        bunnyTargetMode === "existing"
                          ? "bg-orange-500/20 border-orange-400 text-white"
                          : "bg-black/30 border-white/10 text-slate-400"
                      }`}
                    >
                      ➕ إضافة داخل كورس موجود حالياً
                    </button>
                  </div>

                  {bunnyTargetMode === "new_course" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        value={bunnyNewCourseTitle}
                        onChange={(e) => setBunnyNewCourseTitle(e.target.value)}
                        placeholder="اسم الكورس الجديد *"
                        className="sm:col-span-2 rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                      />
                      <input
                        type="number"
                        dir="ltr"
                        value={bunnyNewCoursePrice}
                        onChange={(e) => setBunnyNewCoursePrice(e.target.value)}
                        placeholder="السعر (ج.م)"
                        className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  )}

                  {bunnyTargetMode === "existing" && courses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={bunnyTargetCourseId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setBunnyTargetCourseId(cid);
                          const c = courses.find((x) => x.id === cid);
                          setBunnyTargetSectionId(c?.sections?.[0]?.id || "");
                        }}
                        className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={bunnyTargetSectionId}
                        onChange={(e) => setBunnyTargetSectionId(e.target.value)}
                        className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white outline-none"
                      >
                        {(courses.find((c) => c.id === bunnyTargetCourseId)?.sections || []).map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Live Migration Progress & Log Inside Modal */}
                {migrationJob && (migrationJob.running || migrationJob.logs?.length > 0) && (
                  <div className="rounded-2xl bg-black/55 border border-amber-500/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-amber-300">
                        {migrationJob.running
                          ? `جاري النقل التلقائي إلى يوتيوب (${migrationJob.completed}/${migrationJob.total}) — ${migrationJob.currentPercent}%`
                          : `نتيجة النقل: نجح ${migrationJob.completed} • فشل ${migrationJob.failed}`}
                      </span>
                      {migrationJob.running && (
                        <button
                          type="button"
                          onClick={handleCancelMigration}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/25 text-rose-300 text-[11px] font-bold cursor-pointer"
                        >
                          إيقاف النقل
                        </button>
                      )}
                    </div>
                    {migrationJob.running && (
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-l from-rose-500 to-amber-400 transition-all duration-300"
                          style={{ width: `${migrationJob.currentPercent}%` }}
                        />
                      </div>
                    )}
                    {migrationJob.logs?.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 text-[11px]">
                        {migrationJob.logs.map((lg: any, idx: number) => (
                          <div
                            key={`${lg.guid}-${idx}`}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${
                              lg.status === "done" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            <span className="truncate">
                              {lg.status === "done" ? "✓" : "✕"} <strong>{lg.title}</strong> — {lg.message}
                            </span>
                            {lg.youtubeUrl && (
                              <a
                                href={lg.youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10px] underline shrink-0 text-amber-300"
                              >
                                يوتيوب ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setBunnyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={bunnyBusy || migrationJob?.running || bunnySelectedGuids.length === 0}
                      onClick={() => void handleImportBunnyVideos()}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-45 text-white font-bold text-xs cursor-pointer"
                    >
                      ربط مباشر من Bunny فقط
                    </button>
                    <button
                      type="button"
                      disabled={bunnyBusy || migrationJob?.running || bunnySelectedGuids.length === 0}
                      onClick={() => void handleMigrateBunnyToYouTube()}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-rose-600 to-amber-500 hover:brightness-110 disabled:opacity-45 text-white font-black text-xs inline-flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      {bunnyBusy || migrationJob?.running ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Youtube className="w-4 h-4" />
                      )}
                      <span>
                        {migrationJob?.running
                          ? "جاري النقل إلى يوتيوب..."
                          : `نقل (${bunnySelectedGuids.length}) فيديو إلى يوتيوب (غير مدرج) والمنصة 🚀`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
