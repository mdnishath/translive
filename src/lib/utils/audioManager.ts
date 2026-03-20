// ===========================================
// Global Audio Manager
// Only one audio plays at a time across the app
// ===========================================

let currentAudio: HTMLAudioElement | null = null;
let currentStopCallback: (() => void) | null = null;

/**
 * Register an audio element as the currently playing one.
 * Stops any previously playing audio first.
 */
export function registerAudio(audio: HTMLAudioElement, onStop?: () => void): void {
  // Stop currently playing audio
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentStopCallback) currentStopCallback();
  }

  currentAudio = audio;
  currentStopCallback = onStop ?? null;
}

/**
 * Unregister an audio element (called when playback ends or component unmounts)
 */
export function unregisterAudio(audio: HTMLAudioElement): void {
  if (currentAudio === audio) {
    currentAudio = null;
    currentStopCallback = null;
  }
}
