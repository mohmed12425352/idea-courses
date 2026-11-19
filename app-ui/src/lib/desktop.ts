export interface DesktopDeviceInfo {
  hardwareId: string;
  shortCode: string;
  hostname: string;
  cpuModel: string;
  cpuCores: number;
  totalMemGb: number;
  platform: string;
  osRelease: string;
  userAgentTag: string;
}

export interface DesktopSecurityStatus {
  enabled: boolean;
  locked: boolean;
  detected: string[];
  scanCount?: number;
  lastScanAt?: string | null;
  monitoredSignatures?: number;
}

export interface DesktopVaultItem {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  courseSlug?: string;
  duration?: string;
  watermark?: string;
  mimeType?: string;
  sizeBytes?: number;
  downloadedAt?: string;
  vaultUrl: string;
}

export interface DesktopVaultProgress {
  lessonId: string;
  lessonTitle: string;
  courseTitle?: string;
  status: "starting" | "downloading" | "completed" | "error";
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
  vaultUrl?: string;
  error?: string;
}

export interface EdunovaDesktopBridge {
  isDesktop: boolean;
  appName: string;
  instructor: string;
  version: string;
  getHardwareId: () => string;
  getDeviceInfo: () => DesktopDeviceInfo;
  getSecurityStatus: () => Promise<DesktopSecurityStatus>;
  vaultList: () => Promise<DesktopVaultItem[]>;
  vaultHas: (lessonId: string) => Promise<{ exists: boolean; item?: DesktopVaultItem }>;
  vaultDownload: (payload: {
    lessonId: string;
    url: string;
    lessonTitle: string;
    courseTitle: string;
    courseSlug?: string;
    duration?: string;
    watermark?: string;
    accessToken?: string;
  }) => Promise<{ ok: boolean; item?: DesktopVaultItem; alreadyDownloading?: boolean }>;
  vaultDelete: (lessonId: string) => Promise<{ ok: boolean; lessonId?: string }>;
  openOfflineVaultDrawer: () => void;
  onSecurityStatus: (cb: (status: DesktopSecurityStatus) => void) => () => void;
  onVaultProgress: (cb: (progress: DesktopVaultProgress) => void) => () => void;
}

declare global {
  interface Window {
    edunovaDesktop?: EdunovaDesktopBridge;
  }
}

export function getDesktopBridge(): EdunovaDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.edunovaDesktop;
  if (bridge && bridge.isDesktop) return bridge;
  return null;
}

export function isOfficialDesktopApp(): boolean {
  return Boolean(getDesktopBridge());
}

export function isDirectDownloadableVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("edunova-vault://")) return false;
  if (
    /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|mediadelivery\.net|bunnycdn\.com|\/embed\//i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return (
    trimmed.startsWith("/uploads/") ||
    /\/uploads\//i.test(trimmed) ||
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(trimmed)
  );
}

import { getAppsApiBase, getMobileNativeHardwareInfo, isMobileNativeShell } from "@/lib/apps-runtime";

export function isProtectedNativeApp(): boolean {
  return Boolean(getDesktopBridge()) || isMobileNativeShell();
}

export function getNativeShortHwCode(): string {
  return getDesktopBridge()?.getDeviceInfo()?.shortCode || getMobileNativeHardwareInfo()?.shortCode || "";
}

export function getDesktopExeDownloadUrl(): string {
  return `${getAppsApiBase()}/api/public/desktop-download`;
}

export function getMobileApkDownloadUrl(): string {
  return `${getAppsApiBase()}/api/public/mobile-download`;
}
