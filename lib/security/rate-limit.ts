import { Redis } from "@upstash/redis";
import { RateLimiterRedis } from "rate-limiter-flexible";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (!redis) {
  console.warn("[rate-limit] Upstash Redis not configured — rate limiting disabled");
}

export const loginLimiter = redis
  ? new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:login",
      points: Number(process.env.RATE_LIMIT_LOGIN_MAX ?? 5),
      duration: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_SEC ?? 900),
      blockDuration: 900,
    })
  : null;

export const tradeLimiter = redis
  ? new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:trade",
      points: Number(process.env.RATE_LIMIT_TRADE_MAX ?? 60),
      duration: Number(process.env.RATE_LIMIT_TRADE_WINDOW_SEC ?? 60),
    })
  : null;

export const apiLimiter = redis
  ? new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:api",
      points: Number(process.env.RATE_LIMIT_API_MAX ?? 100),
      duration: Number(process.env.RATE_LIMIT_API_WINDOW_SEC ?? 60),
    })
  : null;

export async function consumeLimiter(
  limiter: RateLimiterRedis | null,
  key: string,
  cost: number = 1
): Promise<{ allowed: boolean; remaining: number; resetSec: number }> {
  if (!limiter) return { allowed: true, remaining: 999, resetSec: 60 };
  try {
    const res = await limiter.consume(key, cost);
    return { allowed: true, remaining: res.remainingPoints, resetSec: res.msBeforeNext / 1000 };
  } catch (rlRes: unknown) {
    const r = rlRes as { remainingPoints: number; msBeforeNext: number };
    return { allowed: false, remaining: r.remainingPoints, resetSec: r.msBeforeNext / 1000 };
  }
}

export function getClientIp(req: unknown): string {
  if (!req || typeof req !== "object") return "unknown";
  const headers = (req as { headers?: Record<string, string | string[]> }).headers;
  if (!headers) return "unknown";
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  const realIp = headers["x-real-ip"];
  if (realIp) return Array.isArray(realIp) ? realIp[0] : realIp;
  return "unknown";
}