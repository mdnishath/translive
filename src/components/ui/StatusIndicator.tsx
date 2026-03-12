// ===========================================
// Status Indicator Component
// ===========================================

"use client";

const STATUS_MESSAGES: Record<string, { text: string; color: string }> = {
  idle: { text: "Tap the mic to start speaking", color: "text-white/50" },
  recording: { text: "Listening... Tap again to stop", color: "text-red-400" },
  transcribing: { text: "Converting speech to text...", color: "text-yellow-400" },
  translating: { text: "Translating...", color: "text-blue-400" },
  speaking: { text: "Playing translated audio...", color: "text-green-400" },
  error: { text: "Something went wrong", color: "text-red-400" },
};

interface StatusIndicatorProps {
  status: string;
  error?: string | null;
}

export function StatusIndicator({ status, error }: StatusIndicatorProps) {
  const config = STATUS_MESSAGES[status] || STATUS_MESSAGES.idle;

  return (
    <div className="text-center">
      {/* Animated dots for processing states */}
      {["transcribing", "translating", "speaking"].includes(status) && (
        <div className="flex justify-center gap-1.5 mb-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      <p className={`text-sm font-medium ${config.color}`}>
        {status === "error" && error ? error : config.text}
      </p>
    </div>
  );
}
