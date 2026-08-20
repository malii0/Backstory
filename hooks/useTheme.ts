"use client";

import { useState } from "react";

export type ThemeMode = "dark" | "light" | "system";

export interface AccentColor {
  id: string;
  name: string;
  value: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: "amber", name: "Kehribar", value: "#f59e0b" },
  { id: "emerald", name: "Zümrüt", value: "#10b981" },
  { id: "indigo", name: "Çivit", value: "#6366f1" },
  { id: "rose", name: "Gül", value: "#f43f5e" },
  { id: "cyan", name: "Açık Mavi", value: "#06b6d4" },
  { id: "purple", name: "Mor", value: "#a855f7" },
];

function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#09090b";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#09090b" : "#ffffff";
}

function generateComplementaryColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#10b981";

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const targetHue = (h * 360 + 140) % 360;

  const s = 0.8;
  const l = 0.5;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((targetHue / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0,
    gPrime = 0,
    bPrime = 0;

  if (0 <= targetHue && targetHue < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (60 <= targetHue && targetHue < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (120 <= targetHue && targetHue < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (180 <= targetHue && targetHue < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (240 <= targetHue && targetHue < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else if (300 <= targetHue && targetHue < 360) {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  const toHex = (val: number) => {
    const hexVal = Math.round((val + m) * 255).toString(16);
    return hexVal.length === 1 ? "0" + hexVal : hexVal;
  };

  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

function applyTheme(newMode: ThemeMode, newAccentHex: string) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  if (newMode === "system") {
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    root.setAttribute("data-theme", systemDark ? "dark" : "light");
    root.classList.toggle("dark", systemDark);
  } else {
    root.setAttribute("data-theme", newMode);
    root.classList.toggle("dark", newMode === "dark");
  }

  const completedColor = generateComplementaryColor(newAccentHex);

  root.style.setProperty("--app-accent", newAccentHex);
  root.style.setProperty(
    "--app-accent-foreground",
    getContrastColor(newAccentHex),
  );
  root.style.setProperty("--app-completed", completedColor);
  root.style.setProperty(
    "--app-completed-foreground",
    getContrastColor(completedColor),
  );
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("backstory-theme-mode") as ThemeMode) || "dark";
}

function getInitialAccent(): string {
  if (typeof window === "undefined") return "#f59e0b";
  return localStorage.getItem("backstory-accent-color") || "#f59e0b";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode());
  const [accent, setAccent] = useState<string>(() => getInitialAccent());

  const updateMode = (newMode: ThemeMode) => {
    setMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("backstory-theme-mode", newMode);
    }
    applyTheme(newMode, accent);
  };

  const updateAccent = (newAccentHex: string) => {
    setAccent(newAccentHex);
    if (typeof window !== "undefined") {
      localStorage.setItem("backstory-accent-color", newAccentHex);
    }
    applyTheme(mode, newAccentHex);
  };

  return { mode, accent, updateMode, updateAccent, ACCENT_COLORS };
}
