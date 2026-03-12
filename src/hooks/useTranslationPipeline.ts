// ===========================================
// Translation Pipeline Hook
// Mic → STT → Translate → TTS (full pipeline)
// ===========================================

"use client";

import { useState, useRef, useCallback } from "react";
import type { Language, TranslationResult } from "@/types";
import { getTargetLanguage } from "@/lib/utils";
import { getMicrophoneStream } from "@/lib/utils/audio";
import { transcribeAudio, translateText, textToSpeech } from "@/services/translation";
import { playAudioFromBase64 } from "@/lib/utils/audio";
import { AUDIO_CONFIG } from "@/lib/constants";

type PipelineStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "translating"
  | "speaking"
  | "error";

interface PipelineState {
  status: PipelineStatus;
  sourceLanguage: Language;
  originalText: string;
  translatedText: string;
  error: string | null;
  results: TranslationResult[];
}

export function useTranslationPipeline(initialLanguage: Language = "bn") {
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    sourceLanguage: initialLanguage,
    originalText: "",
    translatedText: "",
    error: null,
    results: [],
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  const updateState = useCallback(
    (updates: Partial<PipelineState>) =>
      setState((prev) => ({ ...prev, ...updates })),
    []
  );

  const setLanguage = useCallback(
    (lang: Language) => updateState({ sourceLanguage: lang }),
    [updateState]
  );

  const cleanupRecording = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      cleanupRecording();
      updateState({ status: "recording", error: null, originalText: "", translatedText: "" });

      const stream = await getMicrophoneStream();
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: AUDIO_CONFIG.mimeType,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
    } catch {
      cleanupRecording();
      updateState({
        status: "idle",
        error: "Mic unavailable — use text input instead",
      });
    } finally {
      isStartingRef.current = false;
    }
  }, [updateState, cleanupRecording]);

  const translateFromText = useCallback(
    async (text: string) => {
      try {
        updateState({
          status: "translating",
          error: null,
          originalText: text,
          translatedText: "",
        });

        const targetLang = getTargetLanguage(state.sourceLanguage);
        const translated = await translateText(
          text,
          state.sourceLanguage,
          targetLang
        );
        updateState({ translatedText: translated });

        // TTS
        updateState({ status: "speaking" });
        try {
          const audioContent = await textToSpeech(translated, targetLang);
          await playAudioFromBase64(audioContent);
        } catch {
          // TTS may fail in some environments, continue anyway
        }

        const result: TranslationResult = {
          originalText: text,
          translatedText: translated,
          sourceLanguage: state.sourceLanguage,
          targetLanguage: targetLang,
          timestamp: Date.now(),
        };

        setState((prev) => ({
          ...prev,
          status: "idle",
          results: [result, ...prev.results],
        }));
      } catch (error) {
        updateState({
          status: "error",
          error: error instanceof Error ? error.message : "Translation failed",
        });
      }
    },
    [state.sourceLanguage, updateState]
  );

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupRecording();
      return;
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        // Grab chunks before cleanup
        const chunks = [...chunksRef.current];
        cleanupRecording();

        const audioBlob = new Blob(chunks, {
          type: AUDIO_CONFIG.mimeType,
        });

        if (audioBlob.size === 0) {
          updateState({ status: "idle", error: "No audio recorded" });
          resolve();
          return;
        }

        try {
          // Step 1: Transcribe
          updateState({ status: "transcribing" });
          const { transcript } = await transcribeAudio(
            audioBlob,
            state.sourceLanguage
          );

          if (!transcript) {
            updateState({ status: "idle", error: "Could not understand speech. Try again." });
            resolve();
            return;
          }

          updateState({ originalText: transcript });

          // Step 2: Translate
          updateState({ status: "translating" });
          const targetLang = getTargetLanguage(state.sourceLanguage);
          const translated = await translateText(
            transcript,
            state.sourceLanguage,
            targetLang
          );
          updateState({ translatedText: translated });

          // Step 3: Text-to-Speech
          updateState({ status: "speaking" });
          try {
            const audioContent = await textToSpeech(translated, targetLang);
            await playAudioFromBase64(audioContent);
          } catch {
            // TTS may fail, continue anyway
          }

          // Save result
          const result: TranslationResult = {
            originalText: transcript,
            translatedText: translated,
            sourceLanguage: state.sourceLanguage,
            targetLanguage: targetLang,
            timestamp: Date.now(),
          };

          setState((prev) => ({
            ...prev,
            status: "idle",
            results: [result, ...prev.results],
          }));
        } catch (error) {
          updateState({
            status: "error",
            error: error instanceof Error ? error.message : "Pipeline failed",
          });
        }

        resolve();
      };

      recorder.stop();
    });
  }, [state.sourceLanguage, updateState, cleanupRecording]);

  return {
    ...state,
    setLanguage,
    startRecording,
    stopRecording,
    translateFromText,
    isRecording: state.status === "recording",
    isProcessing: ["transcribing", "translating", "speaking"].includes(state.status),
  };
}
