"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Film,
  Search,
  Clapperboard,
  BarChart3,
  Sparkles,
  Monitor,
  Mail,
  ShieldCheck,
  LogIn,
} from "lucide-react";

interface LandingPageProps {
  onSignIn: () => void;
  onPrivacyClick: () => void;
}

type Lang = "en" | "tr";

const MY_EMAIL = "m.alionurlucan@gmail.com";

const CONTENT = {
  en: {
    eyebrow: "Invite-only for now",
    h1: "Your movies and shows, logged your way.",
    subline:
      "Backstory is a quiet, personal tracker for what you watch. Rate on a 0–10 scale, build a watchlist, and see your viewing stats. No feed, no ads, no public profiles.",
    requestAccess: "Request access",
    signIn: "Sign in",
    mailtoSubject: "Backstory access request",
    screenshots: {
      discover: "Discover",
      details: "Details",
      stats: "Stats",
      alts: {
        discover: "Backstory discover interface screenshot",
        details: "Backstory movie and show detail drawer screenshot",
        stats: "Backstory viewing stats dashboard screenshot",
      },
    },
    featuresTitle: "What you get",
    features: [
      {
        title: "Library",
        text: "Mark titles as watched or planned, rate them from 0 to 10, and keep count of rewatches.",
        icon: Film,
      },
      {
        title: "Discover",
        text: "Search movies and shows, browse what's popular or new, and jump to similar titles and collections.",
        icon: Search,
      },
      {
        title: "Details",
        text: "Cast, trailers, and where to stream in Turkey, all in one panel.",
        icon: Clapperboard,
      },
      {
        title: "Stats",
        text: "Total watch time, genre breakdown, average rating, and your most-rewatched title.",
        icon: BarChart3,
      },
      {
        title: "Recommendations",
        text: "Suggestions based on your taste, plus an optional AI analysis whenever you ask for it.",
        icon: Sparkles,
      },
      {
        title: "Everywhere",
        text: "Install it as an app on your phone or desktop and pick up on any device with your account.",
        icon: Monitor,
      },
    ],
    accessTitle: "How to get in",
    accessSteps: [
      "Send me an email.",
      "I'll send you an invite link.",
      "Set a password and start logging.",
    ],
    smallPrint:
      "No ads. No feed. No public profiles. Other users can't see your library.",
    privacyLabel: "Privacy & KVKK",
    rightsReserved: "All rights reserved.",
  },
  tr: {
    eyebrow: "Şimdilik sadece davetle",
    h1: "Film ve dizilerin, senin istediğin gibi.",
    subline:
      "Backstory, izlediklerini takip etmek için yapılmış sakin, kişisel bir araç. 0–10 arası puan ver, izleme listeni oluştur, istatistiklerini gör. Akış yok, reklam yok, herkese açık profil yok.",
    requestAccess: "Erişim iste",
    signIn: "Giriş yap",
    mailtoSubject: "Backstory erişim isteği",
    screenshots: {
      discover: "Keşfet",
      details: "Detaylar",
      stats: "İstatistikler",
      alts: {
        discover: "Backstory keşfet ekran görüntüsü",
        details: "Backstory film ve dizi detay paneli ekran görüntüsü",
        stats: "Backstory izleme istatistikleri paneli ekran görüntüsü",
      },
    },
    featuresTitle: "Neler var",
    features: [
      {
        title: "Kütüphane",
        text: "İzlediklerini ve izleyeceklerini işaretle, 0'dan 10'a puan ver, tekrar izleme sayını tut.",
        icon: Film,
      },
      {
        title: "Keşfet",
        text: "Film ve dizi ara, popüler ve yeni çıkanlara göz at, benzer yapımlara ve koleksiyonlara geç.",
        icon: Search,
      },
      {
        title: "Detaylar",
        text: "Oyuncular, fragmanlar ve Türkiye'de nereden izleyebileceğin, tek panelde.",
        icon: Clapperboard,
      },
      {
        title: "İstatistikler",
        text: "Toplam izleme süresi, tür dağılımı, ortalama puan ve en çok tekrar izlediğin yapım.",
        icon: BarChart3,
      },
      {
        title: "Öneriler",
        text: "Zevkine göre öneriler ve istediğin zaman isteğe bağlı yapay zekâ analizi.",
        icon: Sparkles,
      },
      {
        title: "Her yerde",
        text: "Telefona ya da bilgisayara uygulama olarak kur, hesabınla her cihazda devam et.",
        icon: Monitor,
      },
    ],
    accessTitle: "Nasıl girilir?",
    accessSteps: [
      "Bana e-posta at.",
      "Sana bir davet bağlantısı göndereyim.",
      "Şifreni belirle ve kaydetmeye başla.",
    ],
    smallPrint:
      "Reklam yok. Akış yok. Herkese açık profil yok. Diğer kullanıcılar kütüphaneni göremez.",
    privacyLabel: "Gizlilik & KVKK",
    rightsReserved: "Tüm hakları saklıdır.",
  },
};

function getInitialLanguage(): Lang {
  if (typeof window === "undefined") return "tr";
  try {
    const saved = localStorage.getItem("backstory-landing-lang");
    if (saved === "tr" || saved === "en") return saved;
  } catch {}

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
  }
  return "tr";
}

export default function LandingPage({
  onSignIn,
  onPrivacyClick,
}: LandingPageProps) {
  const [lang, setLang] = useState<Lang>(getInitialLanguage);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.lang = "tr";
      }
    };
  }, [lang]);

  const handleLanguageChange = (nextLang: Lang) => {
    setLang(nextLang);
    try {
      localStorage.setItem("backstory-landing-lang", nextLang);
    } catch {}
  };

  const t = CONTENT[lang];
  const mailtoHref = `mailto:${MY_EMAIL}?subject=${encodeURIComponent(t.mailtoSubject)}`;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col selection:bg-muted selection:text-accent">
      {/* 1. Top Bar */}
      <header className="sticky top-0 z-40 bg-background/90 border-b border-border backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center p-1">
              <div
                className="w-full h-full bg-accent dark:bg-foreground transition-colors duration-200"
                style={{
                  maskImage: "url(/logo.svg)",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                  maskSize: "contain",
                  WebkitMaskImage: "url(/logo.svg)",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  WebkitMaskSize: "contain",
                }}
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground leading-none">
              Backstory
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-card border border-border rounded-xl p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleLanguageChange("tr")}
                aria-pressed={lang === "tr"}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === "tr"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange("en")}
                aria-pressed={lang === "en"}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === "en"
                    ? "bg-muted text-accent font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onSignIn}
              className="bg-accent text-accent-foreground text-xs font-bold px-3.5 py-2 rounded-xl transition-all hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t.signIn}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-16 sm:space-y-24">
        {/* 2. Hero */}
        <section className="relative isolate text-center max-w-3xl mx-auto space-y-6 pt-4">
          <div className="absolute inset-0 -top-12 bg-gradient-to-b from-accent/15 via-transparent to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>{t.eyebrow}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
            {t.h1}
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t.subline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={mailtoHref}
              className="w-full sm:w-auto bg-accent text-accent-foreground font-bold text-xs sm:text-sm px-6 py-3 rounded-2xl transition-all hover:opacity-90 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>{t.requestAccess}</span>
            </a>
            <button
              type="button"
              onClick={onSignIn}
              className="w-full sm:w-auto bg-card border border-border text-foreground hover:bg-muted font-bold text-xs sm:text-sm px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-accent" />
              <span>{t.signIn}</span>
            </button>
          </div>
        </section>

        {/* 3. Screenshots */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card shadow-md">
                <Image
                  src="/screenshots/discover.jpg"
                  alt={t.screenshots.alts.discover}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
              <p className="text-xs font-bold text-center text-muted-foreground">
                {t.screenshots.discover}
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card shadow-md">
                <Image
                  src="/screenshots/detail.jpg"
                  alt={t.screenshots.alts.details}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
              <p className="text-xs font-bold text-center text-muted-foreground">
                {t.screenshots.details}
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card shadow-md">
                <Image
                  src="/screenshots/stats.jpg"
                  alt={t.screenshots.alts.stats}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
              <p className="text-xs font-bold text-center text-muted-foreground">
                {t.screenshots.stats}
              </p>
            </div>
          </div>
        </section>

        {/* 4. Features Grid */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground text-center tracking-tight">
            {t.featuresTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-card/80 border border-border p-5 rounded-3xl space-y-2.5 shadow-sm hover:border-accent/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. How to get in strip */}
        <section className="bg-card/80 border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground">
              {t.accessTitle}
            </h2>
            <p className="text-xs text-muted-foreground">{t.smallPrint}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {t.accessSteps.map((step, idx) => (
              <div
                key={idx}
                className="bg-background/60 border border-border/80 rounded-2xl p-4 flex items-center gap-3"
              >
                <span className="w-7 h-7 rounded-xl bg-accent/15 border border-accent/30 text-accent font-extrabold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs text-foreground font-medium">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-border bg-card/40 px-4 sm:px-8 py-8 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onPrivacyClick}
              className="inline-flex items-center gap-1.5 hover:text-accent transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.privacyLabel}</span>
            </button>
            <span>•</span>
            <a
              href="https://malionurlucan.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              malionurlucan.me
            </a>
            <span>•</span>
            <a
              href="https://github.com/malii0"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              GitHub
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              title="This product uses the TMDB API but is not endorsed or certified by TMDB."
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-border hover:border-border/80 transition-all opacity-80 hover:opacity-100"
            >
              <div className="h-3.5 w-auto relative">
                <Image
                  src="/tmdb-logo.svg"
                  alt="TMDB Logo"
                  width={60}
                  height={14}
                  unoptimized
                  className="h-3.5 w-auto object-contain"
                />
              </div>
              <span className="text-[10px] max-w-xs text-left">
                This product uses the TMDB API but is not endorsed or certified
                by TMDB.
              </span>
            </a>

            <span className="text-[11px]">
              © {currentYear} Backstory. {t.rightsReserved}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
