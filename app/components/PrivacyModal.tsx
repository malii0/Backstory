"use client";

import React from "react";
import { X, ShieldCheck } from "lucide-react";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-accent">
          <ShieldCheck className="w-5 h-5" />
          <h3 className="text-base font-bold text-foreground">
            Gizlilik & KVKK Aydınlatması
          </h3>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <p>
            Bu uygulama kapsamında, hesabınızı oluşturabilmeniz, izleme
            geçmişinizi kaydedebilmeniz ve arkadaşlarınızla paylaşabilmeniz
            amacıyla e-posta adresiniz, kullanıcı adınız ve uygulama içi
            etkileşim verileriniz (izlediğiniz/kaydettiğiniz içerikler ve
            puanlarınız) Supabase altyapısı üzerinde saklanmaktadır.
          </p>
          <p>
            Kişisel verileriniz hiçbir şekilde 3. taraflarla satılmaz veya
            pazarlama amacıyla kullanılmaz.
          </p>
          <p>
            Hesabınızı ve saklanan tüm verilerinizi kalıcı olarak sildirmek veya
            bilgi almak için uygulama geliştiricisi ile iletişime
            geçebilirsiniz.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-accent text-accent-foreground text-xs font-bold py-2.5 rounded-xl transition-all mt-2"
        >
          Anladım
        </button>
      </div>
    </div>
  );
}
