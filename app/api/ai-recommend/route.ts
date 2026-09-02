import { NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { redis } from "@/lib/redis";

interface ItemRef {
  title?: string;
  name?: string;
  [key: string]: unknown;
}

interface CandidateItem {
  id: number | string;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  reason?: string;
  [key: string]: unknown;
}

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const mediaItemInputSchema = z
  .object({
    title: z.string().max(300).optional(),
    name: z.string().max(300).optional(),
    media_type: z.enum(["movie", "tv"]).optional(),
    id: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const requestSchema = z.object({
  watchlist: z.array(mediaItemInputSchema).max(30).default([]),
  favorites: z.array(mediaItemInputSchema).max(30).default([]),
  loggedKeys: z.array(z.string().max(60)).max(5000).default([]),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!redis) {
      return NextResponse.json(
        {
          error:
            "Öneri servisi şu anda geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.",
        },
        { status: 503 },
      );
    }

    const rateKey = `ratelimit:ai:${ip}`;

    try {
      const currentRequests = await redis.incr(rateKey);
      if (currentRequests === 1) {
        await redis.expire(rateKey, 86400);
      }
      if (currentRequests > 50) {
        return NextResponse.json(
          { error: "Too Many Requests" },
          { status: 429 },
        );
      }
    } catch (redisError) {
      console.error("AI RATE LIMIT REDIS ERROR:", redisError);
      return NextResponse.json(
        {
          error:
            "Öneri servisi şu anda geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.",
        },
        { status: 503 },
      );
    }

    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Yetkisiz erişim. Geçersiz oturum." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz istek veya limit aşıldı." },
        { status: 400 },
      );
    }

    const { watchlist, favorites, loggedKeys } = parsed.data;

    if (watchlist.length === 0 && favorites.length === 0) {
      return NextResponse.json({
        rationale:
          "Öneri oluşturabilmek için profilinize en az bir film/dizi ekleyin veya puanlayın.",
        matchedKeywords: [],
        recommendedItems: [],
      });
    }

    const result = await generateObject({
      model: groq("openai/gpt-oss-120b"),
      schema: z.object({
        keywords: z
          .array(z.string())
          .describe("3 to 4 concise theme keywords representing user taste"),
        suggestions: z
          .array(
            z.object({
              title: z
                .string()
                .describe(
                  "Exact official title of the recommended movie or tv show",
                ),
              media_type: z.enum(["movie", "tv"]).describe("Type of media"),
              reason: z
                .string()
                .describe(
                  "1 concise personalized sentence in Turkish explaining exactly why it matches the user's taste",
                ),
            }),
          )
          .describe(
            "List of 15 highly relevant real movie or tv show titles available on TMDB",
          ),
      }),
      prompt: `Given the user's top saved items:
Favorites: ${JSON.stringify(favorites.map((f: ItemRef) => f.title || f.name))}
Watchlist: ${JSON.stringify(watchlist.map((w: ItemRef) => w.title || w.name))}

1. Extract 3 to 4 concise theme keywords representing their core taste.
2. Recommend 15 REAL, non-niche, highly acclaimed movies or TV shows that match this taste. Do NOT recommend fan-made videos, documentaries, or obscure vintage titles unless specifically requested.`,
    });

    const keywords = result.object.keywords || ["sci-fi", "thriller", "drama"];
    const rawSuggestions = result.object.suggestions || [];
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const loggedSet = new Set<string>(loggedKeys);

    const searchPromises = rawSuggestions.map(async (sug) => {
      try {
        const searchType = sug.media_type === "tv" ? "tv" : "movie";
        const res = await fetch(
          `https://api.themoviedb.org/3/search/${searchType}?api_key=${tmdbApiKey}&query=${encodeURIComponent(sug.title)}&language=tr-TR`,
        );
        const data = await res.json();
        const firstResult = data.results?.[0];
        if (!firstResult) return null;
        return { ...firstResult, media_type: searchType, reason: sug.reason };
      } catch {
        return null;
      }
    });

    const searchedItems = (await Promise.all(searchPromises)).filter(Boolean);
    const candidatesMap = new Map<string, CandidateItem>();

    for (const item of searchedItems) {
      const uniqueKey = `${item.media_type}_${item.id}`;
      if (!loggedSet.has(uniqueKey) && !candidatesMap.has(uniqueKey)) {
        candidatesMap.set(uniqueKey, item as CandidateItem);
      }
    }

    let candidateList = Array.from(candidatesMap.values());

    if (candidateList.length < 10) {
      try {
        const fallbackRes = await fetch(
          `https://api.themoviedb.org/3/trending/all/week?api_key=${tmdbApiKey}&language=tr-TR`,
        );
        const fallbackData = await fallbackRes.json();
        const fallbackResults = fallbackData.results || [];

        for (const fbItem of fallbackResults) {
          if (candidateList.length >= 10) break;
          const mediaType = fbItem.media_type === "tv" ? "tv" : "movie";
          const uniqueKey = `${mediaType}_${fbItem.id}`;

          if (!loggedSet.has(uniqueKey) && !candidatesMap.has(uniqueKey)) {
            const fallbackItem = {
              ...fbItem,
              media_type: mediaType,
              reason:
                "Profilinizdeki yapıma ek olarak bu hafta popüler olduğu için listeye eklendi.",
            };
            candidatesMap.set(uniqueKey, fallbackItem);
            candidateList.push(fallbackItem);
          }
        }
      } catch {}
    }

    candidateList = candidateList.slice(0, 10);

    if (candidateList.length === 0) {
      return NextResponse.json({
        rationale: "Profilinize uygun izlenmemiş yeni içerik bulunamadı.",
        matchedKeywords: keywords,
        recommendedItems: [],
      });
    }

    const recommendedItems = candidateList.map((c) => ({
      id: c.id,
      title: c.title || c.name,
      media_type: c.media_type as "movie" | "tv",
      poster_path: c.poster_path,
      release_date: c.release_date,
      first_air_date: c.first_air_date,
      vote_average: c.vote_average,
      overview: c.overview,
      reason: c.reason || "Profilinizdeki tercihlere göre özel önerildi.",
    }));

    return NextResponse.json({
      rationale:
        "Profilinizdeki izleme geçmişi analiz edilerek hazırlanan film ve dizi önerileri:",
      matchedKeywords: keywords,
      recommendedItems,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Sistemde beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
