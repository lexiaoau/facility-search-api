import request from 'supertest';
import { login } from '../utils/auth.js';
import app from '../app.js';
import { clearRateLimitStore } from '../middleware/rateLimit.middleware.js';

let token: string;

beforeAll(async () => {
  const { token: t } = await login('test@test.com', 'password');
  token = t;
});

// Reset the in-memory store before each test so windows don't bleed across cases.
beforeEach(() => {
  clearRateLimitStore();
});

const authHeader = () => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// Rate-limit headers
// ---------------------------------------------------------------------------

describe('Rate-limit response headers', () => {
  it('should include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on success', async () => {
    const res = await request(app).get('/facilities?q=fitness').set(authHeader()).expect(200);

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('X-RateLimit-Limit should equal the configured limit', async () => {
    const res = await request(app).get('/facilities?q=fitness').set(authHeader()).expect(200);

    expect(Number(res.headers['x-ratelimit-limit'])).toBe(100);
  });

  it('X-RateLimit-Remaining should decrement with each request', async () => {
    const res1 = await request(app).get('/facilities?q=fitness').set(authHeader());
    const res2 = await request(app).get('/facilities?q=fitness').set(authHeader());

    const rem1 = Number(res1.headers['x-ratelimit-remaining']);
    const rem2 = Number(res2.headers['x-ratelimit-remaining']);
    expect(rem2).toBe(rem1 - 1);
  });

  it('X-RateLimit-Reset should be a future epoch timestamp in seconds', async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await request(app).get('/facilities?q=fitness').set(authHeader());
    const reset = Number(res.headers['x-ratelimit-reset']);
    expect(reset).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// 429 enforcement
// ---------------------------------------------------------------------------

describe('Rate limit enforcement', () => {
  it('should return 429 when the limit is exceeded', async () => {
    // Exhaust the limit (100 requests).
    // Each verifyToken call in the middleware has a 100–500 ms delay in the
    // mock, so we run them all concurrently to keep the test fast.
    const calls = Array.from({ length: 100 }, () =>
      request(app).get('/facilities?q=fitness').set(authHeader()),
    );
    await Promise.all(calls);

    // The 101st request should be rejected.
    const res = await request(app).get('/facilities?q=fitness').set(authHeader()).expect(429);

    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should include Retry-After header on 429 response', async () => {
    const calls = Array.from({ length: 100 }, () =>
      request(app).get('/facilities?q=fitness').set(authHeader()),
    );
    await Promise.all(calls);

    const res = await request(app).get('/facilities?q=fitness').set(authHeader()).expect(429);

    const retryAfter = Number(res.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('should still return 429 on subsequent requests after limit exceeded', async () => {
    const calls = Array.from({ length: 101 }, () =>
      request(app).get('/facilities?q=fitness').set(authHeader()),
    );
    await Promise.all(calls);

    // Any further request should also be rejected
    await request(app).get('/facilities?q=fitness').set(authHeader()).expect(429);
    await request(app).get('/facilities?q=fitness').set(authHeader()).expect(429);
  });
});

// ---------------------------------------------------------------------------
// Auth still required before rate limiting
// ---------------------------------------------------------------------------

describe('Rate limiting does not bypass auth', () => {
  it('should still return 401 for unauthenticated requests', async () => {
    await request(app).get('/facilities?q=fitness').expect(401);
  });

  it('should return 401 for invalid token regardless of rate limit state', async () => {
    await request(app)
      .get('/facilities?q=fitness')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
});
