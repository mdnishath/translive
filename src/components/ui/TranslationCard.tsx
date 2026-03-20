// ===========================================
// Translation Result Card
// ===========================================

"use client";

import type { TranslationResult } from "@/types";
import { LANGUAGES } from "@/lib/constants";
import { formatTimestamp } from "@/lib/utils";
import { playAudioFromBase64 } from "@/lib/utils/audio";
import { textToSpeech } from "@/services/translation";
import { useState } from "react";

interface TranslationCardProps {
  result: TranslationResult;
}

export function TranslationCard({ result }: TranslationCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const source = LANGUAGES[result.sourceLanguage];
  const target = LANGUAGES[result.targetLanguage];

  async function handlePlayAudio() {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const { audioContent, mimeType } = await textToSpeech(
        result.translatedText,
        result.targetLanguage
      );
      await playAudioFromBase64(audioContent, mimeType);
    } catch {
      // silently fail
    } finally {
      setIsPlaying(false);
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/40">
          {formatTimestamp(result.timestamp)}
        </span>
        <span className="text-xs text-white/40">
          {source.flag} → {target.flag}
        </span>
      </div>

      {/* Original text */}
      <div className="mb-3">
        <p className="text-xs text-white/40 mb-1">{source.name}</p>
        <p className="text-white/70 text-sm">{result.originalText}</p>
      </div>

      {/* Translated text */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-blue-400 mb-1">{target.name}</p>
          <p className="text-white font-medium">{result.translatedText}</p>
        </div>

        {/* Replay button */}
        <button
          onClick={handlePlayAudio}
          disabled={isPlaying}
          className="mt-4 p-2 rounded-full bg-blue-600/20 hover:bg-blue-600/40 transition-colors"
          title="Play translation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-blue-400"
          >
            {isPlaying ? (
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            ) : (
              <path d="M8 5v14l11-7z" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
