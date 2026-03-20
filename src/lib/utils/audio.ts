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
 * Plays base64 encoded audio. Handles both MP3 and PCM/WAV formats.
 */
export function playAudioFromBase64(base64Audio: string, mimeType?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Gemini TTS returns PCM (audio/L16) — convert to WAV for playback
    if (mimeType && mimeType.includes("L16")) {
      const raw = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
      const sampleRate = 24000;
      const wav = createWavFromPcm(raw, sampleRate);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      audio.play().catch(reject);
    } else {
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
      audio.play().catch(reject);
    }
  });
}

/** Create a WAV file from raw PCM data */
function createWavFromPcm(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const header = 44;
  const wav = new ArrayBuffer(header + pcm.length);
  const view = new DataView(wav);
  // RIFF
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, "WAVE");
  // fmt
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data
  writeString(view, 36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(wav, header).set(pcm);
  return wav;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
