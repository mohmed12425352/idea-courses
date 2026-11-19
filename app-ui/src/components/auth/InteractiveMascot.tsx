import React, { useEffect, useState, useRef } from "react";

interface InteractiveMascotProps {
  /** How many characters typed in email input (to move eyes) */
  emailLength?: number;
  /** Whether the email or text field is focused */
  isEmailFocused?: boolean;
  /** Whether the password field is focused */
  isPasswordFocused?: boolean;
  /** Whether the password is currently visible (peek mode) */
  showPassword?: boolean;
  /** Whether the form is currently submitting */
  isLoading?: boolean;
  /** Status of the authentication attempt */
  status?: "idle" | "success" | "error";
  /** Optional custom title or emotion trigger */
  className?: string;
}

export function InteractiveMascot({
  emailLength = 0,
  isEmailFocused = false,
  isPasswordFocused = false,
  showPassword = false,
  isLoading = false,
  status = "idle",
  className = "",
}: InteractiveMascotProps) {
  const [blink, setBlink] = useState(false);

  // Periodic natural blinking when not covering eyes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPasswordFocused) {
        setBlink(true);
        setTimeout(() => setBlink(false), 200);
      }
    }, 3800);
    return () => clearInterval(interval);
  }, [isPasswordFocused]);

  // Calculate eye pupil position based on email text length
  // As user types from 0 to ~30 chars, eyes shift smoothly from left to right and look slightly down
  const maxChars = 32;
  const clampedLen = Math.min(emailLength, maxChars);
  // Range: -8 (left/start) to +8 (right/end)
  const pupilX = isEmailFocused
    ? -7 + (clampedLen / maxChars) * 14
    : 0;
  const pupilY = isEmailFocused ? 4 : isPasswordFocused ? -2 : 0;

  // Arms position
  const coveringEyes = isPasswordFocused && !showPassword;
  const peeking = Boolean(showPassword);

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Floating Sparkles on Success */}
      {status === "success" && (
        <div className="absolute -top-6 inset-x-0 flex justify-center gap-6 animate-bounce">
          <span className="text-xl">🎉</span>
          <span className="text-xl">✨</span>
          <span className="text-xl">⭐</span>
        </div>
      )}

      {/* Sweat drop on Error */}
      {status === "error" && (
        <div className="absolute top-2 right-8 text-blue-400 animate-pulse text-lg font-bold">
          💧
        </div>
      )}

      {/* SVG Mascot (Smart Designer Panda / Bear with Graduation Cap) */}
      <svg
        viewBox="0 0 200 180"
        className="w-40 h-36 md:w-48 md:h-44 transition-all duration-300 drop-shadow-xl"
        style={{
          transform: status === "error" ? "rotate(-3deg)" : status === "success" ? "scale(1.05)" : "none",
        }}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="muzzleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          {/* Shadow Filter */}
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Ears */}
        <g id="ears">
          {/* Left Ear */}
          <circle cx="45" cy="45" r="22" fill="#1e293b" />
          <circle cx="45" cy="45" r="13" fill="#fbbf24" opacity="0.8" />
          {/* Right Ear */}
          <circle cx="155" cy="45" r="22" fill="#1e293b" />
          <circle cx="155" cy="45" r="13" fill="#fbbf24" opacity="0.8" />
        </g>

        {/* Head / Body Base */}
        <ellipse cx="100" cy="95" rx="68" ry="60" fill="url(#faceGrad)" filter="url(#softShadow)" />

        {/* Panda Eye Patches */}
        <ellipse
          cx="68"
          cy="85"
          rx="22"
          ry="18"
          fill="#1e293b"
          transform="rotate(-10 68 85)"
        />
        <ellipse
          cx="132"
          cy="85"
          rx="22"
          ry="18"
          fill="#1e293b"
          transform="rotate(10 132 85)"
        />

        {/* Cheeks Blush */}
        <circle cx="50" cy="110" r="9" fill="#f43f5e" opacity="0.3" />
        <circle cx="150" cy="110" r="9" fill="#f43f5e" opacity="0.3" />

        {/* Eyes & Pupils */}
        {!coveringEyes && (
          <g id="eyesGroup" className="transition-all duration-150">
            {/* Left Eye White */}
            <ellipse cx="68" cy="85" rx="11" ry={blink ? "1" : "11"} fill="#ffffff" />
            {/* Left Pupil */}
            {!blink && (
              <g style={{ transform: `translate(${pupilX}px, ${pupilY}px)`, transition: "transform 120ms ease-out" }}>
                <circle cx="68" cy="85" r="6" fill="#0f172a" />
                <circle cx="66" cy="83" r="2.2" fill="#ffffff" />
                {status === "success" && <circle cx="70" cy="87" r="1" fill="#fbbf24" />}
              </g>
            )}

            {/* Right Eye White */}
            <ellipse cx="132" cy="85" rx="11" ry={blink ? "1" : peeking ? "7" : "11"} fill="#ffffff" />
            {/* Right Pupil */}
            {!blink && (
              <g style={{ transform: `translate(${peeking ? 4 : pupilX}px, ${peeking ? 2 : pupilY}px)`, transition: "transform 120ms ease-out" }}>
                <circle cx="132" cy="85" r="6" fill="#0f172a" />
                <circle cx="130" cy="83" r="2.2" fill="#ffffff" />
                {status === "success" && <circle cx="134" cy="87" r="1" fill="#fbbf24" />}
              </g>
            )}
          </g>
        )}

        {/* Cute Glasses Frame (Designer Touch) */}
        <g id="glasses" stroke="#fbbf24" strokeWidth="2.5" fill="none" opacity="0.85">
          <circle cx="68" cy="85" r="18" />
          <circle cx="132" cy="85" r="18" />
          <path d="M 86 85 Q 100 80 114 85" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Muzzle / Nose Area */}
        <ellipse cx="100" cy="115" rx="22" ry="16" fill="url(#muzzleGrad)" />

        {/* Nose */}
        <path
          d="M 94 108 C 94 108, 100 104, 106 108 C 108 112, 100 116, 100 116 C 100 116, 92 112, 94 108 Z"
          fill="#1e293b"
        />

        {/* Mouth */}
        <g id="mouth" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" fill="none">
          {status === "success" ? (
            /* Big Joyful Smile */
            <path d="M 88 118 Q 100 134 112 118" fill="#f43f5e" />
          ) : status === "error" ? (
            /* Sad Wobble */
            <path d="M 92 124 Q 100 118 108 124" />
          ) : isLoading ? (
            /* Small 'O' shape while thinking */
            <circle cx="100" cy="122" r="3.5" fill="#1e293b" />
          ) : coveringEyes ? (
            /* Shy playful smirk */
            <path d="M 94 120 Q 100 126 106 120" />
          ) : (
            /* Gentle natural smile */
            <>
              <path d="M 100 116 L 100 121" />
              <path d="M 93 121 Q 100 126 107 121" />
            </>
          )}
        </g>

        {/* Graduation Cap / Academic Hat (Fekra Design Academy identity) */}
        <g id="gradCap" className="transition-transform duration-200" style={{ transformOrigin: "100px 32px" }}>
          {/* Base band */}
          <path d="M 75 32 Q 100 38 125 32 L 122 42 Q 100 48 78 42 Z" fill="#0f172a" />
          {/* Diamond Top */}
          <polygon
            points="100,12 148,28 100,44 52,28"
            fill="url(#bodyGrad)"
            stroke="#fbbf24"
            strokeWidth="1.5"
            filter="url(#softShadow)"
          />
          {/* Gold Button */}
          <circle cx="100" cy="28" r="3.5" fill="url(#goldGrad)" />
          {/* Tassel */}
          <path
            d="M 100 28 Q 130 35 138 52"
            stroke="#fbbf24"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="138" cy="53" r="2.5" fill="#fbbf24" />
        </g>

        {/* Paws / Hands */}
        <g id="paws">
          {/* Left Paw */}
          <g
            style={{
              transition: "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transformOrigin: "35px 160px",
              transform: coveringEyes || peeking
                ? "translate(24px, -65px) rotate(18deg)"
                : "translate(0px, 0px)",
            }}
          >
            <ellipse cx="42" cy="155" rx="18" ry="15" fill="#1e293b" filter="url(#softShadow)" />
            {/* Paw Pads */}
            <circle cx="42" cy="153" r="6" fill="#fbbf24" opacity="0.9" />
            <circle cx="34" cy="146" r="2.5" fill="#fbbf24" opacity="0.9" />
            <circle cx="42" cy="143" r="2.5" fill="#fbbf24" opacity="0.9" />
            <circle cx="50" cy="146" r="2.5" fill="#fbbf24" opacity="0.9" />
          </g>

          {/* Right Paw */}
          <g
            style={{
              transition: "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transformOrigin: "165px 160px",
              transform: coveringEyes
                ? "translate(-24px, -65px) rotate(-18deg)"
                : peeking
                ? "translate(-8px, -15px) rotate(-6deg)"
                : "translate(0px, 0px)",
            }}
          >
            <ellipse cx="158" cy="155" rx="18" ry="15" fill="#1e293b" filter="url(#softShadow)" />
            {/* Paw Pads */}
            <circle cx="158" cy="153" r="6" fill="#fbbf24" opacity="0.9" />
            <circle cx="150" cy="146" r="2.5" fill="#fbbf24" opacity="0.9" />
            <circle cx="158" cy="143" r="2.5" fill="#fbbf24" opacity="0.9" />
            <circle cx="166" cy="146" r="2.5" fill="#fbbf24" opacity="0.9" />
          </g>
        </g>
      </svg>

      {/* Interactive Speech / State Bubble */}
      <div className="mt-1 text-center">
        {coveringEyes && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full animate-pulse shadow-sm">
            🙈 مش هبص على كلمة السر!
          </span>
        )}
        {peeking && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full shadow-sm">
            👀 ببص بنص عين بس!
          </span>
        )}
        {isEmailFocused && !isPasswordFocused && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 bg-slate-800/80 border border-slate-700/60 px-3 py-0.5 rounded-full">
            ✍️ بتابع معاك البريد الإلكتروني...
          </span>
        )}
        {isLoading && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full animate-pulse">
            ⏳ جاري التحقق من بياناتك...
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
            ❌ راجع البيانات وحاول تاني!
          </span>
        )}
        {status === "success" && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            🎉 مرحباً بك في أكاديمية فكرة!
          </span>
        )}
      </div>
    </div>
  );
}
