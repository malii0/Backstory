import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const ALLOWED_PATTERNS = [
  /^\/search\/multi$/,
  /^\/search\/(movie|tv)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/recommendations$/,
  /^\/trending\/all\/week$/,
  /^\/collection\/\d+$/,
  /^\/movie\/(now_playing|upcoming)$/,
  /^\/person\/\d+\/combined_credits$/,
  /^\/watch\/providers\/(movie|tv)$/,
];

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: TMDB API Key is missing." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json(
      { error: "Endpoint parameter is required." },
      { status: 400 },
    );
  }

  const isAllowed = ALLOWED_PATTERNS.some((pattern) => pattern.test(endpoint));
  if (!isAllowed) {
    return NextResponse.json(
      { error: "Endpoint not allowed." },
      { status: 403 },
    );
  }

  try {
    const targetUrl = new URL(`${TMDB_BASE_URL}${endpoint}`);
    targetUrl.searchParams.append("api_key", TMDB_API_KEY);
    targetUrl.searchParams.append("language", "tr-TR");

    searchParams.forEach((value, key) => {
      if (key !== "endpoint" && key !== "api_key") {
        targetUrl.searchParams.append(key, value);
      }
    });

    const res = await fetch(targetUrl.toString(), {
      next: { revalidate: 3600 },
    } as RequestInit & { next?: { revalidate?: number } });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.status_message || "TMDB API error" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
