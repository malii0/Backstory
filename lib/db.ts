// lib/db.ts
import { supabase } from './supabase';
import { LogMetadata, UserProfile, ActivityFeedItem, MediaItem } from './types';
import { Database } from './database.types';

type MediaLogRow = Database['public']['Tables']['media_logs']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const parseUpdatedAt = (rawDate: unknown): number => {
  if (typeof rawDate === 'number') return rawDate;
  if (typeof rawDate === 'string') {
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
  itemData: (row.item_data as unknown) as MediaItem,
  runtime: row.runtime ?? 0,
  updatedAt: parseUpdatedAt(row.updated_at),
});

export const fetchLogsFromSupabase = async (): Promise<{
  data: Record<string, LogMetadata>;
  error: string | null;
}> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: {}, error: null };
    }

    const { data, error } = await supabase
      .from('media_logs')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase veri çekme hatası:', error);
      return {
        data: {},
        error: 'Verileriniz buluttan çekilirken bir sorun oluştu.',
      };
    }

    const logsRecord: Record<string, LogMetadata> = {};
    const rows = (data || []) as MediaLogRow[];
    rows.forEach((row) => {
      logsRecord[row.key] = mapRowToLog(row);
    });

    return { data: logsRecord, error: null };
  } catch (err: unknown) {
    console.error('Beklenmeyen hata:', err);
    return { data: {}, error: 'Sunucuyla bağlantı kurulamadı.' };
  }
};

export const saveLogToSupabase = async (key: string, log: LogMetadata): Promise<boolean> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Kullanıcı oturumu bulunamadı:', userError);
    return false;
  }

  const row: Database['public']['Tables']['media_logs']['Insert'] = {
    user_id: user.id,
    key,
    is_completed: log.isCompleted ?? false,
    is_watchlist: log.isWatchlist ?? false,
    rating: log.rating ?? 0,
    watch_count: log.watchCount ?? 0,
    item_data: log.itemData as unknown as Database['public']['Tables']['media_logs']['Insert']['item_data'],
    runtime: log.runtime ?? 0,
    updated_at: log.updatedAt ?? Date.now(),
  };

  const { error } = await supabase
    .from('media_logs')
    .upsert(row as never, { onConflict: 'user_id, key' });

  if (error) {
    console.error('Supabase kaydetme hatası:', error);
    return false;
  }
  return true;
};

export const deleteLogFromSupabase = async (key: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error('Silme işlemi için oturum bulunamadı.');
    return false;
  }

  const { error } = await supabase
    .from('media_logs')
    .delete()
    .eq('key', key)
    .eq('user_id', user.id);

  if (error) {
    console.error('Supabase silme hatası:', error);
    return false;
  }
  return true;
};

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  const profile = data as unknown as ProfileRow;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || '🎬',
  };
};

export const updateUserProfile = async (
  displayName: string,
  avatarUrl: string
): Promise<{ success: boolean; error?: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };
  }

  const defaultUsername = (user.email?.split('@')[0] || 'user') + '_' + user.id.slice(0, 4);

  const profileRow: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    username: defaultUsername,
    display_name: displayName,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(profileRow as never, { onConflict: 'id' });

  if (error) {
    console.error('Supabase profil kaydetme hatası:', error.message, error.details);
    return { success: false, error: error.message };
  }

  return { success: true };
};

export const fetchActivityFeed = async (limit = 30): Promise<ActivityFeedItem[]> => {
  const { data: logs, error: logsError } = await supabase
    .from('media_logs')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (logsError || !logs) return [];

  const mediaLogs = logs as unknown as MediaLogRow[];

  const userIds = Array.from(new Set(mediaLogs.map((l) => l.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  const profileMap = new Map<string, UserProfile>();
  const profileRows = (profiles || []) as unknown as ProfileRow[];
  
  profileRows.forEach((p) => {
    profileMap.set(p.id, {
      id: p.id,
      username: p.username,
      displayName: p.display_name || p.username,
      avatarUrl: p.avatar_url || '🎬',
    });
  });

  return mediaLogs.map((row) => ({
    id: `${row.user_id}_${row.key}`,
    userId: row.user_id,
    userProfile: profileMap.get(row.user_id),
    key: row.key,
    rating: row.rating ?? 0,
    isCompleted: row.is_completed ?? false,
    isWatchlist: row.is_watchlist ?? false,
    itemData: (row.item_data as unknown) as MediaItem,
    updatedAt: parseUpdatedAt(row.updated_at),
  }));
};