import Redis from "ioredis";

const getRedisClient = (): Redis | null => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 10000,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
      },
    });

    client.on("error", (err) => {
      console.error("Redis client internal error:", err);
    });

    return client;
  } catch (err) {
    console.error("Redis baslatilamadi:", err);
    return null;
  }
};

declare global {
  var redisClient: Redis | null | undefined;
}

export const redis =
  global.redisClient !== undefined ? global.redisClient : getRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.redisClient = redis;
}
