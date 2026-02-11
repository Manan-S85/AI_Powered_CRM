import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Add Lead", path: "/addleads" },
    { name: "ML Stats", path: "/mlstats" },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="text-2xl font-bold text-indigo-600 tracking-tight">
           AI RECUIRTER
          </div>

          {/* Nav Links */}
          <div className="flex gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200
                    
                    ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                    }
                  `}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section (future profile/avatar) */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
              DY
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
