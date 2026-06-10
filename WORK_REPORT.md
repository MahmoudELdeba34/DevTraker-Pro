# WorkTrack — تقرير الأعمال المنجزة

> **التاريخ:** يونيو 2026  
> **المشروع:** WorkTrack (سابقًا DevTracker Pro / ProTrack)  
> **النوع:** تقرير شامل لكل التحسينات والميزات المُنفَّذة في جلسات التطوير الأخيرة

---

## 1. ملخص تنفيذي

تم تحويل المشروع من نظام إدارة مشاريع أساسي إلى **منصة عمل متكاملة** تشمل: أمان أقوى، حضور بالوجه، قواعد HR احترافية، واجهة Dark Luxury، دعم RTL للعربية، وإعادة هوية باسم **WorkTrack**.

| المحور | الحالة |
|--------|--------|
| الأمان (Security) | ✅ منفّذ |
| الحضور بالوجه + المقارنة | ✅ منفّذ |
| قواعد الإجازة والإذن | ✅ منفّذ |
| UI / UX + Light Mode + RTL | ✅ منفّذ |
| صفحة Clock Terminal مستقلة | ✅ منفّذ |
| توثيق المشروع | ✅ `PROJECT_GUIDE.md` + `API_DOCUMENTATION.md` |
| إعادة التسمية → WorkTrack | ✅ منفّذ |
| HttpOnly Cookies للتوكن | ⏳ مؤجل (مقترح للمرحلة القادمة) |
| تحقق الوجه على السيرفر (tfjs-node) | ⏳ فشل التثبيت على Windows — البديل: مقارنة البصمة من المتصفح |

---

## 2. الأمان (Security Audit & Fixes)

### 2.1 حرج (Critical) — تم الإصلاح

| # | المشكلة | الحل |
|---|---------|------|
| 1 | التوكن في `localStorage` | نقل إلى `sessionStorage` + ترحيل تلقائي من التخزين القديم |
| 2 | Guards تقرأ التوكن مباشرة من localStorage | توحيد عبر `AuthService` في كل الـ guards |
| 3 | Payroll بدون صلاحيات | `GET /adjustments` محمي بـ admin/hr/accountant + إخفاء الرابط من السايدبار |
| 4 | رفع صورة Avatar بدون تحقق | UUID للملفات + فحص magic bytes للصورة |
| 5 | CORS مفتوح على LAN | LAN فقط عند `CORS_ALLOW_LAN=true` |
| 6 | لا يوجد Forgot/Reset Password | API كامل + واجهة `forgot-password` / `reset-password` |
| 7 | Brute-force على Login | Rate limit: 5 محاولات/دقيقة |
| 8 | JWT secret ضعيف | رفض الأسرار الافتراضية في `getJwtSecret()` |
| 9 | JSON body بدون حد | `express.json({ limit: '50kb' })` |
| 10 | تسجيل مستخدم جديد يرفع الصلاحية | بعد أول admin → كل التسجيلات `employee` فقط |
| 11 | `authMiddleware` يستخدم `process.env` مباشرة | استخدام `getJwtSecret()` |
| 12 | `tempPassword` في استجابة API | إزالته — يُرسل عبر الإيميل/`setupLink` فقط |
| 13 | HR ينشئ حسابات admin | HR محدود بـ employee/manager |
| 14 | حساب موقوف يقدر يسجل دخول | فحص `suspended` / `resigned` في EmployeeProfile عند Login |
| 15 | طباعة MongoDB URI كامل في اللوج | إخفاء credentials — يظهر الـ host فقط |
| 16 | `adjustedBy` نوع خاطئ في attendance | `mongoose.Types.ObjectId` |

### 2.2 لم يُنفَّذ بعد

- **HttpOnly Cookies** للـ JWT (مذكور كتحسين مستقبلي)
- **مدير يوافق فقط على فريقه** (scope على leave/permission approval)

---

## 3. الحضور والانصراف (Attendance)

### 3.1 صفحة Clock Terminal مستقلة

- **المسار:** `/attendance/punch`
- **الملف:** `frontend/src/app/pages/attendance-punch/`
- أزرار Punch In/Out من **يوم العمل** تنقل للصفحة بدل modal داخلي
- رابط في السايدبار: **تسجيل الحضور**
- يحدد تلقائيًا: حضور / انصراف / الوردية مكتملة

### 3.2 التحقق بالوجه (Face Recognition)

#### التسجيل (Enrollment)
- أول استخدام: تسجيل وجه المرجع
- **API:** `GET/POST/DELETE /api/auth/me/face`
- يُخزَّن: `facePhotoUrl` + `faceDescriptor` (128 رقم) على `User`

#### الحضور / الانصراف
- كاميرا + استخراج بصمة الوجه (`@vladmandic/face-api` في المتصفح)
- إرسال: صورة + `faceDescriptor` في FormData
- السيرفر يقارن البصمة بالمرجع (Euclidean distance، عتبة ~0.55)
- عدم التطابق → **403** مع رسالة واضحة
- على السجل: `checkInFaceVerified`, `checkInFaceDistance`, `checkOutFaceVerified`, `checkOutFaceDistance`

#### ملفات رئيسية
```
backend/src/utils/faceMatch.ts
backend/src/utils/verifyAttendanceFace.ts
backend/src/middleware/uploadFacePhoto.ts
frontend/src/app/services/face-recognition.service.ts
frontend/src/app/components/ui/face-capture/
```

---

## 4. قواعد HR والـ Validation

### 4.1 الإجازات — 24 ساعة مسبقًا

| الطبقة | التفاصيل |
|--------|----------|
| Backend | `meetsLeaveAdvanceNotice()` — رفض إذا أقل من 24 ساعة قبل بداية الإجازة |
| Backend | فحص نوع الإجازة، التداخل، تواريخ الماضي، طول السبب |
| Frontend | `leaveAdvanceNoticeValidator()` + `dateRangeValidator()` |
| Frontend | رسائل خطأ عربي/إنجليزي في Request Center |

### 4.2 الأذونات — وقت تلقائي + إغلاق 5 مساءً

| القاعدة | التفاصيل |
|---------|----------|
| لا إدخال يدوي للوقت | السيرفر يحدد `fromTime` / `toTime` حسب نوع الإذن والساعة الحالية |
| بعد 5:00 PM | ممنوع تقديم أي إذن (Frontend + Backend) |
| أنواع الإذن | تأخير حضور، انصراف مبكر، ساعي، عمل من البيت، تصحيح |

**ملفات:**
```
backend/src/utils/permissionWindow.ts
backend/src/utils/validation.ts
frontend/src/app/core/validators/permission.validators.ts
frontend/src/app/core/validators/leave.validators.ts
```

---

## 5. واجهة المستخدم (UI / UX)

### 5.1 نظام التصميم Dark Luxury

- **الملف:** `frontend/src/styles.css`
- Tokens: surfaces, glass, shadows, animations
- مكوّنات: `glass-card`, `surface-card`, `stat-tile`, `modal`, `tracking-banner`
- تطبيق على: Shell, Dashboard, Employee Home, Request Center, Auth pages, Modals

### 5.2 Light Mode

- متغيرات CSS كاملة لـ `html[data-theme='light']`
- تحسينات glass والمودالات والبانرات في الوضع الفاتح

### 5.3 RTL (العربية)

- إصلاح السايدبار: يمين في العربي، المحتوى شمال
- إزالة `flex-row-reverse` المزدوج مع `dir=rtl`
- خصائص منطقية: `start-0`, `end-0`, `ms-auto`, `border-s`, `text-start`
- قائمة الموبايل تفتح من الجهة الصحيحة

### 5.4 صورة الملف الشخصي (Avatar)

- رفع ملف + URL خارجي
- `UserAvatarComponent` في الهيدر والحساب
- API: `POST/PUT/DELETE /api/auth/me/avatar`

---

## 6. التوثيق والتنظيف

| العنصر | الوصف |
|--------|--------|
| `PROJECT_GUIDE.md` | دليل شامل (~760 سطر) — Backend, Frontend, UI, تدفقات |
| `API_DOCUMENTATION.md` | توثيق الـ API |
| `WORK_REPORT.md` | هذا التقرير |
| حذف `app.component.html` | ملف orphan غير مستخدم |
| حذف `workspace-members-modal` | مكوّن غير مستورد |
| حذف `Timelog` model | كود ميت |
| إزالة `WEBAUTHN_*` من `.env.example` | تنظيف |

---

## 7. إعادة الهوية → WorkTrack

| قبل | بعد |
|-----|-----|
| DevTracker Pro | **WorkTrack** |
| ProTrack (UI) | **WorkTrack** |
| `devtracker-pro` (npm) | `worktrack` |
| MongoDB افتراضي `devtracker` | `worktrack` |

**تحديث في:** الترجمات، الشعار، الإيميلات، `index.html`, README, PROJECT_GUIDE, Postman, Render/MonsterASP.

---

## 8. هيكل المسارات الجديدة (Frontend)

```
/employee-home          → يوم العمل (لوحة الحضور)
/attendance/punch       → Clock Terminal (وجه + حضور/انصراف)
/request-center         → إجازات / أذونات / أوفر تايم
/forgot-password        → نسيت كلمة المرور
/reset-password         → إعادة تعيين كلمة المرور
```

---

## 9. API Endpoints المضافة / المُحدَّثة

| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/auth/forgot-password` | طلب رابط إعادة التعيين |
| POST | `/api/auth/reset-password` | تعيين كلمة مرور جديدة |
| GET | `/api/auth/me/face` | حالة تسجيل الوجه |
| POST | `/api/auth/me/face` | تسجيل/تحديث الوجه |
| DELETE | `/api/auth/me/face` | حذف ملف الوجه |
| POST | `/api/attendance/check-in` | حضور + صورة + بصمة وجه |
| POST | `/api/attendance/check-out` | انصراف + صورة + بصمة وجه |
| GET | `/api/permissions/window` | هل نافذة الأذونات مفتوحة؟ |
| POST | `/api/permissions/request` | إذن (وقت تلقائي) |

---

## 10. حالة البناء (Build)

| الطبقة | الحالة |
|--------|--------|
| Backend `tsc` | ✅ ناجح |
| Frontend `ng build` | ✅ ناجح |
| حزمة face-api (lazy) | ~1.7 MB chunk لصفحة الحضور فقط |

---

## 11. توصيات المرحلة القادمة

1. **HttpOnly Cookies** — أمان أعلى للتوكن
2. **تحقق الوجه على السيرفر** — عند توفر بيئة تدعم `tfjs-node` أو خدمة ML منفصلة
3. **لوحة HR للوجوه** — عرض صور الحضور + نسبة التطابق لكل موظف
4. **مدير يوافق على فريقه فقط** — scope على `managerId`
5. **اختبارات آلية** — unit tests لـ `faceMatch`, `permissionWindow`, `leave validation`
6. **تحديث `API_DOCUMENTATION.md`** — إضافة endpoints الوجه والأذونات الجديدة

---

## 12. ملخص بالأرقام

| البند | تقريبًا |
|-------|---------|
| إصلاحات أمان حرجة | 16+ |
| ميزات HR جديدة | حضور بالوجه، إجازة 24س، إذن تلقائي |
| صفحات/مكوّنات جديدة | attendance-punch, face-capture, validators |
| ملفات backend جديدة | faceMatch, permissionWindow, verifyAttendanceFace, uploadFacePhoto |
| لغات مدعومة | عربي + إنجليزي مع RTL |
| اسم المنتج النهائي | **WorkTrack** |

---

*تم إعداد هذا التقرير بناءً على سجل التطوير وجلسات المراجعة على المشروع.*
