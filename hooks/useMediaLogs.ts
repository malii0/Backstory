// hooks/useMediaLogs.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { LogMetadata, MediaItem, MediaDetail } from '@/lib/types';
import { fetchLogsFromSupabase, saveLogToSupabase, deleteLogFromSupabase, parseUpdatedAt } from '@/lib/db';
import { Database } from '@/lib/database.types';

export function useMediaLogs(
  isAuthenticated: boolean,
  showToast: (msg: string, canUndo?: boolean) => void
) {
  const [logs, setLogs] = useState<Record<string, LogMetadata>>({});
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const previousLogsRef = useRef<Record<string, LogMetadata> | null>(null);

  // Stale Cloud Load Guard
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLogs({});
      setIsLogsLoading(false);
      return;
    }

    const currentRequestId = ++fetchRequestIdRef.current;

    const loadCloudLogs = async () => {
      setIsLogsLoading(true);
      const { data } = await fetchLogsFromSupabase();

      if (currentRequestId === fetchRequestIdRef.current) {
        setLogs(data);
        setIsLogsLoading(false);
      }
    };

    loadCloudLogs();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('media_logs_changes')
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'media_logs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new as Database['public']['Tables']['media_logs']['Row'];
              const incomingUpdatedAt = parseUpdatedAt(row.updated_at);

              const incomingLog: LogMetadata = {
                isCompleted: row.is_completed ?? false,
                isWatchlist: row.is_watchlist ?? false,
                rating: row.rating ?? 0,
                watchCount: row.watch_count ?? 0,
                itemData: (row.item_data as unknown) as MediaItem,
                runtime: row.runtime ?? 0,
                updatedAt: incomingUpdatedAt,
              };

              // Realtime Echo Guard: Yerel optimistic state daha güncelse ezilmesini engelle
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
            } else if (payload.eventType === 'DELETE') {
              const deletedKey = (payload.old as { key?: string })?.key;
              if (deletedKey) {
                setLogs((prev) => {
                  const updated = { ...prev };
                  delete updated[deletedKey];
                  return updated;
                });
              }
            }
          }
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

  const getItemKey = useCallback((item: { media_type: string; id: number }) => `${item.media_type}_${item.id}`, []);

  const updateLog = useCallback(async (
    item: MediaItem,
    updates: Partial<LogMetadata>,
    selectedItem?: MediaItem | null,
    detailData?: MediaDetail | null
  ) => {
    const key = getItemKey(item);
    const currentLog = logs[key] || {
      isCompleted: false,
      isWatchlist: false,
      rating: 0,
      watchCount: 0,
    };

    const type = item.media_type || 'movie';
    let calculatedRuntime = currentLog.runtime || 0;

    if (type === 'movie') {
      calculatedRuntime =
        (selectedItem?.id === item.id ? detailData?.runtime : undefined) ||
        (item as unknown as { runtime?: number })?.runtime ||
        currentLog.runtime ||
        0;
    } else if (type === 'tv') {
      const epCount =
        (selectedItem?.id === item.id ? detailData?.number_of_episodes : undefined) ||
        (item as unknown as { number_of_episodes?: number })?.number_of_episodes ||
        0;
      const epTime =
        (selectedItem?.id === item.id ? detailData?.episode_run_time?.[0] : undefined) ||
        (item as unknown as { episode_run_time?: number[] })?.episode_run_time?.[0] ||
        45;
      calculatedRuntime = epCount > 0 ? epCount * epTime : currentLog.runtime || 0;
    }

    const updatedLog: LogMetadata = {
      ...currentLog,
      ...updates,
      itemData: item,
      updatedAt: Date.now(),
      runtime: calculatedRuntime,
    };

    const previousLogsState = { ...logs };
    previousLogsRef.current = previousLogsState;

    if (!updatedLog.isCompleted && !updatedLog.isWatchlist && updatedLog.rating === 0) {
      const newLogs = { ...logs };
      delete newLogs[key];
      setLogs(newLogs);

      const success = await deleteLogFromSupabase(key);
      if (!success) {
        setLogs(previousLogsState);
        previousLogsRef.current = null;
        showToast('Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.');
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
        showToast('Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.');
      }
    }
  }, [logs, getItemKey, showToast]);

  const toggleCompleted = useCallback((item: MediaItem, selectedItem?: MediaItem | null, detailData?: MediaDetail | null) => {
    const key = getItemKey(item);
    const currentLog = logs[key];
    const isComp = currentLog?.isCompleted;
    const title = item.title || item.name;

    updateLog(item, {
      isCompleted: !isComp,
      isWatchlist: !isComp ? false : currentLog?.isWatchlist,
      watchCount: !isComp ? 1 : 0,
    }, selectedItem, detailData);

    showToast(!isComp ? `"${title}" izlendi olarak işaretlendi.` : `"${title}" izlenenlerden çıkarıldı.`, true);
  }, [logs, getItemKey, updateLog, showToast]);

  const toggleWatchlist = useCallback((item: MediaItem, selectedItem?: MediaItem | null, detailData?: MediaDetail | null) => {
    const key = getItemKey(item);
    const currentLog = logs[key];
    const title = item.title || item.name;

    updateLog(item, {
      isWatchlist: !currentLog?.isWatchlist,
    }, selectedItem, detailData);

    showToast(!currentLog?.isWatchlist ? `"${title}" izleneceklere eklendi.` : `"${title}" listeden çıkarıldı.`, true);
  }, [logs, getItemKey, updateLog, showToast]);

  const setRating = useCallback((item: MediaItem, rawRating: number, selectedItem?: MediaItem | null, detailData?: MediaDetail | null) => {
    const key = getItemKey(item);
    const currentLog = logs[key];
    const title = item.title || item.name;

    updateLog(item, {
      rating: rawRating,
      isCompleted: rawRating > 0 ? true : currentLog?.isCompleted,
      isWatchlist: rawRating > 0 ? false : currentLog?.isWatchlist,
      watchCount: rawRating > 0 && !currentLog?.watchCount ? 1 : currentLog?.watchCount,
    }, selectedItem, detailData);

    if (rawRating > 0) {
      showToast(`"${title}" içeriğine ${rawRating} puan verildi.`, true);
    }
  }, [logs, getItemKey, updateLog, showToast]);

  const updateWatchCount = useCallback((item: MediaItem, count: number, selectedItem?: MediaItem | null, detailData?: MediaDetail | null) => {
    const title = item.title || item.name;
    updateLog(item, {
      watchCount: count,
      isCompleted: count > 0,
    }, selectedItem, detailData);

    showToast(`"${title}" ${count} kez izlendi olarak güncellendi.`, true);
  }, [updateLog, showToast]);

  return {
    logs,
    setLogs,
    isLogsLoading,
    previousLogsRef,
    getItemKey,
    updateLog,
    toggleCompleted,
    toggleWatchlist,
    setRating,
    updateWatchCount,
  };
}