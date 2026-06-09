# DevTracker Pro — دليل المشروع الشامل

> وثيقة مرجعية لمراجعة المشروع بالكامل: Backend، Frontend، وواجهة المستخدم (UI).  
> للتفاصيل الكاملة لكل endpoint راجع أيضًا: [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)

---

## فهرس المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [التشغيل المحلي](#2-التشغيل-المحلي)
3. [هيكل المجلدات](#3-هيكل-المجلدات)
4. [الأدوار والصلاحيات](#4-الأدوار-والصلاحيات)
5. [Backend — الباك‌اند](#5-backend--الباكاند)
6. [Frontend — الفرونت‌اند](#6-frontend--الفرونتاند)
7. [UI — واجهة المستخدم](#7-ui--واجهة-المستخدم)
8. [تدفقات المستخدم الرئيسية](#8-تدفقات-المستخدم-الرئيسية)
9. [قاعدة البيانات (Models)](#9-قاعدة-البيانات-models)
10. [الترجمة والثيم](#10-الترجمة-والثيم)
11. [النشر (Deployment)](#11-النشر-deployment)
12. [ملاحظات مهمة للمراجعة](#12-ملاحظات-مهمة-للمراجعة)

---

## 1. نظرة عامة

**DevTracker Pro** (يُعرض في الواجهة باسم **ProTrack**) هو نظام متكامل يجمع بين:

| المجال | الوظائف |
|--------|---------|
| **إدارة المشاريع** | Workspaces → Projects → Tasks + Subtasks |
| **تتبع الوقت** | مؤقت على المهام + جلسات سريعة (Quick sessions) |
| **الموارد البشرية (HR)** | حضور، إجازات، أذونات، وقت إضافي |
| **الرواتب** | تشغيل شهري، كشوف رواتب، تعديلات |
| **التعاون** | أعضاء مساحات العمل، إشعارات، نشاط الفريق |

### التقنيات

| الطبقة | Stack |
|--------|-------|
| **Backend** | Node.js, Express 4, TypeScript, Mongoose 8, MongoDB |
| **Frontend** | Angular 17 (Standalone), RxJS, Tailwind CSS 3 |
| **Auth** | JWT (15 دقيقة) + Refresh Token (30 يوم) مع Rotation |
| **Charts** | Chart.js + ng2-charts |
| **Email** | Nodemailer (SMTP اختياري) |

### شكل الاستجابة من الـ API

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "رسالة الخطأ" }
```

**Base URL:** `http://localhost:5000/api`

---

## 2. التشغيل المحلي

### المتطلبات

- Node.js 20+
- MongoDB محلي أو MongoDB Atlas
- npm

### الإعداد

```bash
# من جذر المشروع
cd backend
cp .env.example .env
# عدّل JWT_SECRET (32+ حرف) و MONGODB_URI

cd ../frontend
npm install
cd ../backend
npm install
```

### التشغيل

```bash
# من جذر المشروع — يشغّل الباك والفرونت معًا
npm run dev
```

| الخدمة | العنوان |
|--------|---------|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:5000/api |
| Health check | http://localhost:5000/api/health |

### أوامر مفيدة

| الأمر | الوظيفة |
|-------|---------|
| `npm run backend` | الباك‌اند فقط |
| `npm run frontend` | الفرونت فقط |
| `npm run build:monsterasp` | بناء حزمة MonsterASP |
| `npm run build:render` | بناء لـ Render |

---

## 3. هيكل المجلدات

```
DevTracker Pro/
├── backend/                    # API + MongoDB
│   ├── src/
│   │   ├── server.ts           # نقطة الدخول
│   │   ├── middleware/         # auth, uploadAvatar
│   │   ├── models/             # 19 Mongoose schema
│   │   ├── routes/             # 16 router
│   │   ├── utils/              # tokens, email, avatar, workspaceAccess...
│   │   ├── services/           # onboarding
│   │   └── jobs/               # reminderCron
│   ├── uploads/avatars/        # صور البروفايل المرفوعة
│   └── .env.example
│
├── frontend/                   # Angular SPA
│   └── src/app/
│       ├── pages/              # 18 شاشة (routes)
│       ├── components/         # shell, ui, tasks, projects...
│       ├── services/           # 17 خدمة HTTP
│       ├── guards/             # auth, admin, hr, accountant
│       ├── interceptors/       # jwt, toast
│       ├── models/types.ts     # كل الـ TypeScript interfaces
│       └── core/               # i18n, theme, utils
│
├── scripts/                    # build-monsterasp, build-render
├── deploy/                     # server.js, web.config (IIS)
├── API_DOCUMENTATION.md        # توثيق API مفصّل
├── MONSTERASP_DEPLOY.md        # دليل النشر على MonsterASP
└── PROJECT_GUIDE.md            # هذا الملف
```

---

## 4. الأدوار والصلاحيات

### الأدوار العامة (Global Roles) — في JWT

| الدور | الوصف |
|-------|-------|
| `employee` | موظف عادي — بياناته فقط |
| `manager` | مدير — موافقة طلبات + تقارير الفريق |
| `hr` | موارد بشرية — ملفات موظفين، حضور، رواتب |
| `accountant` | محاسب — مساحة الرواتب |
| `admin` | مدير نظام — وصول كامل |

> **أول مستخدم يسجّل** يحصل تلقائيًا على دور `admin`.

### أدوار مساحة العمل (Workspace Roles)

| الدور | الصلاحية داخل الـ Workspace |
|-------|------------------------------|
| `admin` | إدارة الأعضاء والإعدادات |
| `member` | عضو عادي |
| `viewer` | مشاهدة فقط |

### Guards في الفرونت

| Guard | يسمح لـ | يعيد التوجيه إلى |
|-------|---------|------------------|
| `authGuard` | أي مستخدم مسجّل (يوجد token) | `/login` |
| `adminGuard` | `admin` فقط | `/dashboard` |
| `hrGuard` | `admin`, `hr`, `manager` | `/dashboard` |
| `accountantGuard` | `admin`, `hr`, `accountant` | `/dashboard` |

---

## 5. Backend — الباك‌اند

### 5.1 Middleware على مستوى السيرفر (`server.ts`)

| Middleware | الوظيفة |
|------------|---------|
| Helmet | أمان HTTP headers |
| CORS | `FRONTEND_URL` + `CORS_ORIGINS` |
| Rate limit | 300 طلب/دقيقة على `/api/` |
| `express.json` | حد 1MB |
| Static uploads | `/api/uploads` → مجلد `uploads/` |
| SPA (production) | يخدم Angular من `backend/public/` |

### 5.2 Middleware مخصص

| الملف | الوظيفة |
|-------|---------|
| `middleware/auth.ts` | يتحقق من `Bearer JWT` → `req.userId`, `req.userRole` |
| `middleware/uploadAvatar.ts` | Multer — رفع صورة بروفايل (2MB، JPEG/PNG/WebP/GIF) |

### 5.3 Routes — ملخص سريع

| Prefix | الملف | المجال |
|--------|-------|--------|
| `/api/auth` | `auth.ts` | تسجيل، دخول، refresh، بروفايل، avatar، setup |
| `/api/users` | `users.ts` | قائمة مستخدمين، أدوار، heartbeat، جلسات نشطة |
| `/api/workspaces` | `workspaces.ts` | مساحات عمل وأعضاء وonboarding |
| `/api/projects` | `projects.ts` | مشاريع |
| `/api/tasks` | `tasks.ts` | مهام، مؤقت، subtasks |
| `/api/time-entries` | `timeEntries.ts` | جلسات وقت سريعة |
| `/api/employees` | `employees.ts` | ملفات الموظفين |
| `/api/attendance` | `attendance.ts` | حضور وانصراف |
| `/api/leaves` | `leaves.ts` | إجازات |
| `/api/permissions` | `permissions.ts` | أذونات |
| `/api/overtime` | `overtime.ts` | وقت إضافي |
| `/api/payroll` | `payroll.ts` | رواتب |
| `/api/reports` | `reports.ts` | تقارير وقت |
| `/api/notifications` | `notifications.ts` | إشعارات |
| `/api/activity` | `activity.ts` | نشاط وpresence |
| `/api/documents` | `documents.ts` | مستندات طباعة HR |

### 5.4 Auth — آلية المصادقة

```
تسجيل الدخول
    ↓
accessToken (JWT 15 دقيقة) + refreshToken (opaque 30 يوم)
    ↓
كل طلب API → Authorization: Bearer <accessToken>
    ↓
عند 401 → POST /auth/refresh → زوج tokens جديد
    ↓
إعادة المحاولة مرة واحدة
```

**إبطال الجلسات يحدث عند:**
- تسجيل الخروج (`/logout`)
- تسجيل الخروج من كل الأجهزة (`/logout-all`)
- تغيير كلمة المرور
- إعادة تعيين كلمة المرور من الأدمن

**Account Setup (بدون SMTP):**
- الأدمن/HR ينشئ مستخدمًا → رابط `/setup-account?token=&email=`
- المستخدم يضبط كلمة المرور → يدخل تلقائيًا

### 5.5 Utils و Services

| الملف | الوظيفة |
|-------|---------|
| `utils/tokens.ts` | JWT + refresh rotation + family revocation |
| `utils/accountSetup.ts` | روابط إعداد الحساب (7 أيام) |
| `utils/email.ts` | SMTP أو mock في الكونسول |
| `utils/notify.ts` | إنشاء إشعارات |
| `utils/avatar.ts` | مسارات وحذف صور البروفايل |
| `utils/workspaceAccess.ts` | RBAC داخل الـ workspace |
| `utils/userTracking.ts` | إيقاف المؤقتات + presence |
| `utils/migrations.ts` | ترحيل أعضاء workspace عند الإقلاع |
| `services/workspaceOnboarding.ts` | إضافة موظف لمساحة عمل |
| `services/onboardingCredentials.ts` | تسليم بيانات الدخول |
| `jobs/reminderCron.ts` | تذكير بمواعيد المهام (كل ساعة) |

### 5.6 متغيرات البيئة (`.env`)

| المتغير | مطلوب؟ | الوصف |
|---------|--------|-------|
| `JWT_SECRET` | **نعم** (32+ حرف) | توقيع JWT |
| `MONGODB_URI` | لا | افتراضي: `mongodb://localhost:27017/devtracker` |
| `PORT` | لا | افتراضي: `5000` |
| `FRONTEND_URL` | لا | CORS + روابط الإعداد |
| `CORS_ORIGINS` | لا | أصول إضافية مفصولة بفاصلة |
| `NODE_ENV` | لا | `production` يفعّل SPA |
| `SMTP_*` | لا | إرسال إيميلات (اختياري) |

---

## 6. Frontend — الفرونت‌اند

### 6.1 البنية المعمارية

- **Angular 17 Standalone** — بدون NgModules
- **Lazy loading** لكل الصفحات عبر `loadComponent()`
- **لا NgRx** — الحالة عبر Angular Signals + RxJS
- **Services** في `providedIn: 'root'`

### 6.2 الصفحات والمسارات (`app.routes.ts`)

#### صفحات عامة (بدون تسجيل دخول)

| المسار | الصفحة | ملاحظات |
|--------|--------|---------|
| `/login` | تسجيل الدخول | |
| `/register` | إنشاء حساب | |
| `/setup-account` | تفعيل حساب بدعوة | token + email |
| `/forgot-password` | نسيت كلمة المرور | **UI فقط — غير موصول بالـ API** |
| `/reset-password` | إعادة تعيين | **UI فقط — غير موصول بالـ API** |

#### صفحات داخل Shell (تحتاج `authGuard`)

| المسار | الصفحة | Guard إضافي |
|--------|--------|-------------|
| `/dashboard` | لوحة التحكم | — |
| `/projects/:id` | تفاصيل مشروع + مهام | — |
| `/members` | أعضاء مساحة العمل | — |
| `/my-timesheet` | سجل وقتي شخصي | — |
| `/request-center` | مركز الطلبات (إجازة/إذن/OT) | — |
| `/employee-home` | تسجيل حضور | — |
| `/account` | الإعدادات + البروفايل | — |
| `/support` | الدعم والأسئلة الشائعة | — |
| `/reports` | تقارير الوقت | — |
| `/admin-hr-portal` | بوابة HR | `hrGuard` |
| `/team-activity` | نشاط الفريق المباشر | `hrGuard` |
| `/team/users/:id` | تقرير مستخدم | `hrGuard` |
| `/payroll-workspace` | مساحة الرواتب | `accountantGuard` |
| `/admin` | لوحة الأدمن | `adminGuard` |

### 6.3 الخدمات (Services)

| الخدمة | الملف | الـ API |
|--------|-------|---------|
| `AuthService` | `auth.service.ts` | `/auth/*` |
| `WorkspaceService` | `workspace.service.ts` | `/workspaces/*` |
| `ProjectService` | `project.service.ts` | `/projects/*` |
| `TaskService` | `task.service.ts` | `/tasks/*` |
| `TimeEntryService` | `time-entry.service.ts` | `/time-entries/*` |
| `UserService` | `user.service.ts` | `/users/*` |
| `HRService` | `hr.service.ts` | `/employees`, `/attendance`, `/leaves`, `/permissions`, `/overtime` |
| `PayrollService` | `payroll.service.ts` | `/payroll/*` |
| `ReportService` | `report.service.ts` | `/reports/*` |
| `NotificationService` | `notification.service.ts` | `/notifications/*` |
| `ActivityService` | `activity.service.ts` | `/activity/*` |
| `OnboardingService` | `onboarding.service.ts` | onboarding في workspaces |
| `PrintDocumentService` | `print-document.service.ts` | طباعة payslips وHR docs |
| `ActiveTimerService` | `active-timer.service.ts` | غلاف لمؤقت المهام (client) |
| `ToastService` | `toast.service.ts` | إشعارات UI |
| `ThemeService` | `theme.service.ts` | light/dark |
| `LocaleService` | `locale.service.ts` | ar/en |

### 6.4 Interceptors

| Interceptor | الوظيفة |
|-------------|---------|
| `jwtInterceptor` | يضيف Bearer token؛ عند 401 يعمل refresh ويعيد المحاولة |
| `toastInterceptor` | يعرض toast عند أخطاء HTTP (ما عدا 401 وheartbeat) |

### 6.5 إدارة الحالة (State)

| المصدر | الآلية |
|--------|--------|
| المستخدم الحالي | `AuthService.currentUser` (signal) + localStorage |
| مساحة العمل النشطة | `WorkspaceService.activeWorkspace` (signal) |
| المؤقت النشط | `ActiveTimerService.activeTask` |
| جلسة وقت سريعة | `TimeEntryService.active` |
| Toasts | `ToastService.toasts` |
| اللغة | `LocaleService` + localStorage `protrack-locale` |
| الثيم | `ThemeService` + localStorage `protrack-theme` |

### 6.6 Types الرئيسية (`models/types.ts`)

`User`, `Workspace`, `WorkspaceMember`, `Project`, `Task`, `Subtask`, `TimeEntry`, `EmployeeProfile`, `Attendance`, `Leave`, `Permission`, `Overtime`, `PayrollRun`, `Payslip`, `SalaryAdjustment`, `ActivityReport`, `PresenceReport`, `ApiResponse<T>`, `AuthResponse`

---

## 7. UI — واجهة المستخدم

### 7.1 الهيكل العام (Shell)

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (260px)  │  Header (workspace, timer, notif, user) │
│  - Logo ProTrack  ├─────────────────────────────────────────┤
│  - Workspace      │                                         │
│  - Navigation     │         <router-outlet>                 │
│  - Projects tree  │         (محتوى الصفحة)                  │
│                   │                                         │
└───────────────────┴─────────────────────────────────────────┘
│  Mobile: Bottom nav (5 أيقونات)                             │
└─────────────────────────────────────────────────────────────┘
```

**مكوّن Shell:** `frontend/src/app/components/shell/shell.component.ts`

**ما يوفّره Shell:**
- تبديل مساحة العمل (Workspace switcher)
- شجرة المشاريع في السايدبار
- مؤقت عام في الهيدر (task timer + quick session)
- إشعارات
- قائمة المستخدم (بروفايل، دعم، خروج)
- إنشاء workspace جديد
- إدارة أعضاء workspace
- تفضيلات اللغة والثيم (`UiPreferencesComponent`)
- تنقل موبايل (bottom nav)

### 7.2 عناصر التنقل (Sidebar)

| العنصر | المسار | من يراه |
|--------|--------|---------|
| Dashboard | `/dashboard` | الجميع |
| Projects | شجرة مشاريع | الجميع |
| Members | `/members` | الجميع |
| Timesheet | `/my-timesheet` | الجميع |
| Requests | `/request-center` | الجميع |
| HR Portal | `/admin-hr-portal` | admin, manager, hr |
| Team Activity | `/team-activity` | admin, manager, hr |
| Payroll | `/payroll-workspace` | الجميع في القائمة — **الـ route محمي** |
| Reports | `/reports` | الجميع |
| Account | `/account` | الجميع |

### 7.3 مكوّنات UI المشتركة (`components/ui/`)

| المكوّن | الاستخدام |
|---------|-----------|
| `user-avatar` | صورة بروفايل أو أحرف أولية |
| `confirm-dialog` | تأكيد حذف/موافقة |
| `modal-shell` | غلاف مودال عام |
| `page-header` | عنوان صفحة + tips |
| `toast-container` | رسائل النجاح/الخطأ |
| `ui-preferences` | تبديل عربي/إنجليزي + ثيم |
| `date-picker` | اختيار تاريخ |
| `assignee-picker` | اختيار مسؤول مهمة |
| `skeleton` | تحميل |
| `flash-banner` | تنبيه inline |
| `credentials-banner` | عرض كلمة مرور مؤقتة |
| `workspace-members-modal` | إدارة أعضاء (ClickUp style) |

### 7.4 مكوّنات الميزات (`components/`)

| المكوّن | الوظيفة |
|---------|---------|
| `task-card` | بطاقة مهمة في اللوحة |
| `task-details-modal` | تفاصيل مهمة + subtasks |
| `task-form-modal` | إنشاء/تعديل مهمة |
| `timer-widget` | ويدجت المؤقت |
| `filter-bar` | فلاتر المهام |
| `project-list` | قائمة مشاريع |
| `project-form-modal` | إنشاء/تعديل مشروع |
| `workspace-members` | مودال أعضاء workspace |

### 7.5 دليل الصفحات — ماذا يفعل كل شاشة؟

#### `/dashboard` — لوحة التحكم
- إحصائيات المشاريع والمهام
- Charts (Chart.js)
- إنشاء مشروع جديد
- بطاقات المشاريع مع اختصارات

#### `/projects/:id` — تفاصيل المشروع
- عرض المهام (بطاقات)
- فلاتر: status, priority, deadline
- إنشاء/تعديل/حذف مهام
- Subtasks
- مؤقت على المهمة
- تعيين مسؤول (assignee)

#### `/members` — الأعضاء
- قائمة أعضاء مساحة العمل
- دعوة بالإيميل / onboarding موظف جديد
- إرسال بيانات دخول
- تغيير دور العضو في الـ workspace

#### `/my-timesheet` — السجل الزمني
- سجل الوقت من المهام والجلسات السريعة
- عرض بالتاريخ

#### `/request-center` — مركز الطلبات
- تقديم: إجازة، إذن، وقت إضافي
- متابعة حالة الطلبات
- طباعة المستندات المعتمدة

#### `/employee-home` — الحضور
- Check-in / Check-out
- بداية/نهاية استراحة
- حالة اليوم وساعة حية

#### `/account` — الإعدادات
- **تبويب البروفايل:** الاسم
- **صورة البروفايل:** رفع ملف أو رابط URL أو إزالة
- **تبويب الأمان:** تغيير كلمة المرور

#### `/admin-hr-portal` — بوابة HR
- سجل الموظفين + ملفات HR
- حضور اليوم
- موافقة/رفض: إجازات، أذونات، overtime
- تعديل حضور يدوي

#### `/payroll-workspace` — الرواتب
- تشغيل رواتب شهر (`YYYY-MM`)
- مراجعة payslips
- تعديلات راتب (bonus/deduction)
- تغيير حالة التشغيل (draft → paid → locked)
- طباعة كشف راتب

#### `/admin` — لوحة الأدمن
- كل المستخدمين
- تغيير الأدوار العامة
- الجلسات النشطة (live)

#### `/team-activity` + `/team/users/:id`
- حضور الفريق المباشر
- تقرير نشاط مستخدم بفترة زمنية
- إيقاف مؤقت مستخدم (force stop)

#### `/reports` — التقارير
- ملخص وقت يومي
- Overtime (>7 ساعات/يوم)

#### `/support` — الدعم
- بطاقات مساعدة
- أسئلة شائعة

### 7.6 نظام التصميم (Design System) — Dark Luxury

الملف المرجعي: `frontend/src/styles.css`

#### كلاسات UI الجاهزة

| Class | الاستخدام |
|-------|-----------|
| `glass` | خلفية زجاجية (sidebar, mobile menu) |
| `glass-card` | بطاقة زجاجية تفاعلية |
| `surface-card` | لوحات صفحات (stats, charts, sections) |
| `tracking-banner` | بانر المؤقت في Dashboard |
| `stat-tile` | بطاقة إحصائية مع hover glow |
| `modal` / `modal-backdrop` | نوافذ منبثقة |
| `btn-primary` / `btn-accent` / `btn-ghost` | أزرار |
| `field-input` / `field-label` | حقول إدخال |
| `badge-*` | شارات الحالة |

#### الألوان (CSS Variables في `styles.css`)

| Token | الاستخدام |
|-------|-----------|
| `bg-base` | خلفية التطبيق |
| `bg-elevated` | بطاقات ومودالات |
| `bg-hover` | hover على عناصر |
| `accent` | اللون الأساسي (#6366F1 indigo) |
| `text-primary/secondary/muted` | تدرج النصوص |
| `success/warning/danger/info` | حالات |

#### Tailwind

- كل الألوان semantic عبر CSS variables
- Animations: `fade-in`, `scale-in`, `slide-up`, `pulse-glow`...
- **Dark** افتراضي في CSS؛ **Light** عبر `data-theme="light"`

#### الخطوط

| الاستخدام | الخط |
|-----------|------|
| عناوين | Syne |
| نص | DM Sans |
| عربي | Cairo |
| كود | JetBrains Mono |

#### أنماط UI متكررة

| النمط | الكلاسات / الملف |
|-------|------------------|
| أزرار أساسية | `.btn-primary`, `.btn-accent` |
| حقول إدخال | `.field-input`, `.field-label` |
| بطاقات | `bg-bg-elevated border border-border rounded-xl` |
| مودالات | `shadow-modal`, `animate-scale-in` |
| Avatars | `app-user-avatar` أو `.user-avatar` |
| RTL | `[attr.data-locale]`, `dir` على `<html>` |

#### ثيم فاتح/داكن

- `ThemeService` يضبط `data-theme` على `<html>`
- التبديل من أيقونة التفضيلات في الهيدر
- يُحفظ في `localStorage` → `protrack-theme`

---

## 8. تدفقات المستخدم الرئيسية

### 8.1 تسجيل الدخول والخروج

```
/login → POST /auth/login → token + user في localStorage → /dashboard
/logout → POST /auth/logout → مسح storage → /login
```

### 8.2 Workspace → Project → Task

```
إنشاء workspace → إنشاء project → فتح /projects/:id
→ إنشاء tasks → مؤقت / subtasks / assignee
```

### 8.3 تتبع الوقت (نظامان)

| النوع | المسار | الوصف |
|-------|--------|-------|
| **Task timer** | `POST /tasks/:id/timer/start` | مرتبط بمهمة محددة |
| **Quick session** | `POST /time-entries/start` | وصف حر + ربط اختياري بمهمة |

> السيرفر يضمن **مؤقت واحد نشط** لكل مستخدم.

### 8.4 دورة HR

```
موظف: employee-home (حضور) + request-center (طلبات)
    ↓
مدير/HR: admin-hr-portal (موافقة)
    ↓
طباعة: documents API
```

### 8.5 دورة الرواتب

```
HR/Accountant: payroll-workspace
    ↓
POST /payroll/run/:month → حساب تلقائي من حضور + OT + تعديلات
    ↓
مراجعة payslips → approve → paid → locked
    ↓
طباعة: /payroll/payslips/:id/print-data
```

### 8.6 Onboarding موظف جديد

```
HR/Admin: members → onboard by email
    ↓
إنشاء حساب + إضافة للـ workspace
    ↓
رابط setup أو إيميل SMTP
    ↓
/setup-account → كلمة مرور → دخول تلقائي
```

### 8.7 صورة البروفايل

```
/account → رفع صورة: POST /auth/me/avatar (multipart)
         → رابط URL: PUT /auth/me/avatar { avatarUrl }
         → إزالة: DELETE /auth/me/avatar
```

---

## 9. قاعدة البيانات (Models)

| Model | الغرض |
|-------|-------|
| `User` | حسابات + role + avatar + presence |
| `RefreshToken` | جلسات refresh مع rotation |
| `AccountSetupToken` | روابط إعداد لمرة واحدة |
| `Workspace` | مساحات عمل + members |
| `Project` | مشاريع |
| `Task` | مهام + timeLogs + subtasks + timer |
| `TimeEntry` | جلسات وقت سريعة |
| `EmployeeProfile` | بيانات HR للموظف |
| `Attendance` | سجل حضور يومي |
| `Leave` | طلبات إجازة |
| `Permission` | أذونات |
| `Overtime` | وقت إضافي |
| `Policy` | سياسات (مرتبطة بالملف — جزئيًا مستخدمة) |
| `PayrollRun` | تشغيل رواتب شهري |
| `Payslip` | كشف راتب |
| `SalaryAdjustment` | مكافآت/خصومات |
| `Notification` | إشعارات داخل التطبيق |
| `Timelog` | **Legacy** — غير مستخدم في routes الحالية |

---

## 10. الترجمة والثيم

### i18n

| العنصر | الموقع |
|--------|--------|
| الإنجليزية | `core/i18n/translations/en.ts` (~4000 سطر) |
| العربية | `core/i18n/translations/ar.ts` (~3700 سطر) |
| الاستخدام | `{{ 'key' \| translate }}` |
| التبديل | `UiPreferencesComponent` أو `LocaleService.toggleLocale()` |
| RTL | تلقائي عند `ar` — `dir="rtl"` على `<html>` |
| التحقق | `frontend/scripts/verify-ar-keys.mjs` |

### مفاتيح شائعة

| Prefix | المحتوى |
|--------|---------|
| `nav.*` | عناصر التنقل |
| `shell.*` | Shell وmodals |
| `account.*` | صفحة الإعدادات |
| `dashboard.*` | لوحة التحكم |
| `common.*` | نصوص عامة |

---

## 11. النشر (Deployment)

| المنصة | الملف | الأمر |
|--------|-------|-------|
| MonsterASP | `MONSTERASP_DEPLOY.md` | `npm run build:monsterasp` |
| Render | `scripts/build-render.mjs` | `npm run build:render` |
| IIS | `deploy/web.config`, `deploy/server.js` | — |

**Production:**
- Angular يُبنى إلى `backend/public/`
- Express يخدم API + SPA من نفس المنفذ
- MongoDB Atlas مطلوب (لا MongoDB على MonsterASP)
- `FRONTEND_URL` = رابط الإنتاج
- `JWT_SECRET` قوي (32+ حرف)

---

## 12. ملاحظات مهمة للمراجعة

### ما يعمل بالكامل ✅

- Auth كامل (login, register, refresh, setup-account)
- Workspaces, Projects, Tasks, Timers
- HR: حضور، إجازات، أذونات، overtime
- Payroll + طباعة
- إشعارات
- صورة بروفايل (رفع + URL)
- عربي/إنجليزي + RTL
- ثيم فاتح/داكن

### ما زال مفتوحًا / تحسينات مستقبلية ⚠️

| العنصر | الحالة |
|--------|--------|
| `Policy` model | موجود لكن الحضور يستخدم 9:00–17:00 ثابت |
| HttpOnly cookies | Tokens في `sessionStorage` (أفضل من localStorage) — للإنتاج الكامل استخدم cookies |

### أمان — ما تم إصلاحه ✅

- Tokens في `sessionStorage` + Guards عبر `AuthService`
- `GET /payroll/adjustments` محمي بـ `admin|hr|accountant`
- رابط Payroll مخفي في Sidebar لغير المصرح لهم
- Avatar: UUID filename + magic-byte validation
- CORS LAN فقط مع `CORS_ALLOW_LAN=true` في التطوير
- Forgot/Reset password API (15 دقيقة، single-use)
- Login rate limit: 5 محاولات/دقيقة
- JWT_SECRET يرفض القيم الافتراضية الضعيفة
- `express.json` حد 50kb
- حذف `Timelog` legacy model

### ملفات مرجعية إضافية

| الملف | المحتوى |
|-------|---------|
| [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) | كل endpoints مع أمثلة JSON |
| [`MONSTERASP_DEPLOY.md`](./MONSTERASP_DEPLOY.md) | نشر خطوة بخطوة |
| [`backend/.env.example`](./backend/.env.example) | متغيرات البيئة |

---

## خريطة سريعة: من أين أبدأ المراجعة؟

```
1. server.ts          → كيف يشتغل السيرفر
2. routes/auth.ts     → المصادقة
3. routes/workspaces  → التعاون
4. routes/tasks       → المهام والمؤقت
5. routes/attendance  → HR
6. routes/payroll     → الرواتب
7. app.routes.ts      → كل شاشات الفرونت
8. shell.component.ts → UI الرئيسي
9. types.ts           → كل الـ interfaces
10. styles.css        → التصميم
```

---

*آخر تحديث: يونيو 2026 — يشمل ميزة صورة البروفايل (رفع + URL).*
