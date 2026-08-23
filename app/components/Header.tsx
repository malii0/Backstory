"use client";

import React from "react";
import Image from "next/image";
import {
  LogOut,
  LogIn,
  User,
  Users,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { ActiveTab, UserProfile } from "@/lib/types";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onPrivacyClick: () => void;
  isHidden?: boolean;
}

export default function Header({
  activeTab,
  setActiveTab,
  isAuthenticated,
  onLoginClick,
  onLogoutClick,
  onPrivacyClick,
  isHidden = false,
}: HeaderProps) {
  return (
    <header
      className={`sticky top-0 z-40 bg-background/90 border-b border-border -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 px-4 sm:px-6 md:px-8 lg:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ease-in-out ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center p-1.5">
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

        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
            Backstory
          </h1>

          <div className="flex items-center gap-1.5">
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
            </a>

            <button
              onClick={onPrivacyClick}
              title="Gizlilik & KVKK Aydınlatması"
              className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-accent hover:border-border/80 transition-all flex items-center justify-center"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1 bg-card p-1.5 rounded-xl border border-border overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("explore")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "explore"
                ? "bg-muted text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Keşfet
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "completed"
                ? "bg-muted text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bitirdiklerim
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "watchlist"
                ? "bg-muted text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            İzlenecekler
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "feed"
                ? "bg-accent/10 border border-accent/30 text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Arkadaş Akışı
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "stats"
                ? "bg-accent/10 border border-accent/30 text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profil
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-accent/10 border border-accent/30 text-accent shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Ayarlar
          </button>
        </nav>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onLogoutClick}
              title="Çıkış Yap"
              className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-4 py-2 rounded-xl bg-accent text-accent-foreground transition-colors flex items-center gap-2 text-xs font-bold flex-shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>Giriş Yap</span>
          </button>
        )}
      </div>
    </header>
  );
}
