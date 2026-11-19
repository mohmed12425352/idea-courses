import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, ShieldCheck, ZoomIn, X } from "lucide-react";
import certificateIdeaCourses from "@/assets/certificate-idea-courses.jpg";

export function CertificateSection() {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="platform-cert-box">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Certificate Image Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div
              onClick={() => setIsZoomed(true)}
              className="relative group cursor-pointer"
              title="انقر لتكبير الشهادة وعرض التفاصيل"
            >
              <div className="absolute -inset-2 bg-gradient-to-r from-[#e50914]/40 to-[#f5c518]/30 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
              <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#1b1717] group-hover:border-[#e50914] transition-all duration-300">
                <img
                  src={certificateIdeaCourses}
                  alt="نموذج شهادة إتمام الدورة المعتمدة — Idea Courses"
                  loading="lazy"
                  className="max-h-[300px] w-auto object-contain transition-transform duration-500 group-hover:scale-105"
                />

                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#e50914] text-white flex items-center justify-center shadow-lg shadow-[#e50914]/50 scale-90 group-hover:scale-100 transition-transform duration-200">
                    <ZoomIn className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Texts & Guarantee */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Completion Certificate Box */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-[#252121] border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center shrink-0">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg mb-1">شهادة إتمام الكورس</h4>
                <p className="text-white/75 text-sm leading-relaxed">
                  ستحصل على شهادة إتمام رقمية برمز تحقق بعد إتمام مشاهدة دروس الكورس والتطبيق العملي.
                </p>
              </div>
            </div>

            {/* Money-Back Guarantee Box */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-[#252121] border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-[#5aca26]/15 text-[#5aca26] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg mb-1">ضمان استرجاع الأموال</h4>
                <p className="text-white/75 text-sm leading-relaxed">
                  تقدر تسترجع إشتراكك بالكامل في حالة عدم الإستفادة من الكورس. للاطلاع على{" "}
                  <Link to="/refund" className="text-[#e50914] underline hover:text-[#f5c518]">
                    قواعد سياسة الاسترجاع الخاصة بنا اضغط هنا
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Subscribe Action */}
            <div className="pt-2">
              <Link to="/register" className="main__btn text-base px-8 py-3 shadow-lg shadow-[#e50914]/25">
                إشترك الآن
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Certificate Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute -top-12 left-0 sm:left-auto sm:-right-2 z-10 w-9 h-9 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Certificate High-Res Image Container */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 bg-[#121212] shadow-2xl max-h-[85vh] flex items-center justify-center p-2">
              <img
                src={certificateIdeaCourses}
                alt="شهادة إتمام الدورة المعتمدة — Idea Courses"
                className="max-h-[82vh] w-auto max-w-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Caption */}
            <div className="mt-3 px-5 py-1.5 rounded-full bg-black/80 border border-white/10 text-xs font-bold text-white/90 shadow-md flex items-center gap-2">
              <Award className="w-4 h-4 text-[#f5c518]" />
              <span>نموذج شهادة إتمام معتمدة بكود تحقق رسمي — منصة Idea Courses</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
