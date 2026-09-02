import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' https://image.tmdb.org data: blob:;
    font-src 'self' data:;
    frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.themoviedb.org https://va.vercel-scripts.com https://vitals.vercel-insights.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  if (request.nextUrl.pathname.startsWith("/api/ai-recommend")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Yetkisiz erişim. Oturum açmanız gerekmektedir." },
        { status: 401 },
      );
    }

    const token = authHeader.split(" ")[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Sunucu yapılandırma hatası." },
        { status: 500 },
      );
    }

    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: "Geçersiz veya süresi dolmuş oturum." },
          { status: 401 },
        );
      }

      const userData = await res.json();
      requestHeaders.set("x-user-id", userData.id);
    } catch {
      return NextResponse.json(
        { error: "Auth servisine ulaşılamadı." },
        { status: 500 },
      );
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
