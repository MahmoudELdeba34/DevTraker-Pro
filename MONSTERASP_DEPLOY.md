# نشر WorkTrack على MonsterASP.NET

دليل خطوة بخطوة لرفع المشروع (Angular + Node API + MongoDB Atlas) على [MonsterASP](https://www.monsterasp.net).

---

## المتطلبات

| البند | التفاصيل |
|--------|----------|
| حساب MonsterASP | خطة تدعم **Node.js** |
| MongoDB | **MongoDB Atlas** (مجاني) — MonsterASP لا يوفر MongoDB |
| جهازك | Node.js 20+ و npm |

---

## 1) تجهيز قاعدة البيانات (MongoDB Atlas)

1. أنشئ Cluster مجاني على [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Network Access** → أضف `0.0.0.0/0` (أو IP سيرفر MonsterASP إن وُجد)
3. انسخ connection string مثل:
   ```
   mongodb+srv://USER:PASS@cluster.xxx.mongodb.net/devtracker?retryWrites=true&w=majority
   ```

---

## 2) بناء حزمة الرفع من جهازك

من مجلد المشروع:

```bash
node scripts/build-monsterasp.mjs
```

أو:

```bash
npm run build:monsterasp
```

سيُنشأ مجلد **`monsterasp-publish/`** جاهز للرفع (API + Angular + node_modules + web.config).

---

## 3) إنشاء موقع على MonsterASP

1. سجّل دخول [لوحة التحكم](https://admin.monsterasp.net)
2. **Websites** → **Create website**
3. اختر **Node.js**
4. احفظ:
   - رابط الموقع: `https://siteXXXXX.monsterasp.net`
   - بيانات **FTP** أو **WebDeploy**

---

## 4) رفع الملفات إلى `/wwwroot`

### طريقة أ: FTP (FileZilla)

1. اتصل بـ FTP من لوحة التحكم
2. افتح مجلد **`/wwwroot`**
3. ارفع **كل محتويات** `monsterasp-publish/` (ليس المجلد نفسه فقط المحتوى):
   - `server.js`
   - `web.config`
   - `package.json`
   - `package-lock.json`
   - مجلد `dist/`
   - مجلد `public/`
   - مجلد `node_modules/`
   - مجلد `logs/` (فارغ)

### طريقة ب: WebDeploy

فعّل WebDeploy من لوحة التحكم واستخدم `msdeploy` — انظر [توثيق MonsterASP](https://help.monsterasp.net/books/deploy/page/how-to-deploy-website-content-from-command-line).

---

## 5) إعداد المتغيرات البيئية

على السيرفر أنشئ ملف **`.env`** داخل `/wwwroot` (انسخ من `.env.example`):

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASS@cluster.xxx.mongodb.net/devtracker?retryWrites=true&w=majority
JWT_SECRET=ضع_سلسلة_عشوائية_طويلة_32_حرف_على_الأقل

# رابط موقعك على MonsterASP (مهم للبريد وروابط الإعداد)
FRONTEND_URL=https://siteXXXXX.monsterasp.net

# اختياري — SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password

# بصمة الموبايل (بعد تفعيل HTTPS)
WEBAUTHN_RP_NAME=WorkTrack
WEBAUTHN_RP_ID=siteXXXXX.monsterasp.net
WEBAUTHN_ORIGIN=https://siteXXXXX.monsterasp.net
```

> **لا ترفع `.env` على GitHub** — ارفعه فقط عبر FTP للسيرفر.

---

## 6) تشغيل الموقع

1. من لوحة MonsterASP: **Restart App Pool**
2. افتح المتصفح:
   - التطبيق: `https://siteXXXXX.monsterasp.net`
   - فحص API: `https://siteXXXXX.monsterasp.net/api/health`

يجب أن ترى: `{"success":true,"data":{"status":"ok",...}}`

---

## 7) حل المشاكل

### خطأ 502.5 — Process Failure

1. لوحة التحكم → **Logs** → فعّل **HttpPlatform debug logs**
2. اقرأ `/wwwroot/logs/node_*.log` عبر WebFTP
3. تأكد من:
   - `server.js` و `web.config` في `/wwwroot`
   - `node_modules` مرفوع بالكامل
   - `MONGODB_URI` و `JWT_SECRET` في `.env`

### CORS / تسجيل الدخول لا يعمل

تأكد أن `FRONTEND_URL` = رابط الموقع بالضبط (مع `https://`).

### البصمة على الموبايل

تحتاج **HTTPS** (MonsterASP يوفره). اضبط `WEBAUTHN_RP_ID` و `WEBAUTHN_ORIGIN` على دومين الموقع.

---

## 8) تحديث بعد تعديل الكود

```bash
node scripts/build-monsterasp.mjs
```

ارفع الملفات المتغيرة (عادة `dist/`, `public/`, وأحياناً `node_modules` إذا تغيّرت الحزم) ثم **Restart App Pool**.

---

## هيكل المجلد على السيرفر

```
/wwwroot/
  server.js          ← نقطة الدخول لـ MonsterASP
  web.config         ← إعداد IIS Node
  package.json
  .env               ← أسرارك (على السيرفر فقط)
  dist/              ← API مُجمَّع
  public/            ← Angular (index.html + assets)
  node_modules/
  logs/
```

---

## ملاحظات

- **منفذ واحد**: Express يخدم `/api/*` والواجهة من نفس الدومين — لا حاجة لموقعين.
- **MongoDB**: يبقى على Atlas (سحابي).
- **الخطة المجانية**: راجع حدود MonsterASP لحجم `node_modules` ووقت التشغيل.
