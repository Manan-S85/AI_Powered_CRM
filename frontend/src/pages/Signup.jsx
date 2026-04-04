import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/Api";
import { Eye, EyeOff } from "lucide-react";
import img1 from "../assets/ai1.jpg";


const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      const { data } = await API.post("/auth/signup", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: "admin"
      });

      if (data.success) {
        const token = data.access_token;
        const userRole = data.user?.role || "admin";

        localStorage.setItem("token", token);
        localStorage.setItem("role", userRole);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("userUpdated"));

        navigate("/dashboard", { replace: true });
      } else {
        setError(data.message || "Failed to create account");
        setLoading(false);
      }

    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
        setError("Cannot connect to backend. Is the server running?");
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Failed to create account. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8">
      <img
        src={img1}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-[#030712]/90 via-[#0b1324]/84 to-[#041824]/90" />
      <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-3xl border border-white/10 bg-slate-950/35 p-10 text-slate-100 shadow-2xl backdrop-blur-xl lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Detagenix CRM</p>
          <h1 className="mt-5 text-5xl font-black leading-[1.05] text-white">Create secure admin access for your CRM control center.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Your account unlocks enterprise automation, analytics, and AI-assisted follow-up workflows.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-200">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Role-based access</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Unified dashboard</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Lead lifecycle</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">AI recommendations</div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="crm-surface relative w-full rounded-3xl p-8 text-white sm:p-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Get started</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Create Account</h2>
          <p className="mt-2 text-sm text-slate-300">Set up your administrator profile.</p>

          {error && (
            <div className="mt-6 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="crm-field mt-2 w-full rounded-xl px-4 py-3 text-sm placeholder:text-slate-500"
                placeholder="Enter your full name"
              />
            </div>

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
                placeholder="Create a strong password"
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

            <div className="relative">
              <label className="text-sm font-medium text-slate-300">Confirm Password</label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                className="crm-field mt-2 w-full rounded-xl px-4 py-3 pr-12 text-sm placeholder:text-slate-500"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-11 rounded-md p-1 text-slate-300 hover:bg-white/10"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="crm-button-primary mt-7 w-full rounded-xl py-3 text-base font-semibold shadow-lg shadow-cyan-900/30 disabled:opacity-60"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <div className="mt-6 flex items-center justify-center text-sm text-slate-300">
            <p className="mr-2">Already have an account?</p>
            <Link to="/login" className="font-semibold text-cyan-200 transition hover:text-white">
              Sign In
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">Detagenix CRM © 2026</p>
        </form>
      </div>
    </div>
  );
};

export default Signup;