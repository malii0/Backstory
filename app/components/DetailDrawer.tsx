"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import {
  X,
  Star,
  Eye,
  Bookmark,
  Layers,
  ExternalLink,
  Film,
  Play,
  Plus,
  Minus,
  RotateCcw,
  Globe,
  Tv,
  Clock,
  User,
  Clapperboard,
  Loader2,
  Users,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { MediaItem, MediaDetail, LogMetadata, Collection } from "@/lib/types";
import { getEffectiveWatchCount } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface DetailDrawerProps {
  selectedItem: MediaItem;
  detailData: MediaDetail | null;
  isDetailLoading: boolean;
  detailError: string | null;
  currentLog?: LogMetadata;
  onClose: () => void;
  onGenreSelect: (genreId: number) => void;
  onSelectItem: (item: MediaItem) => void;
  onToggleCompleted: () => void;
  onToggleWatchlist: () => void;
  onUpdateRating: (rating: number) => void;
  onUpdateWatchCount: (count: number) => void;
  onRetry: () => void;
}

interface PersonCredit {
  id: number;
  title?: string;
  name?: string;
  job?: string;
  department?: string;
  popularity?: number;
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv";
  vote_average?: number;
}

interface WatchProviderInfo {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export default function DetailDrawer({
  selectedItem,
  detailData,
  isDetailLoading,
  detailError,
  currentLog,
  onClose,
  onGenreSelect,
  onSelectItem,
  onToggleCompleted,
  onToggleWatchlist,
  onUpdateRating,
  onUpdateWatchCount,
  onRetry,
}: DetailDrawerProps) {
  const [showTrailer, setShowTrailer] = useState(false);
  const [collectionData, setCollectionData] = useState<Collection | null>(null);
  const [canClose, setCanClose] = useState(false);

  const [activePerson, setActivePerson] = useState<{
    id: number;
    name: string;
    job: "Director" | "Creator" | "Actor";
  } | null>(null);
  const [filmography, setFilmography] = useState<MediaItem[]>([]);
  const [isFilmographyLoading, setIsFilmographyLoading] = useState(false);
  const [filmographyLimit, setFilmographyLimit] = useState(15);

  const [touchRating, setTouchRating] = useState<number | null>(null);
  const isTouchDraggingRef = useRef(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const starContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = starContainerRef.current;
    if (!el) return;

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      isTouchDraggingRef.current = true;
      const rect = el.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const calculatedRating = Math.max(1, Math.ceil(ratio * 10));
      setTouchRating(calculatedRating);
    };

    el.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleNativeTouchMove);
  }, []);

  const [prevSelectedItem, setPrevSelectedItem] = useState(selectedItem);
  if (selectedItem !== prevSelectedItem) {
    setPrevSelectedItem(selectedItem);
    setCanClose(false);
  }

  const collectionId = detailData?.belongs_to_collection?.id;

  const [prevCollectionId, setPrevCollectionId] = useState<
    number | null | undefined
  >(collectionId);
  if (collectionId !== prevCollectionId) {
    setPrevCollectionId(collectionId);
    if (!collectionId) {
      setCollectionData(null);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanClose(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedItem]);

  useEffect(() => {
    window.history.pushState({ drawerOpen: true }, "", "#detail");

    const handlePopState = () => {
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      if (window.location.hash === "#detail") {
        window.history.back();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePerson) {
          setActivePerson(null);
        } else {
          onCloseRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePerson]);

  const trailerKey = useMemo(() => {
    if (!detailData?.videos?.results) return null;
    const trailer = detailData.videos.results.find(
      (v) =>
        v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
    );
    return trailer ? trailer.key : detailData.videos.results[0]?.key || null;
  }, [detailData]);

  useEffect(() => {
    if (!collectionId) return;

    let isMounted = true;
    const fetchCollection = async () => {
      try {
        const res = await fetchWithAuth(
          `/api/tmdb?endpoint=/collection/${collectionId}`,
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.parts) {
            data.parts.sort((a: MediaItem, b: MediaItem) => {
              const dateA = new Date(a.release_date || 0).getTime();
              const dateB = new Date(b.release_date || 0).getTime();
              return dateA - dateB;
            });
          }
          setCollectionData(data);
        }
      } catch (e) {}
    };

    fetchCollection();
    return () => {
      isMounted = false;
    };
  }, [collectionId]);

  useEffect(() => {
    if (!activePerson) {
      return;
    }

    let isMounted = true;
    const fetchPersonFilmography = async () => {
      setIsFilmographyLoading(true);
      setFilmographyLimit(15);
      try {
        const res = await fetchWithAuth(
          `/api/tmdb?endpoint=/person/${activePerson.id}/combined_credits`,
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          let items: PersonCredit[] = [];

          if (activePerson.job === "Director") {
            items = (data.crew || []).filter(
              (c: PersonCredit) => c.job === "Director",
            );
          } else if (activePerson.job === "Creator") {
            items = (data.crew || []).filter(
              (c: PersonCredit) =>
                c.job === "Executive Producer" ||
                c.department === "Production" ||
                c.job === "Creator",
            );
            if (items.length === 0) items = data.cast || [];
          } else if (activePerson.job === "Actor") {
            items = data.cast || [];
          }

          const map = new Map<string, MediaItem>();
          items.forEach((item) => {
            const mType = item.media_type || "movie";
            const key = `${mType}_${item.id}`;
            if (!map.has(key)) {
              map.set(key, {
                id: item.id,
                title: item.title,
                name: item.name,
                poster_path: item.poster_path,
                release_date: item.release_date,
                first_air_date: item.first_air_date,
                vote_average: item.vote_average,
                media_type: mType,
              });
            }
          });

          const sorted = Array.from(map.values()).sort(
            (a, b) => (b.vote_average || 0) - (a.vote_average || 0),
          );
          setFilmography(sorted);
        }
      } catch (err) {
      } finally {
        if (isMounted) {
          setIsFilmographyLoading(false);
        }
      }
    };

    fetchPersonFilmography();
    return () => {
      isMounted = false;
    };
  }, [activePerson]);

  const smartRecommendations = useMemo(() => {
    if (!detailData) return [];

    const recs = detailData.recommendations?.results || [];
    const sims = detailData.similar?.results || [];

    const combinedMap = new Map<string, MediaItem>();

    recs.forEach((item) => {
      const type = item.media_type || selectedItem.media_type;
      combinedMap.set(`${type}_${item.id}`, {
        ...item,
        media_type: type,
      });
    });

    if (combinedMap.size < 10) {
      sims.forEach((item) => {
        const type = item.media_type || selectedItem.media_type;
        const key = `${type}_${item.id}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, {
            ...item,
            media_type: type,
          });
        }
      });
    }

    return Array.from(combinedMap.values()).slice(0, 10);
  }, [detailData, selectedItem]);

  const collectionOrder = useMemo(() => {
    if (!collectionData?.parts || !selectedItem) return null;
    const index = collectionData.parts.findIndex(
      (p) => p.id === selectedItem.id,
    );
    return index !== -1 ? index + 1 : null;
  }, [collectionData, selectedItem]);

  const directorObj = detailData?.credits?.crew?.find(
    (c) => c.job === "Director",
  );
  const creatorObj = detailData?.created_by?.[0];
  const castList = detailData?.credits?.cast?.slice(0, 10) || [];

  const handleStarClick = (targetRating: number) => {
    if ((currentLog?.rating || 0) === targetRating) {
      onUpdateRating(0);
    } else {
      onUpdateRating(targetRating);
    }
  };

  const handleTouchStart = () => {
    isTouchDraggingRef.current = false;
  };

  const handleTouchEnd = () => {
    if (isTouchDraggingRef.current && touchRating !== null) {
      if ((currentLog?.rating || 0) === touchRating) {
        onUpdateRating(0);
      } else {
        onUpdateRating(touchRating);
      }
    }
    setTouchRating(null);
    isTouchDraggingRef.current = false;
  };

  const title = selectedItem.title || selectedItem.name || "İçerik Detayı";
  const releaseYear = (
    selectedItem.release_date ||
    selectedItem.first_air_date ||
    ""
  ).split("-")[0];
  const imdbId = detailData?.imdb_id || detailData?.external_ids?.imdb_id;
  const currentWatchCount = getEffectiveWatchCount(currentLog);
  const watchProviders = detailData?.["watch/providers"]?.results?.TR;

  const activeDisplayRating =
    touchRating !== null ? touchRating : currentLog?.rating || 0;

  return (
    <div
      onClick={() => {
        if (canClose) onClose();
      }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center md:items-center p-0 md:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      {activePerson && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => {
                setActivePerson(null);
                setFilmography([]);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full bg-muted border border-border"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Clapperboard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  {activePerson.job === "Director"
                    ? "Yönetmen Filmografisi"
                    : activePerson.job === "Creator"
                      ? "Yaratıcı Yapımları"
                      : "Oyuncunun Diğer Yapımları"}
                </p>
                <h3 className="text-lg font-extrabold text-foreground">
                  {activePerson.name}
                </h3>
              </div>
            </div>

            {isFilmographyLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span>Filmografi yükleniyor...</span>
              </div>
            ) : filmography.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Diğer yapım bulunamadı.
              </p>
            ) : (
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
                {filmography.slice(0, filmographyLimit).map((item) => {
                  const mType = item.media_type || "movie";
                  const key = `${mType}_${item.id}`;
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        onSelectItem(item);
                        setActivePerson(null);
                        setFilmography([]);
                      }}
                      className="flex items-center gap-3 p-2 rounded-xl bg-background/60 hover:bg-muted/80 border border-border/80 cursor-pointer transition-all group"
                    >
                      {item.poster_path ? (
                        <div className="w-10 h-14 relative flex-shrink-0">
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt={item.title || item.name || "Afiş"}
                            fill
                            sizes="40px"
                            className="object-cover rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0">
                          <Film className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground group-hover:text-accent transition-colors truncate">
                          {item.title || item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(
                            item.release_date ||
                            item.first_air_date ||
                            ""
                          ).split("-")[0] || "N/A"}{" "}
                          • {mType === "tv" ? "Dizi" : "Film"}
                        </p>
                      </div>
                      {item.vote_average && item.vote_average > 0 ? (
                        <span className="text-xs font-bold text-accent flex items-center gap-1">
                          <Star className="w-3 h-3 fill-accent text-accent" />
                          {item.vote_average.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {filmography.length > filmographyLimit && (
                  <button
                    onClick={() => setFilmographyLimit((prev) => prev + 20)}
                    className="w-full py-2.5 mt-2 bg-muted/60 hover:bg-muted text-accent border border-border/60 rounded-xl text-xs font-semibold transition-all text-center"
                  >
                    Daha Fazla Göster ({filmography.length - filmographyLimit}{" "}
                    yapım daha var)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-full md:max-w-2xl min-h-dvh md:min-h-0 md:max-h-[90vh] bg-background border-0 md:border border-border/80 rounded-none md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground bg-card/80 hover:bg-card p-2 rounded-full border border-border transition-colors z-20 backdrop-blur-md"
          title="Kapat (ESC)"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-6">
          {detailError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between gap-2 text-xs text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{detailError}</span>
              </div>
              <button
                onClick={onRetry}
                className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-[11px] font-bold text-red-300 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Tekrar Dene
              </button>
            </div>
          )}

          {isDetailLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              <span>Detaylar yükleniyor...</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pr-8">
            <div className="md:col-span-6 flex gap-3.5 items-start">
              {selectedItem.poster_path ? (
                <div className="w-28 h-40 relative rounded-2xl shadow-xl border border-border flex-shrink-0 overflow-hidden">
                  <Image
                    src={`https://image.tmdb.org/t/p/w342${selectedItem.poster_path}`}
                    alt={title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-28 h-40 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground border border-border flex-shrink-0">
                  <Film className="w-10 h-10" />
                </div>
              )}

              <div className="flex-1 space-y-2 pt-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="bg-accent/10 text-accent border border-accent/30 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {selectedItem.media_type === "tv" ? "Dizi" : "Film"}
                  </span>
                  {releaseYear && (
                    <span className="bg-card text-foreground border border-border text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {releaseYear}
                    </span>
                  )}
                  {imdbId && (
                    <a
                      href={`https://www.imdb.com/title/${imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                    >
                      IMDb <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                <h2
                  title={title}
                  className="text-lg md:text-xl font-extrabold text-foreground leading-snug break-words"
                >
                  {title}
                </h2>

                {selectedItem.media_type === "movie" && directorObj && (
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3.5 h-3.5 flex-shrink-0" /> Yönetmen:
                    </span>
                    <button
                      onClick={() =>
                        setActivePerson({
                          id: directorObj.id,
                          name: directorObj.name,
                          job: "Director",
                        })
                      }
                      title={directorObj.name}
                      className="text-accent font-semibold hover:underline transition-all text-left break-words"
                    >
                      {directorObj.name}
                    </button>
                  </p>
                )}
                {selectedItem.media_type === "tv" && creatorObj && (
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <User className="w-3.5 h-3.5 flex-shrink-0" /> Yaratıcı:
                    </span>
                    <button
                      onClick={() =>
                        setActivePerson({
                          id: creatorObj.id,
                          name: creatorObj.name,
                          job: "Creator",
                        })
                      }
                      title={creatorObj.name}
                      className="text-accent font-semibold hover:underline transition-all text-left break-words"
                    >
                      {creatorObj.name}
                    </button>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="flex items-center gap-1 text-accent text-[11px] font-bold bg-card border border-border px-2 py-0.5 rounded-lg">
                    <Star className="w-3 h-3 fill-accent text-accent" />
                    {selectedItem.vote_average?.toFixed(1) || "N/A"}
                  </span>

                  {selectedItem.media_type === "tv" &&
                    detailData?.number_of_seasons && (
                      <div className="flex items-center gap-1 bg-card border border-border px-2 py-0.5 rounded-lg text-[11px] text-foreground font-medium">
                        <Tv className="w-3 h-3 text-muted-foreground" />
                        <span>{detailData.number_of_seasons} S</span>
                        {detailData.number_of_episodes && (
                          <span className="text-muted-foreground">
                            • {detailData.number_of_episodes} B
                          </span>
                        )}
                      </div>
                    )}

                  {detailData?.runtime ? (
                    <div className="flex items-center gap-1 bg-card border border-border px-2 py-0.5 rounded-lg text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{detailData.runtime} dk</span>
                    </div>
                  ) : null}
                </div>

                {trailerKey && (
                  <button
                    onClick={() => setShowTrailer(!showTrailer)}
                    className="inline-flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shadow-sm mt-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    {showTrailer ? "Fragmanı Kapat" : "Fragmanı İzle"}
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-6 bg-card/60 border border-border/60 p-3 rounded-2xl flex flex-col min-h-[10rem] max-h-48">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1 flex-shrink-0">
                Özet
              </h3>
              <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
                <p className="text-xs text-foreground leading-relaxed">
                  {selectedItem.overview ||
                    "Bu içerik için özet bilgisi bulunmuyor."}
                </p>
              </div>
            </div>
          </div>

          {showTrailer && trailerKey && (
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-border shadow-xl bg-black animate-in fade-in duration-200">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                title="Fragman"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {detailData?.genres && detailData.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {detailData.genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => onGenreSelect(genre.id)}
                  className="bg-card hover:bg-muted text-foreground border border-border text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                >
                  {genre.name}
                </button>
              ))}
            </div>
          )}

          {watchProviders && (
            <div className="bg-card/80 border border-border/80 p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                Nerede İzlenir? (Türkiye)
              </h3>

              <div className="flex flex-wrap gap-2">
                {watchProviders.flatrate?.map((p: WatchProviderInfo) => (
                  <div
                    key={p.provider_id}
                    className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-xl text-xs font-medium text-foreground"
                  >
                    <div className="w-5 h-5 relative rounded-md overflow-hidden flex-shrink-0">
                      <Image
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        fill
                        sizes="20px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <span>{p.provider_name}</span>
                  </div>
                ))}
                {!watchProviders.flatrate && (
                  <p className="text-xs text-muted-foreground">
                    Abonelik platformlarında bulunamadı.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  Veri kaynağı: JustWatch
                </span>
                {watchProviders.link && (
                  <a
                    href={watchProviders.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Tüm seçenekleri gör →
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="bg-card/80 border border-border/80 p-4 rounded-2xl space-y-4">
            <div className="flex gap-2">
              <button
                onClick={onToggleCompleted}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  currentLog?.isCompleted
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-4 h-4" />
                {currentLog?.isCompleted ? "İzlendi" : "İzledim"}
              </button>

              <button
                onClick={onToggleWatchlist}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  currentLog?.isWatchlist
                    ? "bg-accent/20 border-accent/40 text-accent"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bookmark className="w-4 h-4" />
                {currentLog?.isWatchlist ? "Listede" : "İzleyeceğim"}
              </button>
            </div>

            <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Puanınız:
                </span>
                <span className="text-xs font-bold text-accent">
                  {activeDisplayRating > 0
                    ? `${activeDisplayRating} / 10`
                    : "Puan Yok"}
                </span>
              </div>

              <div
                ref={starContainerRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="flex items-center justify-between py-2 px-1 select-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleStarClick(star)}
                    className="p-1 transition-transform active:scale-125 focus:outline-none"
                    title={`${star} Puan`}
                  >
                    <Star
                      className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${
                        activeDisplayRating >= star
                          ? "text-accent fill-accent"
                          : "text-muted border-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {currentLog?.isCompleted && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-accent" />
                  İzleme Sayısı:
                </span>
                <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-1">
                  <button
                    onClick={() =>
                      onUpdateWatchCount(Math.max(1, currentWatchCount - 1))
                    }
                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    disabled={currentWatchCount <= 1}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-foreground px-2">
                    {currentWatchCount}
                  </span>
                  <button
                    onClick={() => onUpdateWatchCount(currentWatchCount + 1)}
                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {castList.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent" />
                Oyuncu Kadrosu
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {castList.map((actor) => (
                  <div
                    key={actor.id}
                    onClick={() =>
                      setActivePerson({
                        id: actor.id,
                        name: actor.name,
                        job: "Actor",
                      })
                    }
                    className="flex-shrink-0 w-20 text-center cursor-pointer group"
                  >
                    {actor.profile_path ? (
                      <div className="w-20 h-24 relative mb-1.5 rounded-2xl overflow-hidden border border-border group-hover:border-accent/50 transition-colors shadow-md">
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                          alt={actor.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-24 bg-muted rounded-2xl mb-1.5 border border-border flex items-center justify-center text-muted-foreground group-hover:border-accent/50 transition-colors">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <p className="text-[11px] font-bold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                      {actor.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground line-clamp-1">
                      {actor.character}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {collectionData && (
            <div className="bg-gradient-to-r from-accent/10 to-card border border-accent/30 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-accent text-xs font-bold">
                  <Layers className="w-4 h-4" />
                  <span>{collectionData.name}</span>
                </div>
                {collectionOrder && (
                  <span className="bg-accent/20 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent/30">
                    {collectionOrder}. Film
                  </span>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {collectionData.parts?.map((part) => (
                  <div
                    key={part.id}
                    onClick={() =>
                      onSelectItem({ ...part, media_type: "movie" })
                    }
                    className={`flex-shrink-0 w-20 cursor-pointer group ${
                      part.id === selectedItem.id
                        ? "ring-2 ring-accent rounded-xl"
                        : ""
                    }`}
                  >
                    {part.poster_path ? (
                      <div className="w-full h-28 relative rounded-xl overflow-hidden mb-1 group-hover:opacity-80 transition-opacity">
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${part.poster_path}`}
                          alt={part.title || "Afiş"}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-muted rounded-xl mb-1 flex items-center justify-center text-muted-foreground">
                        <Film className="w-6 h-6" />
                      </div>
                    )}
                    <p className="text-[10px] font-medium text-foreground line-clamp-1 group-hover:text-accent">
                      {part.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {smartRecommendations.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Benzer & Önerilen İçerikler
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {smartRecommendations.map((rec) => {
                  const rType =
                    rec.media_type || selectedItem.media_type || "movie";
                  const key = `${rType}_${rec.id}`;
                  return (
                    <div
                      key={key}
                      onClick={() => onSelectItem(rec)}
                      className="bg-card border border-border/80 rounded-xl p-2 cursor-pointer hover:border-accent/40 transition-all group flex flex-col justify-between"
                    >
                      {rec.poster_path ? (
                        <div className="w-full aspect-[2/3] relative rounded-lg overflow-hidden mb-1.5">
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${rec.poster_path}`}
                            alt={rec.title || rec.name || "Öneri"}
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
                      <p className="text-[11px] font-semibold text-foreground line-clamp-1 group-hover:text-accent">
                        {rec.title || rec.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
