import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import { startReminderCron } from './jobs/reminderCron';

const app = express();
const PORT = process.env.PORT ?? 5000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/devtracker';

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  })
);
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected to MongoDB: ${MONGODB_URI}`);

    startReminderCron();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
