import { useState, useCallback, useEffect, useRef } from "react";
import { AIInsightResponse, MediaItem } from "@/lib/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

function clearAICache() {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("ai_insights_cache_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

export function useAIRecommendations(userId?: string) {
  const [data, setData] = useState<AIInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevUserId, setPrevUserId] = useState(userId);

  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setData(null);
    setError(null);
  }

  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      clearAICache();
    }
  }, [userId]);

  const cacheKey = userId ? `ai_insights_cache_${userId}` : null;

  const fetchInsights = useCallback(
    async (
      watchlist: MediaItem[],
      favorites: MediaItem[],
      loggedKeys: string[],
      forceRefresh = false,
    ) => {
      if (!forceRefresh && cacheKey) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            setData(JSON.parse(cached));
            return;
          } catch {}
        }
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetchWithAuth("/api/ai-recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watchlist, favorites, loggedKeys }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "AI Önerileri alınamadı.");
        }

        const result: AIInsightResponse = await res.json();

        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(result));
        }
        setData(result);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "AI Önerileri alınamadı.";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey],
  );

  return { data, loading, error, fetchInsights };
}
