# نشر DevTracker Pro على Render

## اختار إيه من الشاشة؟

| الخيار | تستخدمه؟ |
|--------|----------|
| **Web Services** | ✅ **نعم** — API + Angular معاً |
| Static Sites | ❌ لا (الواجهة مدمجة مع الـ API) |
| Postgres | ❌ لا — استخدم MongoDB Atlas |
| Background Workers | ❌ لا |

---

## الخطوات

### 1) ارفع المشروع على GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/devtracker-pro.git
git push -u origin main
```

### 2) على Render
1. اضغط **Web Services**
2. **Connect GitHub** → اختر الريبو
3. الإعدادات:

| الحقل | القيمة |
|-------|--------|
| Name | `devtracker-pro` |
| Region | Frankfurt (أقرب لمصر) |
| Branch | `main` |
| Root Directory | *(فاضي — جذر المشروع)* |
| Runtime | **Node** |
| Build Command | `npm run build:render` |
| Start Command | `npm run start:render` |

### 3) Environment Variables
من تبويب **Environment**:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASS@cluster.xxx.mongodb.net/devtracker?retryWrites=true&w=majority
JWT_SECRET=سلسلة_عشوائية_طويلة_32_حرف_على_الأقل
FRONTEND_URL=https://devtracker-pro.onrender.com
```

> بعد أول deploy، انسخ الرابط الحقيقي من Render وحدّث `FRONTEND_URL`.

### 4) MongoDB Atlas
- **Network Access** → `0.0.0.0/0`
- نفس الـ URI اللي عندك

### 5) Create Web Service
انتظر 5–10 دقائق للـ build الأول.

### 6) اختبر
- `https://YOUR-APP.onrender.com`
- `https://YOUR-APP.onrender.com/api/health`

---

## ملاحظات

- **الخطة المجانية**: السيرفر بينام بعد 15 دقيقة بدون زيارات — أول فتح بياخد ~30 ثانية.
- **HTTPS**: مجاني — البصمة على الموبايل هتشتغل بعد ضبط:
  ```
  WEBAUTHN_RP_ID=your-app.onrender.com
  WEBAUTHN_ORIGIN=https://your-app.onrender.com
  ```

---

## تحديث بعد تعديل الكود
اعمل push على GitHub → Render يعمل deploy تلقائي.
