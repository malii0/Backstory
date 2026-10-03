"use client";

import React, { useState } from "react";
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

export default function SettingsPage() {
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const { mode, accent, updateMode, updateAccent, ACCENT_COLORS } = useTheme();

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
          Uygulama temasını kişiselleştirin ve hesap işlemlerinizi yönetin.
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

      {/* 2. Şifre İşlemleri Kartı */}
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
