# 🎨 نظام التصميم الكامل — منصة فكرة ديزاين (UI / UX)

هذا الملف يحتوي على كود التصميم الكامل للمنصة: الألوان، الخطوط، المسافات،
المكوّنات، الأنماط الجاهزة، وقواعد الاستخدام.

---

## 1) الهوية البصرية

| العنصر | القيمة |
|---|---|
| اللون الأساسي (Navy/Charcoal) | `#1A2332` — `oklch(0.22 0.04 260)` |
| اللون الذهبي (المصباح) | `#FBBF24` — `oklch(0.84 0.17 88)` |
| الأحمر (شريط COURSES) | `#DC2626` — `oklch(0.58 0.22 27)` |
| النجاح | `oklch(0.62 0.16 150)` |
| الخطوط | Cairo / Tajawal (عربي، RTL) |
| نصف القطر الأساسي | `--radius: 0.75rem` |
| الاتجاه | `direction: rtl` على مستوى `html` |
| الوضع الافتراضي | Dark Mode |

---

## 2) التوكِنز (src/styles.css)

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Cairo', 'Tajawal', system-ui, sans-serif;
  --font-display: 'Cairo', 'Tajawal', sans-serif;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-gold: var(--gold);
  --color-gold-foreground: var(--gold-foreground);
  --color-pink: var(--pink);
  --color-pink-foreground: var(--pink-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

### الوضع الفاتح (Light)

```css
:root {
  --radius: 0.75rem;
  --background: oklch(0.985 0.005 250);
  --foreground: oklch(0.20 0.03 260);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.20 0.03 260);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.20 0.03 260);
  --primary: oklch(0.22 0.04 260);
  --primary-foreground: oklch(0.98 0.01 90);
  --secondary: oklch(0.96 0.01 250);
  --secondary-foreground: oklch(0.22 0.04 260);
  --muted: oklch(0.95 0.008 250);
  --muted-foreground: oklch(0.48 0.03 260);
  --accent: oklch(0.94 0.08 90);
  --accent-foreground: oklch(0.22 0.04 260);
  --gold: oklch(0.84 0.17 88);
  --gold-foreground: oklch(0.20 0.03 260);
  --destructive: oklch(0.58 0.22 27);
  --destructive-foreground: oklch(0.98 0 0);
  --success: oklch(0.62 0.16 150);
  --warning: oklch(0.84 0.17 88);
  --border: oklch(0.90 0.015 250);
  --input: oklch(0.90 0.015 250);
  --ring: oklch(0.84 0.17 88);
  --pink: oklch(0.65 0.22 5);
  --pink-foreground: oklch(0.98 0.01 90);
  --chart-1: oklch(0.84 0.17 88);
  --chart-2: oklch(0.22 0.04 260);
  --chart-3: oklch(0.58 0.22 27);
  --chart-4: oklch(0.62 0.16 150);
  --chart-5: oklch(0.55 0.05 260);
  --sidebar: oklch(0.22 0.04 260);
  --sidebar-foreground: oklch(0.96 0.01 90);
  --sidebar-primary: oklch(0.84 0.17 88);
  --sidebar-primary-foreground: oklch(0.20 0.03 260);
  --sidebar-accent: oklch(0.28 0.05 260);
  --sidebar-accent-foreground: oklch(0.96 0.01 90);
  --sidebar-border: oklch(0.32 0.05 260);
  --sidebar-ring: oklch(0.84 0.17 88);
}
```

### الوضع الداكن (Dark)

```css
.dark {
  --background: oklch(0.16 0.03 260);
  --foreground: oklch(0.96 0.01 90);
  --card: oklch(0.21 0.04 260);
  --card-foreground: oklch(0.96 0.01 90);
  --popover: oklch(0.21 0.04 260);
  --popover-foreground: oklch(0.96 0.01 90);
  --primary: oklch(0.84 0.17 88);
  --primary-foreground: oklch(0.18 0.03 260);
  --secondary: oklch(0.26 0.04 260);
  --secondary-foreground: oklch(0.96 0.01 90);
  --muted: oklch(0.26 0.04 260);
  --muted-foreground: oklch(0.72 0.02 250);
  --accent: oklch(0.32 0.06 260);
  --accent-foreground: oklch(0.96 0.01 90);
  --gold: oklch(0.84 0.17 88);
  --gold-foreground: oklch(0.18 0.03 260);
  --destructive: oklch(0.62 0.22 27);
  --destructive-foreground: oklch(0.98 0 0);
  --border: oklch(0.30 0.05 260);
  --input: oklch(0.30 0.05 260);
  --ring: oklch(0.84 0.17 88);
  --pink: oklch(0.70 0.20 350);
  --pink-foreground: oklch(0.98 0.01 90);
}
```

---

## 3) الأساسيات (Base Layer) + تجاوب الموبايل

```css
@layer base {
  * { border-color: var(--color-border); }
  html { direction: rtl; overflow-x: hidden; }

  /* تكبير الخط على الموبايل لسهولة القراءة */
  @media (max-width: 640px) {
    html { font-size: 17.5px; }
    p, li, span, div, a, button, label, input, textarea { text-wrap: pretty; }
    .text-xs   { font-size: 0.8125rem; }
    .text-sm   { font-size: 0.9375rem; }
    .text-base { font-size: 1.0625rem; }
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-feature-settings: "ss01", "cv11";
    overflow-x: hidden;
    max-width: 100vw;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    font-weight: 700;
  }
}
```

---

## 4) الـ Utilities المخصّصة

```css
/* حاوية الصفحة القياسية */
@utility container-page {
  margin-inline: auto;
  padding-inline: 1rem;
  max-width: 80rem;
}

/* نص بتدرّج ذهبي */
@utility text-gradient-gold {
  background: linear-gradient(135deg, oklch(0.90 0.17 92), oklch(0.78 0.18 80));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* خلفية الكحلي بنقشة إضاءة (الفوتر / الهيرو) */
@utility bg-navy-pattern {
  background-color: oklch(0.22 0.04 260);
  background-image:
    radial-gradient(circle at 20% 20%, oklch(0.84 0.17 88 / 0.14) 0, transparent 40%),
    radial-gradient(circle at 80% 70%, oklch(0.58 0.22 27 / 0.10) 0, transparent 45%);
}

/* تدرّج زر البراند (كحلي متحرك عند الهوفر) */
@utility btn-brand-gradient {
  background-image: linear-gradient(135deg,
    oklch(0.20 0.04 260) 0%,
    oklch(0.28 0.05 260) 55%,
    oklch(0.40 0.07 265) 100%);
  background-size: 200% 100%;
  background-position: 0% 0%;
  transition: background-position 400ms ease, transform 200ms ease, box-shadow 200ms ease;
  color: #ffffff;
}
.btn-brand-gradient:hover { background-position: 100% 0%; }
.btn-brand-gradient, .btn-brand-gradient * { color: #ffffff; }

/* تدرّج الزر الذهبي */
@utility btn-gold-gradient {
  background-image: linear-gradient(135deg,
    oklch(0.90 0.17 92) 0%,
    oklch(0.82 0.18 85) 50%,
    oklch(0.72 0.18 70) 100%);
  background-size: 200% 100%;
  background-position: 0% 0%;
  transition: background-position 400ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.btn-gold-gradient:hover { background-position: 100% 0%; }
```

---

## 5) مكوّن الأزرار (Button variants)

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "btn-brand-gradient text-primary-foreground shadow hover:shadow-lg hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:     "border border-primary/30 bg-background text-primary shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary",
        secondary:   "bg-secondary text-secondary-foreground shadow-sm hover:bg-gold hover:text-gold-foreground",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-primary underline-offset-4 hover:underline hover:text-gold",
        gold:        "btn-gold-gradient text-gold-foreground shadow hover:shadow-lg hover:-translate-y-0.5",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-10 rounded-md px-8",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

الاستخدام:
```tsx
<Button>تسجيل</Button>
<Button variant="gold" size="lg">اشترك الآن</Button>
<Button variant="outline" size="sm">تحديث</Button>
```

---

## 6) هيكل الصفحة (Layout)

```tsx
// SiteShell — الغلاف العام لكل الصفحات
<div className="flex min-h-screen flex-col">
  <Header />                        {/* sticky top-0 z-40 bg-[#111] h-[60px] */}
  <main className="flex-1">{children}</main>
  <Footer />                        {/* bg-navy-pattern text-white mt-16 */}
</div>
```

### الهيدر
- ارتفاع ثابت `h-[60px]`، خلفية `#111`، ثابت أعلى الصفحة `sticky z-40`.
- يمين: اللوجو (36×36). وسط: روابط التنقل. يسار: المفضلة / السلة / الإشعارات / الوضع الليلي / حساب المستخدم.
- الروابط النشطة: `text-gold`، غير النشطة: `text-white/80 hover:text-white`.
- على الموبايل: قائمة منسدلة `border-t border-white/10 bg-[#111]`.

### الفوتر
- شبكة `grid gap-8 md:grid-cols-4` + شريط حقوق سفلي `border-t border-white/10`.
- النصوص الثانوية: `text-white/70`، الهوفر: `hover:text-gold`.

---

## 7) قواعد التجاوب (Responsive Rules)

الصفوف التي تحتوي نص + عناصر ثابتة:

```tsx
<header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl">{icon}</div>
    <h1 className="truncate text-xl font-black sm:text-2xl">{title}</h1>
  </div>
  <Widget />
</header>
```

- `min-w-0` على كل حاوية نص.
- `shrink-0` على الأيقونات والصور الثابتة.
- `truncate` على العناوين ذات السطر الواحد.
- نقاط التوقف: `sm 640` / `md 768` / `lg 1024` / `xl 1280`.

---

## 8) الوضع الليلي (Dark Mode)

```tsx
// hooks/use-theme.tsx
const STORAGE_KEY = "fd-theme";      // القيمة الافتراضية: dark
document.documentElement.classList.toggle("dark", theme === "dark");
```

يُحفظ الاختيار في `localStorage`، ويُطبَّق كـ class على `<html>`.

---

## 9) قواعد إلزامية للتصميم (Do & Don't)

✅ استخدم التوكِنز الدلالية دائمًا:
`bg-background` · `text-foreground` · `bg-card` · `text-muted-foreground`
`bg-primary` · `bg-gold text-gold-foreground` · `border-border` · `bg-destructive`

❌ ممنوع تمامًا:
- ألوان مباشرة مثل `text-white` أو `bg-black` أو `bg-[#hex]` داخل المكوّنات.
- إضافة `tailwind.config.js` (المشروع على Tailwind v4 — كل الإعداد في `src/styles.css`).
- استيراد خطوط عبر `@import` لرابط خارجي — تُحمَّل عبر `<link>` في `__root.tsx`.

---

## 10) الحركة والانتقالات

| الحالة | القيمة |
|---|---|
| انتقال الأزرار | `transition-all duration-300` |
| رفع الزر عند الهوفر | `hover:-translate-y-0.5 hover:shadow-lg` |
| تحرك التدرّج | `background-position 400ms ease` |
| كشف عناصر الصفحة | GSAP عبر `useGsapReveal` (يُعاد تشغيله مع كل تغيير مسار) |
| شاشة التحميل (Splash) | لوجو + سبينر، حد أدنى للظهور 1500ms |

---

## 11) مقياس المسافات والحواف

| الاستخدام | القيمة |
|---|---|
| حشوة الأقسام | `py-12` → `py-16` |
| فراغ الشبكات | `gap-4` / `gap-6` / `gap-8` |
| عرض الحاوية | `max-w-7xl` (80rem) + `px-4` |
| زوايا البطاقات | `rounded-lg` (0.75rem) |
| زوايا الأزرار | `rounded-md` |
| العناصر الدائرية | `rounded-full` (الأفاتار، الشارات، أيقونات التواصل) |
