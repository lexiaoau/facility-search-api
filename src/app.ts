import express from 'express';
import facilitiesRouter from './routes/facilities.route.js';
import docsRouter from './routes/docs.route.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.middleware.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs — no auth required
app.use('/docs', docsRouter);

const rateLimitMiddleware = createRateLimitMiddleware({
  limit: 100, // 100 requests
  windowMs: 60_000, // per 1 minute, per user
});

app.use('/facilities', authMiddleware, rateLimitMiddleware, facilitiesRouter);
app.use(errorMiddleware);

export default app;
