"use client";

import React from "react";
import Image from "next/image";
import { X, Search, SlidersHorizontal, Star, AlertCircle } from "lucide-react";
import { GENRES_LIST } from "@/lib/constants";
import { ActiveTab } from "@/lib/types";

interface FilterPanelProps {
  show: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  explore: ReturnType<typeof import("@/hooks/useTmdbExplore").useTmdbExplore>;
  modalSearchInputRef: React.RefObject<HTMLInputElement | null>;
  displayedItemsLength: number | string;
}

export default function FilterPanel({
  show,
  onClose,
  activeTab,
  explore,
  modalSearchInputRef,
  displayedItemsLength,
}: FilterPanelProps) {
  const isSearchActive = explore.query.trim().length > 0;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-200 ${
          show
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[75vh] overflow-y-auto no-scrollbar max-w-2xl mx-auto transition-transform duration-300 ease-out will-change-transform ${
          show ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="w-12 h-1 bg-muted-foreground/40 rounded-full mx-auto mb-1 flex-shrink-0" />

        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-accent" />
            Filtrele & Ara
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg bg-muted/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Arama Metni
          </label>
          <div className="relative">
            <input
              ref={modalSearchInputRef}
              type="text"
              maxLength={150}
              placeholder={
                activeTab === "explore"
                  ? "Film veya dizi arayın..."
                  : activeTab === "completed"
                    ? "İzlediklerinizde arayın..."
                    : "Listenizde arayın..."
              }
              value={explore.query}
              onChange={(e) => explore.setQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2.5 pl-9 pr-8 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent/50 transition-all shadow-inner"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            {explore.query && (
              <button
                onClick={() => explore.setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Medya Türü
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "all", label: "Tümü" },
              { id: "movie", label: "Film" },
              { id: "tv", label: "Dizi" },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() =>
                  explore.setSelectedMediaType(
                    type.id as "all" | "movie" | "tv",
                  )
                }
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  explore.selectedMediaType === type.id
                    ? "bg-accent/10 border-accent/50 text-accent"
                    : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {isSearchActive && activeTab === "explore" && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-2.5 text-[11px] text-accent flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Arama yaparken Kategori, Platform, Puan ve Yıl filtreleri TMDB
              aramasına uygulanamaz.
            </span>
          </div>
        )}

        <div
          className={
            isSearchActive && activeTab === "explore"
              ? "opacity-40 pointer-events-none transition-opacity space-y-4"
              : "space-y-4 transition-opacity"
          }
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Platform (Türkiye)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
              {explore.providers.map((provider) => {
                const isSelected =
                  explore.selectedProviderId === provider.provider_id;
                return (
                  <button
                    key={provider.provider_id}
                    onClick={() =>
                      explore.setSelectedProviderId(
                        isSelected ? null : provider.provider_id,
                      )
                    }
                    className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-accent/10 border-accent/50 text-accent"
                        : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {provider.logo_path && (
                      <div className="w-4 h-4 relative flex-shrink-0">
                        <Image
                          src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                          alt={provider.provider_name}
                          fill
                          sizes="16px"
                          unoptimized
                          className="rounded-md object-cover"
                        />
                      </div>
                    )}
                    <span>{provider.provider_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                Minimum Puan
              </label>
              <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md">
                {explore.minRating === 0
                  ? "Tüm Puanlar"
                  : `${explore.minRating.toFixed(1)}+`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="9.5"
              step="0.5"
              value={explore.minRating}
              onChange={(e) => explore.setMinRating(parseFloat(e.target.value))}
              className="w-full accent-accent bg-background h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                Çıkış Yılı Aralığı
              </label>
              <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md">
                {explore.yearRange.start} - {explore.yearRange.end}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">
                  Başlangıç: {explore.yearRange.start}
                </span>
                <input
                  type="range"
                  min="1900"
                  max={explore.yearRange.end}
                  step="1"
                  value={explore.yearRange.start}
                  onChange={(e) =>
                    explore.setYearRange((prev) => ({
                      ...prev,
                      start: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-accent bg-background h-2 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">
                  Bitiş: {explore.yearRange.end}
                </span>
                <input
                  type="range"
                  min={explore.yearRange.start}
                  max={new Date().getFullYear()}
                  step="1"
                  value={explore.yearRange.end}
                  onChange={(e) =>
                    explore.setYearRange((prev) => ({
                      ...prev,
                      end: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-accent bg-background h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Kategori
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
              <button
                onClick={() => explore.setSelectedGenreId(null)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  explore.selectedGenreId === null
                    ? "bg-accent/10 border-accent/50 text-accent"
                    : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Tümü
              </button>
              {GENRES_LIST.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() =>
                    explore.setSelectedGenreId(
                      explore.selectedGenreId === genre.id ? null : genre.id,
                    )
                  }
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                    explore.selectedGenreId === genre.id
                      ? "bg-accent/10 border-accent/50 text-accent"
                      : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Sıralama
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeTab === "explore"
                ? [
                    { id: "popularity.desc", label: "Popülerlik" },
                    {
                      id: "vote_average.desc",
                      label: "Tüm Zamanların En İyileri",
                    },
                    { id: "vote_count.desc", label: "En Çok Oylananlar" },
                  ].map((sortOption) => (
                    <button
                      key={sortOption.id}
                      onClick={() =>
                        explore.setSortBy(
                          sortOption.id as typeof explore.sortBy,
                        )
                      }
                      className={`py-2 px-2 text-center rounded-xl text-xs font-medium border transition-all ${
                        explore.sortBy === sortOption.id
                          ? "bg-accent/10 border-accent/50 text-accent"
                          : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sortOption.label}
                    </button>
                  ))
                : [
                    { id: "updated_at.desc", label: "Son Eklenenler" },
                    { id: "my_rating.desc", label: "Puanım" },
                    { id: "watch_count.desc", label: "İzleme Sayısı" },
                    { id: "vote_average.desc", label: "TMDB Puanı" },
                  ].map((sortOption) => (
                    <button
                      key={sortOption.id}
                      onClick={() =>
                        explore.setSortBy(
                          sortOption.id as typeof explore.sortBy,
                        )
                      }
                      className={`py-2 px-2 text-center rounded-xl text-xs font-medium border transition-all ${
                        explore.sortBy === sortOption.id
                          ? "bg-accent/10 border-accent/50 text-accent"
                          : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sortOption.label}
                    </button>
                  ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {explore.activeFilterCount > 0
              ? `${explore.activeFilterCount} filtre aktif`
              : "Filtre yok"}
          </span>
          <div className="flex gap-2">
            {explore.activeFilterCount > 0 && (
              <button
                onClick={explore.handleResetFilters}
                className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors px-3 py-1.5"
              >
                Sıfırla
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-accent text-accent-foreground font-bold text-xs px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>Tamam</span>
              <span className="bg-background/20 px-1.5 py-0.2 rounded-md text-[10px]">
                {displayedItemsLength} Sonuç
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
