import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/Api";
import hero from "../assets/images.jpg";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await API.post("/api/auth/login", form);

      // ✅ ADMIN ONLY ACCESS
      if (data.user.role !== "admin") {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role);

      // ✅ Single dashboard entry
      navigate("/dashboard", { replace: true });

    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      
      {/* LEFT PANEL — BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 text-white flex-col justify-center px-20">
  <div className="max-w-lg">
    <div className="flex items-center gap-4 mb-8">
      <h1 className="text-5xl font-bold tracking-tight">AI RECRUITER</h1>
    </div>

    <p className="text-xl text-indigo-100 mb-8 leading-relaxed">
      Identify high-converting leads instantly using machine learning.
      Make smarter sales decisions with real-time AI predictions.
    </p>
  </div>
</div>

      {/* RIGHT PANEL — LOGIN */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6">
        
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white p-10 rounded-3xl shadow-2xl border border-gray-100"
        >
          
          <h2 className="text-3xl font-bold mb-2">
            Admin Login
          </h2>

          <p className="text-gray-500 mb-8">
            Enter your credentials to access the AI dashboard
          </p>

          {error && (
            <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          {/* EMAIL */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600">
              Email Address
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full mt-2 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition"
              placeholder="admin@leadai.com"
            />
          </div>

          {/* PASSWORD */}
          <div className="mb-6 relative">
            <label className="text-sm font-semibold text-gray-600">
              Password
            </label>

            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              className="w-full mt-2 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition"
              placeholder="Enter your password"
            />

            <div
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-11 cursor-pointer text-gray-500"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>
          </div>

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-semibold text-lg disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-gray-400 text-sm mt-8 text-center">
            Secure Admin Access • LeadAI © 2026
          </p>

        </form>
      </div>
    </div>
  );
};

export default Login;
