import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { STATIC_BUNDLES } from "@/lib/staticCoursesData";
import { CustomBundleModal } from "./CustomBundleModal";

export function CourseBundles() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      {/* Section Header */}
      <div className="text-right mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white">باقات الكورسات</h2>
        <p className="text-white/70 text-sm mt-1">الآن يمكنك الإشتراك في باقات الكورسات التعليمية المتاحة وتوفير المزيد</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {STATIC_BUNDLES.map((bundle) => (
          <div key={bundle.id} className="platform-product group bg-[#1e1b1b] p-3 border border-white/5">
            {/* Image */}
            <div className="platform-product__img">
              <img src={bundle.image_url} alt={bundle.title} loading="lazy" />
              <div className="platform-product__labels">
                <span className="platform-product__label platform-product__label--gray">
                  {bundle.courses_count} دورات
                </span>
              </div>
              <Link
                to="/courses"
                search={{ type: "bundle" } as any}
                className="platform-product__overlay"
                title="تفاصيل الباقة"
              >
                تفاصيل الباقة
              </Link>
            </div>

            {/* Title & Details */}
            <div className="p-2 mt-2">
              <Link
                to="/courses"
                search={{ type: "bundle" } as any}
                className="text-white font-bold text-base hover:text-[#e50914] transition-colors block mb-2"
              >
                {bundle.title}
              </Link>
              <p className="text-white/60 text-xs line-clamp-2 mb-4 leading-relaxed">
                {bundle.description}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <Link
                  to="/courses"
                  search={{ type: "bundle" } as any}
                  className="text-white/80 hover:text-[#e50914] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>تفاصيل الباقة</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
                <div className="text-left">
                  <span className="text-xs text-white/40 line-through mr-1.5">${bundle.price}</span>
                  <span className="text-sm font-bold text-[#5aca26]">${bundle.discount_price}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Action Column: View All Bundles + Create Custom Bundle */}
        <div className="flex flex-col justify-between gap-4">
          {/* View All Bundles Card */}
          <Link
            to="/courses"
            search={{ type: "bundle" } as any}
            className="platform-product__package-btn group"
            title="الإطلاع على جميع الباقات"
          >
            <span>الإطلاع على جميع الباقات</span>
            <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-white group-hover:text-black flex items-center justify-center transition-all">
              <ArrowLeft className="w-5 h-5 text-white group-hover:text-black" />
            </div>
          </Link>

          {/* Create Custom Bundle Button Card */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="platform-product__package-btn dark group"
            title="إنشيء باقتك الخاصة وأحصل على خصم 8%"
          >
            <span>إنشيء باقتك الخاصة وأحصل على خصم 8%</span>
            <div className="w-10 h-10 rounded-full bg-[#e50914] flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>
        </div>
      </div>

      {/* Custom Bundle Modal */}
      <CustomBundleModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
