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

export const GOOGLE_TTS_CONFIG = {
  bn: { languageCode: "bn-IN", name: "bn-IN-Standard-A" },
  fr: { languageCode: "fr-FR", name: "fr-FR-Standard-A" },
  en: { languageCode: "en-US", name: "en-US-Standard-A" },
} as const;

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  mimeType: "audio/webm;codecs=opus",
} as const;
