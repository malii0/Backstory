import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyServerAuth } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const ALLOWED_PATTERNS: Array<{
  pattern: RegExp;
  allowedParams: ReadonlySet<string>;
}> = [
  {
    pattern: /^\/search\/multi$/,
    allowedParams: new Set(["query", "page"]),
  },
  {
    pattern: /^\/search\/(movie|tv)$/,
    allowedParams: new Set(["query", "page"]),
  },
  {
    pattern: /^\/discover\/movie$/,
    allowedParams: new Set([
      "page",
      "sort_by",
      "vote_count.gte",
      "with_genres",
      "vote_average.gte",
      "with_watch_providers",
      "watch_region",
      "primary_release_date.gte",
      "primary_release_date.lte",
    ]),
  },
  {
    pattern: /^\/discover\/tv$/,
    allowedParams: new Set([
      "page",
      "sort_by",
      "vote_count.gte",
      "with_genres",
      "vote_average.gte",
      "with_watch_providers",
      "watch_region",
      "first_air_date.gte",
      "first_air_date.lte",
    ]),
  },
  {
    pattern: /^\/(movie|tv)\/\d+$/,
    allowedParams: new Set(["append_to_response", "include_image_language"]),
  },
  {
    pattern: /^\/(movie|tv)\/\d+\/recommendations$/,
    allowedParams: new Set([]),
  },
  {
    pattern: /^\/trending\/all\/week$/,
    allowedParams: new Set(["page"]),
  },
  {
    pattern: /^\/collection\/\d+$/,
    allowedParams: new Set([]),
  },
  {
    pattern: /^\/movie\/(now_playing|upcoming)$/,
    allowedParams: new Set(["region", "page"]),
  },
  {
    pattern: /^\/person\/\d+\/combined_credits$/,
    allowedParams: new Set([]),
  },
  {
    pattern: /^\/watch\/providers\/(movie|tv)$/,
    allowedParams: new Set(["watch_region"]),
  },
  {
    pattern: /^\/(movie|tv)\/\d+\/watch\/providers$/,
    allowedParams: new Set([]),
  },
];

export async function GET(request: NextRequest) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error: TMDB API Key is missing." },
      { status: 500 },
    );
  }

  const userId = await verifyServerAuth(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Yetkisiz erişim. Oturum açmanız gerekmektedir." },
      { status: 401 },
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

  if (endpoint.length > 200) {
    return NextResponse.json(
      { error: "Invalid parameter value." },
      { status: 400 },
    );
  }

  const matchedRule = ALLOWED_PATTERNS.find((rule) =>
    rule.pattern.test(endpoint),
  );
  if (!matchedRule) {
    return NextResponse.json(
      { error: "Endpoint not allowed." },
      { status: 403 },
    );
  }

  if (!redis) {
    return NextResponse.json(
      { error: "Service Unavailable: Rate limiter not configured." },
      { status: 503 },
    );
  }

  try {
    const rateKey = `ratelimit:tmdb:${userId}`;
    const { allowed } = await checkRateLimit(rateKey, 300, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
  } catch (err) {
    console.error("TMDB RATE LIMIT REDIS ERROR:", err);
  }

  const allowedEntries: Array<[string, string]> = [];
  for (const key of matchedRule.allowedParams) {
    if (!searchParams.has(key)) continue;
    const value = searchParams.get(key) ?? "";
    if (value.length > 200) {
      return NextResponse.json(
        { error: "Invalid parameter value." },
        { status: 400 },
      );
    }
    if (key === "page") {
      if (!/^\d+$/.test(value)) {
        return NextResponse.json(
          { error: "Invalid page parameter." },
          { status: 400 },
        );
      }
      const pageNum = Number(value);
      if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 500) {
        return NextResponse.json(
          { error: "Invalid page parameter." },
          { status: 400 },
        );
      }
    }
    allowedEntries.push([key, value]);
  }

  allowedEntries.sort(([a], [b]) => a.localeCompare(b));

  const targetUrl = new URL(`${TMDB_BASE_URL}${endpoint}`);
  targetUrl.searchParams.set("api_key", TMDB_API_KEY);
  targetUrl.searchParams.set("language", "tr-TR");

  const canonicalEntries: Array<[string, string]> = [
    ["language", "tr-TR"],
    ...allowedEntries,
  ];
  canonicalEntries.sort(([a], [b]) => a.localeCompare(b));

  const cacheParams = new URLSearchParams();
  for (const [k, v] of canonicalEntries) {
    cacheParams.append(k, v);
  }
  for (const [k, v] of allowedEntries) {
    targetUrl.searchParams.set(k, v);
  }

  const cacheKey = `tmdb:${endpoint}?${cacheParams.toString()}`;

  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      const parsedData =
        typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
      return NextResponse.json(parsedData, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  } catch {}

  try {
    const res = await fetch(targetUrl.toString(), {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.status_message || "TMDB API error" },
        { status: res.status },
      );
    }

    const data = await res.json();

    try {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 86400 });
    } catch {}

    return NextResponse.json(data, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
