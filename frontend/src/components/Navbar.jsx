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
    <nav className="sticky top-0 z-50 bg-transparent backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-20">

          {/* Logo */}
          <div className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent select-none">
            AI Recruiter
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-lg">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                    ${isActive
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
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
                <div className="absolute right-0 mt-3 w-44 rounded-2xl bg-transparent backdrop-blur-xl border border-white/10 shadow-2xl py-2 z-50">
                  <button
                    type="button"
                    onClick={handleGoToProfile}
                    className="w-full text-left px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
                  >
                    Profile
                  </button>

                  <div className="border-t border-white/10 my-1"></div>

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
