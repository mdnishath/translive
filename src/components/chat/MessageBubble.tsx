"use client";

import { useState, useRef, useEffect } from "react";
import VoiceMessageBubble from "@/components/voice/VoiceMessageBubble";

export interface Message {
  id: string;
  content: string;
  translatedContent: string | null;
  messageType: "TEXT" | "VOICE" | "CALL";
  originalLanguage: string;
  translatedLanguage?: string | null;
  audioUrl?: string | null;
  translatedAudioUrl?: string | null;
  senderId: string;
  createdAt: string;
  deletedForEveryone?: boolean;
  /** Which translation engine produced the current translatedContent */
  translationEngine?: "google" | "claude" | null;
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentUserLanguage: string;
  /** Fix #4: true when the server never confirmed delivery within the timeout. */
  isFailed?: boolean;
  /** Fix #4: Called when the user taps "Retry" on a failed message. */
  onRetry?: () => void;
  /** Called when user selects delete for me */
  onDeleteForMe?: (messageId: string) => void;
  /** Called when user selects delete for everyone (sender only) */
  onDeleteForEveryone?: (messageId: string) => void;
  /** Whether the contact has read this message (for double checkmark) */
  isRead?: boolean;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const isPending = (id: string) => id.startsWith("temp-");

export default function MessageBubble({
  message,
  isMine,
  currentUserLanguage,
  isFailed = false,
  onRetry,
  onDeleteForMe,
  onDeleteForEveryone,
  isRead = false,
}: MessageBubbleProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pending = isPending(message.id);
  const isTranslated = message.originalLanguage !== currentUserLanguage;
  const hasTranslation = isTranslated && !!message.translatedContent;
  const mainText = hasTranslation && !showOriginal ? message.translatedContent! : message.content;
  const subText = hasTranslation ? (showOriginal ? message.translatedContent : message.content) : null;

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

  // ── Deleted for everyone placeholder ──────────────────────────
  if (message.deletedForEveryone) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/3 border border-white/5">
          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span className="text-xs text-slate-600 italic">This message was deleted</span>
        </div>
      </div>
    );
  }

  // ── CALL event ────────────────────────────────────────────────────
  if (message.messageType === "CALL") {
    return (
      <div className="flex justify-center my-3">
        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-full px-4 py-2 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5 text-[#4ECDC4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {isMine ? "You called" : "Incoming call"} · {formatTime(message.createdAt)}
        </div>
      </div>
    );
  }

  // ── TEXT / VOICE bubble ───────────────────────────────────────────
  return (
    <div className={`group relative flex ${isMine ? "justify-end animate-msg-right" : "justify-start animate-msg-left"} mb-1.5`}>
      <div className={`max-w-[75%] sm:max-w-[65%] flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${
            isMine
              ? `text-white rounded-br-sm ${
                  isFailed
                    ? "bg-red-900/40 border border-red-500/30"
                    : `bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] ${pending ? "opacity-70" : ""}`
                }`
              : "bg-[#162035] border border-white/6 text-white rounded-bl-sm"
          }`}
        >
          {message.messageType === "VOICE" && message.audioUrl ? (
            <VoiceMessageBubble
              audioUrl={message.audioUrl}
              translatedAudioUrl={message.translatedAudioUrl ?? undefined}
              transcript={message.content || undefined}
              translatedText={message.translatedContent ?? undefined}
              isMine={isMine}
              isTranslated={isTranslated}
              currentUserLanguage={currentUserLanguage}
            />
          ) : message.messageType === "VOICE" ? (
            <div className="flex items-center gap-2 py-1 text-sm opacity-60">
              <svg className={`w-4 h-4 ${isMine ? "text-white" : "text-[#6C63FF]"}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Voice message
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed break-words" dir="auto">{mainText}</p>

              {isTranslated && !hasTranslation && !pending && (
                <div className={`mt-1.5 pt-1.5 border-t flex items-center gap-1.5 ${
                  isMine ? "border-white/15" : "border-white/8"
                }`}>
                  <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin opacity-50" />
                  <span className={`text-xs ${isMine ? "text-white/50" : "text-slate-500"}`}>
                    Translating…
                  </span>
                </div>
              )}

              {subText && (
                <div
                  dir="auto"
                  className={`mt-1.5 pt-1.5 border-t text-xs leading-relaxed break-words ${
                    isMine ? "border-white/15 text-white/55" : "border-white/8 text-slate-500"
                  }`}
                >
                  {subText}
                </div>
              )}

              {hasTranslation && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setShowOriginal((v) => !v)}
                    className={`text-[10px] font-medium transition-colors ${
                      isMine
                        ? "text-white/40 hover:text-white/70"
                        : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {showOriginal ? "Show translation" : "Show original"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Bubble tail */}
          {isMine ? (
            <div className="absolute -bottom-0 -right-1 w-3 h-3 overflow-hidden" aria-hidden="true">
              <div className={`w-4 h-4 rotate-45 -translate-x-2 translate-y-1 ${isFailed ? "bg-red-900/40" : "bg-[#8B5CF6]"}`} />
            </div>
          ) : (
            <div className="absolute -bottom-0 -left-1 w-3 h-3 overflow-hidden" aria-hidden="true">
              <div className="w-4 h-4 bg-[#162035] rotate-45 translate-x-2 translate-y-1" />
            </div>
          )}
        </div>

        {/* Time + delivery status + delete menu */}
        <div className={`flex items-center gap-1 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-slate-600 tabular-nums">{formatTime(message.createdAt)}</span>

          {/* Translation engine badge: A = AI refined, G = Google */}
          {hasTranslation && (message.translationEngine === "claude" ? (
            <span className="w-3.5 h-3.5 rounded-full bg-[#4ECDC4] text-[#0a1628] text-[8px] font-bold flex items-center justify-center" title="AI Refined">A</span>
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center" title="Google Translate">G</span>
          ))}

          {isMine && (
            isFailed ? (
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-label="Failed to send">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="text-[10px] text-[#6C63FF] hover:text-[#8B5CF6] hover:underline transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : pending ? (
              <svg className="w-3 h-3 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24" aria-label="Sending">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isRead ? (
              /* Double checkmark — message was read */
              <svg className="w-4 h-4 text-[#4ECDC4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Read">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M1 13l4 4L15 7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 13l4 4L21 7" />
              </svg>
            ) : (
              /* Single checkmark — delivered but not read */
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Delivered">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )
          )}

          {/* Delete menu — visible on hover */}
          {!pending && !isFailed && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-400 hover:bg-white/5"
                aria-label="Message options"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>

              {menuOpen && (
                <div className={`absolute ${isMine ? "right-0" : "left-0"} bottom-full mb-1 w-44 bg-[#1a2236] border border-[#2a3a5c] rounded-lg shadow-2xl overflow-hidden z-50 py-1`}>
                  <button
                    onClick={() => { setMenuOpen(false); onDeleteForMe?.(message.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete for me
                  </button>
                  {isMine && (
                    <button
                      onClick={() => { setMenuOpen(false); onDeleteForEveryone?.(message.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete for everyone
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
