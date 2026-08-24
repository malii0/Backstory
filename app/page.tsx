"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  X,
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  Dices,
  Sparkles,
  Clapperboard,
  Calendar,
  EyeOff,
  CheckSquare,
  Square,
  Trash2,
  ListChecks,
} from "lucide-react";

import Header from "./components/Header";
import MediaCard from "./components/MediaCard";
import DetailDrawer from "./components/DetailDrawer";
import SkeletonGrid from "./components/SkeletonGrid";
import StatsDashboard from "./components/StatsDashboard";
import AuthModal from "./components/AuthModal";
import SettingsPage from "./components/SettingsPage";
import ActivityFeed from "./components/ActivityFeed";
import RatingManagerModal from "./components/RatingManagerModal";
import FilterPanel from "./components/FilterPanel";
import PrivacyModal from "./components/PrivacyModal";
import RandomPickModal from "./components/RandomPickModal";
import ToastList, { ToastItemData } from "./components/ToastList";

import { GENRES_LIST } from "@/lib/constants";
import {
  MediaItem,
  MediaDetail,
  LogMetadata,
  ActiveTab,
  ActivityFeedItem,
} from "@/lib/types";
import { getEffectiveWatchCount } from "@/lib/utils";
import {
  saveLogToSupabase,
  saveBulkLogsToSupabase,
  deleteBulkLogsFromSupabase,
  fetchActivityFeed,
} from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useMediaLogs } from "@/hooks/useMediaLogs";
import { useTmdbExplore, DEFAULT_YEAR_RANGE } from "@/hooks/useTmdbExplore";
import { useRecommendations } from "@/hooks/useRecommendations";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Next.js mimarisinde useSearchParams kullanan bileşenlerin Suspense ile sarılması gerekir.
// Tüm page'i sarmak yerine URL okuma işlemini bu küçük bileşene izole ediyoruz.
function TabParamHandler({ onTabMatch }: { onTabMatch: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "profile") {
      onTabMatch();
      // Yönlendirme bittikten sonra URL'deki ?tab=profile kısmını temizle (sayfayı yenilemeden)
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, onTabMatch]);

  return null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("explore");
  const [showFab, setShowFab] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);

  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const lastFeedFetchRef = useRef<number>(0);

  const [isRatingManagerOpen, setIsRatingManagerOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [randomPick, setRandomPick] = useState<MediaItem | null>(null);

  const [hideLoggedItems, setHideLoggedItems] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modalSearchInputRef = useRef<HTMLInputElement | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message: msg }]);
      setTimeout(() => {
        dismissToast(id);
      }, 6000);
    },
    [dismissToast],
  );

  const auth = useAuth();
  const logsManager = useMediaLogs(auth.isAuthenticated, showToast);
  const explore = useTmdbExplore(activeTab);
  const recommendations = useRecommendations(logsManager.logs);

  const isHydratingRef = useRef(false);
  const hydrationStateRef = useRef({
    logs: logsManager.logs,
    updateLog: logsManager.updateLog,
  });

  useEffect(() => {
    hydrationStateRef.current = {
      logs: logsManager.logs,
      updateLog: logsManager.updateLog,
    };
  }, [logsManager.logs, logsManager.updateLog]);

  useEffect(() => {
    if (
      !auth.isAuthenticated ||
      logsManager.isLogsLoading ||
      isHydratingRef.current
    ) {
      return;
    }

    const { logs: currentLogs } = hydrationStateRef.current;
    const logsToHydrate = Object.values(currentLogs).filter(
      (log) => log.providers === undefined && log.itemData,
    );

    if (logsToHydrate.length === 0) return;

    isHydratingRef.current = true;
    let isSubscribed = true;

    const hydrateMissingProviders = async () => {
      for (const log of logsToHydrate) {
        if (!isSubscribed) break;

        try {
          const type = log.itemData!.media_type || "movie";
          const id = log.itemData!.id;
          const res = await fetchWithAuth(
            `/api/tmdb?endpoint=/${type}/${id}/watch/providers`,
          );

          if (res.ok) {
            const data = await res.json();
            const trProviders = data.results?.TR?.flatrate;
            const fetchedProviders = trProviders
              ? trProviders.map((p: { provider_id: number }) => p.provider_id)
              : [];

            if (log.itemData) {
              const { updateLog } = hydrationStateRef.current;
              await updateLog(
                log.itemData,
                { providers: fetchedProviders },
                null,
                null,
                { silent: true },
              );
            }
          }
        } catch (err) {}

        await new Promise((r) => setTimeout(r, 750));
      }
      isHydratingRef.current = false;
    };

    hydrateMissingProviders();

    return () => {
      isSubscribed = false;
      isHydratingRef.current = false;
    };
  }, [auth.isAuthenticated, logsManager.isLogsLoading]);

  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedKeys(new Set());
  }, [activeTab]);

  const userWatchedIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(logsManager.logs).forEach((log) => {
      if (log.isCompleted && log.itemData?.id) {
        set.add(`${log.itemData.media_type || "movie"}_${log.itemData.id}`);
      }
    });
    return set;
  }, [logsManager.logs]);

  const userWatchlistIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(logsManager.logs).forEach((log) => {
      if (log.isWatchlist && log.itemData?.id) {
        set.add(`${log.itemData.media_type || "movie"}_${log.itemData.id}`);
      }
    });
    return set;
  }, [logsManager.logs]);

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [detailData, setDetailData] = useState<MediaDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [prevSelectedItem, setPrevSelectedItem] = useState<MediaItem | null>(
    selectedItem,
  );
  if (selectedItem !== prevSelectedItem) {
    setPrevSelectedItem(selectedItem);
    if (!selectedItem) {
      setDetailData(null);
      setDetailError(null);
      setIsDetailLoading(false);
    }
  }

  const handleCloseDrawer = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleSelectItem = useCallback((item: MediaItem) => {
    setSelectedItem(item);
  }, []);

  const handleCardToggleCompleted = useCallback(
    (item: MediaItem) => {
      logsManager.toggleCompleted(item, null, null);
    },
    [logsManager.toggleCompleted],
  );

  const handleCardToggleWatchlist = useCallback(
    (item: MediaItem) => {
      logsManager.toggleWatchlist(item, null, null);
    },
    [logsManager.toggleWatchlist],
  );

  const handleDrawerToggleCompleted = useCallback(() => {
    if (selectedItem) {
      logsManager.toggleCompleted(selectedItem, selectedItem, detailData);
    }
  }, [logsManager, selectedItem, detailData]);

  const handleDrawerToggleWatchlist = useCallback(() => {
    if (selectedItem) {
      logsManager.toggleWatchlist(selectedItem, selectedItem, detailData);
    }
  }, [logsManager, selectedItem, detailData]);

  const handleDrawerUpdateRating = useCallback(
    (rating: number) => {
      if (selectedItem) {
        logsManager.setRating(selectedItem, rating, selectedItem, detailData);
      }
    },
    [logsManager, selectedItem, detailData],
  );

  const handleDrawerUpdateWatchCount = useCallback(
    (count: number) => {
      if (selectedItem) {
        logsManager.updateWatchCount(
          selectedItem,
          count,
          selectedItem,
          detailData,
        );
      }
    },
    [logsManager, selectedItem, detailData],
  );

  const handleSelectPersonalized = () => {
    explore.setExploreMode("personalized");
    recommendations.fetchRecommendations();
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setShowFab(currentScrollY > 200);

      if (currentScrollY < 50) {
        setIsHeaderHidden(false);
      } else if (currentScrollY > lastScrollY.current) {
        setIsHeaderHidden(true);
      } else if (currentScrollY < lastScrollY.current) {
        setIsHeaderHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (activeTab !== "feed" || !auth.isAuthenticated) return;

    const now = Date.now();
    if (now - lastFeedFetchRef.current < 120000 && activityFeed.length > 0) {
      return;
    }

    let isMounted = true;
    const fetchFeed = async () => {
      setIsFeedLoading(true);
      try {
        const feed = await fetchActivityFeed();
        if (isMounted) {
          setActivityFeed(feed);
          lastFeedFetchRef.current = Date.now();
        }
      } catch (err) {
      } finally {
        if (isMounted) {
          setIsFeedLoading(false);
        }
      }
    };

    fetchFeed();

    return () => {
      isMounted = false;
    };
  }, [activeTab, auth.isAuthenticated, activityFeed.length]);

  useEffect(() => {
    if (
      selectedItem ||
      randomPick ||
      auth.isAuthModalOpen ||
      isRatingManagerOpen ||
      isPrivacyModalOpen
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    selectedItem,
    randomPick,
    auth.isAuthModalOpen,
    isRatingManagerOpen,
    isPrivacyModalOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        explore.setShowFilters(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [explore]);

  useEffect(() => {
    if (explore.showFilters) {
      setTimeout(() => {
        modalSearchInputRef.current?.focus();
      }, 150);
    }
  }, [explore.showFilters]);

  const handleUndo = async () => {
    const restored = logsManager.previousLogsRef.current;
    if (!restored) return;

    const currentLogs = logsManager.logs;
    logsManager.setLogs(restored);
    setToasts([]);
    logsManager.previousLogsRef.current = null;

    const allKeys = new Set([
      ...Object.keys(restored),
      ...Object.keys(currentLogs),
    ]);

    const keysToDelete: string[] = [];
    const updatesToSave: { key: string; log: LogMetadata }[] = [];

    for (const key of allKeys) {
      const prevLog = restored[key];
      const currLog = currentLogs[key];

      if (JSON.stringify(prevLog) !== JSON.stringify(currLog)) {
        if (prevLog) {
          updatesToSave.push({ key, log: prevLog });
        } else {
          keysToDelete.push(key);
        }
      }
    }

    if (keysToDelete.length > 0) {
      await deleteBulkLogsFromSupabase(keysToDelete);
    }
    if (updatesToSave.length > 0) {
      await saveBulkLogsToSupabase(updatesToSave);
    }
  };

  const handleScroll = useCallback(() => {
    if (activeTab !== "explore") return;

    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 500
    ) {
      if (explore.exploreMode === "personalized") {
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
  }, [activeTab, explore, recommendations]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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
      const type = selectedItem.media_type || "movie";
      const proxyParams = new URLSearchParams({
        endpoint: `/${type}/${selectedItem.id}`,
        append_to_response:
          "recommendations,similar,videos,watch/providers,external_ids,credits,images",
        include_image_language: "en,null",
      });

      const res = await fetch(`/api/tmdb?${proxyParams.toString()}`);
      if (!res.ok) throw new Error("Detay verisi alınamadı.");
      const data = await res.json();
      setDetailData({ ...data, media_type: type });
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setIsDetailLoading(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (selectedItem) {
      fetchDetails();
    }
  }, [selectedItem, fetchDetails]);

  const displayedItems = useMemo(() => {
    if (activeTab === "explore") {
      let results =
        explore.exploreMode === "personalized"
          ? recommendations.recommendations
          : explore.searchResults;

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
        if (activeTab === "completed") return log.isCompleted;
        if (activeTab === "watchlist") return log.isWatchlist;
        return false;
      })
      .map((log) => ({ item: log.itemData, log }))
      .filter(
        (entry): entry is { item: MediaItem; log: LogMetadata } =>
          entry.item !== undefined,
      );

    if (explore.query.trim()) {
      const q = explore.query.toLowerCase();
      filtered = filtered.filter((entry) => {
        const title = (entry.item.title || entry.item.name || "").toLowerCase();
        return title.includes(q);
      });
    }

    if (explore.selectedMediaType !== "all") {
      filtered = filtered.filter(
        (entry) => entry.item.media_type === explore.selectedMediaType,
      );
    }

    if (explore.minRating > 0) {
      filtered = filtered.filter(
        (entry) => (entry.log?.rating || 0) >= explore.minRating,
      );
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
      const genreObj = GENRES_LIST.find(
        (g) => g.id === explore.selectedGenreId,
      );
      if (genreObj) {
        filtered = filtered.filter((entry) => {
          const targetIds =
            entry.item.media_type === "tv" ? genreObj.tvIds : genreObj.movieIds;
          return entry.item.genre_ids?.some((id) => targetIds.includes(id));
        });
      }
    }

    if (explore.selectedProviderId !== null) {
      filtered = filtered.filter((entry) => {
        const providers = entry.log?.providers || [];
        return providers.includes(explore.selectedProviderId!);
      });
    }

    filtered.sort((a, b) => {
      if (explore.sortBy === "my_rating.desc") {
        return b.log.rating - a.log.rating;
      }
      if (explore.sortBy === "watch_count.desc") {
        return getEffectiveWatchCount(b.log) - getEffectiveWatchCount(a.log);
      }
      if (explore.sortBy === "vote_average.desc") {
        return (b.item.vote_average || 0) - (a.item.vote_average || 0);
      }
      if (explore.sortBy === "vote_count.desc") {
        return (b.item.vote_count || 0) - (a.item.vote_count || 0);
      }
      return (b.log.updatedAt || 0) - (a.log.updatedAt || 0);
    });

    return filtered.map((entry) => entry.item);
  }, [
    activeTab,
    hideLoggedItems,
    explore.exploreMode,
    explore.searchResults,
    explore.query,
    explore.selectedMediaType,
    explore.minRating,
    explore.isYearRangeActive,
    explore.yearRange.start,
    explore.yearRange.end,
    explore.selectedGenreId,
    explore.selectedProviderId,
    explore.sortBy,
    recommendations.recommendations,
    logsManager.logs,
    logsManager.getItemKey,
  ]);

  const handlePickRandomFromWatchlist = () => {
    if (displayedItems.length === 0) return;
    const randomIndex = Math.floor(Math.random() * displayedItems.length);
    setRandomPick(displayedItems[randomIndex]);
  };

  const toggleSelection = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (
      !window.confirm(
        `${selectedKeys.size} seçili içeriği silmek istediğinize emin misiniz?`,
      )
    )
      return;

    const keysArray = Array.from(selectedKeys);
    const previousState = { ...logsManager.logs };
    logsManager.previousLogsRef.current = previousState;

    const newLogs = { ...previousState };
    keysArray.forEach((k) => delete newLogs[k]);

    logsManager.setLogs(newLogs);
    setSelectedKeys(new Set());
    setIsSelectionMode(false);
    showToast(`${keysArray.length} içerik listeden silindi.`);

    const success = await deleteBulkLogsFromSupabase(keysArray);
    if (!success) {
      logsManager.setLogs(previousState);
      logsManager.previousLogsRef.current = null;
      showToast(
        "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
      );
    }
  };

  const handleBulkRate = (rating: number) => {
    if (selectedKeys.size === 0) return;
    const itemsToUpdate = displayedItems.filter((item) =>
      selectedKeys.has(logsManager.getItemKey(item)),
    );
    logsManager.bulkUpdateRating(itemsToUpdate, rating);
    setSelectedKeys(new Set());
    setIsSelectionMode(false);
  };

  return (
    <main className="min-h-dvh bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 lg:p-10 relative pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <Suspense fallback={null}>
        <TabParamHandler onTabMatch={() => setActiveTab("stats")} />
      </Suspense>

      <AuthModal
        isOpen={auth.isAuthModalOpen}
        isInviteMode={auth.isInviteMode}
        onSuccess={(isNewUser) => {
          auth.setIsAuthModalOpen(false);
          auth.setIsInviteMode(false);
          auth.loadProfile();
          if (isNewUser) {
            setActiveTab("settings");
          }
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }}
      />

      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      <ToastList
        toasts={toasts}
        onUndo={handleUndo}
        canUndo={!!logsManager.previousLogsRef.current}
      />

      {showFab &&
        activeTab !== "stats" &&
        activeTab !== "settings" &&
        activeTab !== "feed" && (
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

      <RandomPickModal
        item={randomPick}
        onClose={() => setRandomPick(null)}
        onSelect={(item) => {
          setSelectedItem(item);
          setRandomPick(null);
        }}
        onReroll={handlePickRandomFromWatchlist}
      />

      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAuthenticated={auth.isAuthenticated}
          userProfile={auth.userProfile}
          onLoginClick={() => auth.setIsAuthModalOpen(true)}
          onLogoutClick={auth.handleLogout}
          onPrivacyClick={() => setIsPrivacyModalOpen(true)}
          isHidden={isHeaderHidden}
        />

        {activeTab === "stats" ? (
          <StatsDashboard
            logs={logsManager.logs}
            onNavigateToExplore={() => setActiveTab("explore")}
            onOpenRatingManager={() => setIsRatingManagerOpen(true)}
            onSelectItem={handleSelectItem}
            onToggleCompleted={handleDrawerToggleCompleted}
            onToggleWatchlist={handleDrawerToggleWatchlist}
            userProfile={auth.userProfile}
          />
        ) : activeTab === "settings" ? (
          <SettingsPage
            userProfile={auth.userProfile}
            onUpdated={auth.loadProfile}
          />
        ) : activeTab === "feed" ? (
          <ActivityFeed
            feedItems={activityFeed}
            isLoading={isFeedLoading}
            userWatchedIds={userWatchedIds}
            userWatchlistIds={userWatchlistIds}
            onSelectItem={handleSelectItem}
            onQuickAddToWatchlist={handleCardToggleWatchlist}
            onQuickToggleCompleted={handleCardToggleCompleted}
          />
        ) : (
          <section className="space-y-4">
            {activeTab === "explore" && !explore.query.trim() && (
              <div className="w-full overflow-x-auto pb-1.5 no-scrollbar">
                <div className="flex items-center gap-2 min-w-max px-1 justify-start md:justify-center">
                  <button
                    onClick={() => explore.setExploreMode("standard")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                      explore.exploreMode === "standard"
                        ? "bg-muted border-border text-accent shadow-sm"
                        : "bg-card/60 border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Tümü (Keşfet)
                  </button>

                  <button
                    onClick={handleSelectPersonalized}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === "personalized"
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm"
                        : "bg-card/60 border-border/80 text-muted-foreground hover:text-purple-400"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Sana Özel
                  </button>

                  <button
                    onClick={() => explore.setExploreMode("now_playing")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === "now_playing"
                        ? "bg-accent/10 border-accent/30 text-accent shadow-sm"
                        : "bg-card/60 border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clapperboard className="w-3.5 h-3.5" /> Vizyondakiler (TR)
                  </button>
                  <button
                    onClick={() => explore.setExploreMode("upcoming")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      explore.exploreMode === "upcoming"
                        ? "bg-accent/10 border-accent/30 text-accent shadow-sm"
                        : "bg-card/60 border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Yakında Gelecekler
                  </button>

                  <button
                    onClick={() => setHideLoggedItems(!hideLoggedItems)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                      hideLoggedItems
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm"
                        : "bg-card/60 border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    {hideLoggedItems
                      ? "Kayıtlılar Gizlendi"
                      : "Listemdekileri Gizle"}
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
                      activeTab === "explore"
                        ? "Film veya dizi arayın..."
                        : activeTab === "completed"
                          ? "İzlediklerinizde arayın..."
                          : "Listenizde arayın..."
                    }
                    value={explore.query}
                    onChange={(e) => explore.setQuery(e.target.value)}
                    className="w-full bg-card border border-border rounded-2xl py-3 pl-10 pr-12 sm:pr-16 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-border/80 transition-all shadow-inner"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {explore.query ? (
                      <button
                        onClick={() => explore.setQuery("")}
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
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
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
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Aktif:
                  </span>

                  {explore.query.trim() !== "" && (
                    <button
                      onClick={() => explore.setQuery("")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>Arama: &quot;{explore.query}&quot;</span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.exploreMode !== "standard" &&
                    activeTab === "explore" && (
                      <button
                        onClick={() => explore.setExploreMode("standard")}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                      >
                        <span>
                          {explore.exploreMode === "now_playing"
                            ? "Vizyondakiler"
                            : explore.exploreMode === "personalized"
                              ? "Sana Özel"
                              : "Yakında Gelecekler"}
                        </span>
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}

                  {explore.selectedMediaType !== "all" && (
                    <button
                      onClick={() => explore.setSelectedMediaType("all")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {explore.selectedMediaType === "movie"
                          ? "Filmler"
                          : "Diziler"}
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
                        {GENRES_LIST.find(
                          (g) => g.id === explore.selectedGenreId,
                        )?.name || "Kategori"}
                      </span>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}

                  {explore.selectedProviderId !== null && (
                    <button
                      onClick={() => explore.setSelectedProviderId(null)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-card border border-border rounded-lg text-xs text-accent transition-colors whitespace-nowrap"
                    >
                      <span>
                        {explore.providers.find(
                          (p) => p.provider_id === explore.selectedProviderId,
                        )?.provider_name || "Platform"}
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

              <FilterPanel
                show={explore.showFilters}
                onClose={() => explore.setShowFilters(false)}
                activeTab={activeTab}
                explore={explore}
                modalSearchInputRef={modalSearchInputRef}
                displayedItemsLength={
                  activeTab === "explore" &&
                  explore.exploreMode !== "personalized"
                    ? explore.totalResults >= 1000
                      ? "1000+"
                      : explore.totalResults
                    : displayedItems.length
                }
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                {activeTab === "explore"
                  ? explore.query.trim()
                    ? `'${explore.query}' arama sonuçları`
                    : explore.exploreMode === "personalized"
                      ? "Zevkine Göre Seçilenler"
                      : explore.exploreMode === "now_playing"
                        ? "Vizyondaki Filmler (Türkiye)"
                        : explore.exploreMode === "upcoming"
                          ? "Yakında Vizyona Girecekler"
                          : "Keşfet"
                  : activeTab === "completed"
                    ? `Bitirdikleriniz (${displayedItems.length})`
                    : `İzleme Listeniz (${displayedItems.length})`}
              </h2>

              <div className="flex items-center gap-2">
                {activeTab === "explore" &&
                  explore.exploreMode === "personalized" && (
                    <button
                      onClick={() =>
                        recommendations.fetchRecommendations(undefined, true)
                      }
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Yeniden Hesapla
                    </button>
                  )}

                {activeTab === "watchlist" &&
                  displayedItems.length > 0 &&
                  !isSelectionMode && (
                    <button
                      onClick={handlePickRandomFromWatchlist}
                      className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Dices className="w-4 h-4" /> Ne İzlesem?
                    </button>
                  )}

                {(activeTab === "completed" || activeTab === "watchlist") &&
                  displayedItems.length > 0 && (
                    <button
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) setSelectedKeys(new Set());
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                        isSelectionMode
                          ? "bg-accent text-accent-foreground"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isSelectionMode ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <ListChecks className="w-4 h-4" />
                      )}
                      {isSelectionMode ? "İptal" : "Seç"}
                    </button>
                  )}
              </div>
            </div>

            {(explore.errorMessage || recommendations.error) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-center gap-2 text-red-400 font-medium text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {explore.errorMessage || recommendations.error}
                </div>
                <button
                  onClick={() => {
                    if (explore.exploreMode === "personalized") {
                      recommendations.fetchRecommendations(undefined, true);
                    } else {
                      explore.fetchContent(1, true);
                    }
                  }}
                  className="bg-muted hover:bg-muted/80 text-foreground text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 mx-auto transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tekrar Deneyin
                </button>
              </div>
            )}

            {(explore.isLoading &&
              activeTab === "explore" &&
              explore.exploreMode !== "personalized") ||
            (recommendations.isLoading &&
              explore.exploreMode === "personalized") ||
            (logsManager.isLogsLoading && activeTab !== "explore") ? (
              <SkeletonGrid />
            ) : (
              <>
                {!explore.errorMessage &&
                  !recommendations.error &&
                  displayedItems.length === 0 && (
                    <div className="text-center py-16 sm:py-20 space-y-3">
                      <p className="text-muted-foreground text-sm">
                        {activeTab === "explore"
                          ? hideLoggedItems
                            ? "Görüntülenen tüm içerikler listelerinizde kayıtlı olduğundan gizlendi."
                            : "Aradığınız kriterde içerik bulunamadı."
                          : activeTab === "completed"
                            ? "Arama kriterlerinize uyan izlenmiş içerik bulunamadı."
                            : "Arama kriterlerinize uyan içerik bulunamadı."}
                      </p>
                      {activeTab === "explore" && hideLoggedItems && (
                        <button
                          onClick={() => setHideLoggedItems(false)}
                          className="bg-card hover:bg-muted text-accent text-xs px-4 py-2 rounded-xl border border-border transition-all inline-block"
                        >
                          Kayıtlı İçerikleri Göster
                        </button>
                      )}
                      {activeTab !== "explore" &&
                        explore.activeFilterCount > 0 && (
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
                      <div key={key} className="relative">
                        <div
                          className={
                            isSelectionMode
                              ? "opacity-90 transition-opacity"
                              : ""
                          }
                        >
                          <MediaCard
                            item={item}
                            log={log}
                            isNowPlaying={
                              item.media_type === "movie" &&
                              explore.nowPlayingIds.has(item.id)
                            }
                            onSelect={handleSelectItem}
                            onToggleCompleted={handleCardToggleCompleted}
                            onToggleWatchlist={handleCardToggleWatchlist}
                          />
                        </div>
                        {isSelectionMode && (
                          <div
                            className={`absolute inset-0 z-20 cursor-pointer rounded-2xl border-2 transition-all ${
                              selectedKeys.has(key)
                                ? "border-accent bg-accent/10"
                                : "border-transparent hover:border-accent/50"
                            }`}
                            onClick={() => toggleSelection(key)}
                          >
                            <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-md rounded-lg p-1 shadow-sm">
                              {selectedKeys.has(key) ? (
                                <CheckSquare className="w-5 h-5 text-accent" />
                              ) : (
                                <Square className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {((explore.isFetchingMore &&
              explore.exploreMode !== "personalized") ||
              (recommendations.isFetchingMore &&
                explore.exploreMode === "personalized")) && (
              <div className="text-center py-6 text-muted-foreground text-xs animate-pulse">
                Daha fazla içerik yükleniyor...
              </div>
            )}

            {activeTab === "explore" &&
              explore.exploreMode === "personalized" &&
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
            onGenreSelect={(tmdbGenreId: number) => {
              const matchedCategory = GENRES_LIST.find(
                (g) =>
                  g.movieIds.includes(tmdbGenreId) ||
                  g.tvIds.includes(tmdbGenreId),
              );
              if (matchedCategory) {
                explore.setSelectedGenreId(matchedCategory.id);
              } else {
                explore.setSelectedGenreId(null);
              }
              setSelectedItem(null);
              setActiveTab("explore");
            }}
            onSelectItem={handleSelectItem}
            onToggleCompleted={handleDrawerToggleCompleted}
            onToggleWatchlist={handleDrawerToggleWatchlist}
            onUpdateRating={handleDrawerUpdateRating}
            onUpdateWatchCount={handleDrawerUpdateWatchCount}
            onRetry={fetchDetails}
          />
        )}

        <RatingManagerModal
          isOpen={isRatingManagerOpen}
          logs={logsManager.logs}
          onClose={() => setIsRatingManagerOpen(false)}
          onUpdateRating={(item, rating) => logsManager.setRating(item, rating)}
          onBulkUpdateRating={(items, rating) =>
            logsManager.bulkUpdateRating(items, rating)
          }
          onSelectItem={handleSelectItem}
        />
      </div>

      {isSelectionMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl p-2.5 flex items-center gap-3 w-max max-w-[95vw] animate-in slide-in-from-bottom-5">
          <span className="text-xs font-bold text-accent whitespace-nowrap bg-accent/10 px-2.5 py-1.5 rounded-lg border border-accent/20">
            {selectedKeys.size} Seçildi
          </span>

          <div className="h-6 w-px bg-border mx-0.5" />

          <select
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val) && val > 0) handleBulkRate(val);
              e.target.value = "";
            }}
            defaultValue=""
            className="bg-background border border-border text-foreground text-xs rounded-xl px-2 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="" disabled>
              Puanla...
            </option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
              <option key={r} value={r}>
                {r} Puan
              </option>
            ))}
          </select>

          <button
            onClick={handleBulkDelete}
            className="text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Sil
          </button>
        </div>
      )}
    </main>
  );
}
