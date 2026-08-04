import { useState, useCallback, useRef } from 'react';
import { MediaItem, LogMetadata } from '@/lib/types';

interface ScoredLogItem {
  id: number;
  type: 'movie' | 'tv';
  weight: number;
  genres: number[];
}

export function useRecommendations(logs: Record<string, LogMetadata>) {
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fullPoolRef = useRef<MediaItem[]>([]);
  const poolIndexRef = useRef<number>(0);

  const getNextBatchFromPool = useCallback(() => {
    const pool = fullPoolRef.current;
    if (pool.length === 0) return [];

    let currentIndex = poolIndexRef.current;

    if (currentIndex >= pool.length) {
      currentIndex = 0;
    }

    const nextBatch = pool.slice(currentIndex, currentIndex + 20);
    poolIndexRef.current = currentIndex + 20;

    return nextBatch;
  }, []);

  const fetchRecommendations = useCallback(
    async (forceNewFetch = false) => {
      if (!forceNewFetch && fullPoolRef.current.length > 0) {
        const nextBatch = getNextBatchFromPool();
        setRecommendations(nextBatch);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loggedIds = new Set<string>();
        const completedLogs: LogMetadata[] = [];

        Object.values(logs).forEach((log) => {
          if (!log.itemData?.id) return;
          const type = log.itemData.media_type || 'movie';
          loggedIds.add(`${type}_${log.itemData.id}`);

          if (log.isCompleted) {
            completedLogs.push(log);
          }
        });

        // COLD START FALLBACK: 3'ten az izleme varsa Trendleri çek
        if (completedLogs.length < 3) {
          const res = await fetch('/api/tmdb?endpoint=/trending/all/week');
          if (!res.ok) throw new Error('Trend verileri alınamadı.');
          const data = await res.json();

          const filtered = (data.results || [])
            .filter((item: MediaItem) => !loggedIds.has(`${item.media_type || 'movie'}_${item.id}`))
            .map((item: MediaItem) => ({
              ...item,
              media_type: item.media_type || 'movie',
              recommendationSource: 'wildcard' as const,
              matchScore: (item.vote_average || 5) + 40,
            }))
            .sort((a: MediaItem, b: MediaItem) => (b.matchScore || 0) - (a.matchScore || 0));

          fullPoolRef.current = filtered;
          poolIndexRef.current = 0;
          setRecommendations(getNextBatchFromPool());
          setHasFetched(true);
          setIsLoading(false);
          return;
        }

        // 1. ÖRTÜLÜ SKORLAMA (Kullanıcı Tercihleri)
        const scoredItems: ScoredLogItem[] = completedLogs.map((log) => {
          const item = log.itemData!;
          const type = (item.media_type || 'movie') as 'movie' | 'tv';

          let baseWeight = 1.0;

          if (log.rating && log.rating > 0) {
            baseWeight += (log.rating - 5) * 0.2;
          }

          const watchCount = log.watchCount || (log.isCompleted ? 1 : 0);
          if (watchCount > 1) {
            baseWeight += Math.min((watchCount - 1) * 0.5, 1.5);
          }

          return {
            id: item.id,
            type,
            weight: Math.max(baseWeight, 0.2),
            genres: item.genre_ids || [],
          };
        });

        scoredItems.sort((a, b) => b.weight - a.weight);
        const topItems = scoredItems.slice(0, 3);

        const genreWeights: Record<number, number> = {};
        scoredItems.forEach((si) => {
          si.genres.forEach((gId) => {
            genreWeights[gId] = (genreWeights[gId] || 0) + si.weight;
          });
        });

        const sortedGenres = Object.entries(genreWeights)
          .sort(([, a], [, b]) => b - a)
          .map(([gId]) => parseInt(gId, 10));

        const topGenresStr = sortedGenres.slice(0, 2).join(',');

        // 2. PARALEL TMDB İSTEKLERİ
        const fetchPromises: Promise<{
          results: MediaItem[];
          source: 'similar' | 'genre' | 'wildcard';
          sourceWeight: number;
        }>[] = [];

        // Kol A: Benzer İçerikler (Taban: 100, Max Log Bonusu: +30)
        topItems.forEach((item) => {
          fetchPromises.push(
            fetch(`/api/tmdb?endpoint=/${item.type}/${item.id}/recommendations`)
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((d) => ({
                results: d.results || [],
                source: 'similar' as const,
                sourceWeight: 100 + Math.min(item.weight * 10, 30),
              }))
              .catch(() => ({ results: [], source: 'similar' as const, sourceWeight: 100 }))
          );
        });

        // Kol B: Tür Bazlı İçerikler (Taban: 70, Tavan Bonusu: Max +30)
        const rawGenreWeight = sortedGenres.length > 0 ? (genreWeights[sortedGenres[0]] || 1) : 1;
        const normalizedGenreBonus = Math.min(rawGenreWeight * 3, 30);

        fetchPromises.push(
          fetch(
            `/api/tmdb?endpoint=/discover/movie&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200`
          )
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({
              results: d.results || [],
              source: 'genre' as const,
              sourceWeight: 70 + normalizedGenreBonus,
            }))
            .catch(() => ({ results: [], source: 'genre' as const, sourceWeight: 70 }))
        );

        fetchPromises.push(
          fetch(
            `/api/tmdb?endpoint=/discover/tv&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200`
          )
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({
              results: d.results || [],
              source: 'genre' as const,
              sourceWeight: 70 + normalizedGenreBonus,
            }))
            .catch(() => ({ results: [], source: 'genre' as const, sourceWeight: 70 }))
        );

        // Wildcard (Taban: 40)
        fetchPromises.push(
          fetch(`/api/tmdb?endpoint=/trending/all/week`)
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({ results: d.results || [], source: 'wildcard' as const, sourceWeight: 40 }))
            .catch(() => ({ results: [], source: 'wildcard' as const, sourceWeight: 40 }))
        );

        const responses = await Promise.all(fetchPromises);

        // 3. AĞIRLIKLI SKORLAMA, ÇİFTE KAYNAK BONUSU VE ÖNCELİKLİ TEKİLLEŞTİRME
        const uniqueMap = new Map<string, MediaItem>();

        // Kaynak Rozeti Öncelik Haritası (Big Rank = Higher Priority)
        const SOURCE_PRIORITY: Record<'similar' | 'genre' | 'wildcard', number> = {
          similar: 3,
          genre: 2,
          wildcard: 1,
        };

        responses.forEach(({ results, source, sourceWeight }) => {
          results.forEach((item) => {
            if (!item || !item.id) return;
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            const key = `${type}_${item.id}`;

            if (!loggedIds.has(key)) {
              const calculatedScore = sourceWeight + (item.vote_average || 0) * 2;

              if (uniqueMap.has(key)) {
                const existing = uniqueMap.get(key)!;
                const newScore = Math.max(existing.matchScore || 0, calculatedScore) + 15;

                // Mevcut kaynağın önceliği ile gelen yeni kaynağın önceliğini kıyasla
                const existingPriority = SOURCE_PRIORITY[existing.recommendationSource || 'wildcard'];
                const incomingPriority = SOURCE_PRIORITY[source];

                const winningSource = incomingPriority > existingPriority ? source : existing.recommendationSource;

                uniqueMap.set(key, {
                  ...existing,
                  recommendationSource: winningSource,
                  matchScore: newScore,
                });
              } else {
                uniqueMap.set(key, {
                  ...item,
                  media_type: type,
                  recommendationSource: source,
                  matchScore: calculatedScore,
                });
              }
            }
          });
        });

        // 4. HAVUZU KESİN SIRALAMA
        const pool = Array.from(uniqueMap.values()).sort(
          (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
        );

        fullPoolRef.current = pool;
        poolIndexRef.current = 0;

        const initialBatch = getNextBatchFromPool();
        setRecommendations(initialBatch);
        setHasFetched(true);
      } catch (err: unknown) {
        console.error('Öneriler yüklenirken hata oluştu:', err);
        setError('Sana özel öneriler yüklenirken bir sorun oluştu.');
      } finally {
        setIsLoading(false);
      }
    },
    [logs, getNextBatchFromPool]
  );

  return {
    recommendations,
    isLoading,
    error,
    hasFetched,
    fetchRecommendations,
    refreshRecommendations: () => fetchRecommendations(false),
  };
}