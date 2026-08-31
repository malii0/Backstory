"use client";

import React, { useState, useEffect } from "react";
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
  User as UserIcon,
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
  const [username, setUsername] = useState(userProfile?.username || "");
  const [isPublic, setIsPublic] = useState(userProfile?.isPublic || false);

  const [loading, setLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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
      setUsername(userProfile.username || "");
      setAvatarUrl(userProfile.avatarUrl || "🎬");
      setIsPublic(userProfile.isPublic || false);
    }
    setPasswordMsg(null);
  }

  useEffect(() => {
    if (updateSuccess) {
      const timer = setTimeout(() => {
        setUpdateSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [updateSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUpdateSuccess(false);
    setProfileError(null);

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setProfileError(
        "Kullanıcı adı 3-20 karakter uzunluğunda olmalı ve sadece harf, rakam, alt çizgi içermelidir.",
      );
      setLoading(false);
      return;
    }

    const result = await updateUserProfile(
      username,
      displayName,
      avatarUrl,
      isPublic,
    );

    setLoading(false);

    if (result.success) {
      setUpdateSuccess(true);
      await onUpdated();
    } else {
      setProfileError(result.error || "Güncelleme başarısız oldu.");
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

      {/* 1. Tema Kartı */}
      <div className="bg-card/80 border border-border/80 p-5 sm:p-6 rounded-3xl space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sun className="w-4 h-4 text-accent" /> Tema Modu
          </span>
          <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => updateMode("dark")}
              className={`p-2 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === "dark"
                  ? "bg-muted text-accent font-bold"
                  : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Sistem
            </button>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-border/60">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" /> Ana Vurgu Rengi
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {ACCENT_COLORS.map((col) => {
              const isActive = accent.toLowerCase() === col.value.toLowerCase();
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => updateAccent(col.value)}
                  title={col.name}
                  className={`w-9 h-9 rounded-full transition-all flex items-center justify-center border cursor-pointer ${
                    isActive
                      ? "ring-2 ring-foreground scale-110 border-transparent"
                      : "border-border/40 hover:scale-105"
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

        <p className="text-[10px] text-muted-foreground/60 italic text-right pt-2">
          Değişiklikler anında uygulanır.
        </p>
      </div>

      {/* 2. Profil Bilgileri Kartı */}
      <div className="bg-card/80 border border-border/80 p-5 sm:p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-2 text-foreground font-semibold mb-5">
          <UserIcon className="w-4 h-4 text-accent" />
          <h3>Profil Bilgileri</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent transition"
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
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-accent transition"
              placeholder="Örn: Mali"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Kullanıcı Adı (URL)
            </label>
            <div className="flex items-center">
              <span className="bg-muted border border-r-0 border-border rounded-l-xl px-3 py-2.5 text-sm text-muted-foreground">
                backstory.com/u/
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                className="w-full px-3 py-2.5 bg-background border border-border rounded-r-xl text-sm text-foreground focus:outline-none focus:border-accent transition"
                placeholder="kullanici_adi"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/50 mt-4">
            <div>
              <p className="text-sm font-medium text-foreground">Açık Profil</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Profilinizi ve listelerinizi diğer kullanıcıların görmesine izin
                verin.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="pt-2">
            {profileError && (
              <div className="mb-3 p-3 rounded-xl text-xs text-red-400 bg-red-950/50 border border-red-900/50 text-center animate-in fade-in duration-300">
                {profileError}
              </div>
            )}

            {updateSuccess && (
              <div className="mb-3 p-3 rounded-xl text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 text-center animate-in fade-in duration-300">
                Profiliniz başarıyla güncellendi.
              </div>
            )}

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
          </div>
        </form>
      </div>

      {/* 3. Şifre İşlemleri Kartı */}
      <div className="bg-card/80 border border-border/80 p-5 sm:p-6 rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <KeyRound className="w-4 h-4 text-accent" />
          <h3>Şifre İşlemleri</h3>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Şifrenizi değiştirmek için kayıtlı e-posta adresinize bir sıfırlama
          bağlantısı gönderebilirsiniz.
        </p>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl text-xs border animate-in fade-in duration-300 ${
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
  );
}
