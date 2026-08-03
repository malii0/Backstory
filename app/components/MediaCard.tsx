'use client';

import React, { useCallback } from 'react';
import { Star, Eye, Bookmark, RotateCcw, CheckCircle2 } from 'lucide-react';
import { MediaItem, LogMetadata } from '@/lib/types';
import { getEffectiveWatchCount } from '@/lib/utils';

interface MediaCardProps {
  item: MediaItem;
  log?: LogMetadata;
  isNowPlaying?: boolean;
  onSelect: (item: MediaItem) => void;
  onToggleCompleted: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
}

function MediaCardComponent({
  item,
  log,
  isNowPlaying,
  onSelect,
  onToggleCompleted,
  onToggleWatchlist,
}: MediaCardProps) {
  const title = item.title || item.name || 'İsimsiz';
  const releaseYear = (item.release_date || item.first_air_date || '').split('-')[0];
  const watchCount = getEffectiveWatchCount(log);

  const isCompleted = !!log?.isCompleted;
  const isWatchlist = !!log?.isWatchlist;
  const userRating = log?.rating ?? 0;

  const handleSelect = useCallback(() => {
    onSelect(item);
  }, [onSelect, item]);

  const handleCompleted = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCompleted(item);
  }, [onToggleCompleted, item]);

  const handleWatchlist = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWatchlist(item);
  }, [onToggleWatchlist, item]);

  const getCardStyle = () => {
    if (isCompleted && isWatchlist) {
      return {
        borderColor: 'var(--app-completed)',
        boxShadow: '0 0 12px -2px var(--app-completed), 0 0 0 2px var(--app-accent)',
      };
    }
    if (isCompleted) {
      return {
        borderColor: 'var(--app-completed)',
        boxShadow: '0 4px 12px -2px var(--app-completed)',
      };
    }
    if (isWatchlist) {
      return {
        borderColor: 'var(--app-accent)',
        boxShadow: '0 4px 12px -2px var(--app-accent)',
      };
    }
    return {};
  };

  return (
    <div
      onClick={handleSelect}
      style={getCardStyle()}
      className={`group bg-card/60 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col h-full relative border ${
        !isCompleted && !isWatchlist ? 'border-border/80 hover:border-border' : ''
      }`}
    >
      <div className="relative aspect-[2/3] w-full bg-background overflow-hidden flex-shrink-0">
        {item.poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold text-xs p-2 text-center">
            Görsel Yok
          </div>
        )}

        {userRating > 0 && (
          <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-md border border-accent/50 text-accent text-[11px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg">
            <Star className="w-3 h-3 fill-accent text-accent" />
            <span>{userRating}</span>
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={handleCompleted}
            style={
              isCompleted
                ? {
                    backgroundColor: 'var(--app-completed)',
                    borderColor: 'var(--app-completed)',
                    color: 'var(--app-completed-foreground)',
                  }
                : undefined
            }
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              isCompleted
                ? 'font-bold shadow-md'
                : 'bg-background/80 border-border text-muted-foreground hover:text-foreground shadow-md'
            }`}
            title="İzlendi İşaretle"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleWatchlist}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              isWatchlist
                ? 'bg-accent border-accent text-accent-foreground font-bold shadow-md'
                : 'bg-background/80 border-border text-muted-foreground hover:text-foreground shadow-md'
            }`}
            title="İzleme Listesine Ekle"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
          {isCompleted && (
            <div
              style={{
                backgroundColor: 'var(--app-completed)',
                color: 'var(--app-completed-foreground)',
              }}
              className="p-1.5 rounded-xl shadow-lg flex items-center justify-center"
              title="İzlendi"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
          )}

          {isWatchlist && (
            <div
              className="bg-accent text-accent-foreground p-1.5 rounded-xl shadow-lg flex items-center justify-center"
              title="İzleme Listesinde"
            >
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
          )}

          {watchCount > 1 && (
            <div className="bg-background/80 backdrop-blur-md border border-accent/40 text-accent text-[10px] font-black px-1.5 py-1 rounded-xl flex items-center gap-0.5 shadow-lg">
              <RotateCcw className="w-3 h-3" />
              <span>{watchCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1 justify-between gap-1.5">
        <h3 
          title={title}
          className="text-xs font-bold text-foreground line-clamp-2 leading-tight min-h-[2.25rem] flex items-center group-hover:text-accent transition-colors"
        >
          {title}
        </h3>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-1">
          <div className="flex items-center gap-1.5">
            <span>{releaseYear || 'N/A'}</span>
            {isNowPlaying && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Vizyonda
              </span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-muted-foreground font-medium">
            <Star className="w-3 h-3 text-accent/80 fill-accent/80" />
            {item.vote_average?.toFixed(1) || '0'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MediaCardComponent, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.isNowPlaying === next.isNowPlaying &&
    prev.onSelect === next.onSelect &&
    prev.onToggleCompleted === next.onToggleCompleted &&
    prev.onToggleWatchlist === next.onToggleWatchlist &&
    prev.log?.isCompleted === next.log?.isCompleted &&
    prev.log?.isWatchlist === next.log?.isWatchlist &&
    prev.log?.rating === next.log?.rating &&
    prev.log?.watchCount === next.log?.watchCount
  );
});