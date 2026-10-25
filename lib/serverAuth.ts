import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

interface CacheEntry {
  userId: string;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const MAX_TTL_MS = 60_000;
const tokenCache = new Map<string, CacheEntry>();

let supabaseServerClient: ReturnType<typeof createClient> | null = null;

function getSupabaseServerClient() {
  if (supabaseServerClient) return supabaseServerClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseServerClient;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function verifyServerAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const now = Date.now();
  const key = hashToken(token);
  const cached = tokenCache.get(key);

  if (cached) {
    if (now < cached.expiresAt) {
      return cached.userId;
    }
    tokenCache.delete(key);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return null;
  }

  try {
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return null;
    }

    const userId = String(data.claims.sub);
    const tokenExpMs =
      typeof data.claims.exp === "number"
        ? data.claims.exp * 1000
        : now + MAX_TTL_MS;
    const expiresAt = Math.min(now + MAX_TTL_MS, tokenExpMs);

    if (expiresAt > now) {
      if (tokenCache.size >= MAX_CACHE_SIZE) {
        for (const [k, v] of tokenCache.entries()) {
          if (now >= v.expiresAt) {
            tokenCache.delete(k);
          }
        }
        if (tokenCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = tokenCache.keys().next().value;
          if (oldestKey !== undefined) {
            tokenCache.delete(oldestKey);
          }
        }
      }
      tokenCache.set(key, { userId, expiresAt });
    }

    return userId;
  } catch {
    return null;
  }
}
