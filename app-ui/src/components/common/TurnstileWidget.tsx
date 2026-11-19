import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: any) => void;
  className?: string;
  theme?: "dark" | "light" | "auto";
  action?: string;
}

export const TURNSTILE_SITE_KEY =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY?.trim()) || "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (error: any) => void;
          theme?: "dark" | "light" | "auto";
          language?: string;
          action?: string;
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  ({ onVerify, onExpire, onError, className = "", theme = "dark", action }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onVerifyRef = useRef(onVerify);
    onVerifyRef.current = onVerify;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (!TURNSTILE_SITE_KEY) {
          setTimeout(() => onVerifyRef.current("dev-bypass-token"), 0);
          return;
        }
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {}
        }
      },
    }));

    useEffect(() => {
      // When VITE_TURNSTILE_SITE_KEY is empty (default for localhost / standalone deployments),
      // auto-verify cleanly without external Cloudflare CAPTCHA lock-in!
      if (!TURNSTILE_SITE_KEY) {
        onVerifyRef.current("dev-bypass-token");
        return;
      }

      let isMounted = true;
      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted || widgetIdRef.current) return;
        try {
          containerRef.current.innerHTML = "";
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => {
              if (isMounted) onVerifyRef.current(token);
            },
            "expired-callback": () => {
              if (isMounted && onExpire) onExpire();
            },
            "error-callback": (err: any) => {
              if (isMounted && onError) onError(err);
            },
            theme,
            language: "ar",
            action,
          });
        } catch (e) {
          console.error("Failed to render Turnstile widget:", e);
        }
      };

      if (typeof window !== "undefined" && window.turnstile) {
        renderWidget();
      } else if (typeof document !== "undefined") {
        const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            if (isMounted) renderWidget();
          };
          document.head.appendChild(script);
        }
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
      };
    }, [theme, action]);

    if (!TURNSTILE_SITE_KEY) return null;

    return (
      <div className={`min-h-[65px] flex items-center justify-center my-3 select-none ${className}`}>
        <div ref={containerRef} />
      </div>
    );
  },
);

TurnstileWidget.displayName = "TurnstileWidget";
