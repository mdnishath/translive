// ===========================================
// TransLive Core Types
// ===========================================

export type Language = "bn" | "fr" | "en";

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  timestamp: number;
}

export interface SpeechToTextResult {
  transcript: string;
  confidence: number;
  language: Language;
  isFinal: boolean;
}

export interface TextToSpeechResult {
  audioContent: string; // base64 encoded audio
  language: Language;
}

export type TranslationDirection = "bn-to-fr" | "fr-to-bn" | "bn-to-en" | "en-to-bn" | "fr-to-en" | "en-to-fr";

export interface ApiError {
  message: string;
  code: string;
  status: number;
}
