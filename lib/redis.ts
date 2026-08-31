import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

export const redis =
  global.redisClient ||
  (redisUrl
    ? new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      })
    : (null as unknown as Redis));

if (process.env.NODE_ENV !== "production") {
  global.redisClient = redis;
}
