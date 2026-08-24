"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, Bookmark } from "lucide-react";

import { UserProfile, LogMetadata, MediaItem, MediaDetail } from "@/lib/types";
import { fetchProfileByUsername, fetchPublicLogs } from "@/lib/db";
import MediaCard from "@/app/components/MediaCard";
import DetailDrawer from "@/app/components/DetailDrawer";
import SkeletonGrid from "@/app/components/SkeletonGrid";
import StatsDashboard from "@/app/components/StatsDashboard";
import { useAuth } from "@/hooks/useAuth";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const auth = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<Record<string, LogMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"completed" | "watchlist">(
    "completed",
  );

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [detailData, setDetailData] = useState<MediaDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isAuthLoading) return;

    if (!auth.isAuthenticated) {
      router.push("/");
    } else if (auth.userProfile?.username === username) {
      router.push("/?tab=profile");
    }
  }, [
    auth.isAuthLoading,
    auth.isAuthenticated,
    auth.userProfile,
    username,
    router,
  ]);

  useEffect(() => {
    if (
      !username ||
      auth.isAuthLoading ||
      !auth.isAuthenticated ||
      auth.userProfile?.username === username
    ) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      const p = await fetchProfileByUsername(username);
      if (!p) {
        setError("Kullanıcı bulunamadı veya profil gizli.");
        setLoading(false);
        return;
      }
      setProfile(p);
      const l = await fetchPublicLogs(p.id);
      setLogs(l);
      setLoading(false);
    };

    loadData();
  }, [username, auth.isAuthLoading, auth.isAuthenticated, auth.userProfile]);

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
        append_to_response: "videos,watch/providers,credits",
        include_image_language: "en,null",
      });

      const res = await fetch(`/api/tmdb?${proxyParams.toString()}`);
      if (!res.ok) throw new Error("Detay verisi alınamadı.");
      const data = await res.json();
      setDetailData({ ...data, media_type: type });
    } catch (err: unknown) {
      console.error("Detay yükleme hatası:", err);
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
    const filtered = Object.values(logs)
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

    filtered.sort((a, b) => (b.log.updatedAt || 0) - (a.log.updatedAt || 0));
    return filtered.map((entry) => entry.item);
  }, [activeTab, logs]);

  const totalCompleted = useMemo(
    () => Object.values(logs).filter((l) => l.isCompleted).length,
    [logs],
  );
  const totalWatchlist = useMemo(
    () => Object.values(logs).filter((l) => l.isWatchlist).length,
    [logs],
  );

  if (
    auth.isAuthLoading ||
    loading ||
    !auth.isAuthenticated ||
    auth.userProfile?.username === username
  ) {
    return (
      <main className="min-h-dvh bg-background p-6">
        <SkeletonGrid />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-dvh bg-background p-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Hata</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-bold text-xs"
        >
          Ana Sayfaya Dön
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 relative pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-card hover:bg-muted rounded-xl border border-border text-muted-foreground transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">Geri Dön</span>
          </button>
        </div>

        <StatsDashboard
          logs={logs}
          userProfile={profile}
          isPublicView={true}
          onSelectItem={(i) => setSelectedItem(i)}
        />

        <div className="mt-8 pt-6 border-t border-border/60">
          <h3 className="text-lg font-bold text-foreground mb-4">
            Tüm İçerikler
          </h3>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4">
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "completed"
                  ? "bg-accent/10 border border-accent/30 text-accent shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Bitirdikleri ({totalCompleted})
            </button>
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "watchlist"
                  ? "bg-accent/10 border border-accent/30 text-accent shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              İzleyecekleri ({totalWatchlist})
            </button>
          </div>

          {displayedItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-3xl">
              Bu liste şu an boş.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {displayedItems.map((item) => {
                const key = `${item.media_type}_${item.id}`;
                const log = logs[key];
                return (
                  <MediaCard
                    key={key}
                    item={item}
                    log={log}
                    readOnly={true}
                    onSelect={(i) => setSelectedItem(i)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {selectedItem && (
          <DetailDrawer
            selectedItem={selectedItem}
            detailData={detailData}
            isDetailLoading={isDetailLoading}
            detailError={detailError}
            currentLog={logs[`${selectedItem.media_type}_${selectedItem.id}`]}
            readOnly={true}
            onClose={() => setSelectedItem(null)}
            onSelectItem={(i) => setSelectedItem(i)}
            onRetry={fetchDetails}
          />
        )}
      </div>
    </main>
  );
}
