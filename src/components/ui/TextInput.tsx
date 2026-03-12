// ===========================================
// Text Input Component for translation
// ===========================================

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TextInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TextInput({ onSubmit, disabled, placeholder }: TextInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || "Type text to translate..."}
        className={cn(
          "flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white",
          "placeholder:text-white/30 focus:outline-none focus:border-blue-500/50",
          "transition-colors",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className={cn(
          "px-5 py-3 rounded-xl font-medium transition-all",
          text.trim() && !disabled
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-white/10 text-white/30 cursor-not-allowed"
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </button>
    </form>
  );
}
