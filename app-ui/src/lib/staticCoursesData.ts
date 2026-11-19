export interface StaticCourse {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  image_url: string;
  price: number;
  discount_price: number | null;
  level: "مبتدئ" | "متوسط" | "متقدم" | "كل المستويات";
  is_free?: boolean;
  category: string;
  category_slug: string;
  instructor_name: string;
  rating: number;
  reviews_count: number;
  students_count: number;
  duration: string;
  lessons_count: number;
}

export interface StaticBundle {
  id: string;
  slug: string;
  title: string;
  image_url: string;
  courses_count: number;
  courses_names: string[];
  price: number;
  discount_price: number;
  description: string;
}

export interface StaticReview {
  id: string;
  user_name: string;
  avatar_url?: string | null;
  rating: number;
  comment: string;
  course_title: string;
  course_slug: string;
}

export interface StaticVideoReview {
  id: string;
  title: string;
  thumbnail_url: string;
  vimeo_url: string;
}

export const STATIC_CATEGORIES = [
  {
    id: "motiongraphic",
    title: "الموشن جرافيك",
    gradient: "linear-gradient(259deg, #ff006f, #d7284b)",
    icon: "motion",
    count: 14,
  },
  {
    id: "design",
    title: "التصميم",
    gradient: "linear-gradient(259deg, #9930df, #8c00ff)",
    icon: "design",
    count: 11,
  },
  {
    id: "content",
    title: "صناعة المحتوى",
    gradient: "linear-gradient(259deg, #df4130, #ff2600)",
    icon: "content",
    count: 8,
  },
  {
    id: "videoediting",
    title: "مونتاج الفيديو",
    gradient: "linear-gradient(259deg, #3073df, #0055ff)",
    icon: "video",
    count: 9,
  },
  {
    id: "3ddesign",
    title: "الثري دي",
    gradient: "linear-gradient(259deg, #df30d0, #e100ff)",
    icon: "3d",
    count: 6,
  },
  {
    id: "webdesign",
    title: "تصميم المواقع والتطبيقات",
    gradient: "linear-gradient(259deg, #44886a, #369145)",
    icon: "web",
    count: 7,
  },
  {
    id: "ai-creation",
    title: "الذكاء الإصطناعي",
    gradient: "linear-gradient(259deg, #0033ff, #6600ff)",
    icon: "ai",
    count: 12,
  },
  {
    id: "free",
    title: "الدورات المجانية",
    gradient: "linear-gradient(259deg, #0cd74a, #02ffbb)",
    icon: "free",
    count: 15,
  },
];

export const STATIC_LATEST_COURSES: StaticCourse[] = [
  {
    id: "c-1",
    slug: "aicreation-kids",
    title: "مغامرات الذكاء الاصطناعي للأطفال",
    short_description: "كورس تفاعلي لتعليم الأطفال كيفية استخدام أدوات الذكاء الاصطناعي في الرسم والقصص والبرمجة البسيطة.",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    price: 35,
    discount_price: 25,
    level: "مبتدئ",
    category: "الذكاء الإصطناعي",
    category_slug: "ai-creation",
    instructor_name: "م. حسام الدين",
    rating: 5.0,
    reviews_count: 12,
    students_count: 12,
    duration: "4 ساعات",
    lessons_count: 22,
  },
  {
    id: "c-2",
    slug: "premiere-pro",
    title: "كورس المونتاج بـ Adobe Premiere Pro مع تقنيات الـ AI",
    short_description: "احتراف تحرير الفيديو والمونتاج الإعلاني والسينمائي باستخدام أدوات بريمير برو الحديثة والذكاء الاصطناعي.",
    image_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80",
    price: 65,
    discount_price: 49,
    level: "مبتدئ",
    category: "مونتاج الفيديو",
    category_slug: "videoediting",
    instructor_name: "م. حسام الدين",
    rating: 5.0,
    reviews_count: 34,
    students_count: 34,
    duration: "10 ساعات",
    lessons_count: 48,
  },
  {
    id: "c-3",
    slug: "ai-content",
    title: "ورشة صناعة المحتوى بالذكاء الاصطناعي",
    short_description: "ورشة عمل مجانية لتعلم كيفية كتابة المحتوى، صناعة الصور، وإعداد الفيديوهات الاحترافية بسرعة خيالية.",
    image_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
    price: 0,
    discount_price: 0,
    level: "مبتدئ",
    is_free: true,
    category: "صناعة المحتوى",
    category_slug: "content",
    instructor_name: "م. حسام الدين",
    rating: 4.8,
    reviews_count: 512,
    students_count: 4358,
    duration: "3 ساعات",
    lessons_count: 14,
  },
  {
    id: "c-4",
    slug: "ai-video-creation",
    title: "كورس صناعة الفيديوهات بالذكاء الاصطناعي",
    short_description: "تعلم توليد الفيديوهات الكاملة والشخصيات الناطقة وتعديل الصوت والمؤثرات باستخدام أقوى نماذج الذكاء الاصطناعي.",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    price: 75,
    discount_price: 55,
    level: "كل المستويات",
    category: "الذكاء الإصطناعي",
    category_slug: "ai-creation",
    instructor_name: "م. حسام الدين",
    rating: 4.7,
    reviews_count: 820,
    students_count: 6559,
    duration: "8 ساعات",
    lessons_count: 36,
  },
];

export const STATIC_FEATURED_COURSES: StaticCourse[] = [
  {
    id: "c-5",
    slug: "motion-collage",
    title: "كورس الموشن جرافيك المتقدم | تحريك كولاج أرت بالافترافكت",
    short_description: "دورة تخصصية في فن تحريك الكولاج واستخراج العناصر ودمج المشاهد التاريخية والحديثة بطريقة إبداعية.",
    image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
    price: 60,
    discount_price: 45,
    level: "متقدم",
    category: "الموشن جرافيك",
    category_slug: "motiongraphic",
    instructor_name: "م. حسام الدين",
    rating: 4.8,
    reviews_count: 98,
    students_count: 633,
    duration: "7 ساعات",
    lessons_count: 32,
  },
  {
    id: "c-6",
    slug: "ui-ux-design-in-figma",
    title: "كورس فيجما لتصميم واجهات المستخدم | UI / UX Design in Figma",
    short_description: "تعلم تصميم التطبيقات والمواقع التفاعلية من الصفر حتى تجهيز الملفات للمطورين عبر فيجما.",
    image_url: "https://images.unsplash.com/photo-1581291518655-9523c932dedb?w=800&auto=format&fit=crop&q=80",
    price: 50,
    discount_price: 39,
    level: "مبتدئ",
    category: "تصميم المواقع والتطبيقات",
    category_slug: "webdesign",
    instructor_name: "م. حسام الدين",
    rating: 4.8,
    reviews_count: 42,
    students_count: 263,
    duration: "9 ساعات",
    lessons_count: 40,
  },
  {
    id: "c-7",
    slug: "chroma-key-and-motion-graphics-course",
    title: "Chroma Key and Motion Graphics Course",
    short_description: "تقنيات عزل الكروما الخضراء والمؤثرات البصرية وتنسيق المشاهد المتحركة بأعلى جودة.",
    image_url: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800&auto=format&fit=crop&q=80",
    price: 45,
    discount_price: 35,
    level: "متوسط",
    category: "الموشن جرافيك",
    category_slug: "motiongraphic",
    instructor_name: "م. حسام الدين",
    rating: 4.8,
    reviews_count: 56,
    students_count: 345,
    duration: "6 ساعات",
    lessons_count: 28,
  },
  {
    id: "c-8",
    slug: "character-animation-in-after-effects-duik-angela-script",
    title: "Character Animation in After Effects",
    short_description: "تحريك الشخصيات وتجهيز المفاصل والريجينج باستخدام سكريبت Duik Angela داخل After Effects.",
    image_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
    price: 70,
    discount_price: 55,
    level: "متقدم",
    category: "الموشن جرافيك",
    category_slug: "motiongraphic",
    instructor_name: "م. حسام الدين",
    rating: 4.9,
    reviews_count: 85,
    students_count: 427,
    duration: "11 ساعة",
    lessons_count: 52,
  },
  {
    id: "c-9",
    slug: "editcapcut",
    title: "Master Video Editing in CapCut for PC",
    short_description: "كورس عملي مكثف لاحتراف المونتاج السريع على الحاسوب لإنتاج فيديوهات تيك توك وريلز ويوتيوب شورتس.",
    image_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80",
    price: 35,
    discount_price: 25,
    level: "مبتدئ",
    category: "مونتاج الفيديو",
    category_slug: "videoediting",
    instructor_name: "م. حسام الدين",
    rating: 4.8,
    reviews_count: 310,
    students_count: 2972,
    duration: "5 ساعات",
    lessons_count: 26,
  },
  {
    id: "c-10",
    slug: "motion-graphic-course",
    title: "كورس الموشن جرافيك من الصفر للاحتراف | Motion Graphics Course",
    short_description: "الدورة الشاملة الأكثر مبيعاً: من الصفر حتى العمل كفريلانسر وإنتاج مشاريع تجارية متكاملة.",
    image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
    price: 90,
    discount_price: 69,
    level: "كل المستويات",
    category: "الموشن جرافيك",
    category_slug: "motiongraphic",
    instructor_name: "م. حسام الدين",
    rating: 4.9,
    reviews_count: 140,
    students_count: 867,
    duration: "14 ساعة",
    lessons_count: 65,
  },
  {
    id: "c-11",
    slug: "motion-basfar",
    title: "كورس الموشن جرافيك المتقدم | مشروع باصفار",
    short_description: "تطبيق عملي كامل على إعلان تجاري حقيقي خطوة بخطوة من ملفات الإليستريتور إلى الريندر النهائي.",
    image_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
    price: 55,
    discount_price: 40,
    level: "متقدم",
    category: "الموشن جرافيك",
    category_slug: "motiongraphic",
    instructor_name: "م. حسام الدين",
    rating: 4.9,
    reviews_count: 73,
    students_count: 470,
    duration: "6 ساعات",
    lessons_count: 30,
  },
];

export const STATIC_BUNDLES: StaticBundle[] = [
  {
    id: "b-1",
    slug: "motion-graphic-bundle",
    title: "باقة الموشن جرافيك الشاملة",
    image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
    courses_count: 6,
    courses_names: [
      "كورس الموشن جرافيك من الصفر للاحتراف",
      "كورس الموشن جرافيك المتقدم | تحريك كولاج أرت",
      "كورس تحريك الشخصيات في After Effects",
      "كورس Chroma Key والمؤثرات البصرية",
      "مشروع باصفار التجاري",
      "تطبيقات أفترافكتس المتقدمة",
    ],
    price: 340,
    discount_price: 199,
    description: "الباقة الأكثر شمولاً لاحتراف صناعة وتحريك الإعلانات والفيديوهات الترويجية من الصفر حتى الاحتراف.",
  },
  {
    id: "b-2",
    slug: "graphic-bundle",
    title: "باقة الجرافيك ديزاين الشاملة",
    image_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
    courses_count: 5,
    courses_names: [
      "كورس أدوبي إليستريتور الشامل",
      "كورس أدوبي فوتوشوب للمصممين",
      "تصميم السوشيال ميديا والهويات البصرية",
      "كورس فيجما لتصميم واجهات المستخدم UI/UX",
      "أساسيات الطباعة واختيار الألوان",
    ],
    price: 280,
    discount_price: 165,
    description: "كل ما تحتاجه لتصبح مصمم جرافيك متكامل قادر على تصميم الهويات والسوشيال ميديا وواجهات المستخدم.",
  },
];

export const STATIC_REVIEWS: StaticReview[] = [
  {
    id: "r-real-1",
    user_name: "hamo ahmed",
    avatar_url: null,
    rating: 5,
    comment: "احلي واسهل شرح شوفته في حياتي مع توفير الادوات لمده سنه مجانا ومتابعه وغير جروب الواتساب وان حضرتك بترد علينا في اي وقت وبترد علينا بنفسك والتحديثات المجانيه كمان يعني حرفيا حضرتك موفر لينا كل حاجه بجد شكرا ليك علي كل حاجه عملتها معانا",
    course_title: "كورس ذكاء اصطناعي..",
    course_slug: "kwrs-aldhka-alastnaay-alahtrafy",
  },
  {
    id: "r-real-2",
    user_name: "nadia salah",
    avatar_url: null,
    rating: 5,
    comment: "الكورس ممتاز جدا واستفدت منه جدا في شغلي وحقيقي سعيدة بالكورس ده شكرا باشا مهندس ميدو",
    course_title: "كورس الذكاء الاصطناعي للمعلمين",
    course_slug: "kwrs-aldhka-alastnaay-llmalmyn",
  },
  {
    id: "r-real-3",
    user_name: "Manal mohamed",
    avatar_url: null,
    rating: 5,
    comment: "الكورس ممتع وسهل جدا بفضل بشمهندس ميدو...وبوفركل اداه مجانا عشان يساعدك تشتغل من غير متشيل هم للاشتراك وبرد اى وقت بجد مفيش كلام يشكرو",
    course_title: "كورس ذكاء اصطناعي..",
    course_slug: "kwrs-aldhka-alastnaay-alahtrafy",
  },
  {
    id: "r-real-4",
    user_name: "Amira Hassan",
    avatar_url: "https://ykzwmwczktqricjizqie.supabase.co/storage/v1/object/public/avatars/98f9aca7-f82c-4f03-8d3c-17bc14dae5ca/avatar-1778390355208.png",
    rating: 5,
    comment: "شرح فى غاية الدقة والتفصيل.. وتصميم المواقع بالذكاء الاصطناعي أصبح أسهل بكثير بفضل أسلوب الشرح العملي والمباشر👍👍",
    course_title: "تصميم المواقع بالذكاء الاصطناعي",
    course_slug: "ai-web-design",
  },
  {
    id: "r-real-5",
    user_name: "Menna elaraby",
    avatar_url: null,
    rating: 5,
    comment: "حلو جداً الكورس وباشمهندس محمد ماشاء الله عليه بيشرح بطريقة سهلة وتوصل المعلومة كويس جداً .. انصحكم بيه 🥰",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-6",
    user_name: "احمد ربيع",
    avatar_url: null,
    rating: 5,
    comment: "الكورس جميل جدا ماشاء الله ربنا يخليك بشمهندس ميدو ❤️❤️",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-7",
    user_name: "زيزى على",
    avatar_url: null,
    rating: 5,
    comment: "ممتاز والشرح مبسط واستفدت جدا رغم انى مبتدأة واحب اشكر بشمهندس ميدو على اهتمامه واستجابته لأى سؤال وأى مساعدة",
    course_title: "كورس ذكاء اصطناعي..",
    course_slug: "kwrs-aldhka-alastnaay-alahtrafy",
  },
  {
    id: "r-real-8",
    user_name: "Makah Mhmd",
    avatar_url: null,
    rating: 5,
    comment: "بشمهندس ميدو فوق الممتاز كفايه صبرو علينا والله استفدت من الكورس معاه جداااا جدااااااا",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-9",
    user_name: "Eman mahmoud",
    avatar_url: null,
    rating: 5,
    comment: "احسن واحلي كورس ربنا يجازيك خير بشمهندس ميدو ومش بتتاخر عن حد في اي حاجه يطلبها",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-10",
    user_name: "إيمان أنور",
    avatar_url: null,
    rating: 5,
    comment: "رائع..أفضل مكان لتعلم ال ai والتطبيقات العملية المفيدة لسوق العمل",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-11",
    user_name: "Yasmine Hany",
    avatar_url: null,
    rating: 5,
    comment: "جميل جدا استفدت كتير وانشاء الله مش اخر تجربه ومكملين في باقي الكورسات",
    course_title: "كورس ذكاء اصطناعي..",
    course_slug: "kwrs-aldhka-alastnaay-alahtrafy",
  },
  {
    id: "r-real-12",
    user_name: "علا عبد العزيز",
    avatar_url: null,
    rating: 5,
    comment: "الكورس سهل و أكثر من رائع وتطبيق عملي خطوة بخطوة",
    course_title: "كورس ذكاء اصطناعي للمبتدئين",
    course_slug: "kwrs-dhka-astnaay-llmbtdyyn",
  },
  {
    id: "r-real-13",
    user_name: "Omnia",
    avatar_url: null,
    rating: 5,
    comment: "الكورس ممتاز ومفيد جدا اشكرك وبالتوفيق دائماً",
    course_title: "كورس الذكاء الاصطناعي للمعلمين",
    course_slug: "kwrs-aldhka-alastnaay-llmalmyn",
  },
];

export const STATIC_VIDEO_REVIEWS: StaticVideoReview[] = [
  {
    id: "v-1",
    title: "رأي الطالب أحمد حول باقة الموشن جرافيك",
    thumbnail_url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80",
    vimeo_url: "https://player.vimeo.com/video/1058477380",
  },
  {
    id: "v-2",
    title: "تجربة سارة في كورس صناعة الفيديوهات بالـ AI",
    thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    vimeo_url: "https://player.vimeo.com/video/1058477344",
  },
  {
    id: "v-3",
    title: "قصة نجاح محمود في العمل الحر بعد الدورة",
    thumbnail_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
    vimeo_url: "https://player.vimeo.com/video/1058477319",
  },
  {
    id: "v-4",
    title: "تقييم كورس المونتاج وتعديل الألوان",
    thumbnail_url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
    vimeo_url: "https://player.vimeo.com/video/1058477295",
  },
  {
    id: "v-5",
    title: "رأي كريم حول ورش العمل المجانية والتطبيق المباشر",
    thumbnail_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
    vimeo_url: "https://player.vimeo.com/video/1058477227",
  },
];

export const STATIC_COURSES: StaticCourse[] = [
  ...STATIC_LATEST_COURSES,
  ...STATIC_FEATURED_COURSES,
];

export interface StaticLesson {
  id: string;
  title: string;
  duration: string;
  is_preview?: boolean;
  video_url?: string;
}

export interface StaticModule {
  id: string;
  title: string;
  order_index: number;
  lessons: StaticLesson[];
}

export interface StaticCourseDetail extends StaticCourse {
  description: string;
  preview_video_url: string;
  what_you_learn: string[];
  suitable_for: string[];
  requirements: string[];
  modules: StaticModule[];
}

export function getStaticCourseBySlug(slug: string): StaticCourseDetail | undefined {
  const c = STATIC_COURSES.find((item) => item.slug === slug);
  if (!c) return undefined;

  const defaultModules: StaticModule[] = [
    {
      id: "mod-1",
      title: "الفصل الأول: المقدمة وبيئة العمل",
      order_index: 1,
      lessons: [
        {
          id: "les-1-1",
          title: "مقدمة الكورس وخارطة الطريق الاحترافية",
          duration: "08:45",
          is_preview: true,
          video_url: "https://player.vimeo.com/video/1058477380",
        },
        {
          id: "les-1-2",
          title: "تحميل وتثبيت البرامج والملحقات المطلوبة",
          duration: "12:20",
          is_preview: true,
          video_url: "https://player.vimeo.com/video/1058477344",
        },
        {
          id: "les-1-3",
          title: "جولة شاملة في واجهة العمل وضبط التفضيلات",
          duration: "15:10",
          is_preview: false,
        },
      ],
    },
    {
      id: "mod-2",
      title: "الفصل الثاني: المفاهيم والأسس التطبيقية",
      order_index: 2,
      lessons: [
        {
          id: "les-2-1",
          title: "القواعد الذهبية وتنسيق المشاهد والعناصر",
          duration: "18:30",
          is_preview: false,
        },
        {
          id: "les-2-2",
          title: "تطبيقات وتدريبات عملية خطوة بخطوة",
          duration: "24:15",
          is_preview: false,
        },
        {
          id: "les-2-3",
          title: "تقنيات تسريع وتيرة الإنتاج واختصارات لوحة المفاتيح",
          duration: "14:40",
          is_preview: false,
        },
      ],
    },
    {
      id: "mod-3",
      title: "الفصل الثالث: التقنيات المتقدمة وأدوات الذكاء الاصطناعي",
      order_index: 3,
      lessons: [
        {
          id: "les-3-1",
          title: "توظيف أدوات الذكاء الاصطناعي لرفع كفاءة المشروع",
          duration: "21:05",
          is_preview: false,
        },
        {
          id: "les-3-2",
          title: "معالجة الألوان والمؤثرات الصوتية والبصرية",
          duration: "19:50",
          is_preview: false,
        },
        {
          id: "les-3-3",
          title: "حل المشكلات الشائعة وتفادي أخطاء المبتدئين",
          duration: "16:25",
          is_preview: false,
        },
      ],
    },
    {
      id: "mod-4",
      title: "الفصل الرابع: المشروع التجاري الشامل والريندر",
      order_index: 4,
      lessons: [
        {
          id: "les-4-1",
          title: "بناء مشروع إعلاني حقيقي من الألف إلى الياء",
          duration: "32:10",
          is_preview: false,
        },
        {
          id: "les-4-2",
          title: "إعدادات التصدير والريندر بأعلى جودة وأقل حجم",
          duration: "11:40",
          is_preview: false,
        },
        {
          id: "les-4-3",
          title: "نصائح العمل الحر وكيفية تسعير خدماتك للعملاء",
          duration: "17:15",
          is_preview: false,
        },
      ],
    },
  ];

  return {
    ...c,
    description: `في هذا الكورس العملي المكثف ستتعلم ${c.title} بأسلوب مبسط ومباشر. ستنتقل خطوة بخطوة من المفاهيم الأساسية وحتى التطبيقات المتقدمة والمشاريع التجارية الحقيقية.

تم تصميم هذا المسار ليركز على التطبيق العملي بنسبة 100% دون حشو نظري، مع توفير كافة الملفات والملحقات التدريبية المفتوحة لكل درس. ستتعلم أيضاً كيفية الاستفادة من أحدث أدوات الذكاء الاصطناعي لتسريع وتيرة إنتاجك وتحقيق نتائج مبهرة تليق بسوق العمل.`,
    preview_video_url: "https://player.vimeo.com/video/1058477380",
    what_you_learn: [
      "إتقان كافة الأدوات والتقنيات العملية خطوة بخطوة",
      "فهم سير العمل الاحترافي من الفكرة حتى التسليم النهائي",
      "استخدام تقنيات الذكاء الاصطناعي لرفع سرعة وجودة الإنتاج",
      "إنتاج مشاريع حقيقية متكاملة لإضافتها مباشرة لمعرض أعمالك",
      "استراتيجيات التسعير وعرض الخدمات والحصول على عملاء في العمل الحر",
      "الحصول على شهادة إتمام معتمدة لتوثيق مهاراتك",
    ],
    suitable_for: [
      "تريد تعلم مهارة مطلوبة في سوق العمل وبدء دخل مادي منها",
      "صانع محتوى أو مسوق تريد إنتاج محتوى احترافي لجمهورك",
      "مصمم أو مونتير تريد تطوير مهاراتك ومواكبة أدوات العصر",
      "مبتدئ تبحث عن مسار عملي منظم خطوة بخطوة دون تشتت",
    ],
    requirements: [
      "لا يشترط أي خبرة سابقة، نبدأ معك من الصفر تماماً",
      "جهاز كمبيوتر أو لابتوب بمواصفات متوسطة واتصال بالإنترنت",
      "الشغف والرغبة الجادة في التطبيق العملي المستمر",
    ],
    modules: defaultModules,
  };
}

export function getStaticCourseById(id: string): StaticCourseDetail | undefined {
  const c = STATIC_COURSES.find((item) => item.id === id);
  if (!c) return undefined;
  return getStaticCourseBySlug(c.slug);
}
