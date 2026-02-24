import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/Api";
import { Eye, EyeOff } from "lucide-react";


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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      <img
        src={hero}
        alt=""
        className="absolute w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-indigo-900/70 to-purple-900/80" />

      <div className="absolute w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 -top-32 -left-32" />
      <div className="absolute w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 -bottom-32 -right-32" />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md backdrop-blur-xl bg-white/10 border border-white/20 p-10 rounded-3xl shadow-2xl text-white transition-all duration-300 hover:scale-[1.02]"
      >
        <h2 className="text-3xl font-bold mb-2 text-center">
          Create Account
        </h2>

        <p className="text-gray-300 mb-8 text-center">
          Secure access to AI dashboard
        </p>

        {error && (
          <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-5 text-sm">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="text-sm text-gray-300">Full Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full mt-2 px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition text-white placeholder-gray-300"
            placeholder="Enter your full name"
          />
        </div>

        <div className="mb-5">
          <label className="text-sm text-gray-300">Email Address</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full mt-2 px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition text-white placeholder-gray-300"
            placeholder="admin@leadai.com"
          />
        </div>

        <div className="mb-5 relative">
          <label className="text-sm text-gray-300">Password</label>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full mt-2 px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition text-white placeholder-gray-300"
            placeholder="Create a strong password"
          />
          <div
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-11 cursor-pointer text-gray-300"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>
        </div>

        <div className="mb-8 relative">
          <label className="text-sm text-gray-300">Confirm Password</label>
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className="w-full mt-2 px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition text-white placeholder-gray-300"
            placeholder="Confirm your password"
          />
          <div
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-11 cursor-pointer text-gray-300"
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 py-3 rounded-xl font-semibold text-lg hover:opacity-90 transition disabled:opacity-60"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

        <div className="flex items-center justify-center mt-6 text-sm">
          <p className="text-gray-300 mr-2">
            Already have an account?
          </p>
          <Link
            to="/login"
            className="text-indigo-300 hover:text-white font-semibold transition"
          >
            Sign In
          </Link>
        </div>

        <p className="text-gray-400 text-xs mt-8 text-center">
          LeadAI © 2026
        </p>
      </form>
    </div>
  );
};

export default Signup;