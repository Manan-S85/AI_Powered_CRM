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

  if (!cleanedName) {
    return "U";
  }

  const parts = cleanedName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

    return () => {
      window.removeEventListener("userUpdated", updateInitials);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Add Lead", path: "/addleads" },
    { name: "ML Stats", path: "/mlstats" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleGoToProfile = () => {
    setIsProfileOpen(false);
    navigate("/profile");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="text-2xl font-extrabold tracking-tight text-slate-800 select-none">
           AI RECUIRTER
          </div>

          {/* Nav Links */}
          <div className="flex gap-2 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200
                    
                    ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_8px_18px_-8px_rgba(5,150,105,0.85)]"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section - User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((previous) => !previous)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold shadow-[0_10px_20px_-10px_rgba(15,23,42,0.9)] ring-2 ring-white/90"
                title="Open profile menu"
              >
                {initials}
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-lg shadow-[0_14px_32px_-16px_rgba(15,23,42,0.55)] py-1 z-50">
                  <button
                    type="button"
                    onClick={handleGoToProfile}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Profile
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 transition-all duration-200 shadow-[0_10px_20px_-10px_rgba(239,68,68,0.95)]"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
