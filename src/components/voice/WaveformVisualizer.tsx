"use client";

interface WaveformVisualizerProps {
  /** Frequency data from the AnalyserNode (Uint8Array) */
  data: Uint8Array | null;
  /** Number of bars to display */
  bars?: number;
  /** CSS class for the container */
  className?: string;
  /** Bar color — defaults to white */
  color?: string;
}

export default function WaveformVisualizer({
  data,
  bars = 32,
  className = "",
  color = "bg-white/70",
}: WaveformVisualizerProps) {
  // Sample the frequency data down to the number of bars we want
  const barHeights: number[] = [];
  if (data && data.length > 0) {
    const step = Math.max(1, Math.floor(data.length / bars));
    for (let i = 0; i < bars; i++) {
      const idx = Math.min(i * step, data.length - 1);
      // Normalize 0-255 to 0-1, with a minimum height
      barHeights.push(Math.max(0.1, data[idx] / 255));
    }
  } else {
    // Idle state — flat low bars
    for (let i = 0; i < bars; i++) {
      barHeights.push(0.1);
    }
  }

  return (
    <div className={`flex items-end gap-[2px] h-8 ${className}`} aria-hidden="true">
      {barHeights.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${color} transition-[height] duration-75`}
          style={{ height: `${h * 100}%`, minHeight: "3px" }}
        />
      ))}
    </div>
  );
}
