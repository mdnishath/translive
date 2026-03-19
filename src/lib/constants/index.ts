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

// Gemini Pro TTS voices (natural, expressive)
export const GEMINI_TTS_VOICES: Record<string, { languageCode: string; voiceName: string }> = {
  bn: { languageCode: "bn-BD", voiceName: "Despina" },
  fr: { languageCode: "fr-FR", voiceName: "Aoede" },
  en: { languageCode: "en-US", voiceName: "Kore" },
};

// Fallback: Google Cloud Wavenet voices
export const GOOGLE_TTS_CONFIG = {
  bn: { languageCode: "bn-IN", name: "bn-IN-Wavenet-A", ssmlGender: "FEMALE" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-A", ssmlGender: "FEMALE" },
  en: { languageCode: "en-US", name: "en-US-Wavenet-F", ssmlGender: "FEMALE" },
} as const;

export const AUDIO_CONFIG = {
  sampleRate: 48000,
  channels: 1,
  mimeType: "audio/webm;codecs=opus",
} as const;
