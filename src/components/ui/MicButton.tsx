// ===========================================
// Microphone Button Component
// ===========================================

"use client";

import { cn } from "@/lib/utils";

interface MicButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onToggle: () => void;
}

export function MicButton({
  isRecording,
  isProcessing,
  onToggle,
}: MicButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isProcessing}
      className={cn(
        "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 select-none",
        isRecording &&
          "bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.5)]",
        isProcessing && "bg-gray-400 cursor-not-allowed opacity-60",
        !isRecording && !isProcessing && "bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-lg"
      )}
    >
      {/* Pulse animation when recording */}
      {isRecording && (
        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
      )}

      {/* Mic icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="w-10 h-10 relative z-10"
      >
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
        <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
      </svg>
    </button>
  );
}
