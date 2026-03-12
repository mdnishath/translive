// ===========================================
// General Utilities
// ===========================================

import type { Language } from "@/types";

/**
 * Get the opposite language for translation direction
 */
export function getTargetLanguage(source: Language): Language {
  return source === "bn" ? "fr" : "bn";
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Classname merge utility (simple version)
 */
export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
