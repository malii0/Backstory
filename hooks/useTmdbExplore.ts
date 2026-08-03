// hooks/useTmdbExplore.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MediaItem, ActiveTab } from '@/lib/types';

export type YearRange = { start: number; end: number };
export type ExploreMode = 'standard' | 'now_playing' | 'upcoming';
export type WatchProvider = { provider_id: number; provider_name: string; logo_path: string };

export const DEFAULT_YEAR_RANGE: YearRange = { start: 1950, end: new Date().getFullYear() };

export function useTmdbExplore(activeTab: ActiveTab) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Race condition & Network Abort Guard
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [nowPlayingIds, setNowPlayingIds] = useState<Set<number>>(new Set());
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [exploreMode, setExploreMode] = useState<ExploreMode>('standard');

  const [showFilters, setShowFilters] = useState(false);
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [yearRange, setYearRange] = useState<YearRange>(DEFAULT_YEAR_RANGE);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<
    | 'popularity.desc'
    | 'release_date.desc'
    | 'vote_count.desc'
    | 'vote_average.desc'
    | 'top_rated'
    | 'my_rating.desc'
    | 'watch_count.desc'
    | 'updated_at.desc'
  >('popularity.desc');

  // Metin araması için Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Tab değişiminde sıralama mantığını koruma
  useEffect(() => {
    if (activeTab !== 'explore') {
      setExploreMode('standard');
      if (sortBy === 'popularity.desc' || sortBy === 'release_date.desc' || sortBy === 'vote_count.desc' || sortBy === 'top_rated') {
        setSortBy('updated_at.desc');
      }
    } else {
      if (sortBy === 'updated_at.desc' || sortBy === 'my_rating.desc' || sortBy === 'watch_count.desc') {
        setSortBy('popularity.desc');
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/tmdb?endpoint=/watch/providers/movie&watch_region=TR');
        if (res.ok) {
          const data = await res.json();
          setProviders((data.results || []).slice(0, 12));
        }
      } catch (err) {
        console.error('Platform sağlayıcıları çekilemedi:', err);
      }
    };
    fetchProviders();
  }, []);

  useEffect(() => {
    const fetchNowPlayingIds = async () => {
      try {
        const res = await fetch(`/api/tmdb?endpoint=/movie/now_playing&region=TR`);
        if (res.ok) {
          const data = await res.json();
          const ids = new Set<number>(data.results?.map((m: { id: number }) => m.id) || []);
          setNowPlayingIds(ids);
        }
      } catch (err) {
        console.error('Vizyondakiler listesi çekilemedi:', err);
      }
    };
    fetchNowPlayingIds();
  }, []);

  const isYearRangeActive = yearRange.start !== DEFAULT_YEAR_RANGE.start || yearRange.end !== DEFAULT_YEAR_RANGE.end;

  const activeFilterCount = useMemo(() => {
    return [
      selectedMediaType !== 'all',
      minRating > 0,
      isYearRangeActive,
      selectedGenreId !== null,
      selectedProviderId !== null,
      exploreMode !== 'standard' && activeTab === 'explore',
      query.trim() !== '',
    ].filter(Boolean).length;
  }, [selectedMediaType, minRating, isYearRangeActive, selectedGenreId, selectedProviderId, exploreMode, activeTab, query]);

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedMediaType('all');
    setSelectedGenreId(null);
    setSelectedProviderId(null);
    setYearRange(DEFAULT_YEAR_RANGE);
    setMinRating(0);
    setExploreMode('standard');
    setSortBy(activeTab === 'explore' ? 'popularity.desc' : 'updated_at.desc');
  }, [activeTab]);

  const fetchContent = useCallback(async (pageNum: number, isNewSearch = false) => {
    if (activeTab !== 'explore') return;

    // Önceki isteği ağ seviyesinde iptal et
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
        const endpoint = selectedMediaType === 'movie' ? '/search/movie' : selectedMediaType === 'tv' ? '/search/tv' : '/search/multi';
        proxyParams.append('endpoint', endpoint);
        proxyParams.append('query', debouncedQuery.trim());
        proxyParams.append('page', pageNum.toString());
      } else if (exploreMode === 'now_playing') {
        proxyParams.append('endpoint', '/movie/now_playing');
        proxyParams.append('region', 'TR');
        proxyParams.append('page', pageNum.toString());
      } else if (exploreMode === 'upcoming') {
        proxyParams.append('endpoint', '/movie/upcoming');
        proxyParams.append('region', 'TR');
        proxyParams.append('page', pageNum.toString());
      } else {
        const type = selectedMediaType === 'tv' ? 'tv' : 'movie';
        let minVotes = 0;
        let effectiveSortBy =
          sortBy === 'my_rating.desc' || sortBy === 'watch_count.desc' || sortBy === 'updated_at.desc'
            ? 'popularity.desc'
            : sortBy;

        if (sortBy === 'top_rated') {
          minVotes = 10000;
          effectiveSortBy = 'vote_average.desc';
        } else if (sortBy === 'vote_average.desc') {
          minVotes = 3000;
        }

        proxyParams.append('endpoint', `/discover/${type}`);
        proxyParams.append('page', pageNum.toString());
        proxyParams.append('sort_by', effectiveSortBy);
        proxyParams.append('vote_count.gte', minVotes.toString());

        if (selectedGenreId) proxyParams.append('with_genres', selectedGenreId.toString());
        if (minRating > 0) proxyParams.append('vote_average.gte', minRating.toString());

        if (selectedProviderId) {
          proxyParams.append('with_watch_providers', selectedProviderId.toString());
          proxyParams.append('watch_region', 'TR');
        }

        const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
        if (isYearRangeActive) {
          proxyParams.append(`${dateKey}.gte`, `${yearRange.start}-01-01`);
          proxyParams.append(`${dateKey}.lte`, `${yearRange.end}-12-31`);
        }
      }

      const res = await fetch(`/api/tmdb?${proxyParams.toString()}`, {
        signal: controller.signal,
      });
      
      if (currentRequestId !== requestIdRef.current) return;

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'İçerik yüklenirken bir sorun oluştu.');
      }

      const data = await res.json();
      if (currentRequestId !== requestIdRef.current) return;

      let results: MediaItem[] = (data.results || [])
        .filter((item: MediaItem) => item.media_type === 'movie' || item.media_type === 'tv' || !item.media_type)
        .map((item: MediaItem) => ({
          ...item,
          media_type: item.media_type || (exploreMode !== 'standard' ? 'movie' : selectedMediaType === 'tv' ? 'tv' : 'movie'),
        }));

      if (pageNum === 1 || isNewSearch) {
        setSearchResults(results);
      } else {
        setSearchResults((prev) => {
          const existingKeys = new Set(prev.map((i) => `${i.media_type}_${i.id}`));
          const uniqueNewItems = results.filter((i) => !existingKeys.has(`${i.media_type}_${i.id}`));
          return [...prev, ...uniqueNewItems];
        });
      }

      setHasMore(pageNum < (data.total_pages || 1));
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      if (currentRequestId === requestIdRef.current) {
        const msg = err instanceof Error ? err.message : 'Bir hata oluştu.';
        setErrorMessage(msg);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, [debouncedQuery, exploreMode, selectedMediaType, sortBy, selectedGenreId, minRating, selectedProviderId, isYearRangeActive, yearRange, activeTab]);

  // Arama metni ve filtreler değiştiğinde tetikleme
  useEffect(() => {
    if (activeTab !== 'explore') return;
    setPage(1);
    fetchContent(1, true);
  }, [debouncedQuery, selectedMediaType, selectedGenreId, selectedProviderId, yearRange, minRating, sortBy, exploreMode, activeTab, fetchContent]);

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