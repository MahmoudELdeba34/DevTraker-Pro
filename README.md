# DevTracker Pro

> A full-stack project management application for developers — track tasks, log time, manage priorities, and receive deadline reminders.

![DevTracker Pro](https://img.shields.io/badge/Angular-17-DD0031?logo=angular)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

---

## Features

### Core
- 🔐 **JWT Authentication** — Register/Login with bcrypt-hashed passwords, 7-day tokens
- 📁 **Project Management** — Create, update, delete projects with deadlines and descriptions
- ✅ **Task Tracking** — Tasks with priority (low/medium/high) and status (not started / in progress / completed)
- ⏱️ **Live Timer** — Start/stop timer per task, persisted in DB (survives page refresh)
- 🔍 **Filtering** — Filter tasks by status, priority, and deadline (today/this week/overdue)
- 📊 **Progress Bars** — Per-project completion percentage based on task statuses
- 📱 **Responsive** — Works seamlessly on mobile and desktop

### Bonus
- ⏰ **Deadline Reminders** — Hourly cron job sends email reminders at 24h, 12h, and 1h before deadline
- 🎨 **Dark UI** — Premium dark theme with glassmorphism, smooth animations, and Inter font

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 17+ (Standalone Components), Tailwind CSS, Angular Signals + RxJS |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB with Mongoose ODM |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Scheduler | node-cron |
| Email | Nodemailer (SMTP) |

---

## Project Structure

```
devtracker-pro/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose schemas (User, Project, Task)
│   │   ├── routes/          # REST API routes (auth, projects, tasks)
│   │   ├── middleware/       # JWT auth middleware
│   │   ├── jobs/            # Hourly reminder cron job
│   │   └── server.ts        # Express app entry point
│   ├── .env.example
│   └── package.json
└── frontend/                # Angular 17 standalone app
    ├── src/app/
    │   ├── pages/           # login, register, dashboard, project-detail
    │   ├── components/      # task-card, filter-bar, timer-widget
    │   ├── services/        # auth, project, task services
    │   ├── guards/          # JWT auth guard
    │   ├── interceptors/    # HTTP JWT interceptor
    │   └── models/          # TypeScript interfaces
    └── package.json
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### 1. Clone the repository
```bash
git clone <repo-url>
cd devtracker-pro
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and SMTP credentials
npm install
npm run dev
```

The backend starts on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run start
```

The Angular app starts on `http://localhost:4200`.

---

## Environment Variables

### backend/.env
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/devtracker
JWT_SECRET=your_super_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
FRONTEND_URL=http://localhost:4200
```

> **Note:** SMTP variables are optional during local development. If not set, the reminder cron job will log to console instead of sending emails.

---

## API Documentation

All responses follow the format: `{ "success": true/false, "data": ..., "error": "..." }`

### Auth — `/api/auth`
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/register` | `{ name, email, password }` | `{ token, user }` |
| POST | `/login` | `{ email, password }` | `{ token, user }` |

### Projects — `/api/projects` *(requires JWT)*
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get all user projects |
| POST | `/` | Create project `{ title, description?, deadline? }` |
| PUT | `/:id` | Update project fields |
| DELETE | `/:id` | Delete project + all tasks |

### Tasks — `/api/tasks` *(requires JWT)*
| Method | Path | Description |
|--------|------|-------------|
| GET | `/project/:projectId` | Get tasks (filter: `?status=`, `?priority=`, `?deadline=`) |
| POST | `/project/:projectId` | Create task `{ title, priority?, status?, deadline? }` |
| PUT | `/:id` | Update task fields |
| DELETE | `/:id` | Delete task |
| POST | `/:id/timer/start` | Start time tracking |
| POST | `/:id/timer/stop` | Stop timer + save log |
| GET | `/:id/timer/total` | Get total ms logged |

---

## Git Branching Strategy

- `main` — production-ready code
- `develop` — integration branch
- Feature branches: `feat/jwt-auth`, `feat/task-timer`, etc.

---

## Screenshots

> *(Add screenshots here after running the app)*

---

## License

MIT
