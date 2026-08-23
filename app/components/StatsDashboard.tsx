"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { LogMetadata, MediaItem, UserProfile } from "@/lib/types";
import { getEffectiveWatchCount } from "@/lib/utils";
import { GENRES_LIST } from "@/lib/constants";
import AIRecommendationsSection from "@/app/components/AIRecommendationsSection";
import {
  Star,
  Film,
  Tv,
  Clock,
  Award,
  PieChart,
  RotateCcw,
  BarChart3,
  Flame,
  SlidersHorizontal,
} from "lucide-react";

interface StatsDashboardProps {
  logs: Record<string, LogMetadata>;
  onNavigateToExplore?: () => void;
  onOpenRatingManager?: () => void;
  onSelectItem?: (item: MediaItem) => void;
  onToggleCompleted?: (item: MediaItem) => void;
  onToggleWatchlist?: (item: MediaItem) => void;
  userId?: string;
  userProfile?: UserProfile | null;
}

export default function StatsDashboard({
  logs,
  onOpenRatingManager,
  onSelectItem,
  onToggleCompleted,
  onToggleWatchlist,
  userId,
  userProfile,
}: StatsDashboardProps) {
  const stats = useMemo(() => {
    const logEntries = Object.values(logs);
    const completedLogs = logEntries.filter((l) => l.isCompleted);

    const watchlistItems = logEntries
      .filter((l) => l.isWatchlist && l.itemData)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((l) => l.itemData)
      .filter((item): item is MediaItem => Boolean(item))
      .slice(0, 15);

    const favoriteItems = completedLogs
      .filter((l) => l.rating >= 8 && l.itemData)
      .sort((a, b) => b.rating - a.rating)
      .map((l) => l.itemData)
      .filter((item): item is MediaItem => Boolean(item))
      .slice(0, 15);

    const totalMovies = completedLogs.filter(
      (l) => l.itemData?.media_type === "movie",
    ).length;
    const totalTVs = completedLogs.filter(
      (l) => l.itemData?.media_type === "tv",
    ).length;

    const ratedLogs = completedLogs.filter((l) => l.rating > 0);
    const averageRating =
      ratedLogs.length > 0
        ? ratedLogs.reduce((acc, l) => acc + l.rating, 0) / ratedLogs.length
        : 0;

    const ratingDistribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
    };
    ratedLogs.forEach((l) => {
      const r = Math.round(l.rating);
      if (r >= 1 && r <= 10) {
        ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
      }
    });

    const maxRatingCount = Math.max(...Object.values(ratingDistribution), 1);

    const totalRuntimeMinutes = completedLogs.reduce((acc, l) => {
      const itemDataRecord = l.itemData as Record<string, unknown> | undefined;
      const isMovie = l.itemData?.media_type === "movie";
      const itemRuntime =
        typeof itemDataRecord?.runtime === "number"
          ? itemDataRecord.runtime
          : 0;

      const duration =
        l.runtime && l.runtime > 0
          ? l.runtime
          : itemRuntime > 0
            ? itemRuntime
            : isMovie
              ? 110
              : 45;

      const count = getEffectiveWatchCount(l);
      return acc + duration * count;
    }, 0);

    const totalHours = Math.floor(totalRuntimeMinutes / 60);
    const daysSpent = (totalRuntimeMinutes / (60 * 24)).toFixed(1);
    const remainingHoursInDay = Math.floor(
      (totalRuntimeMinutes % (60 * 24)) / 60,
    );

    let wittyTimeComparison = "Henüz yolun başındasın, ekran süren temiz!";
    if (totalHours > 0) {
      if (totalHours < 20)
        wittyTimeComparison = `Bu süreyle en az ${Math.round(totalHours / 2)} kere halı saha maçı yapabilirdin!`;
      else if (totalHours < 100)
        wittyTimeComparison = `Bu sürede yaklaşık ${Math.round(totalHours / 1.5)} fincan kahve içip 5 kitap bitirebilirdin.`;
      else if (totalHours < 300)
        wittyTimeComparison = `İstanbul-Ankara arasını yürüyerek 2 kere gidip gelebileceğin bir zamanı gömdün!`;
      else if (totalHours < 800)
        wittyTimeComparison = `Tebrikler, bir üniversite dönemini tamamen filmlere feda ettin!`;
      else
        wittyTimeComparison = `Efsanevi seviye! Hayatının tam ${daysSpent} gününü ekrana kilitlenerek geçirdin.`;
    }

    const genreCounts: Record<string, number> = {};
    completedLogs.forEach((l) => {
      l.itemData?.genre_ids?.forEach((tmdbId) => {
        const matchedCategory = GENRES_LIST.find(
          (g) => g.movieIds.includes(tmdbId) || g.tvIds.includes(tmdbId),
        );
        if (matchedCategory) {
          genreCounts[matchedCategory.name] =
            (genreCounts[matchedCategory.name] || 0) + 1;
        } else {
          genreCounts["Diğer"] = (genreCounts["Diğer"] || 0) + 1;
        }
      });
    });

    const totalGenreHits =
      Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;

    const topGenres = Object.entries(genreCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalGenreHits) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const rewatchChampion = [...completedLogs]
      .filter((l) => getEffectiveWatchCount(l) > 1 && l.itemData)
      .sort((a, b) => getEffectiveWatchCount(b) - getEffectiveWatchCount(a))[0];

    const topRatedItems = [...completedLogs]
      .filter((l) => l.rating > 0 && l.itemData)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const mostFrequentRating =
      Object.entries(ratingDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "N/A";

    return {
      completedLogs,
      watchlistItems,
      favoriteItems,
      totalMovies,
      totalTVs,
      ratedLogs,
      averageRating,
      ratingDistribution,
      maxRatingCount,
      totalHours,
      daysSpent,
      remainingHoursInDay,
      wittyTimeComparison,
      topGenres,
      rewatchChampion,
      topRatedItems,
      mostFrequentRating,
    };
  }, [logs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-background border border-border rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0">
            {userProfile?.avatarUrl || "🎬"}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">
              {userProfile?.displayName || "Profil"}
            </h2>
            <p className="text-xs text-muted-foreground">
              İzleme alışkanlıklarınız ve metrikleriniz
            </p>
          </div>
        </div>

        <button
          onClick={onOpenRatingManager}
          className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Yönetim</span>
        </button>
      </div>

      <AIRecommendationsSection
        watchlist={stats.watchlistItems}
        favorites={stats.favoriteItems}
        logs={logs}
        userId={userId}
        onSelectItem={onSelectItem}
        onToggleCompleted={onToggleCompleted}
        onToggleWatchlist={onToggleWatchlist}
      />

      <div className="bg-gradient-to-r from-accent/15 via-card to-card border border-accent/30 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4 fill-accent" />
              <span>Hayat Bilançosu</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground">
              {stats.daysSpent}{" "}
              <span className="text-base font-bold text-muted-foreground">
                Gün
              </span>{" "}
              {stats.remainingHoursInDay}{" "}
              <span className="text-base font-bold text-muted-foreground">
                Saat Ekran Başı
              </span>
            </h2>
            <p className="text-xs text-accent/80 font-medium pt-1 max-w-xl italic">
              &quot;{stats.wittyTimeComparison}&quot;
            </p>
          </div>

          <div className="flex items-center gap-3 bg-background/80 border border-border px-4 py-3 rounded-2xl flex-shrink-0">
            <Clock className="w-8 h-8 text-accent" />
            <div>
              <p className="text-[10px] uppercase font-extrabold text-muted-foreground">
                Net Süre
              </p>
              <p className="text-lg font-black text-foreground">
                {stats.totalHours} Saat
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card/80 border border-border/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-accent mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Filmler
            </span>
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xl font-black text-foreground">
              {stats.totalMovies}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              İzlenen film sayısı
            </p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-accent mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Diziler
            </span>
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xl font-black text-foreground">
              {stats.totalTVs}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              İzlenen dizi sayısı
            </p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-accent mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ort. Puan
            </span>
            <Star className="w-5 h-5 fill-accent text-accent" />
          </div>
          <div>
            <p className="text-3xl font-black text-foreground">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "0"}{" "}
              <span className="text-sm font-semibold text-muted-foreground">
                / 10
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats.ratedLogs.length} içerik puanlandı
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7 bg-card/80 border border-border/80 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h3>Puan Dağılım Grafiğiniz</h3>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">
              1 - 10 Skalası
            </span>
          </div>

          <div className="h-44 flex items-end justify-between gap-1.5 pt-4 pb-2 border-b border-border/80">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
              const count = stats.ratingDistribution[star] || 0;
              const heightPercent =
                count > 0
                  ? Math.max((count / stats.maxRatingCount) * 100, 8)
                  : 4;

              return (
                <div
                  key={star}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                >
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-accent transition-colors">
                    {count > 0 ? count : ""}
                  </span>
                  <div className="w-full bg-background rounded-t-lg overflow-hidden flex items-end h-full p-0.5">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-md transition-all duration-500 ${
                        count > 0
                          ? star >= 8
                            ? "bg-accent"
                            : star >= 5
                              ? "bg-accent/70"
                              : "bg-muted-foreground/40"
                          : "bg-muted"
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                    {star}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            En çok{" "}
            <span className="text-accent font-bold">
              {stats.mostFrequentRating}
            </span>{" "}
            puanını vermeyi tercih etmişsin.
          </p>
        </div>

        <div className="md:col-span-5 bg-card/80 border border-border/80 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <PieChart className="w-4 h-4 text-accent" />
            <h3>Favori Tür Dağılımı</h3>
          </div>

          {stats.topGenres.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Henüz tür verisi oluşmadı.
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {stats.topGenres.map((g) => (
                <div key={g.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">
                      {g.name}
                    </span>
                    <span className="text-accent font-bold">
                      {g.count} içerik (%{g.percentage})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border/80">
                    <div
                      style={{ width: `${g.percentage}%` }}
                      className="h-full bg-accent rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {stats.rewatchChampion && stats.rewatchChampion.itemData && (
          <div className="md:col-span-4 bg-card/80 border border-border/80 p-5 rounded-3xl flex items-center gap-4">
            {stats.rewatchChampion.itemData.poster_path ? (
              <div className="w-20 h-28 relative rounded-2xl overflow-hidden border border-border flex-shrink-0 shadow-lg">
                <Image
                  src={`https://image.tmdb.org/t/p/w185${stats.rewatchChampion.itemData.poster_path}`}
                  alt={
                    stats.rewatchChampion.itemData.title ||
                    stats.rewatchChampion.itemData.name ||
                    "Şampiyon"
                  }
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-28 bg-background rounded-2xl flex items-center justify-center text-muted-foreground flex-shrink-0">
                <Film className="w-8 h-8" />
              </div>
            )}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-1 text-accent text-[11px] font-bold">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tekrar İzleme Şampiyonu</span>
              </div>
              <h4 className="text-sm font-extrabold text-foreground truncate">
                {stats.rewatchChampion.itemData.title ||
                  stats.rewatchChampion.itemData.name}
              </h4>
              <p className="text-xs text-muted-foreground leading-snug">
                Tam{" "}
                <span className="text-accent font-black text-sm">
                  {getEffectiveWatchCount(stats.rewatchChampion)} kez
                </span>{" "}
                bıkmadan izlediniz!
              </p>
            </div>
          </div>
        )}

        <div
          className={`${stats.rewatchChampion ? "md:col-span-8" : "md:col-span-12"} bg-card/80 border border-border/80 p-5 rounded-3xl space-y-3`}
        >
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <Award className="w-4 h-4 text-accent" />
            <h3>Zirvedekiler (En Yüksek Puan Verdikleriniz)</h3>
          </div>

          {stats.topRatedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Henüz puan verdiğiniz bir içerik bulunmuyor.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {stats.topRatedItems.map((log) => {
                const item = log.itemData!;
                return (
                  <div
                    key={`${item.media_type}_${item.id}`}
                    className="bg-background border border-border/80 rounded-xl p-2 relative group flex flex-col justify-between"
                  >
                    {item.poster_path ? (
                      <div className="w-full aspect-[2/3] relative rounded-lg overflow-hidden mb-1.5">
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                          alt={item.title || item.name || "Afiş"}
                          fill
                          sizes="(max-width: 640px) 50vw, 20vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[2/3] bg-muted rounded-lg mb-1.5 flex items-center justify-center text-muted-foreground">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-accent text-[10px] font-black px-1.5 py-0.5 rounded-md border border-accent/30 flex items-center gap-1 shadow-lg">
                      <Star className="w-2.5 h-2.5 fill-accent text-accent" />
                      {log.rating}
                    </span>
                    <p className="text-[11px] font-semibold text-foreground truncate">
                      {item.title || item.name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
