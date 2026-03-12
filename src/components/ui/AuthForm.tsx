"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/constants";

interface AuthFormProps {
  mode: "login" | "signup";
  onSubmit: (data: AuthFormData) => Promise<{ error?: string }>;
  loading?: boolean;
}

export interface AuthFormData {
  name?: string;
  email: string;
  password: string;
  language?: string;
}

export default function AuthForm({ mode, onSubmit, loading }: AuthFormProps) {
  const [formData, setFormData] = useState<AuthFormData>({
    name: "",
    email: "",
    password: "",
    language: "bn",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await onSubmit(formData);
    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#4ECDC4] mb-4 shadow-lg shadow-purple-500/30">
            <span className="text-2xl">🌐</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TransLive</h1>
          <p className="text-[#8B9EC7] text-sm mt-1">বাংলা ↔ Français</p>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-[#1f2d4a] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isSignup ? "অ্যাকাউন্ট তৈরি করুন" : "স্বাগতম!"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm text-[#8B9EC7] mb-1.5">আপনার নাম</label>
                <input
                  type="text"
                  placeholder="নাম লিখুন"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-[#0d1526] border border-[#1f2d4a] rounded-xl px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF] transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-[#8B9EC7] mb-1.5">ইমেইল</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full bg-[#0d1526] border border-[#1f2d4a] rounded-xl px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8B9EC7] mb-1.5">পাসওয়ার্ড</label>
              <input
                type="password"
                placeholder="কমপক্ষে ৬ অক্ষর"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full bg-[#0d1526] border border-[#1f2d4a] rounded-xl px-4 py-3 text-white placeholder-[#4a5568] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF] transition-colors"
              />
            </div>

            {isSignup && (
              <div>
                <label className="block text-sm text-[#8B9EC7] mb-1.5">আপনার ভাষা</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(LANGUAGES).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setFormData({ ...formData, language: lang.code })}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                        formData.language === lang.code
                          ? "border-[#6C63FF] bg-[#6C63FF]/10 text-white"
                          : "border-[#1f2d4a] bg-[#0d1526] text-[#8B9EC7] hover:border-[#6C63FF]/50"
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span className="font-medium text-sm">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4] text-white font-semibold py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-purple-500/20"
            >
              {submitting ? "..." : isSignup ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}
            </button>
          </form>

          <p className="text-center text-sm text-[#8B9EC7] mt-6">
            {isSignup ? (
              <>
                আগেই অ্যাকাউন্ট আছে?{" "}
                <Link href="/login" className="text-[#6C63FF] hover:text-[#4ECDC4] font-medium transition-colors">
                  লগইন করুন
                </Link>
              </>
            ) : (
              <>
                নতুন?{" "}
                <Link href="/signup" className="text-[#6C63FF] hover:text-[#4ECDC4] font-medium transition-colors">
                  অ্যাকাউন্ট তৈরি করুন
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
