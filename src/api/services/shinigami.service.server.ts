import { client as redis } from "@/common/libs/redis";
import { getEnv } from "@/common/utils/env";
import { ShinigamiService, type CacheAdapter } from "./shinigami.service";

const redisCache: CacheAdapter = {
  async get<T>(key: string) {
    try {
      const cached = await redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      console.warn(`[Redis Cache Error] GET ${key}:`, error);
      return null;
    }
  },
  async set(key, value, ttlSeconds) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      console.warn(`[Redis Cache Error] SET ${key}:`, error);
    }
  },
};

export const serverShinigamiService = new ShinigamiService(
  getEnv().API_URL,
  redisCache
);
