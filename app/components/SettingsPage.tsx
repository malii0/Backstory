"use client";

import React, { useState } from "react";
import { UserProfile } from "@/lib/types";
import { updateUserProfile } from "@/lib/db";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import {
  Check,
  Sun,
  Moon,
  Palette,
  KeyRound,
  Mail,
  Monitor,
} from "lucide-react";

interface SettingsPageProps {
  userProfile: UserProfile | null;
  onUpdated: () => void;
}

const PRESET_EMOJIS = [
  "🎬",
  "🍿",
  "👾",
  "🚀",
  "⭐",
  "🐉",
  "🎮",
  "🍕",
  "🤖",
  "🎧",
];

export default function SettingsPage({
  userProfile,
  onUpdated,
}: SettingsPageProps) {
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || "",
  );
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || "🎬");
  const [loading, setLoading] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const { mode, accent, updateMode, updateAccent, ACCENT_COLORS } = useTheme();

  const [prevProfile, setPrevProfile] = useState(userProfile);

  if (userProfile !== prevProfile) {
    setPrevProfile(userProfile);
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setAvatarUrl(userProfile.avatarUrl || "🎬");
    }
    setPasswordMsg(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await updateUserProfile(displayName, avatarUrl);
    setLoading(false);
    if (success) {
      await onUpdated();
    }
  };

  const handleSendResetEmail = async () => {
    setPasswordMsg(null);
    setPasswordLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        throw new Error("Kullanıcı e-posta adresi bulunamadı.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      setPasswordMsg({
        text: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.",
        isError: false,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "E-posta gönderilirken bir hata oluştu.";
      setPasswordMsg({
        text: errorMessage,
        isError: true,
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="pb-2 border-b border-border/60">
        <h2 className="text-xl font-extrabold text-foreground">Ayarlar</h2>
        <p className="text-xs text-muted-foreground">
          Profilini ve uygulama temasını kişiselleştir.
        </p>
      </div>

      <div className="bg-card/80 border border-border/80 p-5 sm:p-8 rounded-3xl space-y-6 shadow-sm">
        <div className="p-4 sm:p-6 rounded-2xl bg-background/60 border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sun className="w-4 h-4 text-accent" /> Tema Modu
            </span>
            <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => updateMode("dark")}
                className={`p-2 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "dark"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Koyu
              </button>
              <button
                type="button"
                onClick={() => updateMode("light")}
                className={`p-2 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "light"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Aydınlık
              </button>
              <button
                type="button"
                onClick={() => updateMode("system")}
                className={`p-2 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "system"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Sistem
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" /> Ana Vurgu Rengi
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {ACCENT_COLORS.map((col) => {
                const isActive =
                  accent.toLowerCase() === col.value.toLowerCase();
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateAccent(col.value)}
                    title={col.name}
                    className={`w-9 h-9 rounded-full transition-all flex items-center justify-center border cursor-pointer ${
                      isActive
                        ? "ring-2 ring-foreground scale-110 border-transparent"
                        : "border-border/40"
                    }`}
                    style={{ backgroundColor: col.value }}
                  >
                    {isActive && (
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                    )}
                  </button>
                );
              })}

              <label className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-dashed border-border cursor-pointer flex items-center justify-center text-muted-foreground text-sm font-bold hover:border-foreground transition-colors">
                +
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => updateAccent(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Avatar (Emoji)
            </label>

            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 bg-background border-2 rounded-2xl flex items-center justify-center text-3xl shadow-inner shrink-0"
                style={{ borderColor: accent }}
              >
                {avatarUrl || "🎬"}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  maxLength={4}
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Emoji yaz..."
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarUrl(emoji)}
                  className={`text-lg p-2 rounded-xl transition-all cursor-pointer ${
                    avatarUrl === emoji
                      ? "bg-muted border scale-105 shadow-sm"
                      : "bg-background hover:bg-muted border border-border text-muted-foreground"
                  }`}
                  style={{
                    borderColor: avatarUrl === emoji ? accent : undefined,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Takma Adın
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none transition"
              placeholder="Örn: Mali"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md cursor-pointer"
            style={{
              backgroundColor: accent,
              color: "var(--app-accent-foreground)",
            }}
          >
            {loading ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="w-5 h-5" /> Değişiklikleri Kaydet
              </>
            )}
          </button>
        </form>

        <div className="pt-5 border-t border-border space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <KeyRound className="w-4 h-4 text-accent" />
            <h3>Şifre İşlemleri</h3>
          </div>

          <p className="text-xs text-muted-foreground">
            Şifrenizi değiştirmek için kayıtlı e-posta adresinize bir sıfırlama
            bağlantısı gönderebilirsiniz.
          </p>

          {passwordMsg && (
            <div
              className={`p-3 rounded-xl text-xs border ${
                passwordMsg.isError
                  ? "bg-red-950/50 text-red-400 border-red-900/50"
                  : "bg-emerald-950/50 text-emerald-400 border-emerald-900/50"
              }`}
            >
              {passwordMsg.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleSendResetEmail}
            disabled={passwordLoading}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Mail className="w-4 h-4 text-accent" />
            {passwordLoading
              ? "E-posta Gönderiliyor..."
              : "Şifre Değiştirme Maili Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
