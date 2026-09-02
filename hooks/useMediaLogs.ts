import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { LogMetadata, MediaItem, MediaDetail } from "@/lib/types";
import {
  fetchLogsFromSupabase,
  saveLogToSupabase,
  deleteLogFromSupabase,
  saveBulkLogsToSupabase,
  deleteBulkLogsFromSupabase,
  parseUpdatedAt,
} from "@/lib/db";
import { Database } from "@/lib/database.types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export function useMediaLogs(
  isAuthenticated: boolean,
  showToast: (msg: string) => void,
) {
  const [logs, setLogs] = useState<Record<string, LogMetadata>>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("backstory_offline_logs");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {};
  });

  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasLocalData = !!localStorage.getItem("backstory_offline_logs");
      if (hasLocalData) setIsLogsLoading(false);
    }
  }, []);

  const logsRef = useRef<Record<string, LogMetadata>>(logs);
  const previousLogsRef = useRef<Record<string, LogMetadata> | null>(null);

  useEffect(() => {
    logsRef.current = logs;
    if (typeof window !== "undefined") {
      localStorage.setItem("backstory_offline_logs", JSON.stringify(logs));
    }
  }, [logs]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLogs({});
      if (typeof window !== "undefined") {
        localStorage.removeItem("backstory_offline_logs");
      }
      setIsLogsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const currentRequestId = ++fetchRequestIdRef.current;

    const loadCloudLogs = async () => {
      const { data, error } = await fetchLogsFromSupabase();

      if (currentRequestId === fetchRequestIdRef.current) {
        if (!error && data) {
          setLogs(data);
        }
        setIsLogsLoading(false);
      }
    };

    loadCloudLogs();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const channelId = `media_logs_changes_${user.id}_${Math.random().toString(36).substring(2, 9)}`;

      channel = supabase
        .channel(channelId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "media_logs",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const row =
                payload.new as Database["public"]["Tables"]["media_logs"]["Row"];
              const incomingUpdatedAt = parseUpdatedAt(row.updated_at);

              const incomingLog: LogMetadata = {
                isCompleted: row.is_completed ?? false,
                isWatchlist: row.is_watchlist ?? false,
                rating: row.rating ?? 0,
                watchCount: row.watch_count ?? 0,
                itemData: row.item_data as unknown as MediaItem,
                runtime: row.runtime ?? 0,
                updatedAt: incomingUpdatedAt,
                providers: (row.item_data as Record<string, unknown>)
                  ?.cached_providers as number[] | undefined,
              };

              setLogs((prev) => {
                const existing = prev[row.key];
                if (existing && (existing.updatedAt ?? 0) > incomingUpdatedAt) {
                  return prev;
                }
                return {
                  ...prev,
                  [row.key]: incomingLog,
                };
              });
            } else if (payload.eventType === "DELETE") {
              const deletedKey = (payload.old as { key?: string })?.key;
              if (deletedKey) {
                setLogs((prev) => {
                  const updated = { ...prev };
                  delete updated[deletedKey];
                  return updated;
                });
              }
            }
          },
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAuthenticated]);

  const getItemKey = useCallback(
    (item: { media_type: string; id: number }) =>
      `${item.media_type}_${item.id}`,
    [],
  );

  const updateLog = useCallback(
    async (
      item: MediaItem,
      updates: Partial<LogMetadata>,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
      options?: { silent?: boolean },
    ) => {
      const key = getItemKey(item);
      const currentLog = logsRef.current[key] || {
        isCompleted: false,
        isWatchlist: false,
        rating: 0,
        watchCount: 0,
      };

      const type = item.media_type || "movie";
      let calculatedRuntime = currentLog.runtime || 0;

      if (type === "movie") {
        calculatedRuntime =
          (selectedItem?.id === item.id ? detailData?.runtime : undefined) ||
          (item as unknown as { runtime?: number })?.runtime ||
          currentLog.runtime ||
          0;
      } else if (type === "tv") {
        const epCount =
          (selectedItem?.id === item.id
            ? detailData?.number_of_episodes
            : undefined) ||
          (item as unknown as { number_of_episodes?: number })
            ?.number_of_episodes ||
          0;
        const epTime =
          (selectedItem?.id === item.id
            ? detailData?.episode_run_time?.[0]
            : undefined) ||
          (item as unknown as { episode_run_time?: number[] })
            ?.episode_run_time?.[0] ||
          45;
        calculatedRuntime =
          epCount > 0 ? epCount * epTime : currentLog.runtime || 0;
      }

      let cachedProviders = currentLog.providers;

      if (detailData?.["watch/providers"]?.results?.TR?.flatrate) {
        cachedProviders = detailData["watch/providers"].results.TR.flatrate.map(
          (p) => p.provider_id,
        );
      } else if (
        detailData &&
        !detailData["watch/providers"]?.results?.TR?.flatrate
      ) {
        cachedProviders = [];
      }

      const cleanItem: MediaItem = { ...item };
      delete cleanItem.recommendationSource;
      delete cleanItem.matchScore;

      const updatedLog: LogMetadata = {
        ...currentLog,
        ...updates,
        itemData: cleanItem,
        updatedAt: options?.silent ? currentLog.updatedAt : Date.now(),
        runtime: calculatedRuntime,
        providers: cachedProviders,
      };

      const previousLogsState = { ...logsRef.current };
      previousLogsRef.current = previousLogsState;

      if (
        !updatedLog.isCompleted &&
        !updatedLog.isWatchlist &&
        updatedLog.rating === 0
      ) {
        setLogs((prev) => {
          const newLogs = { ...prev };
          delete newLogs[key];
          return newLogs;
        });

        const success = await deleteLogFromSupabase(key);
        if (!success) {
          setLogs(previousLogsState);
          previousLogsRef.current = null;
          showToast(
            "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
          );
        }
      } else {
        setLogs((prev) => ({
          ...prev,
          [key]: updatedLog,
        }));

        const success = await saveLogToSupabase(key, updatedLog);
        if (!success) {
          setLogs(previousLogsState);
          previousLogsRef.current = null;
          showToast(
            "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
          );
        } else if (cachedProviders === undefined) {
          fetchWithAuth(
            `/api/tmdb?endpoint=/${type}/${item.id}/watch/providers`,
          )
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) {
                const trProviders = data.results?.TR?.flatrate;
                const fetchedProviders = trProviders
                  ? trProviders.map((p: any) => p.provider_id)
                  : [];

                setLogs((prev) => {
                  const curr = prev[key];
                  if (!curr) return prev;
                  const silentlyUpdatedLog = {
                    ...curr,
                    providers: fetchedProviders,
                  };
                  saveLogToSupabase(key, silentlyUpdatedLog);
                  return { ...prev, [key]: silentlyUpdatedLog };
                });
              }
            })
            .catch(() => {});
        }
      }
    },
    [getItemKey, showToast],
  );

  const bulkUpdateRating = useCallback(
    async (items: MediaItem[], rating: number) => {
      const previousState = { ...logsRef.current };
      previousLogsRef.current = previousState;

      const updatedLogs = { ...logsRef.current };
      const keysToDelete: string[] = [];
      const updatesToSave: { key: string; log: LogMetadata }[] = [];

      for (const item of items) {
        const key = getItemKey(item);
        const currentLog = updatedLogs[key] || {
          isCompleted: false,
          isWatchlist: false,
          rating: 0,
          watchCount: 0,
        };

        const cleanItem = { ...item };
        delete cleanItem.recommendationSource;
        delete cleanItem.matchScore;

        const updatedLog = {
          ...currentLog,
          rating,
          isCompleted: rating > 0 ? true : currentLog.isCompleted,
          isWatchlist: rating > 0 ? false : currentLog.isWatchlist,
          watchCount:
            rating > 0 && !currentLog.watchCount ? 1 : currentLog.watchCount,
          itemData: cleanItem,
          updatedAt: Date.now(),
          providers: currentLog.providers || [],
        };

        if (
          !updatedLog.isCompleted &&
          !updatedLog.isWatchlist &&
          updatedLog.rating === 0
        ) {
          delete updatedLogs[key];
          keysToDelete.push(key);
        } else {
          updatedLogs[key] = updatedLog;
          updatesToSave.push({ key, log: updatedLog });
        }
      }

      setLogs(updatedLogs);
      showToast(`${items.length} içerik toplu olarak güncellendi.`);

      if (keysToDelete.length > 0) {
        await deleteBulkLogsFromSupabase(keysToDelete);
      }
      if (updatesToSave.length > 0) {
        await saveBulkLogsToSupabase(updatesToSave);
      }
    },
    [getItemKey, showToast],
  );

  const toggleCompleted = useCallback(
    (
      item: MediaItem,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
    ) => {
      const key = getItemKey(item);
      const currentLog = logsRef.current[key];
      const isComp = currentLog?.isCompleted;
      const title = item.title || item.name;

      updateLog(
        item,
        {
          isCompleted: !isComp,
          isWatchlist: !isComp ? false : currentLog?.isWatchlist,
          watchCount: !isComp ? 1 : 0,
        },
        selectedItem,
        detailData,
      );

      showToast(
        !isComp
          ? `"${title}" izlendi olarak işaretlendi.`
          : `"${title}" izlenenlerden çıkarıldı.`,
      );
    },
    [getItemKey, updateLog, showToast],
  );

  const toggleWatchlist = useCallback(
    (
      item: MediaItem,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
    ) => {
      const key = getItemKey(item);
      const currentLog = logsRef.current[key];
      const title = item.title || item.name;

      updateLog(
        item,
        {
          isWatchlist: !currentLog?.isWatchlist,
        },
        selectedItem,
        detailData,
      );

      showToast(
        !currentLog?.isWatchlist
          ? `"${title}" izleneceklere eklendi.`
          : `"${title}" listeden çıkarıldı.`,
      );
    },
    [getItemKey, updateLog, showToast],
  );

  const setRating = useCallback(
    (
      item: MediaItem,
      rawRating: number,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
    ) => {
      const key = getItemKey(item);
      const currentLog = logsRef.current[key];
      const title = item.title || item.name;

      updateLog(
        item,
        {
          rating: rawRating,
          isCompleted: rawRating > 0 ? true : currentLog?.isCompleted,
          isWatchlist: rawRating > 0 ? false : currentLog?.isWatchlist,
          watchCount:
            rawRating > 0 && !currentLog?.watchCount
              ? 1
              : currentLog?.watchCount,
        },
        selectedItem,
        detailData,
      );

      if (rawRating > 0) {
        showToast(`"${title}" içeriğine ${rawRating} puan verildi.`);
      }
    },
    [getItemKey, updateLog, showToast],
  );

  const updateWatchCount = useCallback(
    (
      item: MediaItem,
      count: number,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
    ) => {
      const title = item.title || item.name;
      updateLog(
        item,
        {
          watchCount: count,
          isCompleted: count > 0,
        },
        selectedItem,
        detailData,
      );

      showToast(`"${title}" ${count} kez izlendi olarak güncellendi.`);
    },
    [updateLog, showToast],
  );

  return {
    logs,
    setLogs,
    isLogsLoading,
    previousLogsRef,
    getItemKey,
    updateLog,
    bulkUpdateRating,
    toggleCompleted,
    toggleWatchlist,
    setRating,
    updateWatchCount,
  };
}
