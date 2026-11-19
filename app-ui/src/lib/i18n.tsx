import { createContext, useContext, useEffect, useCallback, useState } from "react";

export type Locale = "ar" | "en";

const STORAGE_KEY = "fd-language";

export function getInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") return stored;
    } catch {
      // ignore
    }
  }
  return "ar";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: "rtl" | "ltr";
  t: (key: string, params?: Record<string, string | number>) => string;
  isAr: boolean;
  isEn: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const dict: Record<Locale, Record<string, string>> = {
  ar: {
    "nav.home": "الرئيسية",
    "nav.courses": "الدورات",
    "nav.chat": "الشات",
    "nav.about": "من نحن",
    "nav.contact": "تواصل معنا",
    "header.myCourses": "دوراتي",
    "header.dashboard": "لوحة التحكم",
    "header.admin": "لوحة الإدارة",
    "header.help": "مركز المساعدة",
    "header.logout": "تسجيل الخروج",
    "header.account": "حسابي",
    "header.favorites": "المفضلة",
    "header.cart": "السلة",
    "header.login": "دخول",
    "header.register": "إنشاء حساب",
    "header.menu": "القائمة",
    "header.closeMenu": "إغلاق القائمة",
    "header.openMenu": "فتح القائمة",
    "header.lightMode": "تفعيل الوضع الفاتح",
    "header.darkMode": "تفعيل الوضع المظلم",
    "footer.tagline": "فكرة ديزاين - منصتك الأولى لتعلم المهارات باللغة العربية مع نخبة من أفضل المدربين.",
    "footer.quickLinks": "روابط سريعة",
    "footer.courses": "الكورسات",
    "footer.about": "من نحن",
    "footer.contact": "تواصل معنا",
    "footer.terms": "الشروط والأحكام",
    "footer.privacy": "سياسة الخصوصية",
    "footer.refund": "سياسة الاسترداد",
    "footer.support": "الدعم",
    "footer.whatsapp": "واتساب",
    "footer.followUs": "تابعنا",
    "footer.copyright": "© {year} فكرة ديزاين — جميع الحقوق محفوظة",
    "lang.ar": "العربية",
    "lang.en": "English",
    "lang.switch": "تغيير اللغة",
    "lang.arShort": "ع",
    "lang.enShort": "EN",
  },
  en: {
    "nav.home": "Home",
    "nav.courses": "Courses",
    "nav.chat": "Chat",
    "nav.about": "About",
    "nav.contact": "Contact",
    "header.myCourses": "My Courses",
    "header.dashboard": "Dashboard",
    "header.admin": "Admin",
    "header.help": "Help Center",
    "header.logout": "Logout",
    "header.account": "Account",
    "header.favorites": "Wishlist",
    "header.cart": "Cart",
    "header.login": "Login",
    "header.register": "Register",
    "header.menu": "Menu",
    "header.closeMenu": "Close menu",
    "header.openMenu": "Open menu",
    "header.lightMode": "Switch to light mode",
    "header.darkMode": "Switch to dark mode",
    "footer.tagline": "Fekra Design - your top platform to learn skills in Arabic with a selection of the best trainers.",
    "footer.quickLinks": "Quick Links",
    "footer.courses": "Courses",
    "footer.about": "About",
    "footer.contact": "Contact",
    "footer.terms": "Terms & Conditions",
    "footer.privacy": "Privacy Policy",
    "footer.refund": "Refund Policy",
    "footer.support": "Support",
    "footer.whatsapp": "WhatsApp",
    "footer.followUs": "Follow us",
    "footer.copyright": "© {year} Fekra Design — All rights reserved",
    "lang.ar": "العربية",
    "lang.en": "English",
    "lang.switch": "Change language",
    "lang.arShort": "ع",
    "lang.enShort": "EN",
  },
};

// Extend dictionaries with translations for all static pages.
const extraAr: Record<string, string> = {
  // Common
  "common.or": "أو",
  "common.loading": "جاري التحميل…",
  "common.retry": "إعادة التحميل",
  "common.email": "البريد الإلكتروني",
  "common.password": "كلمة المرور",
  "common.emailPlaceholder": "you@example.com",
  // About
  "about.title": "من نحن",
  "about.hero": "منصة تعليمية مصرية متخصصة",
  "about.p1": "فكرة ديزاين منصة تعليمية مصرية متخصصة في تقديم كورسات احترافية باللغة العربية في مجالات الذكاء الاصطناعي، التسويق الرقمي، التصميم، وصناعة المحتوى. رسالتنا هي تمكين الشباب العربي من اكتساب المهارات الرقمية اللازمة لسوق العمل الحديث.",
  "about.p2": "نؤمن بأن التعليم الجيد حق للجميع، ولذلك نقدم محتوى عالي الجودة بأسعار في متناول الجميع، مع طرق دفع محلية تناسب السوق المصري.",
  // Contact
  "contact.title": "تواصل معنا",
  "contact.email": "البريد",
  "contact.phone": "الهاتف",
  "contact.address": "العنوان",
  "contact.addressValue": "مصر — الإسكندرية",
  // Help
  "help.title": "مركز المساعدة",
  "help.subtitle": "هنا هتلاقي فيديوهات شرح قصيرة تساعدك تستخدم المنصة بسهولة. لو محتاج مساعدة إضافية، تواصل معنا في أي وقت.",
  "help.contactSupport": "تواصل مع الدعم",
  "help.empty": "مفيش فيديوهات مساعدة حالياً — راجعنا قريب!",
  // Terms
  "terms.title": "الشروط والأحكام",
  "terms.updated": "آخر تحديث: مايو 2026",
  // Privacy
  "privacy.title": "سياسة الخصوصية",
  "privacy.updated": "آخر تحديث: مايو 2026",
  // Refund
  "refund.title": "سياسة الاسترداد",
  "refund.subtitle": "ضمان استرداد لمدة 7 أيام",
  // Login
  "login.title": "تسجيل الدخول",
  "login.subtitle": "أهلاً بك مرة أخرى في فكرة ديزاين",
  "login.submit": "دخول",
  "login.loading": "جاري الدخول…",
  "login.forgot": "نسيت كلمة المرور؟",
  "login.noAccount": "ليس لديك حساب؟",
  "login.createAccount": "أنشئ حساباً",
  // Register
  "register.title": "إنشاء حساب جديد",
  "register.subtitle": "انضم إلى آلاف الطلاب الآن",
  "register.fullName": "الاسم الكامل",
  "register.phone": "رقم الموبايل",
  "register.pwPlaceholder": "6 أحرف على الأقل",
  "register.showPw": "إظهار كلمة المرور",
  "register.hidePw": "إخفاء كلمة المرور",
  "register.pwStrength": "قوة كلمة المرور",
  "register.submit": "إنشاء الحساب",
  "register.loading": "جاري الإنشاء…",
  "register.hasAccount": "لديك حساب؟",
  "register.signIn": "سجّل دخول",
  // Forgot password
  "forgot.title": "نسيت كلمة المرور؟",
  "forgot.subtitle": "سنرسل لك رابطاً لإعادة التعيين",
  "forgot.submit": "إرسال رابط الاستعادة",
  "forgot.loading": "جاري الإرسال…",
  "forgot.sent": "تم الإرسال! افحص بريدك الإلكتروني (وصندوق الـ Spam) واضغط على الرابط لإعادة تعيين كلمة المرور.",
  "forgot.back": "عودة لتسجيل الدخول",
  // Reset password
  "reset.title": "تعيين كلمة مرور جديدة",
  "reset.subtitle": "اختر كلمة مرور قوية",
  "reset.newPw": "كلمة المرور الجديدة",
  "reset.confirmPw": "تأكيد كلمة المرور",
  "reset.submit": "تحديث كلمة المرور",
  "reset.loading": "جاري الحفظ…",
  "reset.checking": "جاري التحقق من رابط الاستعادة... إن لم يحدث شيء، اطلب رابطاً جديداً من صفحة \"نسيت كلمة المرور\".",
  // Wishlist
  "wishlist.title": "المفضلة",
  "wishlist.subtitle": "هنا تجد الدورات التي أضفتها لمفضلتك :",
  "wishlist.errorLoad": "حصلت مشكلة مؤقتة في تحميل المفضلة.",
  "wishlist.empty": "لم تضف أي كورسات إلى المفضلة حتى الآن.",
  "wishlist.browse": "تصفح الكورسات",
  // Student works
  "works.badge": "أعمال طلابنا",
  "works.title": "إبداعات صنعها طلاب فكرة ديزاين",
  "works.subtitle": "مجموعة مختارة من أفضل الأعمال — مواقع، موشن جرافيك، هويات بصرية، وتصميمات جرافيك.",
  // Courses list
  "courses.title": "جميع الكورسات",
  "courses.subtitle": "اكتشف أفضل الكورسات الاحترافية باللغة العربية",
  "courses.available": "الكورسات المتاحة",
  "courses.searchPh": "ابحث عن كورس…",
  "courses.allCategories": "كل التصنيفات",
  "courses.sortPopular": "الأكثر شعبية",
  "courses.sortNewest": "الأحدث",
  "courses.sortPriceLow": "السعر: من الأقل",
  "courses.sortPriceHigh": "السعر: من الأعلى",
  "courses.errorLoad": "حصلت مشكلة مؤقتة في تحميل الكورسات.",
  "courses.noMatch": "لا توجد كورسات مطابقة",
  // Home / Index
  "home.heroBadge": "منصة تعليمية مصرية متخصصة",
  "home.brand": "فكرة ديزاين",
  "home.heroHeadline": "كورسات احترافية في الذكاء الاصطناعي والتصميم",
  "home.heroSub": "بنقدّملك كورسات أونلاين من أي مكان، وأوفلاين في الإسكندرية — تعليم احترافي بالعربي يأهّلك لسوق العمل.",
  "home.exploreCourses": "استكشف الكورسات",
  "home.dashboard": "لوحة التحكم",
  "home.createFree": "أنشئ حسابك مجاناً",
  "home.students": "طالب",
  "home.course": "كورس",
  "home.satisfaction": "رضا",
  "home.browseCats": "تصفح الأقسام",
  "home.browseCatsSub": "اختار قسمك المفضل واكتشف الكورسات المتاحة.",
  "home.latest": "أحدث الكورسات",
  "home.latestSub": "أحدث الكورسات اللي إضافتها على المنصة.",
  "home.latestEmpty": "لا توجد كورسات حديثة متاحة حالياً — تابعونا قريباً!",
  "home.latestError": "حصلت مشكلة مؤقتة في تحميل أحدث الكورسات، جرّب تحديث الصفحة.",
  "home.coursesTitle": "الدورات",
  "home.coursesSub": "كورساتنا غير أي مكان — محتوى عملي، شرح بالعربي، ومدرّبين خبرة تأهّلك لسوق الشغل فعلاً.",
  "home.viewAll": "عرض كل الكورسات",
  "home.coursesEmpty": "لا توجد كورسات متاحة حالياً — تابعونا قريباً!",
  "home.coursesError": "حصلت مشكلة مؤقتة في تحميل الكورسات، افتح صفحة كل الكورسات أو جرّب تحديث الصفحة.",
  "home.whyEyebrow": "لماذا فكرة ديزاين؟",
  "home.whyTitle": "تجربة تعليمية لا تُنسى",
  "home.f1t": "مدربون محترفون",
  "home.f1d": "نخبة من خبراء السوق المصري والعربي بسنوات من الخبرة العملية.",
  "home.f2t": "محتوى عربي 100%",
  "home.f2d": "كل الدروس باللغة العربية مع أمثلة من السوق المصري.",
  "home.f3t": "ضمان استرداد",
  "home.f3d": "غير راضٍ؟ استرد أموالك خلال 7 أيام بدون أسئلة.",
  "home.f4t": "مجتمع نشط",
  "home.f4d": "انضم لآلاف الطلاب وتفاعل مع زملائك والمدربين.",
  "home.f5t": "شهادة بعد الكورس",
  "home.f5d": "احصل على شهادة إتمام لكل كورس تنهيه.",
  "home.f6t": "تحديث مستمر",
  "home.f6d": "محتوى يتطور باستمرار لمواكبة آخر التقنيات.",
  "home.testimonialsBadge": "آراء طلابنا",
  "home.testimonialsTitle1": "قصص نجاح",
  "home.testimonialsTitle2": "حقيقية",
  "home.testimonialsTitle3": "من المشتركين",
  "home.testimonialsSub": "مئات الطلاب اللي اتغيرت حياتهم المهنية بعد الكورسات — دي بعض من رسائلهم الحقيقية.",
  // Footer extras
  "footer.legal": "قانوني",
  "footer.studentWorks": "أعمال الطلاب",
  "footer.whatsappCta": "تواصل عبر واتساب",
  "footer.facebook": "فيسبوك",
  "footer.whatsappLabel": "واتساب",
  "footer.instagram": "انستقرام",
  "footer.youtube": "يوتيوب",

  // Home Testimonials & Reviews
  "home.satisfiedStudents": "+1000 طالب راضي",
  "home.latestReviewsEyebrow": "أحدث الآراء",
  "home.latestReviewsTitle": "رأي طلابنا في الكورسات",
  "home.latestReviewsSub": "كل تقييم وكومنت من طلاب اشتركوا فعلاً في الكورسات.",
  "home.latestReviewsEmpty": "كن أول من يكتب رأيه عن كورساتنا!",
  "home.student": "طالب",

  // Student Works
  "home.studentWorksEyebrow": "أعمال طلابنا",
  "home.studentWorksTitle": "شوف شغل الطلاب بنفسك",
  "home.studentWorksSub": "مشاريع وفيديوهات حقيقية اشتغلها طلابنا بعد ما خلّصوا الكورسات.",

  // Payment Methods
  "home.paymentEyebrow": "طرق الدفع",
  "home.paymentTitle": "ادفع بالطريقة الأنسب لك",
  "home.vodafoneCash": "فودافون كاش",
  "home.vodafoneCashDesc": "ادفع من محفظتك مباشرة",
  "home.instapay": "InstaPay",
  "home.instapayDesc": "تحويل فوري عبر إنستا باي",
  "home.bankTransfer": "تحويل بنكي",
  "home.bankTransferDesc": "حوّل من حسابك البنكي",

  // FAQ
  "home.faqEyebrow": "الأسئلة الشائعة",
  "home.faqTitle": "كل ما تريد معرفته",
  "home.faq1Q": "كيف أبدأ التعلم؟",
  "home.faq1A": "أنشئ حساباً مجاناً، اختر الكورس المناسب، ادفع باستخدام إحدى طرق الدفع، وبعد الموافقة على الدفع يفتح لك الكورس فوراً.",
  "home.faq2Q": "هل أحصل على شهادة؟",
  "home.faq2A": "نعم، عند إتمام الكورس تحصل على شهادة بعد الكورس من فكرة.",
  "home.faq3Q": "ما هي مدة الوصول للكورس؟",
  "home.faq3A": "وصول مدى الحياة لجميع كورساتك مع التحديثات المجانية.",
  "home.faq4Q": "هل يمكنني استرداد المبلغ؟",
  "home.faq4A": "نعم، لديك 7 أيام من تاريخ الشراء لطلب الاسترداد عبر مزوّد الدفع Paddle.",
  "home.faq5Q": "كم يستغرق التحقق من الدفع؟",
  "home.faq5A": "الدفع الإلكتروني (بطاقة أو محفظة) فوري: يتم تفعيل الكورس تلقائياً بمجرد اكتمال الدفع. أما التحويل البنكي اليدوي فيُراجع خلال ساعات قليلة في أيام العمل.",

  // CTA
  "home.ctaTitle": "جاهز تبدأ رحلتك التعليمية؟",
  "home.ctaSub": "انضم لآلاف الطلاب الذين غيّروا حياتهم المهنية مع فكرة ديزاين.",
  "home.ctaBrowse": "تصفح الكورسات",
  "home.ctaStart": "ابدأ مجاناً الآن",

  // Certificate & Guarantee
  "home.certTitle": "شهادة إتمام الدورة",
  "home.certDesc": "ستحصل عليها بعد إتمام مشاهدة الدورة من خلال الموقع",
  "home.certImgAlt": "نموذج شهادة إتمام الدورة من فكرة ديزاين",
  "home.guaranteeTitle": "ضمان",
  "home.guaranteeDesc": "تقدر تسترجع اشتراكك بالكامل في حالة عدم الاستفادة من الكورس، للاطلاع على قواعد سياسة الاسترجاع الخاصة بنا ",
  "home.clickHere": "اضغط هنا",
  "home.enrollNow": "اشترك الآن",

  // Categories & Chips
  "cat.ai": "الذكاء الاصطناعي",
  "cat.design": "التصميم",
  "cat.free": "الدورات المجانية",
  "cat.montage": "المونتاج جرافيك",
  "cat.content": "صناعة المحتوى",
  "cat.canva": "كانفا وتصميم",
  "cat.marketing": "التسويق الرقمي",

  // Cart
  "cart.title": "السلة",
  "cart.empty": "السلة فاضية. ابدأ ضيف كورسات لتجميع باكدج بخصم.",
  "cart.subtotal": "المجموع",
  "cart.bundleDiscount": "خصم الباكدج ({pct}%)",
  "cart.total": "الإجمالي",
  "cart.upsell": "ضيف كورس تاني وخد خصم أكبر — 2 كورسات 10% • 3 كورسات 15% • 4 فأكثر 20%",
  "cart.checkoutBundle": "اشترك في الباكدج",
  "cart.checkoutSingle": "اشترك الآن",
  "cart.clear": "تفريغ السلة",
  "cart.remove": "إزالة من السلة",
  "cart.add": "أضف للسلة",

  // Common Extras
  "common.currency": "ج.م",
  "common.delete": "حذف",
  "courses.allProfessional": "كل الكورسات الاحترافية",
  "courses.filter": "فلترة:",
};

const extraEn: Record<string, string> = {
  "common.or": "OR",
  "common.loading": "Loading…",
  "common.retry": "Retry",
  "common.email": "Email",
  "common.password": "Password",
  "common.emailPlaceholder": "you@example.com",
  "about.title": "About Us",
  "about.hero": "Specialized Egyptian learning platform",
  "about.p1": "Fekra Design is a specialized Egyptian learning platform offering professional Arabic-language courses in AI, digital marketing, design, and content creation. Our mission is to empower Arab youth with the digital skills required in the modern job market.",
  "about.p2": "We believe great education is a right for everyone, so we deliver high-quality content at affordable prices with local payment methods that fit the Egyptian market.",
  "contact.title": "Contact Us",
  "contact.email": "Email",
  "contact.phone": "Phone",
  "contact.address": "Address",
  "contact.addressValue": "Egypt — Alexandria",
  "help.title": "Help Center",
  "help.subtitle": "Here you'll find short tutorial videos to help you use the platform easily. Need more help? Contact us anytime.",
  "help.contactSupport": "Contact support",
  "help.empty": "No help videos yet — check back soon!",
  "terms.title": "Terms & Conditions",
  "terms.updated": "Last updated: May 2026",
  "privacy.title": "Privacy Policy",
  "privacy.updated": "Last updated: May 2026",
  "refund.title": "Refund Policy",
  "refund.subtitle": "7-day money-back guarantee",
  "login.title": "Sign In",
  "login.subtitle": "Welcome back to Fekra Design",
  "login.submit": "Sign In",
  "login.loading": "Signing in…",
  "login.forgot": "Forgot your password?",
  "login.noAccount": "Don't have an account?",
  "login.createAccount": "Create one",
  "register.title": "Create a new account",
  "register.subtitle": "Join thousands of students today",
  "register.fullName": "Full name",
  "register.phone": "Mobile number",
  "register.pwPlaceholder": "At least 6 characters",
  "register.showPw": "Show password",
  "register.hidePw": "Hide password",
  "register.pwStrength": "Password strength",
  "register.submit": "Create account",
  "register.loading": "Creating…",
  "register.hasAccount": "Already have an account?",
  "register.signIn": "Sign in",
  "forgot.title": "Forgot your password?",
  "forgot.subtitle": "We'll send you a reset link",
  "forgot.submit": "Send reset link",
  "forgot.loading": "Sending…",
  "forgot.sent": "Sent! Check your email (and spam folder) and click the link to reset your password.",
  "forgot.back": "Back to sign in",
  "reset.title": "Set a new password",
  "reset.subtitle": "Choose a strong password",
  "reset.newPw": "New password",
  "reset.confirmPw": "Confirm password",
  "reset.submit": "Update password",
  "reset.loading": "Saving…",
  "reset.checking": "Verifying recovery link... If nothing happens, request a new link from the \"Forgot password\" page.",
  "wishlist.title": "Wishlist",
  "wishlist.subtitle": "Here are the courses you saved to your wishlist:",
  "wishlist.errorLoad": "A temporary problem occurred while loading your wishlist.",
  "wishlist.empty": "You haven't added any courses to your wishlist yet.",
  "wishlist.browse": "Browse courses",
  "works.badge": "Student works",
  "works.title": "Creations by Fekra Design students",
  "works.subtitle": "A curated selection of top works — websites, motion graphics, brand identities, and graphic designs.",
  "courses.title": "All Courses",
  "courses.subtitle": "Discover the best professional courses in Arabic",
  "courses.available": "Available courses",
  "courses.searchPh": "Search for a course…",
  "courses.allCategories": "All categories",
  "courses.sortPopular": "Most popular",
  "courses.sortNewest": "Newest",
  "courses.sortPriceLow": "Price: low to high",
  "courses.sortPriceHigh": "Price: high to low",
  "courses.errorLoad": "A temporary problem occurred while loading courses.",
  "courses.noMatch": "No matching courses",
  "home.heroBadge": "Specialized Egyptian learning platform",
  "home.brand": "Fekra Design",
  "home.heroHeadline": "Professional courses in AI and design",
  "home.heroSub": "Online courses from anywhere, and offline in Alexandria — professional training in Arabic that prepares you for the job market.",
  "home.exploreCourses": "Explore courses",
  "home.dashboard": "Dashboard",
  "home.createFree": "Create your free account",
  "home.students": "Students",
  "home.course": "Courses",
  "home.satisfaction": "Satisfaction",
  "home.browseCats": "Browse categories",
  "home.browseCatsSub": "Pick your favorite category and discover available courses.",
  "home.latest": "Latest courses",
  "home.latestSub": "The most recent courses added to the platform.",
  "home.latestEmpty": "No recent courses available — check back soon!",
  "home.latestError": "A temporary problem occurred loading the latest courses. Try refreshing.",
  "home.coursesTitle": "Courses",
  "home.coursesSub": "Our courses are different — practical content, Arabic delivery, and expert trainers that actually prepare you for the market.",
  "home.viewAll": "View all courses",
  "home.coursesEmpty": "No courses available yet — check back soon!",
  "home.coursesError": "A temporary problem occurred loading courses. Open the courses page or try refreshing.",
  "home.whyEyebrow": "Why Fekra Design?",
  "home.whyTitle": "An unforgettable learning experience",
  "home.f1t": "Professional trainers",
  "home.f1d": "A selection of Egyptian and Arab market experts with years of hands-on experience.",
  "home.f2t": "100% Arabic content",
  "home.f2d": "Every lesson in Arabic with examples from the Egyptian market.",
  "home.f3t": "Refund guarantee",
  "home.f3d": "Not satisfied? Get your money back within 7 days — no questions asked.",
  "home.f4t": "Active community",
  "home.f4d": "Join thousands of students and interact with peers and trainers.",
  "home.f5t": "Course certificate",
  "home.f5d": "Get a completion certificate for every course you finish.",
  "home.f6t": "Continuously updated",
  "home.f6d": "Content that evolves to keep up with the latest technologies.",
  "home.testimonialsBadge": "Student reviews",
  "home.testimonialsTitle1": "Real success",
  "home.testimonialsTitle2": "stories",
  "home.testimonialsTitle3": "from our members",
  "home.testimonialsSub": "Hundreds of students whose careers changed after these courses — here are some of their real messages.",
  // Footer extras
  "footer.legal": "Legal",
  "footer.studentWorks": "Student Works",
  "footer.whatsappCta": "Chat on WhatsApp",
  "footer.facebook": "Facebook",
  "footer.whatsappLabel": "WhatsApp",
  "footer.instagram": "Instagram",
  "footer.youtube": "YouTube",

  // Home Testimonials & Reviews
  "home.satisfiedStudents": "+1,000 satisfied students",
  "home.latestReviewsEyebrow": "Latest Reviews",
  "home.latestReviewsTitle": "What our students say",
  "home.latestReviewsSub": "Every review and comment is from students who actually enrolled in our courses.",
  "home.latestReviewsEmpty": "Be the first to share your review on our courses!",
  "home.student": "Student",

  // Student Works
  "home.studentWorksEyebrow": "Student Works",
  "home.studentWorksTitle": "See student projects for yourself",
  "home.studentWorksSub": "Real projects and videos completed by our students after finishing the courses.",

  // Payment Methods
  "home.paymentEyebrow": "Payment Methods",
  "home.paymentTitle": "Pay the way that suits you best",
  "home.vodafoneCash": "Vodafone Cash",
  "home.vodafoneCashDesc": "Pay directly from your mobile wallet",
  "home.instapay": "InstaPay",
  "home.instapayDesc": "Instant transfer via InstaPay",
  "home.bankTransfer": "Bank Transfer",
  "home.bankTransferDesc": "Transfer from your bank account",

  // FAQ
  "home.faqEyebrow": "FAQ",
  "home.faqTitle": "Everything you need to know",
  "home.faq1Q": "How do I start learning?",
  "home.faq1A": "Create a free account, choose the suitable course, pay using your preferred payment method, and the course unlocks immediately upon approval.",
  "home.faq2Q": "Do I get a certificate?",
  "home.faq2A": "Yes, upon completing the course you receive an official completion certificate from Fekra Design.",
  "home.faq3Q": "How long do I have access to the course?",
  "home.faq3A": "Lifetime access to all your courses along with free updates.",
  "home.faq4Q": "Can I get a refund?",
  "home.faq4A": "Yes, you have 7 days from purchase date to request a refund via Paddle payment provider.",
  "home.faq5Q": "How long does payment verification take?",
  "home.faq5A": "Online payment (cards or digital wallets) is instant: your course is activated automatically. Manual bank transfer is reviewed within a few hours on business days.",

  // CTA
  "home.ctaTitle": "Ready to start your learning journey?",
  "home.ctaSub": "Join thousands of students who transformed their careers with Fekra Design.",
  "home.ctaBrowse": "Browse courses",
  "home.ctaStart": "Start for free now",

  // Certificate & Guarantee
  "home.certTitle": "Course Completion Certificate",
  "home.certDesc": "You will receive it upon finishing the course through the platform",
  "home.certImgAlt": "Fekra Design Course Completion Certificate Sample",
  "home.guaranteeTitle": "Guarantee",
  "home.guaranteeDesc": "You can get a full refund if the course did not benefit you. To review our refund policy, ",
  "home.clickHere": "click here",
  "home.enrollNow": "Enroll Now",

  // Categories & Chips
  "cat.ai": "Artificial Intelligence",
  "cat.design": "Graphic Design",
  "cat.free": "Free Courses",
  "cat.montage": "Video Editing",
  "cat.content": "Content Creation",
  "cat.canva": "Canva & Design",
  "cat.marketing": "Digital Marketing",

  // Cart
  "cart.title": "Cart",
  "cart.empty": "Your cart is empty. Start adding courses to build a discounted bundle.",
  "cart.subtotal": "Subtotal",
  "cart.bundleDiscount": "Bundle discount ({pct}%)",
  "cart.total": "Total",
  "cart.upsell": "Add another course for a bigger discount — 2 courses 10% • 3 courses 15% • 4+ courses 20%",
  "cart.checkoutBundle": "Subscribe to bundle",
  "cart.checkoutSingle": "Enroll now",
  "cart.clear": "Empty cart",
  "cart.remove": "Remove from cart",
  "cart.add": "Add to cart",

  // Common Extras
  "common.currency": "EGP",
  "common.delete": "Delete",
  "courses.allProfessional": "All Professional Courses",
  "courses.filter": "Filter:",
};

Object.assign(dict.ar, extraAr);
Object.assign(dict.en, extraEn);

// Dashboard (student) translations
const dashAr: Record<string, string> = {
  "dashboard.head.title": "لوحة الطالب — فكرة ديزاين",
  "dashboard.greeting": "أهلاً، {name} 👋",
  "dashboard.tagline": "كل كورساتك المشترك فيها في تبويب «كورساتي» تحت 👇",
  "dashboard.stats.enrolled": "كورس مشترك",
  "dashboard.stats.inProgress": "قيد المتابعة",
  "dashboard.stats.completed": "مكتمل",
  "dashboard.continue.resume": "✨ تابع من حيث وقفت",
  "dashboard.continue.start": "🚀 ابدأ كورسك",
  "dashboard.continue.cta": "ابدأ التعلم الآن",
  "dashboard.percentComplete": "{pct}% مكتمل",
  "dashboard.tabs.courses": "كورساتي",
  "dashboard.tabs.explore": "كورسات جديدة",
  "dashboard.tabs.certs": "الشهادات",
  "dashboard.tabs.orders": "الطلبات",
  "dashboard.tabs.settings": "الحساب",
  "dashboard.courses.emptyTitle": "لسه ما اشتركتش في كورس",
  "dashboard.courses.emptyDesc": "اختار كورسك من المكتبة وابدأ التعلم بضغطة زر",
  "dashboard.courses.browseCta": "تصفح الكورسات",
  "dashboard.courses.allMine": "كل كورساتي ({count})",
  "dashboard.courses.more": "المزيد من الكورسات",
  "dashboard.courses.unavailable": "كورس غير متاح حالياً",
  "dashboard.courses.badgeCompleted": "مكتمل",
  "dashboard.courses.congrats": "🎉 مبروك",
  "dashboard.courses.inProgress": "قيد المتابعة",
  "dashboard.courses.ready": "جاهز للبدء",
  "dashboard.courses.review": "مراجعة الكورس",
  "dashboard.courses.continue": "تابع التعلم",
  "dashboard.courses.start": "ابدأ الكورس",
  "dashboard.courses.notAvailable": "غير متاح",
  "dashboard.tip.title": "مش لاقي كورسك؟",
  "dashboard.tip.desc": "لو دفعت ومش شايف الكورس هنا، روح لتبويب «الطلبات» وتأكد من حالة الدفع، أو كلّمنا على واتساب من الزر الأخضر.",
  "dashboard.explore.title": "كورسات متاحة للاشتراك ({count})",
  "dashboard.explore.allCourses": "كل الكورسات",
  "dashboard.explore.empty": "انت مشترك في كل الكورسات المتاحة حالياً 🎉",
  "dashboard.explore.discount": "خصم",
  "dashboard.explore.details": "تفاصيل الكورس",
  "dashboard.explore.subscribe": "اشترك الآن",
  "dashboard.certs.empty": "أكمل أحد كورساتك للحصول على شهادتك بعد الكورس",
  "dashboard.certs.ready": "شهادة إتمام جاهزة",
  "dashboard.certs.download": "تحميل",
  "dashboard.orders.empty": "لا توجد طلبات بعد",
  "dashboard.orders.orderNo": "رقم الطلب:",
  "dashboard.orders.reason": "السبب:",
  "dashboard.orders.receipt": "تحميل الإيصال",
  "dashboard.orders.approved": "مقبول",
  "dashboard.orders.rejected": "مرفوض",
  "dashboard.orders.pending": "قيد المراجعة",
  "dashboard.settings.uploading": "جاري الرفع...",
  "dashboard.settings.changePhoto": "تغيير الصورة",
  "dashboard.settings.avatarHint": "JPG / PNG حتى 3MB",
  "dashboard.settings.name": "الاسم",
  "dashboard.settings.email": "البريد الإلكتروني",
  "dashboard.settings.phone": "رقم الموبايل",
  "dashboard.settings.save": "حفظ التغييرات",
  "dashboard.settings.saved": "تم تحديث البيانات",
  "dashboard.settings.avatarUpdated": "تم تحديث صورتك",
  "dashboard.settings.errImgOnly": "اختر ملف صورة فقط",
  "dashboard.settings.errSize": "الحد الأقصى 3MB",
  "dashboard.settings.errUpload": "تعذّر رفع الصورة",
  "dashboard.cert.done": "تم تحميل الشهادة 🎉",
  "dashboard.cert.err": "تعذّر إنشاء الشهادة",
  "dashboard.redeem.label": "عندك كود دخول؟",
  "dashboard.redeem.placeholder": "ادخل الكود هنا",
  "dashboard.redeem.activate": "تفعيل الكود",
  "dashboard.redeem.enterCode": "ادخل الكود",
  "dashboard.redeem.invalid": "كود غير صالح",
  "dashboard.redeem.used": "تم استخدام هذا الكود من قبل",
  "dashboard.redeem.notAuth": "يجب تسجيل الدخول أولاً",
  "dashboard.redeem.verifyFail": "تعذّر التحقق من الكود",
  "dashboard.redeem.alreadyEnrolled": "أنت مشترك في هذا الكورس بالفعل، لا حاجة لاستخدام الكود",
  "dashboard.redeem.confirmTitle": "تأكيد تفعيل الكود",
  "dashboard.redeem.confirmPrefix": "هتقوم بتفعيل الكورس:",
  "dashboard.redeem.warn": "⚠️ الكود يُستخدم مرة واحدة فقط ولن تستطيع استرداده مرة أخرى.",
  "dashboard.redeem.cancel": "إلغاء",
  "dashboard.redeem.activating": "جاري التفعيل...",
  "dashboard.redeem.confirm": "تأكيد التفعيل",
  "dashboard.redeem.activateFail": "تعذّر تفعيل الكود",
  "dashboard.redeem.added": "تمت إضافة الكورس 🎉",
  "dashboard.pay.checkingTitle": "جاري التحقق من حالة الدفع…",
  "dashboard.pay.checkingDesc": "من فضلك انتظر لحظات حتى نستلم تأكيد الدفع.",
  "dashboard.pay.approvedTitle": "تم اعتماد الدفع وتفعيل الكورس بنجاح 🎉",
  "dashboard.pay.approvedDescNamed": "الكورس {title} أصبح متاحًا الآن. سيتم فتحه تلقائياً…",
  "dashboard.pay.approvedDesc": "كورسك أصبح متاحًا الآن. سيتم فتحه تلقائياً…",
  "dashboard.pay.openCourse": "افتح الكورس",
  "dashboard.pay.pendingTitle": "طلبك مازال قيد المعالجة",
  "dashboard.pay.pendingDesc": "استلمنا محاولة الدفع لكن لسه ما وصلناش تأكيد نهائي من بوابة الدفع. ده طبيعي وممكن ياخد دقايق قليلة. هنفعّل الكورس تلقائيًا فور وصول التأكيد، وهتلاقيه في تبويب «كورساتي».",
  "dashboard.pay.refresh": "تحديث الصفحة",
  "dashboard.pay.hide": "إخفاء",
  "dashboard.pay.timeoutTitle": "لم نستلم بيانات الدفع بعد",
  "dashboard.pay.timeoutDesc": "لو كان الخصم تم من حسابك، انتظر دقايق قليلة ثم حدّث الصفحة. لو لم يتم الخصم يمكنك إعادة المحاولة من صفحة الكورس.",
  "dashboard.popupBlocked": "السماح بالنوافذ المنبثقة مطلوب",
  "currency.egp": "ج.م",
};

const dashEn: Record<string, string> = {
  "dashboard.head.title": "Student Dashboard — Fekra Design",
  "dashboard.greeting": "Hello, {name} 👋",
  "dashboard.tagline": "All your enrolled courses are under the \"My Courses\" tab below 👇",
  "dashboard.stats.enrolled": "Enrolled",
  "dashboard.stats.inProgress": "In progress",
  "dashboard.stats.completed": "Completed",
  "dashboard.continue.resume": "✨ Continue where you left off",
  "dashboard.continue.start": "🚀 Start your course",
  "dashboard.continue.cta": "Start learning now",
  "dashboard.percentComplete": "{pct}% complete",
  "dashboard.tabs.courses": "My Courses",
  "dashboard.tabs.explore": "New Courses",
  "dashboard.tabs.certs": "Certificates",
  "dashboard.tabs.orders": "Payment History",
  "dashboard.tabs.settings": "Account",
  "dashboard.courses.emptyTitle": "You haven't enrolled in any course yet",
  "dashboard.courses.emptyDesc": "Pick a course from the library and start learning in one click",
  "dashboard.courses.browseCta": "Browse courses",
  "dashboard.courses.allMine": "All my courses ({count})",
  "dashboard.courses.more": "More courses",
  "dashboard.courses.unavailable": "Course currently unavailable",
  "dashboard.courses.badgeCompleted": "Completed",
  "dashboard.courses.congrats": "🎉 Congrats",
  "dashboard.courses.inProgress": "In progress",
  "dashboard.courses.ready": "Ready to start",
  "dashboard.courses.review": "Review course",
  "dashboard.courses.continue": "Continue learning",
  "dashboard.courses.start": "Start course",
  "dashboard.courses.notAvailable": "Unavailable",
  "dashboard.tip.title": "Can't find your course?",
  "dashboard.tip.desc": "If you've paid but don't see the course here, check the \"Payment History\" tab, or message us on WhatsApp using the green button.",
  "dashboard.explore.title": "Courses available to enroll ({count})",
  "dashboard.explore.allCourses": "All courses",
  "dashboard.explore.empty": "You're enrolled in every available course 🎉",
  "dashboard.explore.discount": "Discount",
  "dashboard.explore.details": "Course details",
  "dashboard.explore.subscribe": "Enroll now",
  "dashboard.certs.empty": "Finish one of your courses to unlock your certificate",
  "dashboard.certs.ready": "Completion certificate ready",
  "dashboard.certs.download": "Download",
  "dashboard.orders.empty": "No orders yet",
  "dashboard.orders.orderNo": "Order #:",
  "dashboard.orders.reason": "Reason:",
  "dashboard.orders.receipt": "Download receipt",
  "dashboard.orders.approved": "Approved",
  "dashboard.orders.rejected": "Rejected",
  "dashboard.orders.pending": "Under review",
  "dashboard.settings.uploading": "Uploading...",
  "dashboard.settings.changePhoto": "Change photo",
  "dashboard.settings.avatarHint": "JPG / PNG up to 3MB",
  "dashboard.settings.name": "Name",
  "dashboard.settings.email": "Email",
  "dashboard.settings.phone": "Mobile number",
  "dashboard.settings.save": "Save changes",
  "dashboard.settings.saved": "Profile updated",
  "dashboard.settings.avatarUpdated": "Photo updated",
  "dashboard.settings.errImgOnly": "Select an image file only",
  "dashboard.settings.errSize": "Max size is 3MB",
  "dashboard.settings.errUpload": "Could not upload the photo",
  "dashboard.cert.done": "Certificate downloaded 🎉",
  "dashboard.cert.err": "Could not generate the certificate",
  "dashboard.redeem.label": "Got an access code?",
  "dashboard.redeem.placeholder": "Enter your code here",
  "dashboard.redeem.activate": "Activate code",
  "dashboard.redeem.enterCode": "Enter the code",
  "dashboard.redeem.invalid": "Invalid code",
  "dashboard.redeem.used": "This code has already been used",
  "dashboard.redeem.notAuth": "You must sign in first",
  "dashboard.redeem.verifyFail": "Could not verify the code",
  "dashboard.redeem.alreadyEnrolled": "You're already enrolled in this course — no need to use the code",
  "dashboard.redeem.confirmTitle": "Confirm code activation",
  "dashboard.redeem.confirmPrefix": "You are about to activate the course:",
  "dashboard.redeem.warn": "⚠️ The code can only be used once and cannot be recovered.",
  "dashboard.redeem.cancel": "Cancel",
  "dashboard.redeem.activating": "Activating...",
  "dashboard.redeem.confirm": "Confirm activation",
  "dashboard.redeem.activateFail": "Could not activate the code",
  "dashboard.redeem.added": "Course added 🎉",
  "dashboard.pay.checkingTitle": "Checking payment status…",
  "dashboard.pay.checkingDesc": "Please wait a moment while we receive payment confirmation.",
  "dashboard.pay.approvedTitle": "Payment approved and course activated 🎉",
  "dashboard.pay.approvedDescNamed": "The course {title} is now available. It will open automatically…",
  "dashboard.pay.approvedDesc": "Your course is now available. It will open automatically…",
  "dashboard.pay.openCourse": "Open course",
  "dashboard.pay.pendingTitle": "Your order is still processing",
  "dashboard.pay.pendingDesc": "We received your payment attempt but haven't received final confirmation from the payment gateway yet. This is normal and may take a few minutes. We'll activate the course automatically once confirmation arrives — you'll find it in the \"My Courses\" tab.",
  "dashboard.pay.refresh": "Refresh page",
  "dashboard.pay.hide": "Hide",
  "dashboard.pay.timeoutTitle": "We haven't received payment data yet",
  "dashboard.pay.timeoutDesc": "If your account was charged, wait a few minutes and refresh. If not, you can try again from the course page.",
  "dashboard.popupBlocked": "Please allow pop-ups",
  "currency.egp": "EGP",
};

Object.assign(dict.ar, dashAr);
Object.assign(dict.en, dashEn);

function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let text = dict[locale][key] ?? dict["ar"][key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_, paramKey) => String(params[paramKey] ?? ""));
  }
  return text;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with "ar" for SSR consistency, then sync from localStorage after mount.
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    // After mount, read saved preference
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en") setLocaleState("en");
    } catch {
      // ignore
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const dir: "rtl" | "ltr" = locale === "ar" ? "rtl" : "ltr";
  const isAr = locale === "ar";
  const isEn = locale === "en";

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, dir, t, isAr, isEn }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
