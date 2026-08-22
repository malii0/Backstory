"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Star,
  Search,
  Film,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { LogMetadata, MediaItem } from "@/lib/types";

interface RatingManagerModalProps {
  isOpen: boolean;
  logs: Record<string, LogMetadata>;
  onClose: () => void;
  onUpdateRating: (item: MediaItem, rating: number) => void;
  onBulkUpdateRating: (items: MediaItem[], rating: number) => void;
  onSelectItem: (item: MediaItem) => void;
}

type SortOption = "rating.desc" | "rating.asc" | "updated.desc" | "title.asc";
type RatingFilter = "all" | "rated" | "unrated";

export default function RatingManagerModal({
  isOpen,
  logs,
  onClose,
  onUpdateRating,
  onBulkUpdateRating,
  onSelectItem,
}: RatingManagerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMediaType, setSelectedMediaType] = useState<
    "all" | "movie" | "tv"
  >("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("rating.desc");

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [frozenKeys, setFrozenKeys] = useState<string[]>([]);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  const validLogs = useMemo(() => {
    return Object.entries(logs).filter(
      ([, log]) => log.itemData && !log.isWatchlist,
    );
  }, [logs]);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setFrozenKeys([]);
      setSelectedKeys(new Set());
    } else {
      const sorted = validLogs.map(([key, log]) => ({
        key,
        log,
        item: log.itemData!,
      }));
      sorted.sort((a, b) => {
        if (sortBy === "rating.desc") {
          if (b.log.rating === a.log.rating) {
            return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
          }
          return b.log.rating - a.log.rating;
        }
        if (sortBy === "rating.asc") {
          if (a.log.rating === b.log.rating) {
            return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
          }
          return a.log.rating - b.log.rating;
        }
        if (sortBy === "title.asc") {
          const titleA = a.item.title || a.item.name || "";
          const titleB = b.item.title || b.item.name || "";
          return titleA.localeCompare(titleB, "tr");
        }
        return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
      });
      setFrozenKeys(sorted.map((i) => i.key));
    }
  }

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    const sorted = validLogs.map(([key, log]) => ({
      key,
      log,
      item: log.itemData!,
    }));
    sorted.sort((a, b) => {
      if (newSort === "rating.desc") {
        if (b.log.rating === a.log.rating) {
          return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
        }
        return b.log.rating - a.log.rating;
      }
      if (newSort === "rating.asc") {
        if (a.log.rating === b.log.rating) {
          return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
        }
        return a.log.rating - b.log.rating;
      }
      if (newSort === "title.asc") {
        const titleA = a.item.title || a.item.name || "";
        const titleB = b.item.title || b.item.name || "";
        return titleA.localeCompare(titleB, "tr");
      }
      return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
    });
    setFrozenKeys(sorted.map((i) => i.key));
  };

  const handleRatingFilterChange = (newFilter: RatingFilter) => {
    setRatingFilter(newFilter);
    setFrozenKeys([]);
    setSelectedKeys(new Set());
  };

  const handleMediaTypeChange = (type: "all" | "movie" | "tv") => {
    setSelectedMediaType(type);
    setFrozenKeys([]);
    setSelectedKeys(new Set());
  };

  const filteredLogs = useMemo(() => {
    let list = validLogs.map(([key, log]) => ({
      key,
      log,
      item: log.itemData!,
    }));

    if (ratingFilter === "rated") {
      list = list.filter(({ log }) => log.rating > 0);
    } else if (ratingFilter === "unrated") {
      list = list.filter(({ log }) => log.rating === 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(({ item }) => {
        const title = (item.title || item.name || "").toLowerCase();
        return title.includes(q);
      });
    }

    if (selectedMediaType !== "all") {
      list = list.filter(({ item }) => item.media_type === selectedMediaType);
    }

    if (frozenKeys.length > 0) {
      const orderMap = new Map(frozenKeys.map((k, idx) => [k, idx]));
      list.sort((a, b) => {
        const indexA = orderMap.get(a.key) ?? 999999;
        const indexB = orderMap.get(b.key) ?? 999999;
        return indexA - indexB;
      });
    }

    return list;
  }, [validLogs, searchQuery, selectedMediaType, ratingFilter, frozenKeys]);

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredLogs.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredLogs.map((i) => i.key)));
    }
  };

  const toggleSelectItem = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const handleBulkRating = (rating: number) => {
    const itemsToUpdate = filteredLogs
      .filter(({ key }) => selectedKeys.has(key))
      .map((l) => l.item);
    if (itemsToUpdate.length > 0) {
      onBulkUpdateRating(itemsToUpdate, rating);
    }
    setSelectedKeys(new Set());
  };

  const ratedCount = useMemo(
    () =>
      Object.values(logs).filter(
        (l) => l.itemData && !l.isWatchlist && l.rating > 0,
      ).length,
    [logs],
  );
  const unratedCount = useMemo(
    () =>
      Object.values(logs).filter(
        (l) => l.itemData && !l.isWatchlist && l.rating === 0,
      ).length,
    [logs],
  );

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-background border border-border rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden relative"
      >
        <div className="p-5 border-b border-border/80 flex items-center justify-between gap-3 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-2xl text-accent">
              <Star className="w-5 h-5 fill-accent" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground">
                Yönetim
              </h2>
              <p className="text-xs text-muted-foreground">
                <span className="text-accent font-bold">{ratedCount}</span>{" "}
                Puanlandı •{" "}
                <span className="text-muted-foreground font-bold">
                  {unratedCount}
                </span>{" "}
                Puan Bekliyor
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground bg-card border border-border rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-border/60 bg-card/30 space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Listendeki film veya dizilerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2 pl-9 pr-8 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent/50 transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl">
              <button
                onClick={() => handleRatingFilterChange("all")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  ratingFilter === "all"
                    ? "bg-muted text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tümü ({ratedCount + unratedCount})
              </button>
              <button
                onClick={() => handleRatingFilterChange("rated")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  ratingFilter === "rated"
                    ? "bg-muted text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Puanlananlar ({ratedCount})
              </button>
              <button
                onClick={() => handleRatingFilterChange("unrated")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  ratingFilter === "unrated"
                    ? "bg-muted text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Puan Verilmeyenler ({unratedCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl">
                <button
                  onClick={() => handleMediaTypeChange("all")}
                  className={`px-2 py-0.5 rounded-md font-semibold ${
                    selectedMediaType === "all"
                      ? "text-accent bg-muted"
                      : "text-muted-foreground"
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => handleMediaTypeChange("movie")}
                  className={`px-2 py-0.5 rounded-md font-semibold ${
                    selectedMediaType === "movie"
                      ? "text-accent bg-muted"
                      : "text-muted-foreground"
                  }`}
                >
                  Film
                </button>
                <button
                  onClick={() => handleMediaTypeChange("tv")}
                  className={`px-2 py-0.5 rounded-md font-semibold ${
                    selectedMediaType === "tv"
                      ? "text-accent bg-muted"
                      : "text-muted-foreground"
                  }`}
                >
                  Dizi
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="bg-card border border-border text-foreground text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-accent/50"
              >
                <option value="rating.desc">Puan: Yüksekten Düşüğe</option>
                <option value="rating.asc">Puan: Düşükten Yükseğe</option>
                <option value="updated.desc">Son Güncellenenler</option>
                <option value="title.asc">İsim (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold"
            >
              {selectedKeys.size > 0 &&
              selectedKeys.size === filteredLogs.length ? (
                <CheckSquare className="w-4 h-4 text-accent" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Tümünü Seç ({filteredLogs.length})</span>
            </button>

            {selectedKeys.size > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                <span className="text-[11px] text-accent font-bold">
                  {selectedKeys.size} seçildi:
                </span>
                <select
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) handleBulkRating(val);
                  }}
                  defaultValue=""
                  className="bg-background border border-accent/40 text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="" disabled>
                    Puan Ata...
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s}>
                      {s} Puan Yap
                    </option>
                  ))}
                  <option value={0}>Puanları Temizle</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Kriterlere uyan içerik bulunamadı.
            </div>
          ) : (
            filteredLogs.map(({ key, item, log }) => {
              const title = item.title || item.name || "İsimsiz İçerik";
              const releaseYear = (
                item.release_date ||
                item.first_air_date ||
                ""
              ).split("-")[0];
              const isSelected = selectedKeys.has(key);

              return (
                <div
                  key={key}
                  className={`border rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all group ${
                    isSelected
                      ? "bg-accent/10 border-accent"
                      : log.rating > 0
                        ? "bg-card/70 border-border/80 hover:border-border"
                        : "bg-background/40 border-border/40 hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => toggleSelectItem(key)}
                      className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div
                      onClick={() => {
                        onSelectItem(item);
                        onClose();
                      }}
                      className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    >
                      {item.poster_path ? (
                        <div className="w-10 h-14 relative flex-shrink-0">
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt={title}
                            fill
                            sizes="40px"
                            className="object-cover rounded-xl border border-border group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-14 bg-background rounded-xl border border-border flex items-center justify-center text-muted-foreground flex-shrink-0">
                          <Film className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground group-hover:text-accent transition-colors truncate">
                          {title}
                        </h4>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span className="uppercase font-bold text-accent/80">
                            {item.media_type === "tv" ? "Dizi" : "Film"}
                          </span>
                          {releaseYear && <span>• {releaseYear}</span>}
                          {log.isCompleted && (
                            <span className="text-emerald-400">• İzlendi</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <div className="flex items-center gap-0.5 bg-background border border-border/80 px-2 py-1 rounded-xl">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                        <button
                          key={star}
                          onClick={() => onUpdateRating(item, star)}
                          className="p-0.5 hover:scale-125 transition-transform focus:outline-none"
                          title={`${star} Puan`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              log.rating >= star
                                ? "text-accent fill-accent"
                                : "text-muted border-border hover:text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black min-w-[2.5rem] text-right ${
                          log.rating > 0
                            ? "text-accent"
                            : "text-muted-foreground font-normal"
                        }`}
                      >
                        {log.rating > 0 ? `${log.rating}/10` : "Puan Yok"}
                      </span>

                      {log.rating > 0 && (
                        <button
                          onClick={() => onUpdateRating(item, 0)}
                          className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Puanı Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
