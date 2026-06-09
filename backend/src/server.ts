import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import usersRouter from './routes/users';
import reportsRouter from './routes/reports';
import employeesRouter from './routes/employees';
import attendanceRouter from './routes/attendance';
import leavesRouter from './routes/leaves';
import permissionsRouter from './routes/permissions';
import overtimeRouter from './routes/overtime';
import payrollRouter from './routes/payroll';
import workspacesRouter from './routes/workspaces';
import notificationsRouter from './routes/notifications';
import timeEntriesRouter from './routes/timeEntries';
import activityRouter from './routes/activity';
import documentsRouter from './routes/documents';
import { startReminderCron } from './jobs/reminderCron';
import { migrateWorkspaceMembers } from './utils/migrations';
import { getJwtSecret } from './utils/tokens';

const app = express();
const PORT = process.env.PORT ?? 5000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/devtracker';

/* ─── Security & infra middleware ─────────────────────────────────────────── */

// Trust the first proxy hop (so req.ip is accurate behind nginx/cloudflare)
app.set('trust proxy', 1);

// helmet — sensible defaults; CSP off because we serve only an API and
// our SPA is on a different origin.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  })
);

// Generous global limiter — per-route limiters in auth.ts are stricter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Slow down.' },
});
app.use('/api/', globalLimiter);

app.use(express.json({ limit: '1mb' }));

/* ─── Routes ──────────────────────────────────────────────────────────────── */
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/overtime', overtimeRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/time-entries', timeEntriesRouter);
app.use('/api/activity', activityRouter);
app.use('/api/documents', documentsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

/* ─── Startup ─────────────────────────────────────────────────────────────── */
async function start(): Promise<void> {
  try {
    // Fail fast if JWT_SECRET is missing or weak
    getJwtSecret();

    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected to MongoDB: ${MONGODB_URI}`);

    // Idempotent migration: bring legacy workspace.members arrays up to the
    // new {userId, role} subdocument shape. Safe to run on every startup.
    await migrateWorkspaceMembers();

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
