import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import {
  BookOpen,
  ChevronDown,
  Film,
  Heart,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/common/NotificationBell";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { CartSheet } from "@/components/common/CartSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function maskEmail(email?: string | null) {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, name.length - 2))}@${domain}`;
}

function getInitials(name?: string | null, email?: string | null) {
  const src = (name?.trim() || email || "").trim();
  if (!src) return "؟";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Header() {
  const { user, profile, isAdmin, isModerator, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { ids } = useWishlist();
  const { count: cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  const navItems = [
    { to: "/", label: "الرئيسية", icon: Home, active: path === "/" },
    { to: "/courses", label: "استكشف الكورسات", icon: BookOpen, active: path.startsWith("/courses") },
    { to: "/student-works", label: "أعمال الطلاب", icon: Film, active: path === "/student-works" },
    { to: "/dashboard", label: "مساحة التعلم", icon: LayoutDashboard, active: path === "/dashboard" || path.startsWith("/learn") },
  ];

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setOpen(false);
    nav({ to: "/courses", search: q ? ({ q } as any) : ({} as any) });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 w-full bg-[#111012]/90 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]">
      <div className="container mx-auto px-4 flex h-[72px] items-center justify-between gap-3">
        {/* Right side in RTL: Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group py-1">
            <img
              src="/logo.png"
              alt="Idea Courses"
              className="h-10 md:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
        </div>

        {/* Center: Desktop Navigation Pills */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13.5px] font-bold transition-all duration-200 ${
                  item.active
                    ? "bg-gradient-to-l from-[#e50914] to-[#b80710] text-white shadow-md shadow-[#e50914]/30"
                    : "text-white/75 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Search Input (Desktop XL) */}
        <form onSubmit={onSearchSubmit} className="hidden xl:flex items-center relative w-56 focus-within:w-64 transition-all duration-300">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن كورس..."
            className="w-full h-9 pr-9 pl-3 rounded-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-[#1c1a1d] border border-white/10 focus:border-[#e50914]/60 text-xs text-white placeholder-white/45 outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-white/45 absolute right-3 pointer-events-none" />
        </form>

        {/* Left side in RTL: Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Direct Admin Shortcut Pill when logged in as Admin/Moderator */}
          {(isAdmin || isModerator) && (
            <Link
              to={isAdmin ? "/admin" : "/admin/support"}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-gradient-to-r from-[#f5c518]/20 to-[#e50914]/20 hover:from-[#f5c518]/30 hover:to-[#e50914]/30 border border-[#f5c518]/40 text-[#f5c518] text-xs font-extrabold transition-all shadow-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة الإدارة</span>
            </Link>
          )}

          {/* Wishlist Button */}
          <Link
            to="/wishlist"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-white flex items-center justify-center transition-all"
            title="الدورات المفضلة"
            aria-label="المفضلة"
          >
            <Heart className="w-4 h-4 text-white/85" />
            {ids.size > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#e50914] text-[10px] font-bold text-white shadow">
                {ids.size}
              </span>
            )}
          </Link>

          {/* Shopping Cart Button */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-white flex items-center justify-center transition-all cursor-pointer"
            title="سلة المشتريات"
            aria-label="سلة المشتريات"
          >
            <ShoppingCart className="w-4 h-4 text-white/85" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#e50914] text-[10px] font-bold text-white shadow">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile or Auth Buttons */}
          {user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 pl-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all cursor-pointer">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#e50914] to-[#99050d] text-xs font-bold text-white shadow-inner">
                      {getInitials(profile?.name, profile?.email)}
                    </span>
                    <span className="hidden xl:block text-xs font-bold text-white/90 max-w-[90px] truncate">
                      {profile?.name?.split(" ")[0] || "حسابي"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/50 hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 p-2 bg-[#181619] border border-white/10 text-white rounded-2xl shadow-2xl"
                >
                  <DropdownMenuLabel className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e50914] to-[#99050d] text-sm font-bold text-white">
                      {getInitials(profile?.name, profile?.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">
                        {profile?.name ?? "حسابي"}
                      </span>
                      <span className="block truncate text-xs text-white/55" dir="ltr">
                        {maskEmail(profile?.email || user?.email)}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10 my-1.5" />
                  <DropdownMenuItem
                    onClick={() => nav({ to: "/dashboard" })}
                    className="rounded-xl py-2 hover:!bg-[#e50914] text-white cursor-pointer"
                  >
                    <LayoutDashboard className="ml-2 h-4 w-4" /> مساحة التعلم ودوراتي
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => nav({ to: "/admin" })}
                      className="rounded-xl py-2 hover:!bg-[#e50914] text-[#f5c518] hover:!text-white font-bold cursor-pointer"
                    >
                      <ShieldCheck className="ml-2 h-4 w-4" /> لوحة إدارة المنصة
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => nav({ to: "/help" })}
                    className="rounded-xl py-2 hover:!bg-white/10 text-white cursor-pointer"
                  >
                    <LifeBuoy className="ml-2 h-4 w-4" /> مركز المساعدة والدعم
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10 my-1.5" />
                  <DropdownMenuItem
                    onClick={() => signOut().then(() => nav({ to: "/" }))}
                    className="rounded-xl py-2 text-red-400 hover:!bg-red-500/15 hover:!text-red-300 cursor-pointer"
                  >
                    <LogOut className="ml-2 h-4 w-4" /> تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                search={{ redirect: "/dashboard" }}
                className="h-9 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-bold inline-flex items-center justify-center transition-all"
              >
                دخول
              </Link>
              <Link
                to="/register"
                className="h-9 px-4 rounded-full bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1a25] hover:to-[#c90812] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg shadow-[#e50914]/25 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ابدأ مجاناً</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setOpen(!open)}
            aria-label="القائمة"
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] border border-white/10 text-white flex items-center justify-center hover:bg-white/[0.12] cursor-pointer"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {open && (
        <div className="lg:hidden border-t border-white/10 bg-[#141215]/98 backdrop-blur-2xl p-4 space-y-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={onSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن دورة تدريبية..."
              className="w-full h-10 pr-10 pl-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder-white/45 outline-none focus:border-[#e50914]"
            />
            <Search className="w-4 h-4 text-white/45 absolute right-3.5 top-3 pointer-events-none" />
          </form>

          <div className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                    item.active
                      ? "bg-[#e50914]/20 text-white border border-[#e50914]/40"
                      : "text-white/80 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.active ? "text-[#e50914]" : "text-white/50"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold text-sm text-[#f5c518] bg-[#f5c518]/10 border border-[#f5c518]/30"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>لوحة إدارة المنصة</span>
              </Link>
            )}
          </div>

          {!user && (
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2.5">
              <Link
                to="/login"
                search={{ redirect: "/dashboard" }}
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl bg-white/[0.07] border border-white/10 text-white text-xs font-bold flex items-center justify-center"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b80710] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إنشاء حساب</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Cart Drawer */}
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
