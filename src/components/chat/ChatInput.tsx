"use client";

import { useState, useRef, useCallback } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import WaveformVisualizer from "@/components/voice/WaveformVisualizer";

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  onSendVoice: (audioUrl: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChatInput({ onSend, onSendVoice, onTyping, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slideCancelRef = useRef(false);
  const touchStartXRef = useRef(0);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice.webm");

      const res = await fetch("/api/voice/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { audioUrl } = await res.json();
        onSendVoice(audioUrl);
      }
    } catch (err) {
      console.error("[ChatInput] Voice upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [onSendVoice]);

  const {
    isRecording,
    durationMs,
    analyserData,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder({ onRecordingComplete: handleRecordingComplete });

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping?.();
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ── Hold-to-record handlers ──────────────────────────────────

  function handleMicDown(e: React.MouseEvent | React.TouchEvent) {
    if (disabled || uploading) return;
    slideCancelRef.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    touchStartXRef.current = clientX;
    startRecording();
  }

  function handleMicUp() {
    if (!isRecording) return;
    if (slideCancelRef.current) {
      cancelRecording();
    } else {
      stopRecording();
    }
  }

  function handleMicMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isRecording) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const diff = touchStartXRef.current - clientX;
    if (diff > 80) {
      slideCancelRef.current = true;
    }
  }

  // ── Recording UI ─────────────────────────────────────────────

  if (isRecording || uploading) {
    return (
      <div className="px-4 py-3 bg-[#111827] border-t border-[#1f2d4a]">
        <div className="flex items-center gap-3">
          {/* Cancel hint */}
          <div className={`flex items-center gap-2 flex-1 ${slideCancelRef.current ? "opacity-100" : "opacity-60"}`}>
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                <span className="text-slate-400 text-sm">Sending voice…</span>
              </div>
            ) : (
              <>
                {/* Red recording dot */}
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />

                {/* Duration timer */}
                <span className="text-white text-sm font-medium tabular-nums w-10">
                  {formatTimer(durationMs)}
                </span>

                {/* Waveform */}
                <div className="flex-1">
                  <WaveformVisualizer data={analyserData} bars={24} color="bg-red-400/60" />
                </div>

                {/* Slide to cancel hint */}
                <span className="text-slate-500 text-xs animate-pulse">
                  ◀ Slide to cancel
                </span>
              </>
            )}
          </div>

          {/* Stop/send button (release to send) */}
          {!uploading && (
            <button
              onMouseUp={handleMicUp}
              onTouchEnd={handleMicUp}
              onMouseMove={handleMicMove}
              onTouchMove={handleMicMove}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
              aria-label="Release to send, slide left to cancel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Normal input UI ──────────────────────────────────────────

  const hasText = text.trim().length > 0;

  return (
    <div className="px-4 py-3 bg-[#111827] border-t border-[#1f2d4a]">
      <div className="flex items-end gap-3">
        {/* Mic button — visible when no text */}
        {!hasText && (
          <button
            onMouseDown={handleMicDown}
            onMouseUp={handleMicUp}
            onMouseLeave={handleMicUp}
            onMouseMove={handleMicMove}
            onTouchStart={handleMicDown}
            onTouchEnd={handleMicUp}
            onTouchMove={handleMicMove}
            disabled={disabled || uploading}
            title="Hold to record voice message"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1f2d4a] text-[#6C63FF] hover:bg-[#2a3a5c] active:bg-[#6C63FF] active:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            placeholder="Type a message..."
            rows={1}
            className="w-full bg-[#1f2d4a] text-white text-base sm:text-sm rounded-2xl px-4 py-2.5 placeholder-[#4a5568] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] resize-none overflow-hidden disabled:opacity-50 transition-colors"
            style={{ maxHeight: "120px", fontSize: "16px" }}
          />
        </div>

        {/* Send button — visible when text present */}
        {hasText && (
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || disabled}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-[#6C63FF] text-white disabled:opacity-40 hover:bg-[#5a52d5] transition-colors"
          >
            {sending ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Translation hint */}
      <p className="text-[#4a5568] text-[10px] text-center mt-2">
        Messages are auto-translated · Auto-traduction activée
      </p>
    </div>
  );
}
