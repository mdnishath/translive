"use client";

import { useState, useRef, useCallback } from "react";
import { AUDIO_CONFIG } from "@/lib/constants";

export type RecordingState = "idle" | "recording" | "uploading";

interface UseVoiceRecorderOptions {
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
}

export function useVoiceRecorder({ onRecordingComplete }: UseVoiceRecorderOptions) {
  const [state, setState] = useState<RecordingState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    mediaRecorderRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    audioContextRef.current = null;
    chunksRef.current = [];
    timerRef.current = null;
    animFrameRef.current = 0;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      cancelledRef.current = false;
      chunksRef.current = [];
      setDurationMs(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up Web Audio API analyser for waveform (use device default sample rate)
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyser animation loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      function updateAnalyser() {
        analyser.getByteFrequencyData(dataArray);
        setAnalyserData(new Uint8Array(dataArray));
        animFrameRef.current = requestAnimationFrame(updateAnalyser);
      }
      updateAnalyser();

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported(AUDIO_CONFIG.mimeType)
        ? AUDIO_CONFIG.mimeType
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        setState("idle");
        setAnalyserData(null);

        if (!cancelledRef.current && blob.size > 0 && duration > 500) {
          onRecordingComplete(blob, duration);
        }
      };

      recorder.start(100); // collect data every 100ms
      startTimeRef.current = Date.now();
      setState("recording");

      // Duration timer
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      console.error("[useVoiceRecorder] Failed to start:", err);
      cleanup();
      setState("idle");
    }
  }, [cleanup, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      cleanup();
      setState("idle");
      setAnalyserData(null);
      setDurationMs(0);
    }
  }, [cleanup]);

  return {
    state,
    durationMs,
    analyserData,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: state === "recording",
  };
}
