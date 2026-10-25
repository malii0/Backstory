import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  LogMetadata,
  MediaItem,
  MediaDetail,
  WatchProviderInfo,
} from "@/lib/types";
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
  const initialLoadRunIdRef = useRef<number>(0);
  const runtimeAttemptedKeysRef = useRef<Set<string>>(new Set());
  const runtimeRepairCountRef = useRef<number>(0);
  const writeQueueRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const keyVersionsRef = useRef<Map<string, number>>(new Map());
  const undoRecordRef = useRef<{
    entries: Array<{ key: string; prev: LogMetadata | null }>;
  } | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  const setUndoRecord = useCallback(
    (
      record: {
        entries: Array<{ key: string; prev: LogMetadata | null }>;
      } | null,
    ) => {
      undoRecordRef.current = record;
      setCanUndo(record !== null && record.entries.length > 0);
    },
    [],
  );

  const incrementKeyVersion = useCallback((key: string): number => {
    const next = (keyVersionsRef.current.get(key) ?? 0) + 1;
    keyVersionsRef.current.set(key, next);
    return next;
  }, []);

  const enqueueKeyWrite = useCallback(
    (key: string, fn: () => Promise<boolean>): Promise<boolean> => {
      const prev = writeQueueRef.current.get(key) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(fn)
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.error(err);
          }
          return false;
        });
      const tracked = next.finally(() => {
        if (writeQueueRef.current.get(key) === tracked) {
          writeQueueRef.current.delete(key);
        }
      });
      writeQueueRef.current.set(key, tracked);
      return next;
    },
    [],
  );

  const enqueueKeysWrite = useCallback(
    (keys: string[], fn: () => Promise<boolean>): Promise<boolean> => {
      const uniqueKeys = Array.from(new Set(keys));
      const prevPromises = uniqueKeys.map(
        (key) => writeQueueRef.current.get(key) ?? Promise.resolve(),
      );
      const next = Promise.all(prevPromises.map((p) => p.catch(() => {})))
        .then(fn)
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.error(err);
          }
          return false;
        });
      const tracked = next.finally(() => {
        for (const key of uniqueKeys) {
          if (writeQueueRef.current.get(key) === tracked) {
            writeQueueRef.current.delete(key);
          }
        }
      });
      for (const key of uniqueKeys) {
        writeQueueRef.current.set(key, tracked);
      }
      return next;
    },
    [],
  );

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

  const reloadFromCloud = useCallback(async (): Promise<{
    latest: boolean;
    ok: boolean;
  }> => {
    const currentRequestId = ++fetchRequestIdRef.current;
    const { data, error } = await fetchLogsFromSupabase();

    if (currentRequestId === fetchRequestIdRef.current) {
      if (!error && data) {
        const inFlightKeys = Array.from(writeQueueRef.current.keys());

        const mergedForRef: Record<string, LogMetadata> = { ...data };
        for (const key of inFlightKeys) {
          if (Object.prototype.hasOwnProperty.call(logsRef.current, key)) {
            mergedForRef[key] = logsRef.current[key];
          } else {
            delete mergedForRef[key];
          }
        }
        logsRef.current = mergedForRef;

        setLogs((prev) => {
          const merged: Record<string, LogMetadata> = { ...data };
          for (const key of inFlightKeys) {
            if (Object.prototype.hasOwnProperty.call(prev, key)) {
              merged[key] = prev[key];
            } else {
              delete merged[key];
            }
          }
          return merged;
        });

        return { latest: true, ok: true };
      }
      return { latest: true, ok: false };
    }
    return { latest: false, ok: false };
  }, []);

  const backfillRuntime = useCallback(
    async (key: string, type: string, id: number): Promise<void> => {
      if (runtimeAttemptedKeysRef.current.has(key)) return;
      runtimeAttemptedKeysRef.current.add(key);

      try {
        const res = await fetchWithAuth(`/api/tmdb?endpoint=/${type}/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;

        let computedRuntime = 0;
        if (type === "movie") {
          computedRuntime = data.runtime || 0;
        } else if (type === "tv") {
          const epCount = data.number_of_episodes || 0;
          const epTime = data.episode_run_time?.[0] || 45;
          computedRuntime = epCount > 0 ? epCount * epTime : 0;
        }

        if (computedRuntime <= 0) return;

        const curr = logsRef.current[key];
        if (!curr || !curr.isCompleted || (curr.runtime ?? 0) > 0) return;

        const updatedLog: LogMetadata = {
          ...curr,
          runtime: computedRuntime,
        };

        incrementKeyVersion(key);
        logsRef.current = {
          ...logsRef.current,
          [key]: updatedLog,
        };

        setLogs((prev) => {
          const existing = prev[key];
          if (
            !existing ||
            !existing.isCompleted ||
            (existing.runtime ?? 0) > 0
          ) {
            return prev;
          }
          return {
            ...prev,
            [key]: {
              ...existing,
              runtime: computedRuntime,
            },
          };
        });

        void enqueueKeyWrite(key, () => saveLogToSupabase(key, updatedLog));
      } catch {}
    },
    [incrementKeyVersion, enqueueKeyWrite],
  );

  const runtimeRepair = useCallback(async (): Promise<void> => {
    const runId = initialLoadRunIdRef.current;

    const candidates = Object.entries(logsRef.current)
      .filter(
        ([key, log]) =>
          log.isCompleted &&
          (log.runtime ?? 0) <= 0 &&
          !runtimeAttemptedKeysRef.current.has(key) &&
          Boolean(log.itemData?.id && log.itemData?.media_type),
      )
      .sort(([, a], [, b]) => {
        const aOrder = a.itemData?.media_type === "tv" ? 0 : 1;
        const bOrder = b.itemData?.media_type === "tv" ? 0 : 1;
        return aOrder - bOrder;
      });

    for (let i = 0; i < candidates.length; i++) {
      if (
        initialLoadRunIdRef.current !== runId ||
        runtimeRepairCountRef.current >= 50
      ) {
        return;
      }

      const [key, log] = candidates[i];
      if (runtimeAttemptedKeysRef.current.has(key)) {
        continue;
      }
      const itemData = log.itemData;
      if (!itemData?.id || !itemData?.media_type) {
        continue;
      }

      runtimeRepairCountRef.current += 1;
      await backfillRuntime(key, itemData.media_type, itemData.id);

      if (
        initialLoadRunIdRef.current !== runId ||
        runtimeRepairCountRef.current >= 50
      ) {
        return;
      }

      if (i < candidates.length - 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 500);
        });
      }
    }
  }, [backfillRuntime]);

  useEffect(() => {
    initialLoadRunIdRef.current += 1;
    if (!isAuthenticated) return;

    const loadCloudLogs = async () => {
      const { latest, ok } = await reloadFromCloud();
      if (latest) {
        setIsLogsLoading(false);
      }
      if (ok) {
        void runtimeRepair();
      }
    };

    loadCloudLogs();
  }, [isAuthenticated, reloadFromCloud, runtimeRepair]);

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
      const prevLog = logsRef.current[key] ? { ...logsRef.current[key] } : null;
      const currentLog = prevLog || {
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

      if (!options?.silent) {
        setUndoRecord({ entries: [{ key, prev: prevLog }] });
      }

      const writeVersion = incrementKeyVersion(key);

      if (
        !updatedLog.isCompleted &&
        !updatedLog.isWatchlist &&
        updatedLog.rating === 0
      ) {
        const nextLogs = { ...logsRef.current };
        delete nextLogs[key];
        logsRef.current = nextLogs;

        setLogs((prev) => {
          const newLogs = { ...prev };
          delete newLogs[key];
          return newLogs;
        });

        const success = await enqueueKeyWrite(key, () =>
          deleteLogFromSupabase(key),
        );
        if (!success) {
          if (keyVersionsRef.current.get(key) === writeVersion) {
            if (prevLog) {
              logsRef.current = { ...logsRef.current, [key]: prevLog };
            } else {
              const restoredLogs = { ...logsRef.current };
              delete restoredLogs[key];
              logsRef.current = restoredLogs;
            }
            setLogs((prev) => {
              const next = { ...prev };
              if (prevLog) {
                next[key] = prevLog;
              } else {
                delete next[key];
              }
              return next;
            });
          }
          if (
            !options?.silent &&
            undoRecordRef.current?.entries.length === 1 &&
            undoRecordRef.current.entries[0].key === key
          ) {
            setUndoRecord(null);
          }
          showToast(
            "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
          );
        }
      } else {
        logsRef.current = { ...logsRef.current, [key]: updatedLog };

        setLogs((prev) => ({
          ...prev,
          [key]: updatedLog,
        }));

        const success = await enqueueKeyWrite(key, () =>
          saveLogToSupabase(key, updatedLog),
        );
        if (!success) {
          if (keyVersionsRef.current.get(key) === writeVersion) {
            if (prevLog) {
              logsRef.current = { ...logsRef.current, [key]: prevLog };
            } else {
              const restoredLogs = { ...logsRef.current };
              delete restoredLogs[key];
              logsRef.current = restoredLogs;
            }
            setLogs((prev) => {
              const next = { ...prev };
              if (prevLog) {
                next[key] = prevLog;
              } else {
                delete next[key];
              }
              return next;
            });
          }
          if (
            !options?.silent &&
            undoRecordRef.current?.entries.length === 1 &&
            undoRecordRef.current.entries[0].key === key
          ) {
            setUndoRecord(null);
          }
          showToast(
            "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
          );
        } else {
          if (cachedProviders === undefined) {
            fetchWithAuth(
              `/api/tmdb?endpoint=/${type}/${item.id}/watch/providers`,
            )
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data) {
                  const trProviders = data.results?.TR?.flatrate;
                  const fetchedProviders = trProviders
                    ? trProviders.map((p: WatchProviderInfo) => p.provider_id)
                    : [];

                  const curr = logsRef.current[key];
                  if (!curr) return;

                  const silentlyUpdatedLog: LogMetadata = {
                    ...curr,
                    providers: fetchedProviders,
                  };

                  incrementKeyVersion(key);
                  logsRef.current = {
                    ...logsRef.current,
                    [key]: silentlyUpdatedLog,
                  };

                  setLogs((prev) => {
                    const existing = prev[key];
                    if (!existing) return prev;
                    return {
                      ...prev,
                      [key]: {
                        ...existing,
                        providers: fetchedProviders,
                      },
                    };
                  });

                  enqueueKeyWrite(key, () =>
                    saveLogToSupabase(key, silentlyUpdatedLog),
                  );
                }
              })
              .catch(() => {});
          }
          if (updatedLog.isCompleted && (updatedLog.runtime ?? 0) <= 0) {
            void backfillRuntime(key, type, item.id);
          }
        }
      }
    },
    [
      getItemKey,
      showToast,
      setUndoRecord,
      incrementKeyVersion,
      enqueueKeyWrite,
      backfillRuntime,
    ],
  );

  const bulkUpdateRating = useCallback(
    async (items: MediaItem[], rating: number) => {
      const updatedLogs = { ...logsRef.current };
      const keysToDelete: string[] = [];
      const updatesToSave: { key: string; log: LogMetadata }[] = [];
      const undoMap = new Map<string, LogMetadata | null>();
      const writeVersions = new Map<string, number>();

      for (const item of items) {
        const key = getItemKey(item);
        if (!undoMap.has(key)) {
          undoMap.set(
            key,
            logsRef.current[key] ? { ...logsRef.current[key] } : null,
          );
        }

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

        const writeVersion = incrementKeyVersion(key);
        writeVersions.set(key, writeVersion);

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

      const bulkUndoRecord = {
        entries: Array.from(undoMap.entries()).map(([key, prev]) => ({
          key,
          prev,
        })),
      };
      setUndoRecord(bulkUndoRecord);

      logsRef.current = updatedLogs;
      setLogs(updatedLogs);

      const keysToSave = updatesToSave.map((u) => u.key);
      const deletePromise =
        keysToDelete.length > 0
          ? enqueueKeysWrite(keysToDelete, () =>
              deleteBulkLogsFromSupabase(keysToDelete),
            )
          : Promise.resolve(true);
      const savePromise =
        updatesToSave.length > 0
          ? enqueueKeysWrite(keysToSave, () =>
              saveBulkLogsToSupabase(updatesToSave),
            )
          : Promise.resolve(true);

      const [deleteSuccess, saveSuccess] = await Promise.all([
        deletePromise,
        savePromise,
      ]);

      if (!deleteSuccess || !saveSuccess) {
        const failedKeys = new Set<string>();
        if (!deleteSuccess) {
          for (const key of keysToDelete) {
            failedKeys.add(key);
          }
        }
        if (!saveSuccess) {
          for (const key of keysToSave) {
            failedKeys.add(key);
          }
        }

        const keysToRestore: string[] = [];
        for (const key of failedKeys) {
          if (keyVersionsRef.current.get(key) === writeVersions.get(key)) {
            keysToRestore.push(key);
          }
        }

        if (keysToRestore.length > 0) {
          const nextLogsRef = { ...logsRef.current };
          for (const key of keysToRestore) {
            const prevVal = undoMap.get(key) ?? null;
            if (prevVal) {
              nextLogsRef[key] = prevVal;
            } else {
              delete nextLogsRef[key];
            }
          }
          logsRef.current = nextLogsRef;

          setLogs((prev) => {
            const next = { ...prev };
            for (const key of keysToRestore) {
              const prevVal = undoMap.get(key) ?? null;
              if (prevVal) {
                next[key] = prevVal;
              } else {
                delete next[key];
              }
            }
            return next;
          });
        }

        if (undoRecordRef.current === bulkUndoRecord) {
          setUndoRecord(null);
        }
        showToast(
          "Bulut senkronizasyonu başarısız oldu. Değişiklik geri alındı.",
        );
        void reloadFromCloud();
      } else {
        showToast(`${items.length} içerik toplu olarak güncellendi.`);
      }
    },
    [
      getItemKey,
      showToast,
      incrementKeyVersion,
      setUndoRecord,
      enqueueKeysWrite,
      reloadFromCloud,
    ],
  );

  const undo = useCallback(async () => {
    const record = undoRecordRef.current;
    if (!record || record.entries.length === 0) return;

    const entries = record.entries;
    setUndoRecord(null);

    const beforeMap = new Map<string, LogMetadata | null>();
    const undoVersions = new Map<string, number>();

    const nextLogs = { ...logsRef.current };
    for (const { key, prev } of entries) {
      if (!beforeMap.has(key)) {
        beforeMap.set(
          key,
          logsRef.current[key] ? { ...logsRef.current[key] } : null,
        );
      }
      const version = incrementKeyVersion(key);
      undoVersions.set(key, version);
      if (prev) {
        nextLogs[key] = prev;
      } else {
        delete nextLogs[key];
      }
    }
    logsRef.current = nextLogs;

    setLogs((prevLogs) => {
      const updated = { ...prevLogs };
      for (const { key, prev } of entries) {
        if (prev) {
          updated[key] = prev;
        } else {
          delete updated[key];
        }
      }
      return updated;
    });

    const results = await Promise.all(
      entries.map(({ key, prev }) =>
        enqueueKeyWrite(key, () =>
          prev ? saveLogToSupabase(key, prev) : deleteLogFromSupabase(key),
        ),
      ),
    );

    if (results.some((ok) => !ok)) {
      const keysToRevert: string[] = [];
      entries.forEach(({ key }, idx) => {
        if (
          !results[idx] &&
          keyVersionsRef.current.get(key) === undoVersions.get(key)
        ) {
          keysToRevert.push(key);
        }
      });

      if (keysToRevert.length > 0) {
        const revertedLogsRef = { ...logsRef.current };
        for (const key of keysToRevert) {
          const beforeVal = beforeMap.get(key) ?? null;
          if (beforeVal) {
            revertedLogsRef[key] = beforeVal;
          } else {
            delete revertedLogsRef[key];
          }
        }
        logsRef.current = revertedLogsRef;

        setLogs((prevLogs) => {
          const updated = { ...prevLogs };
          for (const key of keysToRevert) {
            const beforeVal = beforeMap.get(key) ?? null;
            if (beforeVal) {
              updated[key] = beforeVal;
            } else {
              delete updated[key];
            }
          }
          return updated;
        });
      }

      if (undoRecordRef.current === null) {
        setUndoRecord(record);
      }
      showToast("Geri alma buluta kaydedilemedi.");
      void reloadFromCloud();
    }
  }, [setUndoRecord, incrementKeyVersion, enqueueKeyWrite, reloadFromCloud, showToast]);

  const toggleCompleted = useCallback(
    (
      item: MediaItem,
      selectedItem?: MediaItem | null,
      detailData?: MediaDetail | null,
    ) => {
      const key = getItemKey(item);
      const currentLog = logsRef.current[key];
      const isComp = currentLog?.isCompleted;
      const hadRating = (currentLog?.rating ?? 0) > 0;
      const title = item.title || item.name;

      updateLog(
        item,
        {
          isCompleted: !isComp,
          isWatchlist: !isComp ? false : currentLog?.isWatchlist,
          watchCount: !isComp ? 1 : 0,
          ...(isComp ? { rating: 0 } : {}),
        },
        selectedItem,
        detailData,
      );

      showToast(
        !isComp
          ? `"${title}" izlendi olarak işaretlendi.`
          : hadRating
            ? `"${title}" izlenenlerden çıkarıldı. Puanı da kaldırıldı.`
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
          ...(count <= 0 ? { rating: 0 } : {}),
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
    isLogsLoading,
    canUndo,
    undo,
    getItemKey,
    updateLog,
    bulkUpdateRating,
    toggleCompleted,
    toggleWatchlist,
    setRating,
    updateWatchCount,
  };
}
