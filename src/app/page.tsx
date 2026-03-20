"use client";

import { useTranslationPipeline } from "@/hooks/useTranslationPipeline";
import { MicButton } from "@/components/ui/MicButton";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { TranslationCard } from "@/components/ui/TranslationCard";
import { TextInput } from "@/components/ui/TextInput";
import { LANGUAGES } from "@/lib/constants";
import type { Language } from "@/types";
import Link from "next/link";

export default function Home() {
  const pipeline = useTranslationPipeline("bn", "en");
  const source = LANGUAGES[pipeline.sourceLanguage];
  const target = LANGUAGES[pipeline.targetLanguage];
  const allLangs = Object.values(LANGUAGES);
  const isBusy = pipeline.isRecording || pipeline.isProcessing;

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col min-h-screen">

        {/* Header */}
        <header className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            TransLive
          </h1>
          <p className="text-white/40 text-[10px] sm:text-xs mt-1">Real-time AI Translation</p>
        </header>

        {/* Language Selectors — Source → Target */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          {/* Source Language */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-wider mb-1 text-center">From</p>
            <div className="flex gap-1 sm:gap-1.5 justify-center">
              {allLangs.map((lang) => (
                <button
                  key={`src-${lang.code}`}
                  onClick={() => pipeline.setSourceLanguage(lang.code as Language)}
                  disabled={isBusy}
                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                    pipeline.sourceLanguage === lang.code
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  } ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="mr-0.5 sm:mr-1">{lang.flag}</span>
                  <span className="hidden sm:inline">{lang.englishName}</span>
                  <span className="sm:hidden">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={pipeline.swapLanguages}
            disabled={isBusy}
            className="mt-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:rotate-180 duration-300 flex-shrink-0"
            title="Swap languages"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>

          {/* Target Language */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-wider mb-1 text-center">To</p>
            <div className="flex gap-1 sm:gap-1.5 justify-center">
              {allLangs.map((lang) => (
                <button
                  key={`tgt-${lang.code}`}
                  onClick={() => pipeline.setTargetLanguage(lang.code as Language)}
                  disabled={isBusy}
                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                    pipeline.targetLanguage === lang.code
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  } ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="mr-0.5 sm:mr-1">{lang.flag}</span>
                  <span className="hidden sm:inline">{lang.englishName}</span>
                  <span className="sm:hidden">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Direction */}
        <div className="text-center mb-4">
          <span className="inline-flex items-center gap-1.5 sm:gap-2 bg-white/5 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm">
            <span>{source.flag} {source.name}</span>
            <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span>{target.flag} {target.name}</span>
          </span>
        </div>

        {/* Processing Indicator — shows when translating/transcribing */}
        {pipeline.isProcessing && (
          <div className="mb-4 flex items-center justify-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 animate-pulse">
            <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-blue-300 text-sm font-medium">
              {pipeline.status === "transcribing" && "Transcribing your voice..."}
              {pipeline.status === "translating" && "Translating with Gemini Pro..."}
              {pipeline.status === "speaking" && "Generating voice..."}
            </span>
          </div>
        )}

        {/* Translation Result */}
        {(pipeline.originalText || pipeline.translatedText) && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 sm:p-5 mb-4 sm:mb-5 border border-white/10">
            {pipeline.originalText && (
              <div className="mb-3 pb-3 border-b border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                  {source.flag} {source.englishName}
                </p>
                <p className="text-white/80 text-sm">{pipeline.originalText}</p>
              </div>
            )}
            {pipeline.translatedText && (
              <div>
                <p className="text-[10px] text-purple-400/70 uppercase tracking-wider mb-1">
                  {target.flag} {target.englishName}
                </p>
                <p className="text-white text-base sm:text-lg font-medium">
                  {pipeline.translatedText}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        <div className="mb-3 sm:mb-4">
          <TextInput
            onSubmit={pipeline.translateFromText}
            disabled={isBusy}
            placeholder={
              pipeline.sourceLanguage === "bn"
                ? "বাংলায় লিখুন..."
                : pipeline.sourceLanguage === "fr"
                ? "Écrivez en français..."
                : "Type in English..."
            }
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3 sm:mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] sm:text-xs text-white/20">or speak</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Mic + Status */}
        <div className="flex flex-col items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
          <MicButton
            isRecording={pipeline.isRecording}
            isProcessing={pipeline.isProcessing}
            onToggle={pipeline.isRecording ? pipeline.stopRecording : pipeline.startRecording}
          />
          <StatusIndicator status={pipeline.status} error={pipeline.error} />
        </div>

        {/* History */}
        {pipeline.results.length > 0 && (
          <section className="mb-4 sm:mb-6">
            <h2 className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">
              History
            </h2>
            <div className="space-y-2">
              {pipeline.results.map((result) => (
                <TranslationCard key={result.timestamp} result={result} />
              ))}
            </div>
          </section>
        )}

        {/* Login / Chat Link */}
        <div className="text-center mt-auto pb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Open Chat
          </Link>
          <p className="text-[10px] text-white/15 mt-3">
            Powered by Gemini Pro
          </p>
        </div>
      </div>
    </main>
  );
}
