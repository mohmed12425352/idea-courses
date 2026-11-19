import React from "react";
import { cn } from "@/lib/utils";

export interface MascotLoaderProps {
  /** Optional custom text message */
  message?: string;
  /** Optional progress percentage (0 - 100) */
  progress?: number;
  /** Whether to show as a full screen overlay with backdrop blur */
  fullscreen?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class names */
  className?: string;
  /** Optional custom subtext or quote */
  subtitle?: string;
}

export function MascotLoader({
  message,
  progress,
  fullscreen = false,
  size = "md",
  className = "",
  subtitle,
}: MascotLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };

  const content = (
    <div className={cn("flex flex-col items-center justify-center select-none text-center gap-3", className)}>
      <div className="relative flex items-center justify-center">
        {/* Sleek brand spinner */}
        <div
          className={cn(
            sizeClasses[size],
            "rounded-full border-2 border-red-500/20 border-t-red-600 animate-spin"
          )}
        />
      </div>

      {(message || subtitle || typeof progress === "number") && (
        <div className="flex flex-col items-center max-w-sm px-4">
          {message && (
            <p className="text-xs md:text-sm font-semibold text-slate-300">
              {message}
            </p>
          )}

          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">
              {subtitle}
            </p>
          )}

          {typeof progress === "number" && (
            <div className="w-48 mt-2 space-y-1">
              <div className="w-full bg-[#2d2828] border border-[#3d3636] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                <span>جاري التحميل</span>
                <span className="text-red-400">{Math.round(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141111]/85 backdrop-blur-md animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
}
