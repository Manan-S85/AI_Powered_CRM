import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/Api";
import { Eye, EyeOff } from "lucide-react";

import img1 from "../assets/ai1.jpg";
import img2 from "../assets/ai2.jpg";
import img3 from "../assets/ai3.jpg";

const Login = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const images = [img1, img2, img3];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await API.post("/auth/login", form);

      if ((data?.user?.role || "").toLowerCase() !== "admin") {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      const token = data.access_token;
      if (!token) {
        throw new Error("Missing access token in login response");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("userUpdated"));

      navigate("/dashboard", { replace: true });

    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || err.message || "Invalid email or password");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8">
      <img
        src={images[current]}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-all duration-700"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-[#030712]/90 via-[#0b1324]/84 to-[#041824]/90" />
      <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-3xl border border-white/10 bg-slate-950/35 p-10 text-slate-100 shadow-2xl backdrop-blur-xl lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Detagenix CRM</p>
          <h1 className="mt-5 text-5xl font-black leading-[1.05] text-white">Enterprise sales intelligence for fast-moving teams.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Access dashboards, predictions, and AI workflows in one secure control center.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Lead scoring</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Forecasting</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">AI insights</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Follow-up optimization</div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="crm-surface relative w-full rounded-3xl p-8 text-white sm:p-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Welcome back</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Admin Login</h2>
          <p className="mt-2 text-sm text-slate-300">Sign in to continue to your CRM workspace.</p>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="crm-field mt-2 w-full rounded-xl px-4 py-3 text-sm placeholder:text-slate-500"
                placeholder="admin@detagenix.ai"
              />
            </div>

            <div className="relative">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="crm-field mt-2 w-full rounded-xl px-4 py-3 pr-12 text-sm placeholder:text-slate-500"
                placeholder="Enter your password"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-11 rounded-md p-1 text-slate-300 hover:bg-white/10"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="crm-button-primary mt-7 w-full rounded-xl py-3 text-base font-semibold shadow-lg shadow-cyan-900/30 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="mt-6 flex items-center justify-center text-sm text-slate-300">
            <p className="mr-2">Don’t have an account?</p>
            <Link to="/signup" className="font-semibold text-cyan-200 transition hover:text-white">
              Sign Up
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">Detagenix CRM © 2026</p>
        </form>
      </div>
    </div>
  );
};

export default Login;