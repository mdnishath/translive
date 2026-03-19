"use client";

import { useState, useRef, useEffect } from "react";
// Fix #17: Import from shared util instead of duplicating the logic here
import { avatarGradient, getInitials } from "@/lib/utils/avatar";
import { LANGUAGES } from "@/lib/constants";

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
  onLeave?: () => void;
  onDisconnect?: () => void;
  onClearChat?: () => void;
  onBlock?: () => void;
}

export default function ChatHeader({
  contact, isOnline, isTyping, onBack, onLeave, onDisconnect, onClearChat, onBlock,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

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
                {LANGUAGES[contact.language as keyof typeof LANGUAGES]
                  ? `${LANGUAGES[contact.language as keyof typeof LANGUAGES].flag} ${LANGUAGES[contact.language as keyof typeof LANGUAGES].englishName}`
                  : `🌐 ${contact.language}`}
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

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Call buttons (disabled until Session 13) */}
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

        {/* ⋮ More menu — disconnect, clear chat, block */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a2236] border border-[#2a3a5c] rounded-xl shadow-2xl overflow-hidden z-50 py-1">
              {/* Clear chat history */}
              {onClearChat && (
                <button
                  onClick={() => { setMenuOpen(false); onClearChat(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear chat history
                </button>
              )}

              {/* Disconnect */}
              {onDisconnect && (
                <button
                  onClick={() => { setMenuOpen(false); onDisconnect(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Disconnect
                </button>
              )}

              {/* Divider */}
              <div className="h-px bg-white/5 my-1" />

              {/* Block */}
              {onBlock && (
                <button
                  onClick={() => { setMenuOpen(false); onBlock(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Block user
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
