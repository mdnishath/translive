"use client";

export interface Message {
  id: string;
  content: string;
  translatedContent: string | null;
  messageType: "TEXT" | "VOICE" | "CALL";
  originalLanguage: string;
  senderId: string;
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentUserLanguage: string;
  /** Fix #4: true when the server never confirmed delivery within the timeout. */
  isFailed?: boolean;
  /** Fix #4: Called when the user taps "Retry" on a failed message. */
  onRetry?: () => void;
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
}: MessageBubbleProps) {
  const pending = isPending(message.id);
  const isTranslated = message.originalLanguage !== currentUserLanguage;
  const mainText = isTranslated && message.translatedContent ? message.translatedContent : message.content;
  const subText = isTranslated && message.translatedContent ? message.content : null;

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
    <div className={`flex ${isMine ? "justify-end animate-msg-right" : "justify-start animate-msg-left"} mb-1.5`}>
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
          {message.messageType === "VOICE" ? (
            <div className="flex items-center gap-3 py-0.5 min-w-[160px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMine ? "bg-white/20" : "bg-[#6C63FF]/20"}`}
                aria-label="Voice message"
              >
                <svg className={`w-4 h-4 ${isMine ? "text-white" : "text-[#6C63FF]"}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              {/* Static waveform visualization */}
              <div className="flex items-end gap-0.5 flex-1 h-8" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-0.5 rounded-full flex-1 ${isMine ? "bg-white/50" : "bg-[#6C63FF]/60"}`}
                    style={{ height: `${20 + Math.sin(i * 0.9) * 12}px` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Fix #28: dir="auto" ensures Bengali/Arabic text renders RTL correctly */}
              <p className="text-sm leading-relaxed break-words" dir="auto">{mainText}</p>

              {/* Original text shown below the translation */}
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

        {/* Time + delivery status */}
        <div className={`flex items-center gap-1 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-slate-600 tabular-nums">{formatTime(message.createdAt)}</span>

          {isMine && (
            isFailed ? (
              /* Fix #4: Failed state — red icon + retry button */
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
              /* Sending spinner */
              <svg className="w-3 h-3 text-slate-600 animate-spin" fill="none" viewBox="0 0 24 24" aria-label="Sending">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              /* Delivered checkmark */
              <svg className="w-3.5 h-3.5 text-[#4ECDC4]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Delivered">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )
          )}
        </div>
      </div>
    </div>
  );
}
