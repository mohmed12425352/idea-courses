# Fekra Design — دليل Lovable Cloud

> ملف مرجعي لإعدادات وربط Lovable Cloud الخاصة بمشروع **فكرة ديزاين** (Idea Courses / Fekra Design).
> آخر تحديث: يوليو 2026.

---

## 1. نظرة عامة

المشروع يعمل على **Lovable Cloud** — النسخة المدارة من Supabase (Database + Auth + Storage + Edge Functions). كل البيانات والجلسات والملفات بتتعامل من خلال Lovable Cloud، وما فيش حاجة اسمها Supabase dashboard منفصل للمستخدم النهائي.

- **Project ID:** `ykzwmwczktqricjizqie` (استخدام داخلي فقط — لا تشاركه للمستخدمين).
- **Stack:** TanStack Start v1 + React 19 + Vite 7 + Tailwind CSS v4.
- **Runtime:** Serverless Worker (Edge) على Cloudflare.

---

## 2. البنية العامة

```
┌─────────────────────────────────────────────┐
│           Frontend (TanStack Start)         │
│  ── React 19 + Vite + Tailwind v4          │
│  ── Routes: src/routes/...                  │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │   Lovable Cloud (Supabase) │
        │  ── Postgres Database        │
        │  ── Auth (Email + Google)    │
        │  ── Storage                  │
        │  ── Edge Functions (N/A*)      │
        └────────────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │      Integrations          │
        │  ── Google Calendar        │
        │  ── Google Drive           │
        │  ── Zoom OAuth / Server-to-Server│
        │  ── Bunny Stream / CDN     │
        │  ── Lovable Email (Mailgun)│
        └────────────────────────────┘
```

> * داخل التطبيق بنستخدم `createServerFn` من TanStack Start، مش Edge Functions.

---

## 3. الـ Backend

### 3.1 قاعدة البيانات

- PostgreSQL 14.5+ (PostgREST API v14.5).
- الـ schema الرئيسي هو `public`.
- كل الجداول في `public` لازم يكون عليها:
  1. `CREATE TABLE public.<name>`
  2. `GRANT ...` على الطاولات المطلوبة (`authenticated`, `anon`, `service_role` حسب الحاجة).
  3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  4. `CREATE POLICY ...`

> **قاعدة أمانية:** ما فيش Foreign Keys لـ `auth.users` مباشرة. بنعمل جدول `profiles` منفصل بـ `id uuid references auth.users(id)`.

### 3.2 أهم الجداول

| الجدول | الوظيفة |
|--------|---------|
| `profiles` | بيانات المستخدم (الاسم، التليفون، الدور...) |
| `user_roles` | أدوار المستخدمين (`admin`, `moderator`, `user`) |
| `courses` | الكورسات والمحتوى |
| `lessons` | الدروس داخل كل كورس |
| `orders` | طلبات الشراء |
| `bundle_orders` | طلبات الباقات |
| `course_sessions` | الجلسات/المحاضرات المباشرة |
| `lesson_access_blocks` | المحاضرات المقفولة لطالب معين |
| `access_codes` | أكواد الوصول للكورسات |
| `app_settings` | إعدادات التطبيق العامة |
| `email_send_log` | سجل إرسال الإيميلات |
| `email_send_state` | إعدادات وحالة الـ queue للإيميل |

### 3.3 RLS & Security

- كل جداول المستخدمين محمية بـ RLS.
- التحقق من صلاحيات الأدمن بيتم عن طريق `public.has_role(user_id, role)` — `SECURITY DEFINER` function.
- **ممنوع** تخزين الأدوار في جدول `profiles` أو `users` مباشرة. لازم يكون `user_roles` منفصل.

---

## 4. المصادقة (Auth)

### 4.1 طرق تسجيل الدخول

- **Email + Password** (مفعل افتراضياً).
- **Google OAuth** (مفعل افتراضياً — لازم يكون Google provider مفعل في Cloud).
- **Apple, SAML SSO** — متاحين لو احتجناهم.

### 4.2 إعدادات مهمة

- **No anonymous sign-ups** — التسجيل يحتاج إيميل حقيقي.
- **Email confirmation** مطلوب ما لم يُطلب خلاف ذلك.
- تسجيل الدخول الاجتماعي بيستخدم `redirect_uri` = `window.location.origin` أو `window.location.origin/auth/callback`.
- الصفحات المحمية (admin, dashboard, ...) بتستخدم `ssr: false` عشان ما يحصلش redirect غلط أثناء SSR.

### 4.3 Middleware

```ts
// src/start.ts
import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
```

ده بيربط الـ bearer token بتاع Supabase مع كل `createServerFn` من الطرف العميل.

---

## 5. الإيميلات (Email Infrastructure)

### 5.1 الدومين المفعّل

- **الدومين الحالي:** `notify.fekradesign1.shalaby3.online`
- **الدومين السابق (غير متاح):** `notify.mail.shalaby1.shop` — متعلق بـ Mailgun account تابع للـ workspace القديم.

### 5.2 إعدادات البريد

- نستخدم **Lovable Email** (Mailgun كـ ESP).
- لازم الـ `sender_domain` في كل إيميل يطابق الدومين المصرّح بيه.
- توجد قوالب جاهزة في `src/lib/email-templates/`:
  - `signup.tsx`
  - `magic-link.tsx`
  - `recovery.tsx`
  - `invoice.tsx`
  - `balance-invoice.tsx`
  - `live-session.tsx`
  - ...إلخ.

### 5.3 Queue System

- الإيميلات بتتبعت عبر `pgmq` queues:
  - `auth_emails` — أولوية أعلى.
  - `transactional_emails` — أولوية عادية.
- المسار `/lovable/email/queue/process` بيتم استدعاؤه من `pg_cron`.
- يحتاج `LOVABLE_API_KEY` و `SUPABASE_SERVICE_ROLE_KEY` (server-side secrets).

---

## 6. التخزين والملفات

### 6.1 Supabase Storage

- ملفات الطلاب (أعمال، صور، PDFs) متخزنة في Supabase Storage.
- RLS policies على الباكتس (buckets) عشان تمنع الوصول غير المصرح.

### 6.2 Bunny Stream / CDN

- تسجيلات المحاضرات المباشرة (Zoom / Google Meet) بتترفع تلقائياً على **Bunny Stream**.
- الفيديوهات بتتضاف كـ `recording_url` في جدول `course_sessions`.
- فيه cleanup logic عشان ما يتبقاش فيديوهات فاضية (`0 Bytes`) على Bunny.

---

## 7. الربطات الخارجية (Integrations)

### 7.1 Google Calendar

- متصل حالياً في الـ workspace الجديد.
- بيستخدمه التطبيق لإنشاء events للجلسات المباشرة.
- `auto_recording` = "cloud" للتسجيلات (Google Meet).

### 7.2 Google Drive

- متصل حالياً في الـ workspace الجديد.
- بيستخدم لتخزين/قراءة تسجيلات Google Meet (بعد ما تظهر في Google Drive).
- التسجيلات بتاخد 10-20 دقيقة بعد انتهاء الجلسة عشان تظهر في Drive.

### 7.3 Zoom

- Zoom meetings بتتعمل من المنصة (مش يدوياً من zoom.us).
- بيستخدم **Server-to-Server OAuth** أو **OAuth App**.
- scopes المطلوبة تشمل:
  - `meeting:write:admin` أو `meeting:write`
  - `recording:read:admin` أو `recording:read`
  - `cloud_recording` — عشان التسجيلات تتخزن في Zoom Cloud.
- meetings بتتعمل بـ `auto_recording: "cloud"`.
- Webhook: `/api/public/webhooks/zoom` — بيستقبل إشعارات التسجيلات.

### 7.4 META / Meta Pixel

- Endpoint: `/api/public/meta-feed/$token/channel/meta` — بيطلع CSV feed للمنتجات.
- Token مخزن في `app_settings` تحت `meta_feed_token`.
- Pixel IDs متاحة من `/api/public/meta-pixel-ids`.

---

## 8. الـ Public API Endpoints

كل الإندبوينتس دي تحت `/api/public/*` ومش محتاجة auth:

| Endpoint | الوظيفة |
|----------|---------|
| `/api/public/sitemap[.]xml` | Sitemap للموقع |
| `/api/public/sessions/sync-recordings` | تشغيل sync للتسجيلات (cron) |
| `/api/public/payments/kashier-webhook` | Webhook من Kashier |
| `/api/public/payments/webhook` | Webhook عام للمدفوعات |
| `/api/public/payments/retry-failures` | إعادة محاولة فشل المدفوعات |
| `/api/public/webhooks/zoom` | Webhook من Zoom |
| `/api/public/webhooks/google-meet` | Webhook من Google Meet |
| `/api/public/meta-feed/$token/channel/meta` | META CSV feed |
| `/api/public/meta-pixel-ids` | Meta Pixel IDs |

> **تنبيه أمني:** كل webhook لازم يتحقق من التوقيع (signature) قبل معالجة البيانات.

---

## 9. الـ Server Functions

بنستخدم `createServerFn` من `@tanstack/react-start` لأي منطق server-side داخل التطبيق. أمثلة:

- `src/lib/admin-*.functions.ts` — لوحة الأدمن.
- `src/lib/balance-notifications.functions.ts` — إرسال تنبيهات الفواتير.
- `src/lib/recording-sync.functions.ts` — sync التسجيلات.
- `src/lib/bunny.functions.ts` — إدارة Bunny Stream.
- `src/lib/invoice.functions.ts` — إنشاء الفواتير.
- `src/lib/kashier.functions.ts` — مدفوعات Kashier.
- `src/lib/zoom.functions.ts` — إنشاء Zoom meetings.
- `src/lib/google-meet.functions.ts` — إنشاء Google Meet.

### قواعد مهمة:

- **ممنوع** استخدام `child_process`, `sharp`, `puppeteer`, `canvas` في server functions.
- **ممنوع** قراءة `process.env` في module scope — لازم داخل الـ handler.
- Protected functions تستخدم `.middleware([requireSupabaseAuth])` وما بتتناداش من public route loaders.

---

## 10. Cron Jobs (pg_cron)

| Job | الوظيفة | التردد |
|-----|---------|--------|
| `auto-sync-session-recordings` | مزامنة تسجيلات المحاضرات | كل دقيقة |
| `process-email-queue` | إرسال الإيميلات من الـ queue | حسب الإعداد |

> التسجيلات بتبدأ المزامنة بعد 2 دقيقة من وقت بدء الجلسة (`scheduled_at + 2 minutes`)، مش بعد انتهاءها.

---

## 11. الدومينات والنشر

### 11.1 الدومينات

| الدومين | الحالة | الاستخدام |
|---------|--------|-----------|
| `fekradesign.shalaby3.online` | نشط | الدومين الرئيسي |
| `www.fekradesign.shalaby3.online` | يجب إضافة A record | إعادة توجيه |
| `fekradesign1.shalaby3.online` | — | دومين فرعي |
| `notify.fekradesign1.shalaby3.online` | مفعّل | إرسال الإيميلات |

### 11.2 إعدادات DNS المطلوبة

للدومين الرئيسي:
```
A     @                185.158.133.1
A     www              185.158.133.1
TXT   _lovable.<hash>  <verification-value>
```

> لو `www` ناقص، SSL provisioning مش هيكمل والدومين هيفضل `Stalled`.

### 11.3 URLs

- **Preview URL:** `https://id-preview--c321bd43-019d-4d21-b431-52991546e235.lovable.app`
- **Published URL:** `https://to-continue-to-edunova-academy-eg.lovable.app`
- **Custom Domain:** `https://fekradesign.shalaby3.online`

---

## 12. متغيرات البيئة (Environment Variables)

> **لا تُكتب القيم الحقيقية في الكود أبداً.** استخدم Lovable Secrets أو `.env` محلي فقط.

### Client-side (Vite)

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

### Server-side (Secrets)

```
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY
LOVABLE_SEND_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ZOOM_ACCOUNT_ID
ZOOM_CLIENT_ID
ZOOM_CLIENT_SECRET
BUNNY_API_KEY
BUNNY_LIBRARY_ID
BUNNY_CDN_HOST
KASHIER_API_KEY
KASHIER_MERCHANT_ID
PADDLE_API_KEY
PADDLE_WEBHOOK_SECRET
META_FEED_TOKEN
WEBHOOK_SECRET
```

---

## 13. SEO & Verification

- Google Search Console متصل وتم التحقق من الدومين.
- META verification tag موجود في `src/routes/__root.tsx`.
- Sitemap URL: `https://fekradesign.shalaby3.online/api/public/sitemap.xml`
- تم تقديم الـ sitemap لـ Google Search Console.

---

## 14. ملاحظات تشغيلية

1. **الريفريش والدخول:** بسبب `ssr: false` على الصفحات المحمية، ممكن يظهر شاشة login للحظة قبل ما يتقرأ الـ session من localStorage. ده طبيعي.
2. **الإشعارات المتكررة:** تم إصلاحها بـ ID-based deduplication في `NotificationBell`.
3. **التسجيلات اليدوية:** لو حد لصق رابط Zoom/Meet يدوياً، التسجيل مش هيترفع تلقائياً. لازم يتعمل من الزر داخل المنصة.
4. **الشهادات:** فيه template picker في إعدادات الكورس عشان تطبيق نفس قالب الشهادة على كل الكورسات أو نسخه من كورس لآخر.
5. **محاضرات مقفولة:** لو أدمن قفل محاضرة لطالب، بيظهر "الدرس مقفل" في sidebar ويمكن إلغاء القفل من لوحة الأدمن.

---

## 15. روابط مفيدة

- Docs: https://docs.lovable.dev
- Cloud Docs: https://docs.lovable.dev/features/cloud
- Email Docs: https://docs.lovable.dev/features/custom-emails
- Backend UI: **Cloud → Backend** من داخل Lovable Editor.
- Emails UI: **Cloud → Emails** من داخل Lovable Editor.

---

*تم إنشاء هذا الملف كمرجع للـ Cloud setup الخاص بالمشروع. لو حصل تغيير في أي integration أو دومين، يفضل تحديثه فوراً.*
