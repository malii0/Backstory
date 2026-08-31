import Redis from "ioredis";

const getRedisClient = (): Redis | null => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  } catch (err) {
    console.warn("Redis başlatılamadı:", err);
    return null;
  }
};

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | null | undefined;
}

export const redis =
  global.redisClient !== undefined ? global.redisClient : getRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.redisClient = redis;
}
