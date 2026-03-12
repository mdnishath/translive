"use client";

// Fix #17: Import from shared util instead of duplicating the logic here
import { avatarGradient, getInitials } from "@/lib/utils/avatar";

interface ChatHeaderProps {
  contact: {
    id: string;
    name: string;
    language: string;
    avatar: string | null;
  };
  isOnline?: boolean;
  isTyping?: boolean;
  onBack?: () => void;
}

export default function ChatHeader({ contact, isOnline, isTyping, onBack }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5" style={{ background: "#0d1424" }}>

      {/* Back button — mobile only */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back to conversations"
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors text-slate-400 hover:text-white flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {/* Fix #18: aria-label so screen readers identify who the avatar belongs to */}
        <div
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(contact.id)} flex items-center justify-center text-sm font-bold text-white`}
          aria-label={`${contact.name}'s avatar`}
          role="img"
        >
          {getInitials(contact.name)}
        </div>
        {isOnline && (
          <div
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 animate-online"
            style={{ borderColor: "#0d1424" }}
            aria-label="Online"
          />
        )}
      </div>

      {/* Contact info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate leading-tight">{contact.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isTyping ? (
            /* Typing indicator dots */
            <div className="flex items-center gap-1" aria-label={`${contact.name} is typing`}>
              <div className="flex items-center gap-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full bg-[#6C63FF] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#6C63FF]">typing…</span>
            </div>
          ) : (
            <>
              {isOnline ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="text-[11px] text-emerald-400">Online</span>
                </>
              ) : (
                <span className="text-[11px] text-slate-500">Offline</span>
              )}
              <span className="text-slate-700 text-[11px]" aria-hidden="true">·</span>
              <span className="text-[11px] text-slate-500">
                {contact.language === "fr" ? "🇫🇷 French" : "🇧🇩 Bengali"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Auto-translate badge */}
      <div
        className="hidden sm:flex items-center gap-1.5 bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-full px-2.5 py-1 mr-1"
        title="Messages are automatically translated"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" aria-hidden="true" />
        <span className="text-[10px] text-[#4ECDC4] font-medium whitespace-nowrap">Auto-translate</span>
      </div>

      {/* Call buttons (disabled until Session 13) */}
      <div className="flex items-center gap-1">
        <button
          disabled
          title="Voice call — coming soon"
          aria-label="Voice call (coming soon)"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-700 cursor-not-allowed hover:bg-white/4 transition-colors"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
        <button
          disabled
          title="Video call — coming soon"
          aria-label="Video call (coming soon)"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-700 cursor-not-allowed hover:bg-white/4 transition-colors"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
