"use client";

import React, { useState } from "react";
import { Sparkles, Shield, User, X, Check } from "lucide-react";
import { updateUserProfile } from "@/lib/db";
import { UserProfile } from "@/lib/types";

interface AnnouncementModalProps {
  isOpen: boolean;
  userProfile: UserProfile | null;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export default function AnnouncementModal({
  isOpen,
  userProfile,
  onClose,
  onProfileUpdated,
}: AnnouncementModalProps) {
  const [isPublic, setIsPublic] = useState(userProfile?.isPublic ?? false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndClose = async () => {
    if (userProfile && isPublic !== userProfile.isPublic) {
      setLoading(true);
      await updateUserProfile(
        userProfile.username,
        userProfile.displayName,
        userProfile.avatarUrl,
        isPublic,
      );
      setLoading(false);
      await onProfileUpdated();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground bg-muted/60 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-2xl text-accent">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">
              Yenilikler • v1.1
            </span>
            <h3 className="text-lg font-extrabold text-foreground">
              Profiller ve Paylaşım Geldi!
            </h3>
          </div>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-background/60 border border-border/60">
            <User className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">
                Özel Profil Bağlantısı
              </p>
              <p className="text-[11px] mt-0.5">
                Artık Ayarlar sayfasından kendi özel kullanıcı adınızı (URL)
                belirleyebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-background/60 border border-border/60">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Profil Gizliliği</p>
              <p className="text-[11px] mt-0.5">
                Varsayılan olarak profiller gizlidir. Dilerseniz profilinizi
                arkadaşlarınıza açabilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* Hızlı Aksiyon Kutusu */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-background/80">
          <div>
            <p className="text-xs font-bold text-foreground">
              Profilimi Herkese Aç
            </p>
            <p className="text-[10px] text-muted-foreground">
              Listeleriniz görüntülenebilir olsun.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <div className="w-10 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <button
          onClick={handleSaveAndClose}
          disabled={loading}
          className="w-full py-3 bg-accent text-accent-foreground font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            "Kaydediliyor..."
          ) : (
            <>
              <Check className="w-4 h-4" /> Anladım ve Devam Et
            </>
          )}
        </button>
      </div>
    </div>
  );
}
