# Facility Search API

A RESTful API for searching and retrieving fitness facilities. Built with Node.js, Express, and TypeScript.

## Purpose

This API allows clients to search facilities by keyword and filter by amenities, with support for pagination. It was developed as a coding challenge with a 2-hour time limit.

## Project Structure

```
src/
├── app.ts                        # Express app setup and middleware wiring
├── server.ts                     # HTTP server entry point
├── config/
│   └── constants.ts              # Shared constants (pagination limits etc.)
├── controllers/
│   └── facilities.controller.ts  # Request parsing and response formatting
├── middleware/
│   ├── auth.middleware.ts         # Bearer token authentication
│   ├── error.middleware.ts        # Centralised error handler
│   └── rateLimit.middleware.ts    # Per-IP rate limiting (in-memory)
├── models/
│   └── facility.ts               # Facility entity type
├── repositories/
│   └── facilities.repository.ts  # Data loading and n-gram search index
├── routes/
│   ├── docs.route.ts             # Swagger UI + OpenAPI spec endpoint
│   └── facilities.route.ts       # /facilities route definitions
├── services/
│   └── facilities.service.ts     # Business logic + TTL caching layer
├── types/
│   ├── facility.ts               # API-level types (search result, DTOs)
│   └── pagination.ts             # Pagination types
├── utils/
│   ├── auth.ts                   # Mock JWT login/verify utilities
│   ├── cache.ts                  # Generic in-memory TTL cache
│   └── errors.ts                 # Typed application error classes
└── __tests__/
    ├── facilities.integration.test.ts
    ├── facilities.performance.test.ts
    ├── facilities.repository.test.ts
    ├── facilities.service.test.ts
    └── rateLimit.test.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

### Build for production

```bash
npm run build
npm start
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `GET` | `/facilities?q=...` | Yes | Search facilities |
| `GET` | `/facilities/:id` | Yes | Get facility by ID |
| `GET` | `/docs` | No | Swagger UI |
| `GET` | `/docs/openapi.yaml` | No | Raw OpenAPI spec |

### Authentication

All `/facilities` endpoints require a Bearer token:

```
Authorization: Bearer <token>
```

Obtain a token using the mock `login()` utility in `src/utils/auth.ts`:

```ts
import { login } from './src/utils/auth.ts';
const { token } = await login('user@example.com', 'any-password');
```

### Search parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search keyword |
| `amenities` | string / string[] | No | Filter by amenity — repeated params or comma-separated |
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `10`, max `100` |

### Rate limiting

Requests are limited to **100 per 60-second window per client IP**. Every response includes:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1711166400
```

On limit exceeded, the API returns `429` with a `Retry-After` header.

## Scripts

```bash
npm run dev          # Start dev server with hot reload (tsx)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output

npm test             # Run all tests
npm run format       # Format code with Prettier
npm run format:check # Check formatting without writing
npm run lint         # Lint with ESLint
npm run lint:fix     # Lint and auto-fix
```

## Testing

Tests are written with Jest and Supertest. Run the full suite:

```bash
npm test
```

Test files:

- **`facilities.integration.test.ts`** — end-to-end HTTP tests covering auth, validation, response shape, pagination, and amenity filtering
- **`facilities.repository.test.ts`** — unit tests for the n-gram search index and amenity filtering logic
- **`facilities.service.test.ts`** — unit tests for the service layer (validation, DTO mapping, error handling)
- **`facilities.performance.test.ts`** — response time and concurrency tests
- **`rateLimit.test.ts`** — rate limit enforcement and header correctness

## Solution Decisions

### Search: n-gram index

The repository builds a **trigram index** at startup from the JSON dataset. Each facility name is tokenised and broken into 3-character n-grams; search queries go through the same pipeline and the results are intersected. This gives fast, fuzzy substring matching without any external dependency.

For short query words (fewer than 3 characters), the index falls back to **prefix matching** over the full token list to avoid returning no results.

### Caching: TTL cache in the service layer

A lightweight **in-memory TTL cache** (`src/utils/cache.ts`) is applied at the service layer:

- **Search results** — 30-second TTL. Cache key is `{q_normalised}|{amenities_sorted}|{page}|{limit}`, so equivalent queries with different orderings of amenities share the same entry.
- **Facility by ID** — 5-minute TTL. IDs are stable identifiers, so a longer window is appropriate.

A `setInterval` prune runs every minute to evict expired entries and prevent unbounded memory growth. The timer is `.unref()`'d so it does not block process exit during tests.

Redis was not chosen because the brief called for a single-process, in-memory solution. Switching to Redis later would require only replacing `TTLCache` with a Redis-backed implementation behind the same interface.

### Rate limiting: fixed window, keyed by IP

Rate limiting is implemented as a **fixed window counter** in `src/middleware/rateLimit.middleware.ts`, stored in a `Map`. The key is the client IP, read from `X-Forwarded-For` (first entry) with a fallback to `req.ip`.

The middleware sits after `authMiddleware` in the chain but is independent of auth — it could be moved before auth if needed to protect unauthenticated routes.

A sliding window algorithm would be more accurate under burst traffic but adds complexity; fixed window is a reasonable tradeoff for a time-boxed implementation.

### Error handling

All errors extend a base `AppError` class with a `statusCode` and `code` field. A single `errorMiddleware` at the end of the Express chain catches everything and formats it consistently:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Query keyword is required" } }
```

### API documentation

Swagger UI is served at `/docs` via CDN (unpkg), with the OpenAPI 3.0 spec inlined into `docs.route.ts` as a string constant. This avoids any runtime file system reads and works correctly with both `tsx` (dev) and compiled `dist/` (production) without extra build steps.

## Known Gaps (time-boxed)

The following test cases were identified but not implemented within the 2-hour time limit:

**Pagination (`GET /facilities`)**
- Page 1 and page 2 results do not overlap
- `totalPages` matches `Math.ceil(total / limit)`

**GET /facilities/:id**
- Empty string id returns `400`
- ID containing special characters returns `404`

**Concurrency (`facilities.performance.test.ts`)**
- 50 concurrent requests all return `200`
- Mixed concurrent search + getById requests

These would be the next test cases to add given more time.
