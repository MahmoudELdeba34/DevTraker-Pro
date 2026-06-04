import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
import whiteboardsRouter from './routes/whiteboards';
import notificationsRouter from './routes/notifications';
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
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/overtime', overtimeRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/whiteboards', whiteboardsRouter);
app.use('/api/notifications', notificationsRouter);

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
