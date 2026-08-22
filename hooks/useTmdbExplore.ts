import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { MediaItem, ActiveTab, WatchProviderInfo } from "@/lib/types"; // Tip güncellendi
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { GENRES_LIST } from "@/lib/constants";

export type YearRange = { start: number; end: number };
export type ExploreMode =
  | "standard"
  | "now_playing"
  | "upcoming"
  | "personalized";

export const DEFAULT_YEAR_RANGE: YearRange = {
  start: 1900,
  end: new Date().getFullYear(),
};

export function useTmdbExplore(activeTab: ActiveTab) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [yearRange, setYearRange] = useState<YearRange>(DEFAULT_YEAR_RANGE);
  const [debouncedYearRange, setDebouncedYearRange] =
    useState<YearRange>(DEFAULT_YEAR_RANGE);

  const [minRating, setMinRating] = useState<number>(0);
  const [debouncedMinRating, setDebouncedMinRating] = useState<number>(0);

  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [nowPlayingIds, setNowPlayingIds] = useState<Set<number>>(new Set());
  const [providers, setProviders] = useState<WatchProviderInfo[]>([]); // Tip değişti
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null,
  );
  const [exploreMode, setExploreMode] = useState<ExploreMode>("standard");

  const [showFilters, setShowFilters] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<
    "all" | "movie" | "tv"
  >("all");
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    | "popularity.desc"
    | "vote_average.desc"
    | "vote_count.desc"
    | "my_rating.desc"
    | "watch_count.desc"
    | "updated_at.desc"
  >("popularity.desc");

  if (
    exploreMode === "personalized" &&
    (query.trim() !== "" ||
      selectedGenreId !== null ||
      selectedProviderId !== null ||
      minRating > 0)
  ) {
    setExploreMode("standard");
  }

  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    if (activeTab !== "explore") {
      setExploreMode("standard");
      if (
        sortBy === "popularity.desc" ||
        sortBy === "vote_count.desc" ||
        sortBy === "vote_average.desc"
      ) {
        setSortBy("updated_at.desc");
      }
    } else {
      if (
        sortBy === "updated_at.desc" ||
        sortBy === "my_rating.desc" ||
        sortBy === "watch_count.desc"
      ) {
        setSortBy("popularity.desc");
      }
    }
  }

  useEffect(() => {
    if (query === "") {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedYearRange(yearRange);
    }, 350);
    return () => clearTimeout(timer);
  }, [yearRange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMinRating(minRating);
    }, 350);
    return () => clearTimeout(timer);
  }, [minRating]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetchWithAuth(
            "/api/tmdb?endpoint=/watch/providers/movie&watch_region=TR",
          ),
          fetchWithAuth(
            "/api/tmdb?endpoint=/watch/providers/tv&watch_region=TR",
          ),
        ]);

        let allProviders: WatchProviderInfo[] = [];
        if (movieRes.ok) {
          const mData = await movieRes.json();
          allProviders = [...allProviders, ...(mData.results || [])];
        }
        if (tvRes.ok) {
          const tData = await tvRes.json();
          allProviders = [...allProviders, ...(tData.results || [])];
        }

        const uniqueMap = new Map<number, WatchProviderInfo>();
        allProviders.forEach((p) => {
          if (!uniqueMap.has(p.provider_id)) {
            uniqueMap.set(p.provider_id, p);
          }
        });

        // TMDB'nin önceliğine göre sıralama sağlandı (Türkiye platformlarını öne çıkarır)
        const providersArr = Array.from(uniqueMap.values());
        providersArr.sort(
          (a, b) => (a.display_priority || 1000) - (b.display_priority || 1000),
        );
        setProviders(providersArr.slice(0, 24)); // Daha kapsayıcı platform limiti
      } catch (err) {
        console.error("Platform sağlayıcıları çekilemedi:", err);
      }
    };
    fetchProviders();
  }, []);

  useEffect(() => {
    const fetchNowPlayingIds = async () => {
      try {
        const res = await fetchWithAuth(
          `/api/tmdb?endpoint=/movie/now_playing&region=TR`,
        );
        if (res.ok) {
          const data = await res.json();
          const ids = new Set<number>(
            data.results?.map((m: { id: number }) => m.id) || [],
          );
          setNowPlayingIds(ids);
        }
      } catch (err) {
        console.error("Vizyondakiler listesi çekilemedi:", err);
      }
    };
    fetchNowPlayingIds();
  }, []);

  const isYearRangeActive =
    yearRange.start !== DEFAULT_YEAR_RANGE.start ||
    yearRange.end !== DEFAULT_YEAR_RANGE.end;

  const isDebouncedYearRangeActive =
    debouncedYearRange.start !== DEFAULT_YEAR_RANGE.start ||
    debouncedYearRange.end !== DEFAULT_YEAR_RANGE.end;

  const activeFilterCount = useMemo(() => {
    return [
      selectedMediaType !== "all",
      minRating > 0,
      isYearRangeActive,
      selectedGenreId !== null,
      selectedProviderId !== null,
      exploreMode !== "standard" && activeTab === "explore",
      query.trim() !== "",
    ].filter(Boolean).length;
  }, [
    selectedMediaType,
    minRating,
    isYearRangeActive,
    selectedGenreId,
    selectedProviderId,
    exploreMode,
    activeTab,
    query,
  ]);

  const handleResetFilters = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setSelectedMediaType("all");
    setSelectedGenreId(null);
    setSelectedProviderId(null);
    setYearRange(DEFAULT_YEAR_RANGE);
    setDebouncedYearRange(DEFAULT_YEAR_RANGE);
    setMinRating(0);
    setDebouncedMinRating(0);
    setExploreMode("standard");
    setSortBy(activeTab === "explore" ? "popularity.desc" : "updated_at.desc");
  }, [activeTab]);

  const fetchContent = useCallback(
    async (pageNum: number, isNewSearch = false) => {
      if (activeTab !== "explore" || exploreMode === "personalized") return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentRequestId = ++requestIdRef.current;

      if (pageNum === 1) setIsLoading(true);
      else setIsFetchingMore(true);
      setErrorMessage(null);

      try {
        const proxyParams = new URLSearchParams();

        if (debouncedQuery.trim()) {
          const endpoint =
            selectedMediaType === "movie"
              ? "/search/movie"
              : selectedMediaType === "tv"
                ? "/search/tv"
                : "/search/multi";
          proxyParams.append("endpoint", endpoint);
          proxyParams.append("query", debouncedQuery.trim());
          proxyParams.append("page", pageNum.toString());
        } else if (exploreMode === "now_playing") {
          proxyParams.append("endpoint", "/movie/now_playing");
          proxyParams.append("region", "TR");
          proxyParams.append("page", pageNum.toString());
        } else if (exploreMode === "upcoming") {
          proxyParams.append("endpoint", "/movie/upcoming");
          proxyParams.append("region", "TR");
          proxyParams.append("page", pageNum.toString());
        } else {
          const type = selectedMediaType === "tv" ? "tv" : "movie";

          let minVotes = 0;
          if (sortBy === "vote_average.desc") {
            minVotes = type === "tv" ? 800 : 3000;
          }

          let effectiveSortBy =
            sortBy === "my_rating.desc" ||
            sortBy === "watch_count.desc" ||
            sortBy === "updated_at.desc"
              ? "popularity.desc"
              : sortBy;

          proxyParams.append("endpoint", `/discover/${type}`);
          proxyParams.append("page", pageNum.toString());
          proxyParams.append("sort_by", effectiveSortBy);
          proxyParams.append("vote_count.gte", minVotes.toString());

          if (selectedGenreId) {
            const genreObj = GENRES_LIST.find((g) => g.id === selectedGenreId);
            if (genreObj) {
              const ids = type === "tv" ? genreObj.tvIds : genreObj.movieIds;
              proxyParams.append("with_genres", ids.join("|"));
            }
          }

          if (debouncedMinRating > 0)
            proxyParams.append(
              "vote_average.gte",
              debouncedMinRating.toString(),
            );

          if (selectedProviderId) {
            proxyParams.append(
              "with_watch_providers",
              selectedProviderId.toString(),
            );
            proxyParams.append("watch_region", "TR");
          }

          const dateKey =
            type === "movie" ? "primary_release_date" : "first_air_date";
          if (isDebouncedYearRangeActive) {
            proxyParams.append(
              `${dateKey}.gte`,
              `${debouncedYearRange.start}-01-01`,
            );
            proxyParams.append(
              `${dateKey}.lte`,
              `${debouncedYearRange.end}-12-31`,
            );
          }
        }

        const res = await fetchWithAuth(`/api/tmdb?${proxyParams.toString()}`, {
          signal: controller.signal,
        });

        if (currentRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            errJson.error || "İçerik yüklenirken bir sorun oluştu.",
          );
        }

        const data = await res.json();
        if (currentRequestId !== requestIdRef.current) return;

        const results: MediaItem[] = (data.results || [])
          .filter(
            (item: MediaItem) =>
              item.media_type === "movie" ||
              item.media_type === "tv" ||
              !item.media_type,
          )
          .map((item: MediaItem) => ({
            ...item,
            media_type:
              item.media_type ||
              (exploreMode !== "standard"
                ? "movie"
                : selectedMediaType === "tv"
                  ? "tv"
                  : "movie"),
          }));

        if (pageNum === 1 || isNewSearch) {
          setSearchResults(results);
        } else {
          setSearchResults((prev) => {
            const existingKeys = new Set(
              prev.map((i) => `${i.media_type}_${i.id}`),
            );
            const uniqueNewItems = results.filter(
              (i) => !existingKeys.has(`${i.media_type}_${i.id}`),
            );
            return [...prev, ...uniqueNewItems];
          });
        }

        setHasMore(pageNum < (data.total_pages || 1));
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        if (currentRequestId === requestIdRef.current) {
          const msg = err instanceof Error ? err.message : "Bir hata oluştu.";
          setErrorMessage(msg);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
          setIsFetchingMore(false);
        }
      }
    },
    [
      debouncedQuery,
      exploreMode,
      selectedMediaType,
      sortBy,
      selectedGenreId,
      debouncedMinRating,
      selectedProviderId,
      isDebouncedYearRangeActive,
      debouncedYearRange,
      activeTab,
    ],
  );

  useEffect(() => {
    if (activeTab !== "explore" || exploreMode === "personalized") return;

    let isMounted = true;
    const executeInitialFetch = async () => {
      await fetchContent(1, true);
    };

    if (isMounted) {
      executeInitialFetch();
    }

    return () => {
      isMounted = false;
    };
  }, [
    debouncedQuery,
    selectedMediaType,
    selectedGenreId,
    selectedProviderId,
    debouncedYearRange,
    debouncedMinRating,
    sortBy,
    exploreMode,
    activeTab,
    fetchContent,
  ]);

  return {
    query,
    setQuery,
    searchResults,
    isLoading,
    isFetchingMore,
    errorMessage,
    page,
    setPage,
    hasMore,
    nowPlayingIds,
    providers,
    selectedProviderId,
    setSelectedProviderId,
    exploreMode,
    setExploreMode,
    showFilters,
    setShowFilters,
    selectedMediaType,
    setSelectedMediaType,
    selectedGenreId,
    setSelectedGenreId,
    yearRange,
    setYearRange,
    minRating,
    setMinRating,
    sortBy,
    setSortBy,
    isYearRangeActive,
    activeFilterCount,
    handleResetFilters,
    fetchContent,
  };
}
