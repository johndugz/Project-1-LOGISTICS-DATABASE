import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';

import { runMigrations } from './config/database';
import { auditMiddleware } from './middleware/auth';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import scanRoutes from './routes/scan';

const app: Express = express();
const PORT = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(
  cors({
    origin: corsOrigin || true,
    credentials: true,
  })
);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(auditMiddleware);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/scan', scanRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start(): Promise<void> {
  try {
    // Run migrations
    await runMigrations();

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
