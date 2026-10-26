export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    // The profiles table type was removed manually because the feature was removed.
    Tables: {
      media_logs: {
        Row: {
          user_id: string;
          key: string;
          is_completed: boolean;
          is_watchlist: boolean;
          rating: number;
          watch_count: number;
          item_data: Json;
          runtime: number;
          updated_at: number | string;
        };
        Insert: {
          user_id: string;
          key: string;
          is_completed?: boolean;
          is_watchlist?: boolean;
          rating?: number;
          watch_count?: number;
          item_data: Json;
          runtime?: number;
          updated_at?: number | string;
        };
        Update: Partial<Database["public"]["Tables"]["media_logs"]["Insert"]>;
      };
    };
  };
}
