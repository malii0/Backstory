import { NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { watchlist = [], favorites = [], loggedKeys = [] } = await req.json();

    // Pass 1: Zod Şeması ile Garantili Keyword Çıkarımı
    const pass1Result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        keywords: z.array(z.string()).describe('3 to 4 concise TMDB search keywords representing user taste'),
      }),
      prompt: `Given the user's top saved items:
Favorites: ${JSON.stringify(favorites)}
Watchlist: ${JSON.stringify(watchlist)}
Extract 3 to 4 concise TMDB search keywords (genres, themes, or tropes) representing their core taste.`,
    });

    const keywords = pass1Result.object.keywords.length > 0
      ? pass1Result.object.keywords
      : ["sci-fi", "thriller", "drama"];

    const tmdbApiKey = process.env.TMDB_API_KEY;
    const loggedSet = new Set<string>(loggedKeys);

    // Keyword ID'lerini tek seferde paralel çekme
    const keywordIdPromises = keywords.map(async (kw) => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/keyword?api_key=${tmdbApiKey}&query=${encodeURIComponent(kw)}`);
        const data = await res.json();
        return data.results?.[0]?.id || null;
      } catch {
        return null;
      }
    });

    const resolvedKwIds = (await Promise.all(keywordIdPromises)).filter(Boolean);

    // Film ve Dizi Discover isteklerini paralel çalıştırma
    const discoverPromises = resolvedKwIds.flatMap((kwId) => {
      const fetchMovie = async () => {
        try {
          const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${tmdbApiKey}&with_keywords=${kwId}&sort_by=vote_average.desc&vote_count.gte=100`);
          const data = await res.json();
          return (data.results || []).map((item: any) => ({ ...item, media_type: 'movie' }));
        } catch {
          return [];
        }
      };

      const fetchTV = async () => {
        try {
          const res = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${tmdbApiKey}&with_keywords=${kwId}&sort_by=vote_average.desc&vote_count.gte=50`);
          const data = await res.json();
          return (data.results || []).map((item: any) => ({ ...item, media_type: 'tv' }));
        } catch {
          return [];
        }
      };

      return [fetchMovie(), fetchTV()];
    });

    const rawResults = await Promise.all(discoverPromises);

    // Type-scoped key kullanarak filtreleme ("movie_550" / "tv_550")
    const candidatesMap = new Map<string, any>();
    for (const list of rawResults) {
      for (const item of list) {
        const uniqueKey = `${item.media_type}_${item.id}`;
        if (!loggedSet.has(uniqueKey) && !candidatesMap.has(uniqueKey)) {
          candidatesMap.set(uniqueKey, item);
        }
      }
    }

    const candidateList = Array.from(candidatesMap.values()).slice(0, 10);

    if (candidateList.length === 0) {
      return NextResponse.json({
        rationale: "Profilinize uygun izlenmemiş yeni içerik bulunamadı.",
        matchedKeywords: keywords,
        recommendedItems: [],
      });
    }

    // Pass 2: Zod Şeması ile Garantili Kart-Özel Gerekçe Üretimi
    const candidatesContext = candidateList.map((c) => ({
      key: `${c.media_type}_${c.id}`,
      title: c.title || c.name,
      media_type: c.media_type,
      overview: c.overview,
    }));

    const pass2Result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        reasons: z.array(
          z.object({
            key: z.string().describe('Unique identifier format "movie_ID" or "tv_ID"'),
            reason: z.string().describe('1 concise personalized sentence explaining why it matches user taste'),
          })
        ),
      }),
      prompt: `User's top favorites: ${JSON.stringify(favorites.map((f: any) => f.title || f.name))}.
Selected candidates: ${JSON.stringify(candidatesContext)}.

For EACH candidate, explain in EXACTLY 1 concise sentence why it matches the user's taste.`,
    });

    const reasonsMap = (pass2Result.object.reasons || []).reduce((acc, curr) => {
      acc[curr.key] = curr.reason;
      return acc;
    }, {} as Record<string, string>);

    const recommendedItems = candidateList.map((c) => {
      const uniqueKey = `${c.media_type}_${c.id}`;
      return {
        id: c.id,
        title: c.title || c.name,
        media_type: c.media_type as 'movie' | 'tv',
        poster_path: c.poster_path,
        vote_average: c.vote_average,
        overview: c.overview,
        reason: reasonsMap[uniqueKey] || "Profilinizdeki tercihlere göre özel önerildi.",
      };
    });

    return NextResponse.json({
      rationale: "Profilinizdeki izleme geçmişi analiz edilerek hazırlanan film ve dizi önerileri:",
      matchedKeywords: keywords,
      recommendedItems,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'AI Insight hatası oluştu' }, { status: 500 });
  }
}