import Redis from "ioredis";

const getRedisUrl = () => {
  return (
    process.env.REDIS_URL ||
    "redis://:BackstoryRedis2026SecureKey!@89.168.66.114:6379"
  );
};

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

export const redis =
  global.redisClient ||
  new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  global.redisClient = redis;
}
