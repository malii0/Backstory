import { redis } from "@/lib/redis";

const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
else
  local ttl = redis.call("TTL", KEYS[1])
  if ttl == -1 then
    redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
  end
end
return current
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!redis) {
    throw new Error("Redis is not configured");
  }

  const count = await redis.eval<[number], number>(
    RATE_LIMIT_LUA,
    [key],
    [windowSeconds],
  );

  const numericCount = Number(count);
  return {
    allowed: numericCount <= limit,
    remaining: Math.max(0, limit - numericCount),
  };
}
