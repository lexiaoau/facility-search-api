import express from 'express';
import facilitiesRouter from './routes/facilities.route.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/facilities', authMiddleware, facilitiesRouter);
app.use(errorMiddleware);

export default app;
