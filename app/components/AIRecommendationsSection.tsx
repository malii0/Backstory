'use client';

import React from 'react';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { MediaItem, LogMetadata, AIInsightItem } from '@/lib/types';
import MediaCard from '@/app/components/MediaCard';
import { Sparkles, RefreshCw } from 'lucide-react';

interface Props {
  watchlist: MediaItem[];
  favorites: MediaItem[];
  logs: Record<string, LogMetadata>;
  userId?: string;
  onSelectItem?: (item: MediaItem) => void;
  onToggleCompleted?: (item: MediaItem) => void;
  onToggleWatchlist?: (item: MediaItem) => void;
}

export default function AIRecommendationsSection({
  watchlist,
  favorites,
  logs,
  userId,
  onSelectItem,
  onToggleCompleted,
  onToggleWatchlist,
}: Props) {
  const { data, loading, error, fetchInsights } = useAIRecommendations(userId);

  const loggedKeys = React.useMemo(() => {
    return Object.keys(logs);
  }, [logs]);

  const handleTrigger = (force = false) => {
    fetchInsights(watchlist, favorites, loggedKeys, force);
  };

  return (
    <section className="my-6 p-6 bg-card/80 border border-border/80 rounded-3xl space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-base font-bold text-foreground">AI Insight Önerileri</h3>
            <p className="text-xs text-muted-foreground">Profilinizdeki derin desenlere göre oluşturulan özel seçki.</p>
          </div>
        </div>

        {data ? (
          <button
            onClick={() => handleTrigger(true)}
            disabled={loading}
            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yeniden Analiz Et
          </button>
        ) : (
          <button
            onClick={() => handleTrigger(false)}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-muted text-white rounded-xl transition-all font-bold text-xs shadow-md"
          >
            {loading ? 'Analiz Ediliyor...' : 'Önerileri Getir'}
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {data && (
        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-background/60 border border-border/60 rounded-2xl flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{data.rationale}</p>
            <div className="flex gap-1.5 flex-wrap">
              {data.matchedKeywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] rounded-lg font-medium"
                >
                  #{kw}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {data.recommendedItems.map((item: AIInsightItem) => {
              const mediaItem: MediaItem = {
                id: item.id,
                title: item.title,
                media_type: item.media_type,
                poster_path: item.poster_path,
                release_date: item.release_date,
                first_air_date: item.first_air_date,
                vote_average: item.vote_average,
                overview: item.overview,
              };

              const key = `${item.media_type}_${item.id}`;
              const currentLog = logs[key];

              return (
                <div key={key} className="flex flex-col space-y-2">
                  <MediaCard
                    item={mediaItem}
                    log={currentLog}
                    onSelect={onSelectItem || (() => {})}
                    onToggleCompleted={onToggleCompleted || (() => {})}
                    onToggleWatchlist={onToggleWatchlist || (() => {})}
                  />
                  {item.reason && (
                    <p className="text-[11px] text-purple-300/90 italic bg-purple-950/20 border border-purple-800/30 p-2 rounded-xl leading-tight">
                      "{item.reason}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}