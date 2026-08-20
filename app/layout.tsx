import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backstory - Sinema & Dizi Portfolyosu",
  description: "Kişisel film ve dizi takip uygulamanız.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icons/apple-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Backstory",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const themeInitScript = `
(function () {
  try {
    var mode = localStorage.getItem('backstory-theme-mode') || 'dark';
    var accent = localStorage.getItem('backstory-accent-color') || '#f59e0b';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.setProperty('--app-accent', accent);

    function getContrast(hex) {
      var clean = hex.replace('#', '');
      var r = parseInt(clean.slice(0, 2), 16) / 255;
      var g = parseInt(clean.slice(2, 4), 16) / 255;
      var b = parseInt(clean.slice(4, 6), 16) / 255;
      var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance > 0.55 ? '#09090b' : '#ffffff';
    }

    document.documentElement.style.setProperty('--app-accent-foreground', getContrast(accent));

    function genComp(hex) {
      var clean = hex.replace('#', '');
      if (clean.length !== 6) return '#10b981';
      var r = parseInt(clean.slice(0, 2), 16) / 255;
      var g = parseInt(clean.slice(2, 4), 16) / 255;
      var b = parseInt(clean.slice(4, 6), 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0;
      if (max !== min) {
        var d = max - min;
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      var targetHue = (h * 360 + 140) % 360;
      var s = 0.8, l = 0.5;
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((targetHue / 60) % 2) - 1));
      var m = l - c / 2;
      var rP = 0, gP = 0, bP = 0;
      if (0 <= targetHue && targetHue < 60) { rP = c; gP = x; bP = 0; }
      else if (60 <= targetHue && targetHue < 120) { rP = x; gP = c; bP = 0; }
      else if (120 <= targetHue && targetHue < 180) { rP = 0; gP = c; bP = x; }
      else if (180 <= targetHue && targetHue < 240) { rP = 0; gP = x; bP = c; }
      else if (240 <= targetHue && targetHue < 300) { rP = x; gP = 0; bP = c; }
      else if (300 <= targetHue && targetHue < 360) { rP = c; gP = 0; bP = x; }
      var toHex = function(v) {
        var hX = Math.round((v + m) * 255).toString(16);
        return hX.length === 1 ? '0' + hX : hX;
      };
      return '#' + toHex(rP) + toHex(gP) + toHex(bP);
    }

    var completedColor = genComp(accent);
    document.documentElement.style.setProperty('--app-completed', completedColor);
    document.documentElement.style.setProperty('--app-completed-foreground', getContrast(completedColor));
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans bg-background text-foreground antialiased selection:bg-muted selection:text-accent min-h-dvh relative`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
