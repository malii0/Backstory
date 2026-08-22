"use client";

import React from "react";
import Image from "next/image";
import { ActivityFeedItem, MediaItem } from "@/lib/types";
import {
  Star,
  Bookmark,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  Check,
} from "lucide-react";
import { getRelativeTime } from "@/lib/utils";

interface ActivityFeedProps {
  feedItems: ActivityFeedItem[];
  isLoading: boolean;
  userWatchedIds?: Set<string>;
  userWatchlistIds?: Set<string>;
  onSelectItem: (item: MediaItem) => void;
  onQuickAddToWatchlist?: (item: MediaItem) => void;
  onQuickToggleCompleted?: (item: MediaItem) => void;
}

export default function ActivityFeed({
  feedItems,
  isLoading,
  userWatchedIds = new Set(),
  userWatchlistIds = new Set(),
  onSelectItem,
  onQuickAddToWatchlist,
  onQuickToggleCompleted,
}: ActivityFeedProps) {
  const watchedSet =
    userWatchedIds instanceof Set ? userWatchedIds : new Set(userWatchedIds);
  const watchlistSet =
    userWatchlistIds instanceof Set
      ? userWatchlistIds
      : new Set(userWatchlistIds);

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-card rounded-2xl animate-pulse border border-border"
          />
        ))}
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Henüz gruptaki arkadaşların hiçbir film veya dizi kaydetmemiş.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {feedItems.map((item) => {
        const title =
          item.itemData?.title || item.itemData?.name || "Bilinmeyen İçerik";
        const poster = item.itemData?.poster_path
          ? `https://image.tmdb.org/t/p/w185${item.itemData.poster_path}`
          : null;

        const timeAgo = item.updatedAt
          ? getRelativeTime(new Date(item.updatedAt).getTime())
          : "";

        const mediaKey = item.itemData
          ? `${item.itemData.media_type || "movie"}_${item.itemData.id}`
          : "";
        const isUserWatched = mediaKey ? watchedSet.has(mediaKey) : false;
        const isUserInWatchlist = mediaKey ? watchlistSet.has(mediaKey) : false;

        return (
          <div
            key={item.id}
            onClick={() => item.itemData && onSelectItem(item.itemData)}
            className="bg-card/80 hover:bg-card border border-border rounded-2xl p-3.5 flex items-center gap-4 cursor-pointer transition-all shadow-md group relative"
          >
            <div className="w-12 h-16 bg-background rounded-xl overflow-hidden flex-shrink-0 border border-border relative">
              {poster ? (
                <Image
                  src={poster}
                  alt={title}
                  fill
                  sizes="48px"
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  Afiş Yok
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {item.userProfile?.avatarUrl || "🎬"}
                </span>
                <span className="text-xs font-bold text-accent truncate">
                  {item.userProfile?.displayName || "Arkadaş"}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeAgo}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                {title}
              </h4>

              <div className="flex items-center gap-2 pt-0.5">
                {item.isCompleted && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> İzlendi
                  </span>
                )}
                {item.isWatchlist && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">
                    <Bookmark className="w-3 h-3" /> İzlenecek
                  </span>
                )}
                {item.rating > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent bg-background px-2 py-0.5 rounded-md border border-border">
                    <Star className="w-3 h-3 fill-accent text-accent" />{" "}
                    {item.rating}/10
                  </span>
                )}
              </div>
            </div>

            {item.itemData && (
              <div className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center gap-1.5 flex-shrink-0">
                {onQuickToggleCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickToggleCompleted(item.itemData!);
                    }}
                    title={
                      isUserWatched ? "İzlenenlerden Çıkar" : "İzlendi İşaretle"
                    }
                    className={`p-2 rounded-xl border transition-colors ${
                      isUserWatched
                        ? "bg-emerald-500 text-zinc-950 border-emerald-400 hover:bg-emerald-600"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}

                {onQuickAddToWatchlist && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickAddToWatchlist(item.itemData!);
                    }}
                    title={
                      isUserInWatchlist
                        ? "İzleneceklerden Çıkar"
                        : "İzleneceklere Ekle"
                    }
                    className={`p-2 rounded-xl border transition-colors ${
                      isUserInWatchlist
                        ? "bg-accent text-accent-foreground border-accent hover:bg-accent/90"
                        : "bg-accent/10 hover:bg-accent/20 text-accent border-accent/30"
                    }`}
                  >
                    {isUserInWatchlist ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
