export const FB_PIXEL_ID = "1486972089141361";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function fbqTrack(event: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}
