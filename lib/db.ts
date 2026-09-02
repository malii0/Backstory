import { supabase } from "./supabase";
import {
  LogMetadata,
  UserProfile,
  ActivityFeedItem,
  MediaItem,
  PublicMemberItem,
} from "./types";
import { Database } from "./database.types";

type MediaLogRow = Database["public"]["Tables"]["media_logs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

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

export const fetchLogsFromSupabase = async (): Promise<{
  data: Record<string, LogMetadata>;
  error: string | null;
}> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: {}, error: null };
    }

    const { data, error } = await supabase
      .from("media_logs")
      .select("*")
      .eq("user_id", user.id);

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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const itemDataWithProviders = {
    ...(log.itemData || {}),
    cached_providers: log.providers,
  };

  const row: Database["public"]["Tables"]["media_logs"]["Insert"] = {
    user_id: user.id,
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const rows = updates.map(({ key, log }) => {
    const itemDataWithProviders = {
      ...(log.itemData || {}),
      cached_providers: log.providers,
    };

    return {
      user_id: user.id,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { error } = await supabase
    .from("media_logs")
    .delete()
    .eq("key", key)
    .eq("user_id", user.id);

  return !error;
};

export const deleteBulkLogsFromSupabase = async (
  keys: string[],
): Promise<boolean> => {
  if (keys.length === 0) return true;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { error } = await supabase
    .from("media_logs")
    .delete()
    .eq("user_id", user.id)
    .in("key", keys);

  return !error;
};

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const profile = data as unknown as ProfileRow;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || "🎬",
    isPublic: profile.is_public ?? false,
  };
};

export const updateUserProfile = async (
  username: string,
  displayName: string,
  avatarUrl: string,
  isPublic: boolean,
): Promise<{ success: boolean; error?: string }> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Kullanıcı oturumu bulunamadı." };
  }

  const cleanUsername = username.trim().toLowerCase();

  const profileRow: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    username: cleanUsername,
    display_name: displayName,
    avatar_url: avatarUrl,
    is_public: isPublic,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(profileRow as never, { onConflict: "id" });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Bu kullanıcı adı zaten alınmış." };
    }
    return { success: false, error: "Güncelleme başarısız oldu." };
  }

  return { success: true };
};

export const fetchActivityFeed = async (
  limit = 30,
): Promise<ActivityFeedItem[]> => {
  const { data: publicProfiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true);

  if (!publicProfiles || publicProfiles.length === 0) return [];

  const profileRows = publicProfiles as unknown as ProfileRow[];
  const publicUserIds = profileRows.map((p) => p.id);
  const profileMap = new Map<string, UserProfile>();

  profileRows.forEach((p) => {
    profileMap.set(p.id, {
      id: p.id,
      username: p.username,
      displayName: p.display_name || p.username,
      avatarUrl: p.avatar_url || "🎬",
      isPublic: true,
    });
  });

  const { data: logs, error: logsError } = await supabase
    .from("media_logs")
    .select("*")
    .in("user_id", publicUserIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (logsError || !logs) return [];

  const mediaLogs = logs as unknown as MediaLogRow[];

  return mediaLogs.map((row) => ({
    id: `${row.user_id}_${row.key}`,
    userId: row.user_id,
    userProfile: profileMap.get(row.user_id),
    key: row.key,
    rating: row.rating ?? 0,
    isCompleted: row.is_completed ?? false,
    isWatchlist: row.is_watchlist ?? false,
    itemData: row.item_data as unknown as MediaItem,
    updatedAt: parseUpdatedAt(row.updated_at),
  }));
};

export const fetchProfileByUsername = async (
  username: string,
): Promise<UserProfile | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("profiles").select("*").eq("username", username);

  if (user) {
    query = query.or(`is_public.eq.true,id.eq.${user.id}`);
  } else {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;

  const profile = data as unknown as ProfileRow;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || "🎬",
    isPublic: profile.is_public ?? false,
  };
};

export const fetchPublicLogs = async (
  userId: string,
): Promise<Record<string, LogMetadata>> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    const { data } = await supabase
      .from("profiles")
      .select("is_public")
      .eq("id", userId)
      .eq("is_public", true)
      .maybeSingle();

    if (!data) return {};
  }

  const { data, error } = await supabase
    .from("media_logs")
    .select("*")
    .eq("user_id", userId);

  if (error) return {};

  const logsRecord: Record<string, LogMetadata> = {};
  const rows = (data || []) as MediaLogRow[];
  rows.forEach((row) => {
    logsRecord[row.key] = mapRowToLog(row);
  });

  return logsRecord;
};

export const fetchPublicMembers = async (): Promise<PublicMemberItem[]> => {
  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_public")
    .eq("is_public", true);

  if (pError || !profiles) return [];

  const profileRows = profiles as unknown as ProfileRow[];
  const memberIds = profileRows.map((p) => p.id);
  if (memberIds.length === 0) return [];

  const { data: logs } = await supabase
    .from("media_logs")
    .select("user_id, is_completed, is_watchlist")
    .in("user_id", memberIds);

  const statsMap = new Map<string, { completed: number; watchlist: number }>();
  ((logs || []) as unknown as MediaLogRow[]).forEach((l) => {
    const curr = statsMap.get(l.user_id) || { completed: 0, watchlist: 0 };
    if (l.is_completed) curr.completed += 1;
    if (l.is_watchlist) curr.watchlist += 1;
    statsMap.set(l.user_id, curr);
  });

  return profileRows.map((p) => {
    const s = statsMap.get(p.id) || { completed: 0, watchlist: 0 };
    return {
      id: p.id,
      username: p.username,
      avatarUrl: p.avatar_url || "🎬",
      completedCount: s.completed,
      watchlistCount: s.watchlist,
    };
  });
};
