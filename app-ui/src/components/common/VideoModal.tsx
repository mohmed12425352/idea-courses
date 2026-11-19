import { ExternalLink, X } from "lucide-react";
import { SecurePlayer } from "./SecurePlayer";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

function extractSrc(raw: string): string {
  const m = raw.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return (m ? m[1] : raw).trim();
}

export function VideoModal({ isOpen, onClose, videoUrl, title }: VideoModalProps) {
  if (!isOpen) return null;

  const cleanUrl = extractSrc(videoUrl);
  const isDirectVideo =
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.includes(".mp4?") ||
    cleanUrl.includes("/uploads/") ||
    cleanUrl.includes("/storage/v1/object/public/") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.includes(".webm?");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#141215] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-[#1b181c]">
          <h3 className="text-white font-extrabold text-sm sm:text-base truncate">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {cleanUrl.startsWith("http") && (
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white/80 hover:text-white transition-colors"
                title="فتح الفيديو في نافذة جديدة"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#f5c518]" />
                <span className="hidden sm:inline">نافذة مستقلة</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#e50914] hover:bg-[#c40812] text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clipped Video Player Frame */}
        <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
          {isDirectVideo ? (
            <video
              src={cleanUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <SecurePlayer url={cleanUrl} title={title} />
          )}
        </div>
      </div>
    </div>
  );
}
