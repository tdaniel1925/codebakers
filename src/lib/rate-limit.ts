import { RateLimitError } from './errors';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// In-memory store (works for single instance, use Redis for multi-instance)
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 60_000);
}

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Auth endpoints - stricter limits
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 per 15 min
  signup: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 per hour

  // API endpoints - moderate limits
  api: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
  apiWrite: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 writes per minute

  // Admin endpoints
  admin: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 per minute

  // Webhooks - higher limits
  webhook: { windowMs: 60 * 1000, maxRequests: 200 }, // 200 per minute
} as const;

/**
 * Check rate limit for a given identifier
 * Throws RateLimitError if limit exceeded
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = rateLimitConfigs.api
): { remaining: number; resetAt: number } {
  const key = identifier;
  const now = Date.now();

  let entry = store.get(key);

  // If no entry or expired, create new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, entry);
    return { remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);

  // Check if over limit
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }

  return { remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Create rate limit key from request info
 */
export function getRateLimitKey(
  prefix: string,
  identifier: string | null,
  ip: string | null
): string {
  // Prefer user ID, fall back to IP
  const id = identifier || ip || 'unknown';
  return `${prefix}:${id}`;
}

/**
 * Get IP from request headers (works with proxies like Vercel)
 */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    null
  );
}

/**
 * Automatically apply rate limiting based on route path
 * Call this at the start of any route handler
 */
export function autoRateLimit(
  req: { headers: Headers; url: string },
  userId?: string | null
): void {
  const url = new URL(req.url);
  const path = url.pathname;
  const ip = getClientIp(req.headers);

  // Determine config based on path
  let config: RateLimitConfig;
  let prefix: string;

  if (path.includes('/webhooks/')) {
    config = rateLimitConfigs.webhook;
    prefix = 'webhook';
  } else if (path.includes('/admin/')) {
    config = rateLimitConfigs.admin;
    prefix = 'admin';
  } else if (path.includes('/billing/') || path.includes('/checkout')) {
    config = rateLimitConfigs.apiWrite;
    prefix = 'billing';
  } else {
    config = rateLimitConfigs.api;
    prefix = 'api';
  }

  const key = getRateLimitKey(prefix, userId ?? null, ip);
  checkRateLimit(key, config);
}
