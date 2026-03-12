"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LANGUAGES } from "@/lib/constants";

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState(user?.language || "bn");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveLanguage = async () => {
    setSaving(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: selectedLang }),
    });
    if (res.ok) {
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-[#1f2d4a] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#1f2d4a] transition-colors"
        >
          <svg className="w-5 h-5 text-[#8B9EC7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">প্রোফাইল</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center text-2xl font-bold shadow-lg shadow-purple-500/30">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold">{user.name}</p>
            <p className="text-[#8B9EC7] text-sm">{user.email}</p>
          </div>
        </div>

        {/* Language Preference */}
        <div className="bg-[#111827] border border-[#1f2d4a] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[#8B9EC7] mb-4">ভাষা পছন্দ</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(LANGUAGES).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                  selectedLang === lang.code
                    ? "border-[#6C63FF] bg-[#6C63FF]/10 text-white"
                    : "border-[#1f2d4a] bg-[#0d1526] text-[#8B9EC7] hover:border-[#6C63FF]/50"
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium text-sm">{lang.name}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleSaveLanguage}
            disabled={saving || selectedLang === user.language}
            className="w-full mt-4 bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4] text-white font-semibold py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? "সেভ হয়েছে ✓" : saving ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-[#111827] border border-red-500/30 text-red-400 font-semibold py-3 rounded-xl hover:bg-red-500/10 active:scale-[0.98] transition-all"
        >
          লগআউট
        </button>
      </div>
    </div>
  );
}
