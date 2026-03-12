// ===========================================
// TransLive Core Types
// ===========================================

export type Language = "bn" | "fr";

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

export type TranslationDirection = "bn-to-fr" | "fr-to-bn";

export interface ApiError {
  message: string;
  code: string;
  status: number;
}
