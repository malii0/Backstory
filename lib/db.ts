import { supabase } from "./supabase";
import { LogMetadata, MediaItem } from "./types";
import { Database } from "./database.types";

type MediaLogRow = Database["public"]["Tables"]["media_logs"]["Row"];

export const parseUpdatedAt = (rawDate: unknown): number => {
  if (typeof rawDate === "number") return rawDate;
  if (typeof rawDate === "string") {
    const num = Number(rawDate);
    if (!isNaN(num)) return num;
    const parsed = new Date(rawDate).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

const mapRowToLog = (row: MediaLogRow): LogMetadata => ({
  isCompleted: row.is_completed ?? false,
  isWatchlist: row.is_watchlist ?? false,
  rating: row.rating ?? 0,
  watchCount: row.watch_count ?? 0,
  itemData: row.item_data as unknown as MediaItem,
  runtime: row.runtime ?? 0,
  updatedAt: parseUpdatedAt(row.updated_at),
  providers: (row.item_data as Record<string, unknown>)?.cached_providers as
    | number[]
    | undefined,
});

const getCurrentUserId = async (): Promise<string | null> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) return null;
  return session?.user?.id ?? null;
};

export const fetchLogsFromSupabase = async (): Promise<{
  data: Record<string, LogMetadata>;
  error: string | null;
}> => {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return { data: {}, error: "no_session" };
    }

    const { data, error } = await supabase
      .from("media_logs")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return {
        data: {},
        error: "Verileriniz buluttan çekilirken bir sorun oluştu.",
      };
    }

    const logsRecord: Record<string, LogMetadata> = {};
    const rows = (data || []) as MediaLogRow[];
    rows.forEach((row) => {
      logsRecord[row.key] = mapRowToLog(row);
    });

    return { data: logsRecord, error: null };
  } catch {
    return { data: {}, error: "Sunucuyla bağlantı kurulamadı." };
  }
};

export const saveLogToSupabase = async (
  key: string,
  log: LogMetadata,
): Promise<boolean> => {
  const userId = await getCurrentUserId();

  if (!userId) {
    return false;
  }

  const itemDataWithProviders = {
    ...(log.itemData || {}),
    cached_providers: log.providers,
  };

  const row: Database["public"]["Tables"]["media_logs"]["Insert"] = {
    user_id: userId,
    key,
    is_completed: log.isCompleted ?? false,
    is_watchlist: log.isWatchlist ?? false,
    rating: log.rating ?? 0,
    watch_count: log.watchCount ?? 0,
    item_data:
      itemDataWithProviders as unknown as Database["public"]["Tables"]["media_logs"]["Insert"]["item_data"],
    runtime: log.runtime ?? 0,
    updated_at: log.updatedAt ?? Date.now(),
  };

  const { error } = await supabase
    .from("media_logs")
    .upsert(row as never, { onConflict: "user_id, key" });

  return !error;
};

export const saveBulkLogsToSupabase = async (
  updates: { key: string; log: LogMetadata }[],
): Promise<boolean> => {
  if (updates.length === 0) return true;

  const userId = await getCurrentUserId();

  if (!userId) {
    return false;
  }

  const rows = updates.map(({ key, log }) => {
    const itemDataWithProviders = {
      ...(log.itemData || {}),
      cached_providers: log.providers,
    };

    return {
      user_id: userId,
      key,
      is_completed: log.isCompleted ?? false,
      is_watchlist: log.isWatchlist ?? false,
      rating: log.rating ?? 0,
      watch_count: log.watchCount ?? 0,
      item_data:
        itemDataWithProviders as unknown as Database["public"]["Tables"]["media_logs"]["Insert"]["item_data"],
      runtime: log.runtime ?? 0,
      updated_at: log.updatedAt ?? Date.now(),
    };
  });

  const { error } = await supabase
    .from("media_logs")
    .upsert(rows as never[], { onConflict: "user_id, key" });

  return !error;
};

export const deleteLogFromSupabase = async (key: string): Promise<boolean> => {
  const userId = await getCurrentUserId();

  if (!userId) {
    return false;
  }

  const { error } = await supabase
    .from("media_logs")
    .delete()
    .eq("key", key)
    .eq("user_id", userId);

  return !error;
};

export const deleteBulkLogsFromSupabase = async (
  keys: string[],
): Promise<boolean> => {
  if (keys.length === 0) return true;

  const userId = await getCurrentUserId();

  if (!userId) {
    return false;
  }

  const { error } = await supabase
    .from("media_logs")
    .delete()
    .eq("user_id", userId)
    .in("key", keys);

  return !error;
};
