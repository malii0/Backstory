"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (isNewUser?: boolean) => void;
  isInviteMode?: boolean;
}

export default function AuthModal({
  isOpen,
  onSuccess,
  isInviteMode = false,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<
    "login" | "set_password" | "forgot_password"
  >(isInviteMode ? "set_password" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevInviteMode, setPrevInviteMode] = useState(isInviteMode);

  if (isOpen !== prevOpen || isInviteMode !== prevInviteMode) {
    setPrevOpen(isOpen);
    setPrevInviteMode(isInviteMode);
    setMode(isInviteMode ? "set_password" : "login");
    setError(null);
    setMessage(null);
  }

  const isMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = isMinLength && hasUpper && hasLower && hasNumber;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "forgot_password") {
        const redirectUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}`
            : undefined;

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: redirectUrl,
          },
        );

        if (resetError) {
          throw resetError;
        }

        setMessage(
          "Sıfırlama bağlantısı e-postanıza gönderildi! Lütfen gelen kutunuzu kontrol edin.",
        );
        setLoading(false);
      } else if (mode === "set_password") {
        if (!isPasswordValid) {
          setError("Lütfen şifre kurallarına uygun bir şifre belirlen.");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Girdiğiniz şifreler eşleşmiyor.");
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) {
          throw updateError;
        }

        setMessage("Şifreniz başarıyla güncellendi! Giriş yapılıyor...");

        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", window.location.pathname);
        }

        setTimeout(() => {
          setLoading(false);
          setPassword("");
          setConfirmPassword("");
          onSuccess(true);
        }, 1000);
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          setError("Giriş başarısız. Bilgilerinizi kontrol edin.");
          setLoading(false);
        } else {
          setLoading(false);
          setPassword("");
          setConfirmPassword("");
          onSuccess(false);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Bir hata oluştu.";
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 border border-border shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-accent/10 mx-auto mb-3 border border-border relative">
            <Image
              src="/icons/icon-192.png"
              alt="Backstory Logo"
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {mode === "set_password"
              ? "Yeni Şifre Belirleyin"
              : mode === "forgot_password"
                ? "Şifremi Unuttum"
                : "Backstory Giriş"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {mode === "set_password"
              ? "Hesabınız için yeni bir şifre oluşturun."
              : mode === "forgot_password"
                ? "Kayıtlı e-posta adresinizi girin, sıfırlama bağlantısı gönderelim."
                : "Devam etmek için oturum açın."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs text-red-400 bg-red-950/50 border border-red-900/50 rounded-xl text-center">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 rounded-xl text-center">
              {message}
            </div>
          )}

          {(mode === "login" || mode === "forgot_password") && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                E-posta
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-accent transition"
                placeholder="E-postanızı girin"
              />
            </div>
          )}

          {(mode === "login" || mode === "set_password") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  {mode === "set_password" ? "Yeni Şifreniz" : "Şifre"}
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      setMode("forgot_password");
                    }}
                    className="text-[11px] text-accent hover:underline cursor-pointer"
                  >
                    Şifremi Unuttum
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-accent transition"
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === "set_password" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-background/60 border border-border/80 text-[11px]">
              <p className="text-muted-foreground font-medium mb-1">
                Şifre gereksinimleri:
              </p>
              <ul className="space-y-1">
                <li
                  className={`flex items-center gap-1.5 transition-colors ${isMinLength ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  <span>{isMinLength ? "✓" : "•"}</span> En az 8 karakter
                </li>
                <li
                  className={`flex items-center gap-1.5 transition-colors ${hasUpper && hasLower ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  <span>{hasUpper && hasLower ? "✓" : "•"}</span> Büyük ve küçük
                  harf
                </li>
                <li
                  className={`flex items-center gap-1.5 transition-colors ${hasNumber ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  <span>{hasNumber ? "✓" : "•"}</span> En az 1 rakam
                </li>
              </ul>
            </div>
          )}

          {mode === "set_password" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Şifreyi Tekrar Girin
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-accent transition"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === "set_password" && !isPasswordValid)}
            className="w-full py-3 bg-accent text-accent-foreground font-bold rounded-xl text-xs transition disabled:opacity-50 mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading
              ? "İşleniyor..."
              : mode === "set_password"
                ? "Şifreyi Kaydet ve Başla"
                : mode === "forgot_password"
                  ? "Sıfırlama Bağlantısı Gönder"
                  : "Giriş Yap"}
          </button>

          {mode === "forgot_password" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage(null);
                setMode("login");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition cursor-pointer pt-1"
            >
              Giriş ekranına geri dön
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
