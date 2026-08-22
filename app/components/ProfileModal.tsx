"use client";

import React, { useState } from "react";
import { UserProfile } from "@/lib/types";
import { updateUserProfile } from "@/lib/db";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import {
  X,
  Check,
  Sun,
  Moon,
  Palette,
  KeyRound,
  Mail,
  Monitor,
} from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  userProfile: UserProfile | null;
  onClose: () => void;
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

export default function ProfileModal({
  isOpen,
  userProfile,
  onClose,
  onUpdated,
}: ProfileModalProps) {
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
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (userProfile !== prevProfile || isOpen !== prevIsOpen) {
    setPrevProfile(userProfile);
    setPrevIsOpen(isOpen);
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setAvatarUrl(userProfile.avatarUrl || "🎬");
    }
    setPasswordMsg(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await updateUserProfile(displayName, avatarUrl);
    setLoading(false);
    if (success) {
      await onUpdated();
      onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 border border-border shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">
            Profil ve Görünüm
          </h2>
          <p className="text-xs text-muted-foreground">
            Profilini ve uygulama temasını kişiselleştir.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-background/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-accent" /> Tema Modu
            </span>
            <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => updateMode("dark")}
                className={`p-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                  mode === "dark"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Moon className="w-3 h-3" /> Koyu
              </button>
              <button
                type="button"
                onClick={() => updateMode("light")}
                className={`p-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                  mode === "light"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Sun className="w-3 h-3" /> Aydınlık
              </button>
              <button
                type="button"
                onClick={() => updateMode("system")}
                className={`p-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                  mode === "system"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground"
                }`}
              >
                <Monitor className="w-3 h-3" /> Sistem
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/60">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-accent" /> Ana Vurgu Rengi
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_COLORS.map((col) => {
                const isActive =
                  accent.toLowerCase() === col.value.toLowerCase();
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateAccent(col.value)}
                    title={col.name}
                    className={`w-7 h-7 rounded-full transition-all flex items-center justify-center border cursor-pointer ${
                      isActive
                        ? "ring-2 ring-foreground scale-110 border-transparent"
                        : "border-border/40"
                    }`}
                    style={{ backgroundColor: col.value }}
                  >
                    {isActive && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    )}
                  </button>
                );
              })}

              <label className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-dashed border-border cursor-pointer flex items-center justify-center text-muted-foreground text-xs font-bold hover:border-foreground transition-colors">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Avatar (Emoji)
            </label>

            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 bg-background border-2 rounded-2xl flex items-center justify-center text-2xl shadow-inner shrink-0"
                style={{ borderColor: accent }}
              >
                {avatarUrl || "🎬"}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  maxLength={4}
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Emoji yaz..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarUrl(emoji)}
                  className={`text-base p-1.5 rounded-xl transition-all cursor-pointer ${
                    avatarUrl === emoji
                      ? "bg-muted border scale-105"
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

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Takma Adın
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none transition"
              placeholder="Örn: Mali"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg cursor-pointer"
            style={{
              backgroundColor: accent,
              color: "var(--app-accent-foreground)",
            }}
          >
            {loading ? (
              "Kaydediliyor..."
            ) : (
              <>
                <Check className="w-4 h-4" /> Kaydet
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-accent" /> Şifre İşlemleri
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Şifrenizi değiştirmek için kayıtlı e-posta adresinize sıfırlama
            bağlantısı gönderebilirsiniz.
          </p>

          {passwordMsg && (
            <div
              className={`p-2.5 rounded-xl text-[11px] text-center border ${
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
            className="w-full py-2 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5 text-accent" />
            {passwordLoading
              ? "E-posta Gönderiliyor..."
              : "Şifre Değiştirme Maili Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
