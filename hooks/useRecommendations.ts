import { useState, useCallback, useRef } from 'react';
import { MediaItem, LogMetadata } from '@/lib/types';

interface ScoredItem {
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

  // Çekilen geniş havuzu (50-60 öğe) ve gösterilen indeksleri saklayan önbellek
  const fullPoolRef = useRef<MediaItem[]>([]);
  const shownKeysRef = useRef<Set<string>>(new Set());

  // Akıllı Yenileme (Smart Refresh): Havuzdan yeni 20'lik sunar, tükenirse yeniden fetch eder
  const getNextBatchFromPool = useCallback(() => {
    const pool = fullPoolRef.current;
    if (pool.length === 0) return [];

    // Henüz gösterilmemiş olanları filtrele
    let unshown = pool.filter((item) => {
      const key = `${item.media_type || 'movie'}_${item.id}`;
      return !shownKeysRef.current.has(key);
    });

    // Eğer gösterilmeyenler tükendiyse geçmişi sıfırla ve yeniden karıştır
    if (unshown.length < 5) {
      shownKeysRef.current.clear();
      unshown = [...pool];
    }

    // Karıştır (Shuffle)
    for (let i = unshown.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unshown[i], unshown[j]] = [unshown[j], unshown[i]];
    }

    const nextBatch = unshown.slice(0, 20);
    nextBatch.forEach((item) => {
      const key = `${item.media_type || 'movie'}_${item.id}`;
      shownKeysRef.current.add(key);
    });

    return nextBatch;
  }, []);

  const fetchRecommendations = useCallback(
    async (forceNewFetch = false) => {
      // Ağ isteği atmadan hafızadaki havuzdan getir
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
            }));

          fullPoolRef.current = filtered;
          shownKeysRef.current.clear();
          setRecommendations(getNextBatchFromPool());
          setHasFetched(true);
          setIsLoading(false);
          return;
        }

        // ÖRTÜLÜ (IMPLICIT) SKORLAMA
        const scoredItems: ScoredItem[] = completedLogs.map((log) => {
          const item = log.itemData!;
          const type = (item.media_type || 'movie') as 'movie' | 'tv';

          let baseWeight = 1.0;

          // Puan Etkisi: (Rating - 5) * 0.2
          if (log.rating && log.rating > 0) {
            baseWeight += (log.rating - 5) * 0.2;
          }

          // Tekrar İzleme Bonusu: (WatchCount - 1) * 0.5 (Max +1.5)
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

        // PARALEL TMDB İSTEKLERİ
        const fetchPromises: Promise<{ results: MediaItem[]; source: 'similar' | 'genre' | 'wildcard' }>[] = [];

        // Kol A: En yüksek ağırlıklı 3 içeriğin benzerleri
        topItems.forEach((item) => {
          fetchPromises.push(
            fetch(`/api/tmdb?endpoint=/${item.type}/${item.id}/recommendations`)
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((d) => ({ results: d.results || [], source: 'similar' as const }))
              .catch(() => ({ results: [], source: 'similar' as const }))
          );
        });

        // Kol B: En çok tercih edilen türlerin discover verisi
        fetchPromises.push(
          fetch(
            `/api/tmdb?endpoint=/discover/movie&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200`
          )
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({ results: d.results || [], source: 'genre' as const }))
            .catch(() => ({ results: [], source: 'genre' as const }))
        );

        fetchPromises.push(
          fetch(
            `/api/tmdb?endpoint=/discover/tv&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200`
          )
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({ results: d.results || [], source: 'genre' as const }))
            .catch(() => ({ results: [], source: 'genre' as const }))
        );

        // WILDCARD (%15 Çeşitlilik)
        fetchPromises.push(
          fetch(`/api/tmdb?endpoint=/trending/all/week`)
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({ results: d.results || [], source: 'wildcard' as const }))
            .catch(() => ({ results: [], source: 'wildcard' as const }))
        );

        const responses = await Promise.all(fetchPromises);

        // HARMANLAMA VE TEKİLLEŞTİRME
        const uniqueMap = new Map<string, MediaItem>();

        responses.forEach(({ results, source }) => {
          results.forEach((item) => {
            if (!item || !item.id) return;
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            const key = `${type}_${item.id}`;

            if (!loggedIds.has(key) && !uniqueMap.has(key)) {
              uniqueMap.set(key, {
                ...item,
                media_type: type,
                recommendationSource: source,
              });
            }
          });
        });

        const pool = Array.from(uniqueMap.values());
        fullPoolRef.current = pool;
        shownKeysRef.current.clear();

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
    refreshRecommendations: () => fetchRecommendations(false), // Akıllı yenileme
  };
}