import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Handshake,
  LayoutDashboard,
  Menu,
  Percent,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  UserRound,
} from "lucide-react";
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

export default function Navbar({ isCollapsed = false, onToggleCollapse = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [initials, setInitials] = useState("U");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Add Lead", path: "/addleads", icon: UserPlus },
    { name: "ML Stats", path: "/mlstats", icon: BrainCircuit },
    { name: "Lead Generation", path: "/lead-generation", icon: Search },
    { name: "Lead Dashboard", path: "/lead-dashboard", icon: LayoutDashboard },
    { name: "Lead Conversion", path: "/lead-scoring-conversion", icon: Percent },
    { name: "AI Insights", path: "/ai-insights", icon: Sparkles },
    { name: "Sales Forecast", path: "/sales-forecasting", icon: TrendingUp },
    { name: "Client LTV", path: "/client-ltv", icon: BarChart3 },
    { name: "Follow-up AI", path: "/followup-optimizer", icon: Handshake },
    { name: "Chatbot", path: "/chatbot", icon: Bot },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleGoToProfile = () => {
    setIsMobileNavOpen(false);
    navigate("/profile");
  };

  const navLinkClass = (isActive, collapsed = false) =>
    `group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
      collapsed ? "justify-center px-0" : "justify-between px-3.5"
    } ${
      isActive
        ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileNavOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/80 text-slate-100 shadow-xl backdrop-blur-xl transition hover:bg-slate-900 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-slate-950/90 backdrop-blur-2xl transition-all duration-300 lg:flex lg:flex-col ${
          isCollapsed ? "w-24" : "w-72"
        }`}
      >
        <div className={`pb-5 pt-7 ${isCollapsed ? "px-3" : "px-6"}`}>
          <div className={`flex items-start ${isCollapsed ? "justify-center" : "justify-between gap-3"}`}>
            <div className={isCollapsed ? "hidden" : "block"}>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">Detagenix</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Enterprise CRM</h2>
              <p className="mt-2 text-sm text-slate-400">Pipeline intelligence and workflow automation.</p>
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        <nav className="px-4 py-2">
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);

              return (
                <li key={item.name}>
                  <Link to={item.path} className={navLinkClass(isActive, isCollapsed)} title={item.name}>
                    <span className={`inline-flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
                      <Icon size={16} />
                      {isCollapsed ? null : <span>{item.name}</span>}
                    </span>
                    {isCollapsed || !isActive ? null : <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={`mt-auto border-t border-white/10 py-5 ${isCollapsed ? "px-3" : "px-4"}`}>
          <button
            type="button"
            onClick={handleGoToProfile}
            className={`mb-2 inline-flex w-full items-center rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-left text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] ${
              isCollapsed ? "justify-center px-0" : "gap-3 px-3.5"
            }`}
            title="Profile"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
              {initials}
            </span>
            {isCollapsed ? null : <span>Profile</span>}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-left text-sm font-medium text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-500/10 ${
              isCollapsed ? "px-0 text-center" : "px-3.5"
            }`}
            title="Sign Out"
          >
            {isCollapsed ? "Out" : "Sign Out"}
          </button>
        </div>
      </aside>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close navigation"
          />

          <div className="relative h-full w-[84%] max-w-sm border-r border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">Detagenix</p>
                <p className="mt-1 text-lg font-semibold text-white">Enterprise CRM</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
              >
                Close
              </button>
            </div>

            <ul className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(`${item.path}/`);

                return (
                  <li key={`mobile-${item.name}`}>
                    <Link to={item.path} className={navLinkClass(isActive)}>
                      <span className="inline-flex items-center gap-3">
                        <Icon size={16} />
                        <span>{item.name}</span>
                      </span>
                      {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={handleGoToProfile}
                className="inline-flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left text-sm font-medium text-slate-200"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-xs font-bold text-white">
                  {initials}
                </span>
                Profile
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-rose-300/25 bg-rose-500/10 px-3.5 py-2.5 text-left text-sm font-medium text-rose-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
