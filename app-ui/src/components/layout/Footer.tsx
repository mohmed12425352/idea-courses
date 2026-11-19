import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Facebook } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black text-white pt-12 pb-24 md:pb-12 border-t border-[#252121]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pb-8 border-b border-white/10">
          {/* Logo */}
          <div className="md:col-span-3 flex justify-center md:justify-start">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Idea Courses"
                className="h-14 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-6">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/80">
              <li>
                <Link to="/" className="hover:text-[#e50914] transition-colors">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link to="/courses" className="hover:text-[#e50914] transition-colors">
                  الدورات
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-[#e50914] transition-colors">
                  مركز المساعدة
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-[#e50914] transition-colors">
                  سياسة الخصوصية
                </Link>
              </li>
              <li>
                <Link to="/refund" className="hover:text-[#e50914] transition-colors">
                  قواعد سياسة الاسترجاع
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="md:col-span-3 flex flex-col items-center md:items-end space-y-2 text-xs text-white/70">
            <a
              href="tel:+201026533835"
              className="flex items-center gap-2 hover:text-[#e50914] transition-colors"
            >
              <span dir="ltr">01026533835</span>
              <Phone className="w-3.5 h-3.5 text-[#e50914]" />
            </a>
            <a
              href="mailto:mohmedshalaby246@gmail.com"
              className="flex items-center gap-2 hover:text-[#e50914] transition-colors"
            >
              <span>mohmedshalaby246@gmail.com</span>
              <Mail className="w-3.5 h-3.5 text-[#e50914]" />
            </a>
            <div className="flex items-center gap-2">
              <span>الإسكندرية، مصر</span>
              <MapPin className="w-3.5 h-3.5 text-[#e50914]" />
            </div>
          </div>
        </div>

        {/* Bottom bar: Copyright + Social Links */}
        <div className="pt-6 flex flex-col-reverse md:flex-row items-center justify-between gap-4">
          <p className="text-white/60 text-xs text-center md:text-right">
            جميع الحقوق محفوظة لـ{" "}
            <Link to="/" className="text-[#e50914] hover:underline font-semibold">
              Idea Courses © {year}
            </Link>
          </p>

          <div className="flex items-center gap-2">
            <a
              href="https://www.facebook.com/EngDesign1/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-[#252121] hover:bg-[#1877F2] text-white flex items-center justify-center transition-all shadow-sm hover:scale-110"
              title="صفحتنا على فيسبوك"
              aria-label="Facebook"
            >
              <Facebook className="w-4 h-4 fill-current" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}