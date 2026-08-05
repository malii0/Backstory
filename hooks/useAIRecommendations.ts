import { useState, useCallback } from 'react';
import { AIInsightResponse } from '@/lib/types';

export function useAIRecommendations(userId?: string) {
  const [data, setData] = useState<AIInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `ai_insights_cache_${userId || 'guest'}`;

  const fetchInsights = useCallback(
    async (watchlist: any[], favorites: any[], loggedKeys: string[], forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            setData(JSON.parse(cached));
            return;
          } catch {
            // Cache parse hatası durumu
          }
        }
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ai-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchlist, favorites, loggedKeys }),
        });

        if (!res.ok) throw new Error('AI Önerileri alınamadı.');
        const result: AIInsightResponse = await res.json();

        sessionStorage.setItem(cacheKey, JSON.stringify(result));
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey]
  );

  return { data, loading, error, fetchInsights };
}