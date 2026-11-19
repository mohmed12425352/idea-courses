# Idea Courses / EduNova Academy — نسخة مستقلة كاملة (React SPA + Node.js & PostgreSQL)

تم تحويل المنصة بالكامل من Lovable Cloud / Cloudflare Workers / Supabase إلى مشروع **Full-Stack مستقل بالكامل** مفصول إلى:
- **`client/`**: واجهة أمامية كاملة بـ **React 19 + Vite 7 + TanStack Router + Tailwind CSS v4** (بدون أي ارتباط بـ Lovable أو Supabase).
- **`server/`**: باك إند متكامل بـ **Node.js + Express 5 + TypeScript + PostgreSQL + WebSockets (`ws`)** يشمل نظام المصادقة (JWT)، الصلاحيات (Admin / Moderator / Student)، رفع الملفات والفيديوهات بنظام TUS المتقطع، البث المباشر للأحداث اللحظية، الشهادات، الطلبات، الكوبونات، والدعم الفني.

---

## 1. الحسابات الجاهزة للتجربة فوراً

| الصلاحية | البريد الإلكتروني | كلمة المرور | رابط الدخول |
|----------|-------------------|-------------|-------------|
| **مدير المنصة (Admin)** | `admin@edunova.eg` | `Admin@123456` | `http://localhost:5173/admin/login` أو `/login` |
| **طالب تجريبي (مشترك بكورس)** | `student@edunova.eg` | `Student@123456` | `http://localhost:5173/login` |

- **كوبون خصم جاهز للتجربة:** `WELCOME20` (خصم 20%).
- تم نقل جميع البيانات العامة الفعلية (9 كورسات، 31 وحدة، 49 درس، 7 أسئلة شائعة، 24 عمل طلابي، 26 قصة نجاح، 32 تقييم، و70 صورة وقالب شهادة محفوظة محلياً داخل `server/uploads/`).

---

## 2. طريقة التشغيل السريع (Development)

لتشغيل الباك إند (`http://localhost:4000`) والفرونت إند (`http://localhost:5173`) معاً:

```powershell
# 1) تشغيل السيرفر الخلفي (Node.js + PostgreSQL) في نافذة:
cd D:\data\edunova-academy-fullstack\server
npm run dev

# 2) تشغيل الواجهة الأمامية (React + Vite) في نافذة ثانية:
cd D:\data\edunova-academy-fullstack\client
npm run dev
```

أو من المجلد الرئيسي مباشرة بعد تثبيت الحزم:
```powershell
cd D:\data\edunova-academy-fullstack
npm install
npm run dev
```

---

## 3. إعداد قاعدة البيانات PostgreSQL

يحتوي ملف `server/.env` على المتغير:
```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/edunova_academy
```
1. **الاتصال بسيرفر PostgreSQL الخارجي أو المحلي (`postgresql-x64-18`):**
   - فقط ضع كلمة مرور مستخدم `postgres` الخاصة بجهازك بدلاً من `YOUR_POSTGRES_PASSWORD` في `server/.env` ثم أعد تشغيل السيرفر؛ سيقوم السيرفر تلقائياً بإنشاء قاعدة البيانات `edunova_academy` وبناء كل الجداول وزراعة البيانات (`Auto-Migrate & Seed`).
2. **التشغيل الفوري التلقائي (Embedded PostgreSQL Fallback):**
   - في حال لم تضع كلمة مرور PostgreSQL بعد، يقوم السيرفر تلقائياً بتشغيل محرك PostgreSQL مدمج ودائم (`PGlite`) داخل `server/data/pgdata` لكي تعمل المنصة فوراً بنسبة 100% بدون أي تعطيل.
3. **أو عبر Docker:**
   - يوجد ملف `docker-compose.yml` جاهز لتشغيل PostgreSQL 16 على المنفذ `5433`.

---

## 4. التشغيل في بيئة الإنتاج (Production)

```powershell
cd D:\data\edunova-academy-fullstack
npm run build
npm run start
```
يقوم سيرفر Node.js (`http://localhost:4000`) في وضع الإنتاج بخدمة الواجهة الأمامية المبنية (`client/dist`) وجميع مسارات `/api/*` و `/uploads/*` و `/ws` من نفس المنفذ!

---

## 5. أبرز المشاكل والأخطاء التي تمت مراجعتها وإصلاحها

1. **إزالة قفل Cloudflare Turnstile المعطّل محلياً:** كان مفتاح موقع Turnstile القديم مربوطاً بدومين Lovable فقط ويمنع تسجيل الدخول وإنشاء الحسابات على أي دومين جديد أو `localhost`؛ تم جعله اختيارياً عبر `VITE_TURNSTILE_SITE_KEY` و `TURNSTILE_SECRET_KEY`.
2. **إصلاح خطأ صلاحيات جدول الدروس (`42501 permission denied for table profiles`):** تم بناء نظام صلاحيات نظيف ومحكم على مستوى Node.js API بدون تسريب فيديوهات الكورسات المدفوعة لغير المشتركين.
3. **بناء سيرفر رفع فيديوهات TUS محلي مدمج (`/api/tus`):** كان رفع الفيديوهات يتوقف بالكامل إذا لم يكن حساب Bunny Stream مفعلاً؛ الآن يعمل رفع الفيديوهات المتقطع مع شريط التقدم وبث `HTTP 206 Range` محلياً أو عبر Bunny Stream تلقائياً.
4. **استبدال حزم `@lovable.dev/*` المغلقة:**
   - استبدال `@lovable.dev/email-js` بنظام بريد قياسي عبر **Nodemailer SMTP**.
   - استبدال `@lovable.dev/cloud-auth-js` بمسار **Google OAuth 2.0** قياسي على Node.js (`/api/auth/google`).
   - استبدال بوابة الذكاء الاصطناعي المغلقة بدعم **Google Gemini API** المباشر مع مساعد عربي ذكي مدمج يقرأ الكورسات والأسعار من قاعدة البيانات عند عدم وجود مفتاح خارجي.
5. **أرشفة كافة الصور وقوالب الشهادات محلياً:** تم سحب وحفظ 70 ملفاً من صور الكورسات وقوالب الشهادات وأعمال الطلاب داخل `server/uploads/` لضمان عدم ضياع أي صورة مستقبلاً.
