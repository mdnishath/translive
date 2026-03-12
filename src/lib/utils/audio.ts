// ===========================================
// Audio Utilities
// ===========================================

import { AUDIO_CONFIG } from "@/lib/constants";

/**
 * Creates a MediaRecorder with optimal settings for speech recognition
 */
export function createMediaRecorder(
  stream: MediaStream,
  onDataAvailable: (data: Blob) => void
): MediaRecorder {
  const recorder = new MediaRecorder(stream, {
    mimeType: AUDIO_CONFIG.mimeType,
  });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      onDataAvailable(event.data);
    }
  };

  return recorder;
}

/**
 * Plays base64 encoded audio
 */
export function playAudioFromBase64(base64Audio: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audio.onended = () => resolve();
    audio.onerror = (e) => reject(e);
    audio.play().catch(reject);
  });
}

/**
 * Request microphone access
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: AUDIO_CONFIG.sampleRate,
      channelCount: AUDIO_CONFIG.channels,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}
