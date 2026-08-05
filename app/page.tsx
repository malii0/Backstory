'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Search, X, SlidersHorizontal, AlertCircle, RefreshCw, BarChart3, CheckCircle2, RotateCcw, Dices, Sparkles, LogOut, LogIn, Clapperboard, Calendar, Users, Star, EyeOff, ShieldCheck } from 'lucide-react';
import MediaCard from './components/MediaCard';
import DetailDrawer from './components/DetailDrawer';
import SkeletonGrid from './components/SkeletonGrid';
import StatsDashboard from './components/StatsDashboard';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';
import ActivityFeed from './components/ActivityFeed';
import RatingManagerModal from './components/RatingManagerModal';
import { GENRES_LIST } from '@/lib/constants';
import { MediaItem, MediaDetail, LogMetadata, ActiveTab, ActivityFeedItem } from '@/lib/types';
import { getEffectiveWatchCount } from '@/lib/utils';
import { saveLogToSupabase, deleteLogFromSupabase, fetchActivityFeed } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { useMediaLogs } from '@/hooks/useMediaLogs';
import { useTmdbExplore, DEFAULT_YEAR_RANGE } from '@/hooks/useTmdbExplore';
import { useRecommendations } from '@/hooks/useRecommendations';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('explore');
  const [showFab, setShowFab] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRatingManagerOpen, setIsRatingManagerOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [randomPick, setRandomPick] = useState<MediaItem | null>(null);

  const [itemProvidersMap, setItemProvidersMap] = useState<Record<string, number[]>>({});

  // Keşfet sayfasında eklenenleri gizleme durumu
  const [hideLoggedItems, setHideLoggedItems] = useState(false);

  // Toast & Undo State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modalSearchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Custom Hooks
  const auth = useAuth();
  const logsManager = useMediaLogs(auth.isAuthenticated, showToast);
  const explore = useTmdbExplore(activeTab);
  const recommendations = useRecommendations(logsManager.logs);

  // Oturum açmış kullanıcının izlediği ve izleme listesindeki içerik ID'leri
  const userWatchedIds = useMemo(() => {
    const set = new Set<number>();
    Object.values(logsManager.logs).forEach((log) => {
      if (log.isCompleted && log.itemData?.id) {
        set.add(log.itemData.id);
      }
    });
    return set;
  }, [logsManager.logs]);

  const userWatchlistIds = useMemo(() => {
    const set = new Set<number>();
    Object.values(logsManager.logs).forEach((log) => {
      if (log.isWatchlist && log.itemData?.id) {
        set.add(log.itemData.id);
      }
    });
    return set;
  }, [logsManager.logs]);

  // Detay Paneli
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [detailData, setDetailData] = useState<MediaDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const handleCloseDrawer = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleSelectItem = useCallback((item: MediaItem) => {
    setSelectedItem(item);
  }, []);

  const handleToggleCompleted = useCallback((item: MediaItem) => {
    logsManager.toggleCompleted(item, selectedItem, detailData);
  }, [logsManager, selectedItem, detailData]);

  const handleToggleWatchlist = useCallback((item: MediaItem) => {
    logsManager.toggleWatchlist(item, selectedItem, detailData);
  }, [logsManager, selectedItem, detailData]);

  // Sana Özel butonuna tıklama mantığı (Lazy)
  const handleSelectPersonalized = () => {
    explore.setExploreMode('personalized');
    recommendations.fetchRecommendations();
  };

  // Platform Filtresi Seçildiğinde Kontrollü Batch Fetching (N+1 Önlemi)
  useEffect(() => {
    if (activeTab === 'explore' || !explore.selectedProviderId) return;

    const targetLogs = Object.values(logsManager.logs).filter((log) => {
      if (activeTab === 'completed') return log.isCompleted;
      if (activeTab === 'watchlist') return log.isWatchlist;
      return false;
    });

    const missingLogs = targetLogs.filter((log) => {
      if (!log.itemData) return false;
      const key = `${log.itemData.media_type || 'movie'}_${log.itemData.id}`;
      return !itemProvidersMap[key];
    });

    if (missingLogs.length === 0) return;

    let isSubscribed = true;

    const fetchBatch = async () => {
      const batchSize = 5;
      for (let i = 0; i < missingLogs.length; i += batchSize) {
        if (!isSubscribed) break;
        const currentBatch = missingLogs.slice(i, i + batchSize);

        const results = await Promise.all(
          currentBatch.map(async (log) => {
            if (!log.itemData) return null;
            try {
              const type = log.itemData.media_type || 'movie';
              const res = await fetch(`/api/tmdb?endpoint=/${type}/${log.itemData.id}/watch/providers`);
              if (res.ok) {
                const data = await res.json();
                const trProviders = data.results?.TR?.flatrate || [];
                return {
                  key: `${type}_${log.itemData.id}`,
                  providers: trProviders.map((p: { provider_id: number }) => p.provider_id),
                };
              }
            } catch (err) {
              console.error('İçerik platform verisi alınamadı:', err);
            }
            return null;
          })
        );

        if (isSubscribed) {
          setItemProvidersMap((prev) => {
            const nextMap = { ...prev };
            results.forEach((r) => {
              if (r) nextMap[r.key] = r.providers;
            });
            return nextMap;
          });
        }
      }
    };

    fetchBatch();

    return () => {
      isSubscribed = false;
    };
  }, [explore.selectedProviderId, activeTab, logsManager.logs, itemProvidersMap]);

  // Scroll Takibi (FAB Görünürlüğü)
  useEffect(() => {
    const handleScrollFab = () => {
      setShowFab(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScrollFab, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollFab);
  }, []);

  const loadFeed = useCallback(async () => {
    setIsFeedLoading(true);
    const feed = await fetchActivityFeed();
    setActivityFeed(feed);
    setIsFeedLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'feed' && auth.isAuthenticated) {
      loadFeed();
    }
  }, [activeTab, auth.isAuthenticated, loadFeed]);

  useEffect(() => {
    if (selectedItem || randomPick || auth.isAuthModalOpen || isProfileModalOpen || isRatingManagerOpen || isPrivacyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedItem, randomPick, auth.isAuthModalOpen, isProfileModalOpen, isRatingManagerOpen, isPrivacyModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        explore.setShowFilters(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [explore]);

  useEffect(() => {
    if (explore.showFilters) {
      setTimeout(() => {
        modalSearchInputRef.current?.focus();
      }, 150);
    }
  }, [explore.showFilters]);

  // Diff Tabanlı Optimize Edilmiş Undo Mantığı
  const handleUndo = async () => {
    const restored = logsManager.previousLogsRef.current;
    if (!restored) return;

    const currentLogs = logsManager.logs;
    logsManager.setLogs(restored);
    setToastMessage(null);
    logsManager.previousLogsRef.current = null;

    const allKeys = new Set([...Object.keys(restored), ...Object.keys(currentLogs)]);

    for (const key of allKeys) {
      const prevLog = restored[key];
      const currLog = currentLogs[key];

      if (JSON.stringify(prevLog) !== JSON.stringify(currLog)) {
        if (prevLog) {
          await saveLogToSupabase(key, prevLog);
        } else {
          await deleteLogFromSupabase(key);
        }
      }
    }
  };

  // Scroll ile Sayfalama / Infinite Scroll
  const handleScroll = useCallback(() => {
    if (activeTab !== 'explore') return;

    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 500
    ) {
      if (explore.exploreMode === 'personalized') {
        if (!recommendations.isFetchingMore && recommendations.hasMore) {
          recommendations.loadMore();
        }
      } else {
        if (!explore.isLoading && !explore.isFetchingMore && explore.hasMore) {
          const nextPage = explore.page + 1;
          explore.setPage(nextPage);
          explore.fetchContent(nextPage);
        }
      }
    }
  }, [
    activeTab,
    explore.exploreMode,
    explore.isLoading,
    explore.isFetchingMore,
    explore.hasMore,
    explore.page,
    explore.fetchContent,
    explore.setPage,
    recommendations,
  ]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const fetchDetails = useCallback(async () => {
    if (!selectedItem) {
      setDetailData(null);
      setDetailError(null);
      return;
    }

    setIsDetailLoading(true);
    setDetailError(null);
    try {
      const type = selectedItem.media_type || 'movie';
      const proxyParams = new URLSearchParams({
        endpoint: `/${type}/${selectedItem.id}`,
        append_to_response: 'recommendations,similar,videos,watch/providers,external_ids,credits,images',
        include_image_language: 'en,null',
      });

      const res = await fetch(`/api/tmdb?${proxyParams.toString()}`);
      if (!res.ok) throw new Error('Detay verisi alınamadı.');
      const data = await res.json();
      setDetailData({ ...data, media_type: type });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.';
      setDetailError(msg);
    } finally {
      setIsDetailLoading(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const displayedItems = useMemo(() => {
    if (activeTab === 'explore') {
      let results = explore.exploreMode === 'personalized' ? recommendations.recommendations : explore.searchResults;

      if (hideLoggedItems) {
        results = results.filter((item) => {
          const key = logsManager.getItemKey(item);
          const log = logsManager.logs[key];
          return !log?.isCompleted && !log?.isWatchlist;
        });
      }

      return results;
    }

    let filtered = Object.values(logsManager.logs)
      .filter((log) => {
        if (activeTab === 'completed') return log.isCompleted;
        if (activeTab === 'watchlist') return log.isWatchlist;
        return false;
      })
      .map((log) => ({ item: log.itemData, log }))
      .filter((entry): entry is { item: MediaItem; log: LogMetadata } => entry.item !== undefined);

    if (explore.query.trim()) {
      const q = explore.query.toLowerCase();
      filtered = filtered.filter((entry) => {
        const title = (entry.item.title || entry.item.name || '').toLowerCase();
        return title.includes(q);
      });
    }

    if (explore.selectedMediaType !== 'all') {
      filtered = filtered.filter((entry) => entry.item.media_type === explore.selectedMediaType);
    }

    if (explore.minRating > 0) {
      filtered = filtered.filter((entry) => (entry.log?.rating || 0) >= explore.minRating);
    }

    if (explore.isYearRangeActive) {
      filtered = filtered.filter((entry) => {
        const dateStr = entry.item.release_date || entry.item.first_air_date;
        if (!dateStr) return false;
        const year = new Date(dateStr).getFullYear();
        return year >= explore.yearRange.start && year <= explore.yearRange.end;
      });
    }

    if (explore.selectedGenreId !== null) {
      filtered = filtered.filter((entry) => entry.item.genre_ids?.includes(explore.selectedGenreId!));
    }

    if (explore.selectedProviderId !== null) {
      filtered = filtered.filter((entry) => {
        const key = `${entry.item.media_type || 'movie'}_${entry.item.id}`;
        const providers = itemProvidersMap[key];
        return providers ? providers.includes(explore.selectedProviderId!) : true;
      });
    }

    filtered.sort((a, b) => {
      if (explore.sortBy === 'my_rating.desc') {
        return b.log.rating - a.log.rating;
      }
      if (explore.sortBy === 'watch_count.desc') {
        return getEffectiveWatchCount(b.log) - getEffectiveWatchCount(a.log);
      }
      if (explore.sortBy === 'vote_average.desc') {
        return (b.item.vote_average || 0) - (a.item.vote_average || 0);
      }
      return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
    });

    return filtered.map((entry) => entry.item);
  }, [
    activeTab,
    hideLoggedItems,
    explore.exploreMode,
    explore.searchResults,
    recommendations.recommendations,
    explore.query,
    explore.selectedMediaType,
    explore.minRating,
    explore.isYearRangeActive,
    explore.yearRange.start,
    explore.yearRange.end,
    explore.selectedGenreId,
    explore.selectedProviderId,
    explore.sortBy,
    logsManager.logs,
    logsManager.getItemKey,
    itemProvidersMap,
  ]);

  const handlePickRandomFromWatchlist = () => {
    if (displayedItems.length === 0) return;
    const randomIndex = Math.floor(Math.random() * displayedItems.length);
    setRandomPick(displayedItems[randomIndex]);
  };

  const isSearchActive = explore.query.trim().length > 0;

  return (
    <main className="min-h-dvh bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 lg:p-10 relative pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <AuthModal
        isOpen={auth.isAuthModalOpen}
        isInviteMode={auth.isInviteMode}
        onSuccess={(isNewUser) => {
          auth.setIsAuthModalOpen(false);
          auth.setIsInviteMode(false);
          auth.loadProfile();
          if (isNewUser) {
            setIsProfileModalOpen(true);
          }
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        userProfile={auth.userProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdated={auth.loadProfile}
      />

      {isPrivacyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-3xl max-w-md w-full space-y-4 text-left shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsPrivacyModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-accent">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-base font-bold text-foreground">Gizlilik & KVKK Aydınlatması</h3>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <p>
                Bu uygulama kapsamında, hesabınızı oluşturabilmeniz, izleme geçmişinizi kaydedebilmeniz ve arkadaşlarınızla paylaşabilmeniz amacıyla e-posta adresiniz, kullanıcı adınız ve uygulama içi etkileşim verileriniz (izlediğiniz/kaydettiğiniz içerikler ve puanlarınız) Supabase altyapısı üzerinde saklanmaktadır.
              </p>
              <p>
                Kişisel verileriniz hiçbir şekilde 3. taraflarla satılmaz veya pazarlama amacıyla kullanılmaz.
              </p>
              <p>
                Hesabınızı ve saklanan tüm verilerinizi kalıcı olarak sildirmek veya bilgi almak için uygulama geliştiricisi ile iletişime geçebilirsiniz.
              </p>
            </div>

            <button
              onClick={() => setIsPrivacyModalOpen(false)}
              className="w-full bg-accent text-accent-foreground text-xs font-bold py-2.5 rounded-xl transition-all mt-2"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border text-foreground text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-[90vw]">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          {logsManager.previousLogsRef.current && (
            <button
              onClick={handleUndo}
              className="bg-accent/20 hover:bg-accent/30 text-accent px-2.5 py-1 rounded-lg text-[11px] font-bold border border-accent/30 transition-all flex items-center gap-1 flex-shrink-0 ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Geri Al
            </button>
          )}
        </div>
      )}

      {showFab && activeTab !== 'stats' && activeTab !== 'feed' && (
        <button
          onClick={() => explore.setShowFilters(true)}
          className="fixed bottom-6 right-6 z-40 bg-accent text-accent-foreground font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-accent/30 transition-all transform hover:scale-105 active:scale-95 animate-in fade-in zoom-in-90"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-xs">Filtrele & Ara</span>
          {explore.activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-background text-accent text-[10px] rounded-full flex items-center justify-center font-black ml-0.5">
              {explore.activeFilterCount}
            </span>
          )}
        </button>
      )}

      {randomPick && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setRandomPick(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex p-3 rounded-full bg-accent/10 text-accent border border-accent/20">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Rastgele Seçim</p>
              <h3 className="text-lg font-extrabold text-foreground mt-1">
                {randomPick.title || randomPick.name}
              </h3>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {randomPick.overview || 'Açıklama bulunmuyor.'}
            </p>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setSelectedItem(randomPick);
                  setRandomPick(null);
                }}
                className="flex-1 bg-accent text-accent-foreground text-xs font-bold py-2.5 rounded-xl transition-all"
              >
                Detayları Gör
              </button>
              <button
                onClick={handlePickRandomFromWatchlist}
                className="bg-muted hover:bg-muted/80 text-foreground p-2.5 rounded-xl border border-border transition-colors"
                title="Tekrar Zar At"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <header className="sticky top-0 z-40 bg-background/90 border-b border-border -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 px-4 sm:px-6 md:px-8 lg:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center p-1.5">
              <div
                className="w-full h-full bg-accent dark:bg-foreground transition-colors duration-200"
                style={{
                  maskImage: 'url(/logo.svg)',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  maskSize: 'contain',
                  WebkitMaskImage: 'url(/logo.svg)',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  WebkitMaskSize: 'contain'
                }}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">Backstory</h1>

              <div className="flex items-center gap-1.5">
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="This product uses the TMDB API but is not endorsed or certified by TMDB."
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-border hover:border-border/80 transition-all opacity-80 hover:opacity-100"
                >
                  <img
                    src="/tmdb-logo.svg"
                    alt="TMDB Logo"
                    className="h-3.5 w-auto object-contain"
                  />
                </a>

                <button
                  onClick={() => setIsPrivacyModalOpen(true)}
                  title="Gizlilik & KVKK Aydınlatması"
                  className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-accent hover:border-border/80 transition-all flex items-center justify-center"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 bg-card p-1.5 rounded-xl border border-border overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('explore')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'explore'
                    ? 'bg-muted text-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Keşfet
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'completed'
                    ? 'bg-muted text-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Bitirdiklerim
              </button>
              <button
                onClick={() => setActiveTab('watchlist')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'watchlist'
                    ? 'bg-muted text-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                İzlenecekler
              </button>
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'feed'
                    ? 'bg-accent/10 border border-accent/30 text-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Arkadaş Akışı
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'stats'
                    ? 'bg-accent/10 border border-accent/30 text-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                İstatistikler
              </button>
            </nav>

            {auth.isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  title="Profilini Düzenle"
                  className="px-3 py-2 rounded-xl bg-card border border-border text-foreground hover:text-accent transition-colors flex items-center gap-2 text-xs font-semibold flex-shrink-0"
                >
                  <span className="text-sm">{auth.userProfile?.avatarUrl || '🎬'}</span>
                  <span className="hidden sm:inline">{auth.userProfile?.displayName || 'Profil'}</span>
                </button>
                <button
                  onClick={auth.handleLogout}
                  title="Çıkış Yap"
                  className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => auth.setIsAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-accent text-accent-foreground transition-colors flex items-center gap-2 text-xs font-bold flex-shrink-0"
              >
                <LogIn className="w-4 h-4" />
                <span>Giriş Yap</span>
              </button>
            )}
          </div>
        </header>

        {activeTab === 'stats' ? (
          <StatsDashboard
            logs={logsManager.logs}
            onNavigateToExplore={() => setActiveTab('explore')}
            onOpenRatingManager={() => setIsRatingManagerOpen(true)}
          />
        ) : activeTab === 'feed' ? (
          <ActivityFeed
            feedItems={activityFeed}
            isLoading={isFeedLoading}
            userWatchedIds={userWatchedIds}
            userWatchlistIds={userWatchlistIds}
            onSelectItem={handleSelectItem}
            onQuickAddToWatchlist={handleToggleWatchlist}
            onQuickToggleCompleted={handleToggleCompleted}
          />
        ) : (
          <section className="space-y-4">
            {activeTab === 'explore' && !explore.query.trim() && (
              <div className="w-full overflow-x-auto pb-1.5 no-scrollbar">
                <div className="flex items-center gap-2 min-w-max px-1 justify-start md:justify-center">
                  <button
                    onClick={() => explore.setExploreMode('standard')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                      explore.exploreMode === 'standard'
                        ? 'bg-muted border-border text-accent shadow-sm'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tümü (Keşfet)
                  </button>

                  {/* Sana Özel Pill / Butonu */}
                  <button
                    onClick={handleSelectPersonalized}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === 'personalized'
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:text-purple-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Sana Özel
                  </button>

                  <button
                    onClick={() => explore.setExploreMode('now_playing')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === 'now_playing'
                        ? 'bg-accent/10 border-accent/30 text-accent shadow-sm'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clapperboard className="w-3.5 h-3.5" /> Vizyondakiler (TR)
                  </button>
                  <button
                    onClick={() => explore.setExploreMode('upcoming')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === 'upcoming'
                        ? 'bg-accent/10 border-accent/30 text-accent shadow-sm'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Yakında Gelecekler
                  </button>

                  <button
                    onClick={() => setHideLoggedItems(!hideLoggedItems)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      hideLoggedItems
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                        : 'bg-card/60 border-border/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    {hideLoggedItems ? 'Kayıtlılar Gizlendi' : 'Listemdekileri Gizle'}
                  </button>
                </div>
              </div>
            )}

            <div className="relative max-w-2xl mx-auto space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={
                      activeTab === 'explore'
                        ? 'Film veya dizi arayın...'
                        : activeTab === 'completed'
                        ? 'İzlediklerinizde arayın...'
                        : 'Listenizde arayın...'
                    }
                    value={explore.query}
                    onChange={(e) => explore.setQuery(e.target.value)}
                    className="w-full bg-card border border-border rounded-2xl py-3 pl-10 pr-12 sm:pr-16 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-border/80 transition-all shadow-inner"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {explore.query ? (
                      <button
                        onClick={() => explore.setQuery('')}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <kbd className="hidden sm:inline-block bg-background border border-border text-[10px] text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                        ⌘K
                      </kbd>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => explore.setShowFilters(!explore.showFilters)}
                  className={`relative p-3 rounded-2xl border transition-all flex items-center justify-center flex-shrink-0 ${
                    explore.showFilters || explore.activeFilterCount > 0
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {explore.activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {explore.activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {explore.activeFilterCount > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Aktif:</span>

                  {explore.query.trim() !== '' && (
                    <button
                      onClick={() => explore.setQuery('')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>Arama: "{explore.query}"</span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.exploreMode !== 'standard' && activeTab === 'explore' && (
                    <button
                      onClick={() => explore.setExploreMode('standard')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {explore.exploreMode === 'now_playing'
                          ? 'Vizyondakiler'
                          : explore.exploreMode === 'personalized'
                          ? 'Sana Özel'
                          : 'Yakında Gelecekler'}
                      </span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.selectedMediaType !== 'all' && (
                    <button
                      onClick={() => explore.setSelectedMediaType('all')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>{explore.selectedMediaType === 'movie' ? 'Filmler' : 'Diziler'}</span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.selectedProviderId !== null && (
                    <button
                      onClick={() => explore.setSelectedProviderId(null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {explore.providers.find((p) => p.provider_id === explore.selectedProviderId)?.provider_name || 'Platform'}
                      </span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.minRating > 0 && (
                    <button
                      onClick={() => explore.setMinRating(0)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>{explore.minRating.toFixed(1)}+ Puan</span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.isYearRangeActive && (
                    <button
                      onClick={() => explore.setYearRange(DEFAULT_YEAR_RANGE)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {explore.yearRange.start} - {explore.yearRange.end}
                      </span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.selectedGenreId !== null && (
                    <button
                      onClick={() => explore.setSelectedGenreId(null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {GENRES_LIST.find((g) => g.id === explore.selectedGenreId)?.name || 'Kategori'}
                      </span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  <button
                    onClick={explore.handleResetFilters}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-auto whitespace-nowrap"
                  >
                    Temizle
                  </button>
                </div>
              )}

              <div
                className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-200 ${
                  explore.showFilters ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => explore.setShowFilters(false)}
              />

              <div
                className={`fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[75vh] overflow-y-auto no-scrollbar max-w-2xl mx-auto transition-transform duration-300 ease-out will-change-transform ${
                  explore.showFilters ? 'translate-y-0' : 'translate-y-full'
                }`}
              >
                <div className="w-12 h-1 bg-muted-foreground/40 rounded-full mx-auto mb-1 flex-shrink-0" />

                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-accent" />
                    Filtrele & Ara
                  </h3>
                  <button
                    onClick={() => explore.setShowFilters(false)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg bg-muted/60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Arama Metni</label>
                  <div className="relative">
                    <input
                      ref={modalSearchInputRef}
                      type="text"
                      placeholder={
                        activeTab === 'explore'
                          ? 'Film veya dizi arayın...'
                          : activeTab === 'completed'
                          ? 'İzlediklerinizde arayın...'
                          : 'Listenizde arayın...'
                      }
                      value={explore.query}
                      onChange={(e) => explore.setQuery(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl py-2.5 pl-9 pr-8 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent/50 transition-all shadow-inner"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                    {explore.query && (
                      <button
                        onClick={() => explore.setQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Medya Türü</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'movie', label: 'Film' },
                      { id: 'tv', label: 'Dizi' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => explore.setSelectedMediaType(type.id as 'all' | 'movie' | 'tv')}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                          explore.selectedMediaType === type.id
                            ? 'bg-accent/10 border-accent/50 text-accent'
                            : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isSearchActive && activeTab === 'explore' && (
                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-2.5 text-[11px] text-accent flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Arama yaparken Kategori, Platform, Puan ve Yıl filtreleri TMDB aramasına uygulanamaz.</span>
                  </div>
                )}

                <div className={isSearchActive && activeTab === 'explore' ? 'opacity-40 pointer-events-none transition-opacity space-y-4' : 'space-y-4 transition-opacity'}>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Platform (Türkiye)</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                      {explore.providers.map((provider) => {
                        const isSelected = explore.selectedProviderId === provider.provider_id;
                        return (
                          <button
                            key={provider.provider_id}
                            onClick={() => explore.setSelectedProviderId(isSelected ? null : provider.provider_id)}
                            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium border transition-all ${
                              isSelected
                                ? 'bg-accent/10 border-accent/50 text-accent'
                                : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {provider.logo_path && (
                              <img
                                src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                                alt={provider.provider_name}
                                className="w-4 h-4 rounded-md object-cover"
                              />
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
                        {explore.minRating === 0 ? 'Tüm Puanlar' : `${explore.minRating.toFixed(1)}+`}
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
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0.0</span>
                      <span>5.0</span>
                      <span>7.0</span>
                      <span>9.5</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-muted-foreground">Çıkış Yılı Aralığı</label>
                      <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md">
                        {explore.yearRange.start} - {explore.yearRange.end}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Başlangıç: {explore.yearRange.start}</span>
                        <input
                          type="range"
                          min="1950"
                          max={explore.yearRange.end}
                          step="1"
                          value={explore.yearRange.start}
                          onChange={(e) => explore.setYearRange((prev) => ({ ...prev, start: parseInt(e.target.value, 10) }))}
                          className="w-full accent-accent bg-background h-2 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Bitiş: {explore.yearRange.end}</span>
                        <input
                          type="range"
                          min={explore.yearRange.start}
                          max={new Date().getFullYear()}
                          step="1"
                          value={explore.yearRange.end}
                          onChange={(e) => explore.setYearRange((prev) => ({ ...prev, end: parseInt(e.target.value, 10) }))}
                          className="w-full accent-accent bg-background h-2 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Kategori</label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                      <button
                        onClick={() => explore.setSelectedGenreId(null)}
                        className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                          explore.selectedGenreId === null
                            ? 'bg-accent/10 border-accent/50 text-accent'
                            : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Tümü
                      </button>
                      {GENRES_LIST.map((genre) => (
                        <button
                          key={genre.id}
                          onClick={() => explore.setSelectedGenreId(explore.selectedGenreId === genre.id ? null : genre.id)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                            explore.selectedGenreId === genre.id
                              ? 'bg-accent/10 border-accent/50 text-accent'
                              : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Sıralama</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {activeTab === 'explore' ? (
                        [
                          { id: 'popularity.desc', label: 'Popülerlik' },
                          { id: 'release_date.desc', label: 'Yeni Çıkanlar' },
                          { id: 'vote_count.desc', label: 'Çok Oy Alanlar' },
                          { id: 'top_rated', label: 'Top 250' },
                          { id: 'vote_average.desc', label: 'TMDB Puanı' },
                        ].map((sortOption) => (
                          <button
                            key={sortOption.id}
                            onClick={() => explore.setSortBy(sortOption.id as typeof explore.sortBy)}
                            className={`py-2 px-2 text-center rounded-xl text-xs font-medium border transition-all ${
                              explore.sortBy === sortOption.id
                                ? 'bg-accent/10 border-accent/50 text-accent'
                                : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {sortOption.label}
                          </button>
                        ))
                      ) : (
                        [
                          { id: 'updated_at.desc', label: 'Son Eklenenler' },
                          { id: 'my_rating.desc', label: 'Puanım' },
                          { id: 'watch_count.desc', label: 'İzleme Sayısı' },
                          { id: 'vote_average.desc', label: 'TMDB Puanı' },
                        ].map((sortOption) => (
                          <button
                            key={sortOption.id}
                            onClick={() => explore.setSortBy(sortOption.id as typeof explore.sortBy)}
                            className={`py-2 px-2 text-center rounded-xl text-xs font-medium border transition-all ${
                              explore.sortBy === sortOption.id
                                ? 'bg-accent/10 border-accent/50 text-accent'
                                : 'bg-background/60 border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {sortOption.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {explore.activeFilterCount > 0 ? `${explore.activeFilterCount} filtre aktif` : 'Filtre yok'}
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
                      onClick={() => explore.setShowFilters(false)}
                      className="bg-accent text-accent-foreground font-bold text-xs px-4 py-1.5 rounded-xl transition-all"
                    >
                      Tamam
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                {activeTab === 'explore'
                  ? explore.query.trim()
                    ? `'${explore.query}' arama sonuçları`
                    : explore.exploreMode === 'personalized'
                    ? 'Zevkine Göre Seçilenler'
                    : explore.exploreMode === 'now_playing'
                    ? 'Vizyondaki Filmler (Türkiye)'
                    : explore.exploreMode === 'upcoming'
                    ? 'Yakında Vizyona Girecekler'
                    : 'Keşfet'
                  : activeTab === 'completed'
                  ? `Bitirdikleriniz (${displayedItems.length})`
                  : `İzleme Listeniz (${displayedItems.length})`}
              </h2>

              {activeTab === 'explore' && explore.exploreMode === 'personalized' && (
                <button
                  onClick={() => recommendations.fetchRecommendations()}
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Yeniden Hesapla
                </button>
              )}

              {activeTab === 'watchlist' && displayedItems.length > 0 && (
                <button
                  onClick={handlePickRandomFromWatchlist}
                  className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Dices className="w-4 h-4" /> Ne İzlesem?
                </button>
              )}
            </div>

            {(explore.errorMessage || recommendations.error) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-center gap-2 text-red-400 font-medium text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {explore.errorMessage || recommendations.error}
                </div>
                <button
                  onClick={() => {
                    if (explore.exploreMode === 'personalized') {
                      recommendations.fetchRecommendations();
                    } else {
                      explore.fetchContent(1, true);
                    }
                  }}
                  className="bg-muted hover:bg-muted/80 text-foreground text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 mx-auto transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Tekrar Deneyin
                </button>
              </div>
            )}

            {(explore.isLoading && activeTab === 'explore' && explore.exploreMode !== 'personalized') ||
            (recommendations.isLoading && explore.exploreMode === 'personalized') ||
            (logsManager.isLogsLoading && activeTab !== 'explore') ? (
              <SkeletonGrid />
            ) : (
              <>
                {!explore.errorMessage && !recommendations.error && displayedItems.length === 0 && (
                  <div className="text-center py-16 sm:py-20 space-y-3">
                    <p className="text-muted-foreground text-sm">
                      {activeTab === 'explore'
                        ? hideLoggedItems
                          ? 'Görüntülenen tüm içerikler listelerinizde kayıtlı olduğundan gizlendi.'
                          : 'Aradığınız kriterde içerik bulunamadı.'
                        : activeTab === 'completed'
                        ? 'Arama kriterlerinize uyan izlenmiş içerik bulunamadı.'
                        : 'Arama kriterlerinize uyan içerik bulunamadı.'}
                    </p>
                    {activeTab === 'explore' && hideLoggedItems && (
                      <button
                        onClick={() => setHideLoggedItems(false)}
                        className="bg-card hover:bg-muted text-accent text-xs px-4 py-2 rounded-xl border border-border transition-all inline-block"
                      >
                        Kayıtlı İçerikleri Göster
                      </button>
                    )}
                    {activeTab !== 'explore' && explore.activeFilterCount > 0 && (
                      <button
                        onClick={explore.handleResetFilters}
                        className="bg-card hover:bg-muted text-accent text-xs px-4 py-2 rounded-xl border border-border transition-all inline-block"
                      >
                        Filtreleri Temizle
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {displayedItems.map((item) => {
                    const key = logsManager.getItemKey(item);
                    const log = logsManager.logs[key];

                    return (
                      <MediaCard
                        key={key}
                        item={item}
                        log={log}
                        isNowPlaying={item.media_type === 'movie' && explore.nowPlayingIds.has(item.id)}
                        onSelect={handleSelectItem}
                        onToggleCompleted={handleToggleCompleted}
                        onToggleWatchlist={handleToggleWatchlist}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {/* Yükleme ve Bitiş Durumu Metinleri */}
            {((explore.isFetchingMore && explore.exploreMode !== 'personalized') ||
              (recommendations.isFetchingMore && explore.exploreMode === 'personalized')) && (
              <div className="text-center py-6 text-muted-foreground text-xs animate-pulse">
                Daha fazla içerik yükleniyor...
              </div>
            )}

            {activeTab === 'explore' &&
              explore.exploreMode === 'personalized' &&
              !recommendations.isLoading &&
              !recommendations.hasMore &&
              displayedItems.length > 0 && (
                <div className="text-center py-8 text-muted-foreground/60 text-xs font-medium">
                  Sana özel tüm önerileri gördün.
                </div>
              )}
          </section>
        )}

        {selectedItem && (
          <DetailDrawer
            selectedItem={selectedItem}
            detailData={detailData}
            isDetailLoading={isDetailLoading}
            detailError={detailError}
            currentLog={logsManager.logs[logsManager.getItemKey(selectedItem)]}
            onClose={handleCloseDrawer}
            onGenreSelect={(genreId) => {
              explore.setSelectedGenreId(genreId);
              setSelectedItem(null);
              setActiveTab('explore');
            }}
            onSelectItem={handleSelectItem}
            onToggleCompleted={() => handleToggleCompleted(selectedItem)}
            onToggleWatchlist={() => handleToggleWatchlist(selectedItem)}
            onUpdateRating={(rating) => logsManager.setRating(selectedItem, rating, selectedItem, detailData)}
            onUpdateWatchCount={(count) => logsManager.updateWatchCount(selectedItem, count, selectedItem, detailData)}
            onRetry={fetchDetails}
          />
        )}

        <RatingManagerModal
          isOpen={isRatingManagerOpen}
          logs={logsManager.logs}
          onClose={() => setIsRatingManagerOpen(false)}
          onUpdateRating={(item, rating) => logsManager.setRating(item, rating)}
          onSelectItem={handleSelectItem}
        />
      </div>
    </main>
  );
}