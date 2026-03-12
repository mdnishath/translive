"use client";

import { useState, useRef } from "react";

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onTyping, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div className="px-4 py-3 bg-[#111827] border-t border-[#1f2d4a]">
      <div className="flex items-end gap-3">
        {/* Mic button (disabled for now) */}
        <button
          disabled
          title="Voice message — coming in Session 08"
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1f2d4a] text-[#4a5568] cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

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
            className="w-full bg-[#1f2d4a] text-white text-sm rounded-2xl px-4 py-2.5 placeholder-[#4a5568] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] resize-none overflow-hidden disabled:opacity-50 transition-colors"
            style={{ maxHeight: "120px" }}
          />
        </div>

        {/* Send button */}
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
      </div>

      {/* Translation hint */}
      <p className="text-[#4a5568] text-[10px] text-center mt-2">
        Messages are auto-translated · Auto-traduction activée
      </p>
    </div>
  );
}
