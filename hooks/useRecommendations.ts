import { useState, useCallback, useRef } from "react";
import { MediaItem, LogMetadata } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface ScoredLogItem {
  id: number;
  type: "movie" | "tv";
  weight: number;
  genres: number[];
}

export function useRecommendations(logs: Record<string, LogMetadata>) {
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fullPoolRef = useRef<MediaItem[]>([]);
  const poolIndexRef = useRef<number>(0);
  const currentPageRef = useRef<number>(2);
  const loggedIdsRef = useRef<Set<string>>(new Set());
  const topGenresStrRef = useRef<string>("");
  const isColdStartRef = useRef<boolean>(false);

  const fetchRecommendations = useCallback(
    async (
      _overrideLogs?: Record<string, LogMetadata>,
      forceRefresh = false,
    ) => {
      // Önbellek kontrolü eklendi: Zorla yenileme istenmediyse ve havuz doluysa API'ye gitme
      if (!forceRefresh && fullPoolRef.current.length > 0) {
        return;
      }

      setIsLoading(true);
      setError(null);
      poolIndexRef.current = 0;

      try {
        const activeLogs = _overrideLogs || logs;
        const loggedIds = new Set<string>();
        const completedLogs: LogMetadata[] = [];

        Object.entries(activeLogs).forEach(([key, log]) => {
          if (log.itemData?.id) {
            const type = log.itemData.media_type || "movie";
            loggedIds.add(`${type}_${log.itemData.id}`);
          } else {
            loggedIds.add(key);
          }

          if (log.isCompleted) {
            completedLogs.push(log);
          }
        });

        loggedIdsRef.current = loggedIds;

        if (completedLogs.length < 3) {
          isColdStartRef.current = true;
          currentPageRef.current = 1;

          const res = await fetchWithAuth(
            "/api/tmdb?endpoint=/trending/all/week&page=1",
          );
          if (!res.ok) throw new Error("Trend verileri alınamadı.");
          const data = await res.json();

          const filtered = (data.results || [])
            .filter((item: MediaItem) => {
              const type = item.media_type || "movie";
              return !loggedIds.has(`${type}_${item.id}`);
            })
            .map((item: MediaItem) => ({
              ...item,
              media_type: item.media_type || "movie",
              recommendationSource: "wildcard" as const,
              matchScore: (item.vote_average || 5) + 40,
            }))
            .sort(
              (a: MediaItem, b: MediaItem) =>
                (b.matchScore || 0) - (a.matchScore || 0),
            );

          fullPoolRef.current = filtered;
          setRecommendations(filtered.slice(0, 20));
          poolIndexRef.current = 20;
          setHasMore(filtered.length > 20);
          setHasFetched(true);
          setIsLoading(false);
          return;
        }

        isColdStartRef.current = false;
        currentPageRef.current = 2;

        const scoredItems: ScoredLogItem[] = completedLogs.map((log) => {
          const item = log.itemData!;
          const type = (item.media_type || "movie") as "movie" | "tv";

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
        const targetLogs = scoredItems.slice(0, 2);

        const genreWeights: Record<number, number> = {};
        scoredItems.forEach((si) => {
          si.genres.forEach((gId) => {
            genreWeights[gId] = (genreWeights[gId] || 0) + si.weight;
          });
        });

        const sortedGenres = Object.entries(genreWeights)
          .sort(([, a], [, b]) => b - a)
          .map(([gId]) => parseInt(gId, 10));

        const topGenresStr = sortedGenres.slice(0, 2).join(",");
        topGenresStrRef.current = topGenresStr;

        const fetchPromises: Promise<{
          results: MediaItem[];
          source: "similar" | "genre" | "wildcard";
          sourceWeight: number;
        }>[] = [];

        targetLogs.forEach((item) => {
          fetchPromises.push(
            fetchWithAuth(
              `/api/tmdb?endpoint=/${item.type}/${item.id}/recommendations`,
            )
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((d) => ({
                results: d.results || [],
                source: "similar" as const,
                sourceWeight: 100 + Math.min(item.weight * 10, 30),
              }))
              .catch(() => ({
                results: [],
                source: "similar" as const,
                sourceWeight: 100,
              })),
          );
        });

        const rawGenreWeight =
          sortedGenres.length > 0 ? genreWeights[sortedGenres[0]] || 1 : 1;
        const normalizedGenreBonus = Math.min(rawGenreWeight * 3, 30);

        [1, 2].forEach((page) => {
          fetchPromises.push(
            fetchWithAuth(
              `/api/tmdb?endpoint=/discover/movie&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200&page=${page}`,
            )
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((d) => ({
                results: d.results || [],
                source: "genre" as const,
                sourceWeight: 70 + normalizedGenreBonus,
              }))
              .catch(() => ({
                results: [],
                source: "genre" as const,
                sourceWeight: 70,
              })),
          );

          fetchPromises.push(
            fetchWithAuth(
              `/api/tmdb?endpoint=/discover/tv&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200&page=${page}`,
            )
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .then((d) => ({
                results: d.results || [],
                source: "genre" as const,
                sourceWeight: 70 + normalizedGenreBonus,
              }))
              .catch(() => ({
                results: [],
                source: "genre" as const,
                sourceWeight: 70,
              })),
          );
        });

        fetchPromises.push(
          fetchWithAuth(`/api/tmdb?endpoint=/trending/all/week`)
            .then((r) => (r.ok ? r.json() : { results: [] }))
            .then((d) => ({
              results: d.results || [],
              source: "wildcard" as const,
              sourceWeight: 40,
            }))
            .catch(() => ({
              results: [],
              source: "wildcard" as const,
              sourceWeight: 40,
            })),
        );

        const responses = await Promise.all(fetchPromises);
        const uniqueMap = new Map<string, MediaItem>();

        const SOURCE_PRIORITY: Record<
          "similar" | "genre" | "wildcard",
          number
        > = {
          similar: 3,
          genre: 2,
          wildcard: 1,
        };

        responses.forEach(({ results, source, sourceWeight }) => {
          results.forEach((item) => {
            if (!item || !item.id) return;
            const type = item.media_type || (item.title ? "movie" : "tv");
            const key = `${type}_${item.id}`;

            if (loggedIds.has(key)) return;

            const calculatedScore = sourceWeight + (item.vote_average || 0) * 2;

            if (uniqueMap.has(key)) {
              const existing = uniqueMap.get(key)!;
              const newScore =
                Math.max(existing.matchScore || 0, calculatedScore) + 15;
              const existingPriority =
                SOURCE_PRIORITY[existing.recommendationSource || "wildcard"];
              const incomingPriority = SOURCE_PRIORITY[source];
              const winningSource =
                incomingPriority > existingPriority
                  ? source
                  : existing.recommendationSource;

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
          });
        });

        const pool = Array.from(uniqueMap.values()).sort(
          (a, b) => (b.matchScore || 0) - (a.matchScore || 0),
        );

        fullPoolRef.current = pool;
        setRecommendations(pool.slice(0, 20));
        poolIndexRef.current = 20;
        setHasMore(pool.length > 20);
        setHasFetched(true);
      } catch (err: unknown) {
        console.error("Öneriler yüklenirken hata oluştu:", err);
        setError("Sana özel öneriler yüklenirken bir sorun oluştu.");
      } finally {
        setIsLoading(false);
      }
    },
    [logs],
  );

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;

    const currentPool = fullPoolRef.current;
    const currentIndex = poolIndexRef.current;

    if (currentIndex + 20 <= currentPool.length) {
      const nextBatch = currentPool.slice(0, currentIndex + 20);
      setRecommendations(nextBatch);
      poolIndexRef.current = currentIndex + 20;
      setHasMore(poolIndexRef.current < currentPool.length);
      return;
    }

    setIsFetchingMore(true);
    const nextPage = currentPageRef.current + 1;

    try {
      const loggedIds = loggedIdsRef.current;
      const existingKeys = new Set(
        fullPoolRef.current.map((i) => `${i.media_type}_${i.id}`),
      );
      const freshItems: MediaItem[] = [];

      if (isColdStartRef.current) {
        const res = await fetchWithAuth(
          `/api/tmdb?endpoint=/trending/all/week&page=${nextPage}`,
        );
        if (res.ok) {
          const data = await res.json();
          (data.results || []).forEach((item: MediaItem) => {
            const type = item.media_type || "movie";
            const key = `${type}_${item.id}`;
            if (!loggedIds.has(key) && !existingKeys.has(key)) {
              freshItems.push({
                ...item,
                media_type: type,
                recommendationSource: "wildcard",
                matchScore: (item.vote_average || 5) + 40,
              });
            }
          });
        }
      } else {
        const topGenresStr = topGenresStrRef.current;

        const [movieRes, tvRes] = await Promise.all([
          fetchWithAuth(
            `/api/tmdb?endpoint=/discover/movie&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200&page=${nextPage}`,
          ).then((r) => (r.ok ? r.json() : { results: [] })),
          fetchWithAuth(
            `/api/tmdb?endpoint=/discover/tv&with_genres=${topGenresStr}&sort_by=vote_average.desc&vote_count.gte=200&page=${nextPage}`,
          ).then((r) => (r.ok ? r.json() : { results: [] })),
        ]);

        const newResults: MediaItem[] = [
          ...(movieRes.results || []).map((m: MediaItem) => ({
            ...m,
            media_type: "movie" as const,
          })),
          ...(tvRes.results || []).map((t: MediaItem) => ({
            ...t,
            media_type: "tv" as const,
          })),
        ];

        newResults.forEach((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (!loggedIds.has(key) && !existingKeys.has(key)) {
            freshItems.push({
              ...item,
              recommendationSource: "genre",
              matchScore: 70 + (item.vote_average || 0) * 2,
            });
          }
        });
      }

      if (freshItems.length > 0) {
        currentPageRef.current = nextPage;
        const updatedPool = [...fullPoolRef.current, ...freshItems];
        fullPoolRef.current = updatedPool;

        const nextBatch = updatedPool.slice(0, currentIndex + 20);
        setRecommendations(nextBatch);
        poolIndexRef.current = currentIndex + 20;
        setHasMore(poolIndexRef.current < updatedPool.length);
      } else {
        if (currentIndex < currentPool.length) {
          setRecommendations(currentPool);
          poolIndexRef.current = currentPool.length;
        }
        setHasMore(false);
      }
    } catch (err) {
      console.error("Ek öneriler çekilirken hata oluştu:", err);
      setHasMore(false);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore]);

  return {
    recommendations,
    isLoading,
    isFetchingMore,
    error,
    hasFetched,
    hasMore,
    fetchRecommendations,
    refreshRecommendations: fetchRecommendations,
    loadMore,
  };
}
