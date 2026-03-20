// ===========================================
// TransLive Constants
// ===========================================

export const LANGUAGES = {
  bn: { code: "bn", name: "বাংলা", englishName: "Bengali", flag: "🇧🇩" },
  fr: { code: "fr", name: "Français", englishName: "French", flag: "🇫🇷" },
  en: { code: "en", name: "English", englishName: "English", flag: "🇬🇧" },
} as const;

export const DEEPGRAM_CONFIG = {
  models: { bn: "whisper-large", fr: "nova-3", en: "nova-3" },
  punctuate: true,
  interimResults: true,
  endpointing: 300,
} as const;

// Gemini Pro TTS voices (expression-aware)
export const GEMINI_TTS_VOICES: Record<string, string> = {
  bn: "Algenib",
  fr: "Orus",
  en: "Puck",
};

// Fallback: Google Cloud Chirp3-HD / Wavenet voices (all male)
export const GOOGLE_TTS_CONFIG = {
  bn: { languageCode: "bn-IN", name: "bn-IN-Chirp3-HD-Algenib", ssmlGender: "MALE" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-B", ssmlGender: "MALE" },
  en: { languageCode: "en-US", name: "en-US-Wavenet-B", ssmlGender: "MALE" },
} as const;

export const AUDIO_CONFIG = {
  sampleRate: 48000,
  channels: 1,
  mimeType: "audio/webm;codecs=opus",
} as const;
