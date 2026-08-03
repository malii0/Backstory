export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  media_type: 'movie' | 'tv';
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  popularity?: number;
}

export interface Collection {
  id: number;
  name: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: MediaItem[];
}

export interface WatchProviderInfo {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface WatchProvidersRegion {
  link?: string;
  flatrate?: WatchProviderInfo[];
  rent?: WatchProviderInfo[];
  buy?: WatchProviderInfo[];
}

export interface MediaDetail extends MediaItem {
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  tagline?: string;
  status?: string;
  imdb_id?: string;
  belongs_to_collection?: Collection | null;
  external_ids?: {
    imdb_id?: string;
  };
  created_by?: { id: number; name: string; profile_path?: string | null }[];
  credits?: {
    crew?: { id: number; name: string; job: string; profile_path?: string | null }[];
    cast?: { id: number; name: string; character: string; profile_path: string | null }[];
  };
  recommendations?: {
    results: MediaItem[];
  };
  similar?: {
    results: MediaItem[];
  };
  videos?: {
    results: {
      key: string;
      name: string;
      site: string;
      type: string;
    }[];
  };
  'watch/providers'?: {
    results?: {
      [key: string]: WatchProvidersRegion | undefined;
    };
  };
}

export interface LogMetadata {
  isCompleted: boolean;
  isWatchlist: boolean;
  rating: number; // 0-10 skalası
  watchCount: number;
  itemData?: MediaItem;
  runtime?: number;
  updatedAt?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userProfile?: UserProfile;
  key: string;
  rating: number;
  isCompleted: boolean;
  isWatchlist: boolean;
  itemData: MediaItem;
  updatedAt: number;
}

export type ActiveTab = 'explore' | 'completed' | 'watchlist' | 'stats' | 'feed';