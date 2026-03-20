"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { registerAudio, unregisterAudio } from "@/lib/utils/audioManager";

interface VoiceMessageBubbleProps {
  audioUrl: string;
  translatedAudioUrl?: string;
  transcript?: string;
  translatedText?: string;
  isMine: boolean;
  isTranslated?: boolean;
  currentUserLanguage?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ url, isMine }: { url: string; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);

  // Extract waveform for visualization
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const audioCtx = new AudioContext();
        const decoded = await audioCtx.decodeAudioData(buffer);
        const raw = decoded.getChannelData(0);
        const bars = 28;
        const step = Math.floor(raw.length / bars);
        const peaks: number[] = [];
        for (let i = 0; i < bars; i++) {
          let max = 0;
          for (let j = i * step; j < (i + 1) * step && j < raw.length; j++) {
            const abs = Math.abs(raw[j]);
            if (abs > max) max = abs;
          }
          peaks.push(Math.max(0.12, max));
        }
        if (!cancelled) setWaveform(peaks);
        audioCtx.close();
      } catch {
        if (!cancelled) {
          setWaveform(Array.from({ length: 28 }, (_, i) => 0.15 + Math.sin(i * 0.7) * 0.12));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // Create and preload audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    setReady(false);

    let seekTrickDone = false;

    function trySetDuration() {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        return true;
      }
      return false;
    }

    audio.addEventListener("loadedmetadata", () => {
      if (!trySetDuration()) {
        // WebM from MediaRecorder often has Infinity duration.
        // Workaround: seek to a large value to force the browser to calculate it.
        seekTrickDone = false;
        audio.currentTime = 1e10;
      } else {
        seekTrickDone = true;
        setReady(true);
      }
    });

    audio.addEventListener("durationchange", () => {
      if (trySetDuration() && !seekTrickDone) {
        seekTrickDone = true;
        // Reset to start after seek trick completes
        audio.currentTime = 0;
        setReady(true);
      }
    });

    // Fallback: if timeupdate fires from seek trick, catch duration
    function onSeekUpdate() {
      if (!seekTrickDone && trySetDuration()) {
        seekTrickDone = true;
        audio.removeEventListener("timeupdate", onSeekUpdate);
        audio.currentTime = 0;
        setReady(true);
      }
    }
    audio.addEventListener("timeupdate", onSeekUpdate);

    audio.addEventListener("ended", () => {
      setPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(animRef.current);
      unregisterAudio(audio);
    });

    // Also handle external stop (from audioManager when another audio starts)
    audio.addEventListener("pause", () => {
      if (playing) {
        setPlaying(false);
        cancelAnimationFrame(animRef.current);
      }
    });

    // Set src to start loading
    audio.src = url;

    return () => {
      cancelAnimationFrame(animRef.current);
      unregisterAudio(audio);
      audio.pause();
      audio.removeEventListener("timeupdate", onSeekUpdate);
      audio.src = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const updateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animRef.current = requestAnimationFrame(updateTime);
    }
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
      unregisterAudio(audio);
    } else {
      // Register with global manager — stops any other playing audio
      registerAudio(audio, () => {
        setPlaying(false);
        cancelAnimationFrame(animRef.current);
      });
      audio.play().then(() => {
        animRef.current = requestAnimationFrame(updateTime);
        setPlaying(true);
      }).catch(() => {
        // play failed
        unregisterAudio(audio);
      });
    }
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const filledBars = Math.floor(progress * waveform.length);

  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isMine ? "bg-white/20 hover:bg-white/30" : "bg-[#6C63FF]/20 hover:bg-[#6C63FF]/30"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg className={`w-3.5 h-3.5 ${isMine ? "text-white" : "text-[#6C63FF]"}`} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={`w-3.5 h-3.5 ml-0.5 ${isMine ? "text-white" : "text-[#6C63FF]"}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-7" aria-hidden="true">
          {waveform.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-150 ${
                i < filledBars
                  ? isMine ? "bg-white" : "bg-[#6C63FF]"
                  : isMine ? "bg-white/30" : "bg-[#6C63FF]/30"
              }`}
              style={{ height: `${h * 100}%`, minHeight: "3px" }}
            />
          ))}
        </div>
        <div className={`text-[10px] tabular-nums ${isMine ? "text-white/50" : "text-slate-500"}`}>
          {playing ? formatDuration(currentTime) : formatDuration(duration)}
        </div>
      </div>
    </div>
  );
}

export default function VoiceMessageBubble({
  audioUrl,
  translatedAudioUrl,
  transcript,
  translatedText,
  isMine,
  isTranslated,
}: VoiceMessageBubbleProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const hasTranscript = !!transcript;
  const hasTranslation = !!translatedText;
  const shouldShowTranslation = isTranslated && hasTranslation;

  const primaryText = shouldShowTranslation && !showOriginal ? translatedText : transcript;
  const secondaryText = shouldShowTranslation ? (showOriginal ? translatedText : transcript) : null;

  // Sender hears their own original audio
  // Receiver hears the translated TTS audio (falls back to original if not ready)
  const displayAudioUrl = isMine ? audioUrl : (translatedAudioUrl ?? audioUrl);

  return (
    <div className="min-w-[200px] max-w-[280px]">
      {/* Single audio player — translated audio if available, otherwise original */}
      <AudioPlayer url={displayAudioUrl} isMine={isMine} />

      {/* Transcript + Translation text */}
      {hasTranscript && (
        <div className={`mt-2 pt-2 border-t ${isMine ? "border-white/15" : "border-white/8"}`}>
          <p className="text-xs leading-relaxed break-words" dir="auto">
            {primaryText}
          </p>

          {secondaryText && (
            <p
              dir="auto"
              className={`mt-1 text-[11px] leading-relaxed break-words ${
                isMine ? "text-white/50" : "text-slate-500"
              }`}
            >
              {secondaryText}
            </p>
          )}

          {shouldShowTranslation && (
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className={`text-[10px] font-medium mt-1 transition-colors ${
                isMine
                  ? "text-white/40 hover:text-white/70"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {showOriginal ? "Show translation" : "Show original"}
            </button>
          )}
        </div>
      )}

      {/* Processing indicator — no transcript yet */}
      {!hasTranscript && (
        <div className={`mt-2 pt-2 border-t flex items-center gap-1.5 ${isMine ? "border-white/15" : "border-white/8"}`}>
          <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin opacity-50" />
          <span className={`text-[10px] ${isMine ? "text-white/50" : "text-slate-500"}`}>
            Transcribing…
          </span>
        </div>
      )}
    </div>
  );
}
