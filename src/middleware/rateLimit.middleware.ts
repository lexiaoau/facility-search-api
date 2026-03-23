import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export class TooManyRequestsError extends AppError {
  constructor(message: string) {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

interface RateLimitWindow {
  count: number;
  windowStart: number;
}

// In-memory store: clientKey (IP) -> window state
const store = new Map<string, RateLimitWindow>();

export interface RateLimitOptions {
  /** Max requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Rate limiting middleware keyed by client IP address.
 * Can be placed before or after authMiddleware.
 *
 * Adds standard rate-limit headers to every response:
 *   X-RateLimit-Limit      – max requests per window
 *   X-RateLimit-Remaining  – requests left in current window
 *   X-RateLimit-Reset      – UTC epoch (seconds) when window resets
 *   Retry-After            – seconds until retry allowed (only on 429)
 */
export function createRateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const { limit, windowMs } = { ...DEFAULT_OPTIONS, ...options };

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const clientKey =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ?? req.ip ?? 'unknown';

    const now = Date.now();
    const entry = store.get(clientKey);

    let windowStart: number;
    let count: number;

    if (!entry || now - entry.windowStart >= windowMs) {
      // Start a fresh window
      windowStart = now;
      count = 1;
    } else {
      windowStart = entry.windowStart;
      count = entry.count + 1;
    }

    store.set(clientKey, { count, windowStart });

    const resetAtMs = windowStart + windowMs;
    const resetAtSec = Math.ceil(resetAtMs / 1000);
    const remaining = Math.max(0, limit - count);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetAtSec);

    if (count > limit) {
      const retryAfterSec = Math.ceil((resetAtMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return next(
        new TooManyRequestsError(`Rate limit exceeded. Try again in ${retryAfterSec} second(s).`),
      );
    }

    next();
  };
}

/** Clears the in-memory store – useful for tests. */
export function clearRateLimitStore(): void {
  store.clear();
}
