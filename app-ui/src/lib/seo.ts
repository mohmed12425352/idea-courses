export interface SeoSettings {
  site_title: string;
  title_suffix: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;
  og_image: string;
  google_site_verification: string;
  bing_site_verification: string;
  robots_indexing: "all" | "noindex";
  twitter_handle?: string;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  site_title: "منصة فكرة | كورسات احترافية في التصميم والمونتاج والذكاء الاصطناعي",
  title_suffix: " — Idea Courses",
  meta_description: "منصة فكرة لتعلم الموشن جرافيك، الوايت بورد أنيميشن، التصميم الجرافيكي، المونتاج، وصناعة المحتوى بالذكاء الاصطناعي بشرح عملي ومشاريع حقيقية.",
  meta_keywords: "كورسات تصميم, موشن جرافيك, مونتاج, وايت بورد انيميشن, ذكاء اصطناعي, تعليم عن بعد, فكرة ديزاين, ادوبي افتر افكت, بريمير, فوتوشوب",
  canonical_url: "https://fekradesign.shalaby3.online",
  og_image: "/logo.png",
  google_site_verification: "GtLv3hDYxGbJpwJ0rqAEjfdyNWm8qwQHzv6fCzQC40s",
  bing_site_verification: "",
  robots_indexing: "all",
  twitter_handle: "",
};

export const SEO_SETTINGS_KEY = "seo_settings";

export function normalizeSeoSettings(data: any): SeoSettings {
  if (!data || typeof data !== "object") return DEFAULT_SEO_SETTINGS;
  return {
    site_title: typeof data.site_title === "string" && data.site_title.trim() ? data.site_title.trim() : DEFAULT_SEO_SETTINGS.site_title,
    title_suffix: typeof data.title_suffix === "string" ? data.title_suffix : DEFAULT_SEO_SETTINGS.title_suffix,
    meta_description: typeof data.meta_description === "string" && data.meta_description.trim() ? data.meta_description.trim() : DEFAULT_SEO_SETTINGS.meta_description,
    meta_keywords: typeof data.meta_keywords === "string" ? data.meta_keywords : DEFAULT_SEO_SETTINGS.meta_keywords,
    canonical_url: typeof data.canonical_url === "string" && data.canonical_url.trim() ? data.canonical_url.trim().replace(/\/+$/, "") : DEFAULT_SEO_SETTINGS.canonical_url,
    og_image: typeof data.og_image === "string" && data.og_image.trim() ? data.og_image.trim() : DEFAULT_SEO_SETTINGS.og_image,
    google_site_verification: typeof data.google_site_verification === "string" ? data.google_site_verification.trim() : DEFAULT_SEO_SETTINGS.google_site_verification,
    bing_site_verification: typeof data.bing_site_verification === "string" ? data.bing_site_verification.trim() : "",
    robots_indexing: data.robots_indexing === "noindex" ? "noindex" : "all",
    twitter_handle: typeof data.twitter_handle === "string" ? data.twitter_handle.trim() : "",
  };
}
