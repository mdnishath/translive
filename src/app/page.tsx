"use client";

import { useTranslationPipeline } from "@/hooks/useTranslationPipeline";
import { MicButton } from "@/components/ui/MicButton";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { TranslationCard } from "@/components/ui/TranslationCard";
import { TextInput } from "@/components/ui/TextInput";
import { LANGUAGES } from "@/lib/constants";
import { getTargetLanguage } from "@/lib/utils";

export default function Home() {
  const pipeline = useTranslationPipeline("bn");

  const source = LANGUAGES[pipeline.sourceLanguage];
  const target = LANGUAGES[getTargetLanguage(pipeline.sourceLanguage)];

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col min-h-screen">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            TransLive
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {source.flag} {source.name} → {target.flag} {target.name}
          </p>
        </header>

        {/* Language Selector */}
        <div className="flex justify-center mb-8">
          <LanguageSelector
            selected={pipeline.sourceLanguage}
            onChange={pipeline.setLanguage}
            disabled={pipeline.isRecording || pipeline.isProcessing}
          />
        </div>

        {/* Live Translation Display */}
        {(pipeline.originalText || pipeline.translatedText) && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
            {pipeline.originalText && (
              <div className="mb-4">
                <p className="text-xs text-white/40 mb-1">
                  {source.flag} {source.name}
                </p>
                <p className="text-white/80">{pipeline.originalText}</p>
              </div>
            )}
            {pipeline.translatedText && (
              <div>
                <p className="text-xs text-blue-400 mb-1">
                  {target.flag} {target.name}
                </p>
                <p className="text-white text-lg font-medium">
                  {pipeline.translatedText}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        <div className="flex justify-center mb-6">
          <TextInput
            onSubmit={pipeline.translateFromText}
            disabled={pipeline.isProcessing || pipeline.isRecording}
            placeholder={
              pipeline.sourceLanguage === "bn"
                ? "বাংলায় লিখুন..."
                : "Écrivez en français..."
            }
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">or speak</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Mic Button */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <MicButton
            isRecording={pipeline.isRecording}
            isProcessing={pipeline.isProcessing}
            onToggle={pipeline.isRecording ? pipeline.stopRecording : pipeline.startRecording}
          />
          <StatusIndicator status={pipeline.status} error={pipeline.error} />
        </div>

        {/* Translation History */}
        {pipeline.results.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm text-white/40 mb-3 uppercase tracking-wider">
              History
            </h2>
            <div className="space-y-3">
              {pipeline.results.map((result) => (
                <TranslationCard key={result.timestamp} result={result} />
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center mt-8 pb-4">
          <p className="text-xs text-white/20">
            TransLive v0.1 — Phase 1 POC
          </p>
        </footer>
      </div>
    </main>
  );
}
