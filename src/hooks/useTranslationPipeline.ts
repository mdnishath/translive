// ===========================================
// Translation Pipeline Hook
// Mic → STT → Translate → TTS (full pipeline)
// ===========================================

"use client";

import { useState, useRef, useCallback } from "react";
import type { Language, TranslationResult } from "@/types";
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
  targetLanguage: Language;
  originalText: string;
  translatedText: string;
  error: string | null;
  results: TranslationResult[];
}

export function useTranslationPipeline(
  initialSource: Language = "bn",
  initialTarget: Language = "en"
) {
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    sourceLanguage: initialSource,
    targetLanguage: initialTarget,
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

  const setSourceLanguage = useCallback(
    (lang: Language) => {
      setState((prev) => {
        // If source becomes same as target, swap them
        if (lang === prev.targetLanguage) {
          return { ...prev, sourceLanguage: lang, targetLanguage: prev.sourceLanguage };
        }
        return { ...prev, sourceLanguage: lang };
      });
    },
    []
  );

  const setTargetLanguage = useCallback(
    (lang: Language) => {
      setState((prev) => {
        // If target becomes same as source, swap them
        if (lang === prev.sourceLanguage) {
          return { ...prev, targetLanguage: lang, sourceLanguage: prev.targetLanguage };
        }
        return { ...prev, targetLanguage: lang };
      });
    },
    []
  );

  const swapLanguages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sourceLanguage: prev.targetLanguage,
      targetLanguage: prev.sourceLanguage,
    }));
  }, []);

  // Legacy setter for backward compatibility
  const setLanguage = useCallback(
    (lang: Language) => setSourceLanguage(lang),
    [setSourceLanguage]
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

        const translated = await translateText(
          text,
          state.sourceLanguage,
          state.targetLanguage
        );
        updateState({ translatedText: translated });

        // TTS
        updateState({ status: "speaking" });
        try {
          const audioContent = await textToSpeech(translated, state.targetLanguage);
          await playAudioFromBase64(audioContent);
        } catch {
          // TTS may fail in some environments, continue anyway
        }

        const result: TranslationResult = {
          originalText: text,
          translatedText: translated,
          sourceLanguage: state.sourceLanguage,
          targetLanguage: state.targetLanguage,
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
    [state.sourceLanguage, state.targetLanguage, updateState]
  );

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupRecording();
      return;
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
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
          const translated = await translateText(
            transcript,
            state.sourceLanguage,
            state.targetLanguage
          );
          updateState({ translatedText: translated });

          // Step 3: Text-to-Speech
          updateState({ status: "speaking" });
          try {
            const audioContent = await textToSpeech(translated, state.targetLanguage);
            await playAudioFromBase64(audioContent);
          } catch {
            // TTS may fail, continue anyway
          }

          // Save result
          const result: TranslationResult = {
            originalText: transcript,
            translatedText: translated,
            sourceLanguage: state.sourceLanguage,
            targetLanguage: state.targetLanguage,
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
  }, [state.sourceLanguage, state.targetLanguage, updateState, cleanupRecording]);

  return {
    ...state,
    setLanguage,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages,
    startRecording,
    stopRecording,
    translateFromText,
    isRecording: state.status === "recording",
    isProcessing: ["transcribing", "translating", "speaking"].includes(state.status),
  };
}
