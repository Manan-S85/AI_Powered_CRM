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

      if (data.user.role !== "admin") {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/dashboard", { replace: true });

    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || "Invalid email or password");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      <img
        src={images[current]}
        alt=""
        className="absolute w-full h-full object-cover transition-all duration-1000"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-indigo-900/70 to-purple-900/80" />

      <div className="absolute w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 -top-32 -left-32" />
      <div className="absolute w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 -bottom-32 -right-32" />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md backdrop-blur-xl bg-white/10 border border-white/20 p-10 rounded-3xl shadow-2xl text-white transition-all duration-300 hover:scale-[1.02]"
      >
        <h2 className="text-3xl font-bold mb-2 text-center">
          Admin Login
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
          <label className="text-sm text-gray-300">
            Email Address
          </label>

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

        <div className="mb-6 relative">
          <label className="text-sm text-gray-300">
            Password
          </label>

          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full mt-2 px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none transition text-white placeholder-gray-300"
            placeholder="Enter your password"
          />

          <div
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-11 cursor-pointer text-gray-300"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 py-3 rounded-xl font-semibold text-lg hover:opacity-90 transition disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="flex items-center justify-center mt-6 text-sm">
          <p className="text-gray-300 mr-2">
            Don’t have an account?
          </p>
          <Link
            to="/signup"
            className="text-indigo-300 hover:text-white font-semibold transition"
          >
            Sign Up
          </Link>
        </div>

        <p className="text-gray-400 text-sm mt-8 text-center">
          LeadAI © 2026
        </p>
      </form>
    </div>
  );
};

export default Login;