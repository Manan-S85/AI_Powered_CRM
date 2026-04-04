import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const getStoredUser = () => {
  try {
    const userRaw = localStorage.getItem("user");
    return userRaw ? JSON.parse(userRaw) : {};
  } catch {
    return {};
  }
};

const getNameInitials = (name) => {
  const cleanedName = (name || "").trim();
  if (!cleanedName) return "U";
  const parts = cleanedName.split(/\s+/).filter(Boolean);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [initials, setInitials] = useState("U");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const updateInitials = () => {
      const storedUser = getStoredUser();
      setInitials(getNameInitials(storedUser?.name));
    };
    updateInitials();
    window.addEventListener("userUpdated", updateInitials);
    return () => window.removeEventListener("userUpdated", updateInitials);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Add Lead", path: "/addleads" },
    { name: "ML Stats", path: "/mlstats" },
    { name: "AI Insights", path: "/ai-insights" },
    { name: "Chatbot", path: "/chatbot" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleGoToProfile = () => {
    setIsProfileOpen(false);
    navigate("/profile");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700/60 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center h-20 gap-4">

          {/* Logo */}
          <div className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent select-none whitespace-nowrap">
            Detagenix CRM System
          </div>

          {/* Nav Links */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/70 border border-slate-700/70 rounded-2xl p-1.5 backdrop-blur-lg">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                    ${isActive
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg"
                      : "text-slate-200 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="lg:hidden flex items-center gap-2 overflow-x-auto max-w-[52vw] no-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition
                    ${isActive
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white"
                      : "bg-slate-900/70 text-slate-200 border border-slate-700/70"
                    }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-white flex items-center justify-center font-bold shadow-lg hover:scale-105 transition"
                title="Open profile menu"
              >
                {initials}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-44 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/70 shadow-2xl py-2 z-50">
                  <button
                    type="button"
                    onClick={handleGoToProfile}
                    className="w-full text-left px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
                  >
                    Profile
                  </button>

                  <div className="border-t border-slate-700 my-1"></div>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-5 py-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
