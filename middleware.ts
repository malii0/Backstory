import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Yetkisiz erişim. Oturum açmanız gerekmektedir." },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırma hatası." },
      { status: 500 }
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
        { status: 401 }
      );
    }

    const userData = await res.json();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", userData.id);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Auth servisine ulaşılamadı." },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: ["/api/ai-recommend/:path*"],
};