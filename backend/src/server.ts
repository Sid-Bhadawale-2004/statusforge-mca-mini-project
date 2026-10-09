import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { realtimeService } from './services/realtime.service.js';
import { escalationWorker } from './services/escalation.worker.js';
import { EscalationPolicy } from './models/EscalationPolicy.js';

const app = express();
const httpServer = http.createServer(app);
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const allowedClientOrigins = new Set([
  CLIENT_URL,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
]);

// Setup Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [...allowedClientOrigins],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

realtimeService.init(io);

// Express Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || allowedClientOrigins.has(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Observability & Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'statusforge-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'statusforge-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Mount Versioned API
app.use('/api/v1', apiRouter);

// 404 Route Handler for undefined endpoints
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

// Centralized Error Handler
app.use(errorHandler);

async function startServer() {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32 ||
      /replace|change.?me|example/i.test(process.env.JWT_SECRET)
    ) {
      throw new Error('JWT_SECRET must be configured with a unique value of at least 32 characters.');
    }

    // 1. Connect to MongoDB
    await connectDB();

    // Update only legacy channel fields; loading and saving whole policies can fail
    // validation when older documents contain unrelated legacy fields.
    const policyMigration = await EscalationPolicy.collection.updateMany(
      { steps: { $elemMatch: { channel: { $ne: 'email' } } } },
      { $set: { 'steps.$[step].channel': 'email' } },
      { arrayFilters: [{ 'step.channel': { $ne: 'email' } }] }
    );
    if (policyMigration.modifiedCount > 0) {
      console.log(`[StatusForge Backend] Updated ${policyMigration.modifiedCount} escalation policy/policies to email notifications.`);
    }

    // 2. Start background escalation worker
    escalationWorker.start();

    // 3. Listen on port 5000
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[StatusForge Backend] Server is running on http://0.0.0.0:${PORT}`);
      console.log(`[StatusForge Backend] Real-time Socket.IO listening on port ${PORT}`);
      console.log(`[StatusForge Backend] Client origin permitted: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error('[StatusForge Backend] Fatal startup error:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[StatusForge Backend] SIGTERM received. Shutting down gracefully...');
  escalationWorker.stop();
  httpServer.close(() => {
    console.log('[StatusForge Backend] Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[StatusForge Backend] SIGINT received. Shutting down gracefully...');
  escalationWorker.stop();
  httpServer.close(() => {
    console.log('[StatusForge Backend] Server closed.');
    process.exit(0);
  });
});

startServer();
