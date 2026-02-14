import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/Api";
import { Eye, EyeOff, User, Mail, Shield } from "lucide-react";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin", // Default to admin for now
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

    // Basic validation
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
        role: form.role
      });

      console.log("Signup response:", data);

      // Check if signup was successful
      if (data.success) {
        // Backend returns access_token, not token
        const token = data.access_token;
        const userRole = data.user?.role || form.role;

        // Store auth data
        localStorage.setItem("token", token);
        localStorage.setItem("role", userRole);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Navigate to dashboard
        navigate("/dashboard", { replace: true });
      } else {
        setError(data.message || "Failed to create account");
        setLoading(false);
      }

    } catch (err) {
      console.error("Signup error:", err);
      
      // Handle different error types
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
    <div className="min-h-screen flex">
      
      {/* LEFT PANEL — BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 text-white flex-col justify-center px-20">
        <div className="max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-5xl font-bold tracking-tight">AI RECRUITER</h1>
          </div>

          <p className="text-xl text-indigo-100 mb-8 leading-relaxed">
            Join our platform and identify high-converting leads instantly using machine learning.
            Make smarter sales decisions with real-time AI predictions.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — SIGNUP */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6">
        
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white p-10 rounded-3xl shadow-2xl border border-gray-100"
        >
          
          <h2 className="text-3xl font-bold mb-2">
            Create Account
          </h2>

          <p className="text-gray-500 mb-8">
            Sign up to get started with AI-powered lead management
          </p>

          {error && (
            <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          {/* NAME */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <User size={16} />
              Full Name
            </label>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full mt-2 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition"
              placeholder="Enter your full name"
            />
          </div>

          {/* EMAIL */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Mail size={16} />
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

          {/* ROLE */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Shield size={16} />
              Role
            </label>

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
              className="w-full mt-2 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition"
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* PASSWORD */}
          <div className="mb-5 relative">
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
              placeholder="Create a strong password"
            />

            <div
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-11 cursor-pointer text-gray-500"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="mb-6 relative">
            <label className="text-sm font-semibold text-gray-600">
              Confirm Password
            </label>

            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              className="w-full mt-2 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition"
              placeholder="Confirm your password"
            />

            <div
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-11 cursor-pointer text-gray-500"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>
          </div>

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-semibold text-lg disabled:opacity-60"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          {/* LOGIN LINK */}
          <p className="text-center mt-6">
            <span className="text-gray-500">Already have an account? </span>
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Sign In
            </Link>
          </p>

          <p className="text-gray-400 text-sm mt-8 text-center">
            Secure Admin Access • LeadAI © 2026
          </p>

        </form>
      </div>
    </div>
  );
};

export default Signup;