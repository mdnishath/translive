// ===========================================
// Language Selector Component
// ===========================================

"use client";

import type { Language } from "@/types";
import { LANGUAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  selected: Language;
  onChange: (lang: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  selected,
  onChange,
  disabled,
}: LanguageSelectorProps) {
  const languages = Object.values(LANGUAGES);

  return (
    <div className="flex gap-3">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code as Language)}
          disabled={disabled}
          className={cn(
            "px-5 py-3 rounded-xl font-medium transition-all duration-200",
            selected === lang.code
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white/10 text-white/70 hover:bg-white/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-xl mr-2">{lang.flag}</span>
          {lang.name}
        </button>
      ))}
    </div>
  );
}
