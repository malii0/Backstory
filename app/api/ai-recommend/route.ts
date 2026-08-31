import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
  [key: string]: unknown;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const mediaItemInputSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  title: z.string().max(300).optional(),
  name: z.string().max(300).optional(),
  media_type: z.enum(["movie", "tv"]).optional(),
});

const requestSchema = z.object({
  watchlist: z.array(mediaItemInputSchema).max(30).default([]),
  favorites: z.array(mediaItemInputSchema).max(30).default([]),
  loggedKeys: z.array(z.string().max(60)).max(5000).default([]),
});

export async function POST(req: Request) {
  try {
    // Middleware'den gelen user_id okunur
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "Oturum verisi alınamadı." },
        { status: 401 },
      );
    }

    if (redis) {
      try {
        const rateKey = `ratelimit:ai:${userId}`;
        const currentRequests = await redis.incr(rateKey);
        if (currentRequests === 1) {
          await redis.expire(rateKey, 60);
        }
        if (currentRequests > 5) {
          return NextResponse.json(
            {
              error:
                "Çok fazla istek gönderdiniz. Lütfen 1 dakika sonra tekrar deneyin.",
            },
            { status: 429 },
          );
        }
      } catch (err) {
        console.warn("Redis AI rate limit hatası:", err);
      }
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz istek parametreleri veya sınır aşımı." },
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

    const pass1Result = await generateObject({
      model: google("gemini-2.5-flash"),
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

    const keywords = pass1Result.object.keywords || [
      "sci-fi",
      "thriller",
      "drama",
    ];
    const rawSuggestions = pass1Result.object.suggestions || [];
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
        return { ...firstResult, media_type: searchType };
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
            candidatesMap.set(uniqueKey, { ...fbItem, media_type: mediaType });
            candidateList.push({ ...fbItem, media_type: mediaType });
          }
        }
      } catch (e) {
        console.error("Fallback fetch error:", e);
      }
    }

    candidateList = candidateList.slice(0, 10);

    if (candidateList.length === 0) {
      return NextResponse.json({
        rationale: "Profilinize uygun izlenmemiş yeni içerik bulunamadı.",
        matchedKeywords: keywords,
        recommendedItems: [],
      });
    }

    const candidatesContext = candidateList.map((c) => ({
      key: `${c.media_type}_${c.id}`,
      title: c.title || c.name,
      media_type: c.media_type,
      overview: c.overview,
    }));

    const pass2Result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        reasons: z.array(
          z.object({
            key: z
              .string()
              .describe('Unique identifier format "movie_ID" or "tv_ID"'),
            reason: z
              .string()
              .describe(
                "1 concise personalized sentence in Turkish explaining why it matches user taste",
              ),
          }),
        ),
      }),
      prompt: `User's top favorites: ${JSON.stringify(favorites.map((f: ItemRef) => f.title || f.name))}.
Selected candidates: ${JSON.stringify(candidatesContext)}.

For EACH candidate, explain in EXACTLY 1 concise sentence in TURKISH why it matches the user's taste.`,
    });

    const reasonsMap = (pass2Result.object.reasons || []).reduce(
      (acc, curr) => {
        acc[curr.key] = curr.reason;
        return acc;
      },
      {} as Record<string, string>,
    );

    const recommendedItems = candidateList.map((c) => {
      const uniqueKey = `${c.media_type}_${c.id}`;
      return {
        id: c.id,
        title: c.title || c.name,
        media_type: c.media_type as "movie" | "tv",
        poster_path: c.poster_path,
        release_date: c.release_date,
        first_air_date: c.first_air_date,
        vote_average: c.vote_average,
        overview: c.overview,
        reason:
          reasonsMap[uniqueKey] ||
          "Profilinizdeki tercihlere göre özel önerildi.",
      };
    });

    return NextResponse.json({
      rationale:
        "Profilinizdeki izleme geçmişi analiz edilerek hazırlanan film ve dizi önerileri:",
      matchedKeywords: keywords,
      recommendedItems,
    });
  } catch (error: unknown) {
    console.error("AI RECOMMEND API ERROR DETAILS:", error);
    return NextResponse.json(
      {
        error:
          "Sistemde beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
