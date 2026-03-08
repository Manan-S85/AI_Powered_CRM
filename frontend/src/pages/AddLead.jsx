
import React, { useState } from "react";
import api from "../api/Api";
import { CheckCircle2 } from "lucide-react";

export default function AddLead() {
  const [lead, setLead] = useState({
    name: "",
    email: "",
    phone: "",
    highest_education: "",
    role_position: "",
    years_of_experience: "",
    skills: "",
    location: "",
    linkedin_profile: "",
    expected_salary: "",
    willing_to_relocate: "No",
    company_name: "",
    company_website: "",
    company_email: "",
  });

  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLead({
      ...lead,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const payload = {
        ...lead,
        years_of_experience: Number(lead.years_of_experience),
        expected_salary: Number(lead.expected_salary),
        company_email: lead.company_email?.trim() ? lead.company_email.trim() : null,
      };

      const response = await api.post("/predict", payload);
      
      if (response.data.success) {
        setPrediction(response.data.prediction);
        alert("Lead added successfully with ML prediction!");
        
        // Reset form
        setLead({
          name: "",
          email: "",
          phone: "",
          highest_education: "",
          role_position: "",
          years_of_experience: "",
          skills: "",
          location: "",
          linkedin_profile: "",
          expected_salary: "",
          willing_to_relocate: "No",
          company_name: "",
          company_website: "",
          company_email: "",
        });
      } else {
        setError("Failed to process lead");
      }
    } catch (err) {
      console.error("Error adding lead:", err);
      setError(err.response?.data?.detail || "Failed to add lead");
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-8 py-14 flex justify-center">

    <div className="w-full max-w-6xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-12">

      <div className="mb-12">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          AI Candidate Intake
        </h1>
        <p className="text-slate-400 mt-4 text-lg">
          Submit candidate data and let the ML engine evaluate potential
        </p>
      </div>

      {error && (
        <div className="mb-8 bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl backdrop-blur-lg">
          {error}
        </div>
      )}

      {prediction && (
        <div className="mb-10 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-400/20 p-8 rounded-2xl shadow-xl">

          <h3 className="text-xl font-semibold text-emerald-300 mb-6 flex items-center gap-3">
            <CheckCircle2 size={22} />
            ML Prediction Result
          </h3>

          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider">
                Temperature
              </p>
              <p className="text-4xl font-bold text-emerald-400 mt-2">
                {prediction.predicted_temperature}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider">
                Confidence
              </p>
              <p className="text-4xl font-bold text-cyan-400 mt-2">
                {(prediction.confidence * 100).toFixed(1)}%
              </p>

              <div className="w-full bg-white/10 rounded-full h-3 mt-4 overflow-hidden">
                <div
                  style={{ width: `${prediction.confidence * 100}%` }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-700"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Full Name *</label>
            <input
              type="text"
              name="name"
              value={lead.name}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Email *</label>
            <input
              type="email"
              name="email"
              value={lead.email}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Mobile *</label>
            <input
              type="tel"
              name="phone"
              value={lead.phone}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Highest Education *</label>
            <select
              name="highest_education"
              value={lead.highest_education}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            >
              <option className="bg-slate-900" value="">Select Education</option>
              <option className="bg-slate-900">High School</option>
              <option className="bg-slate-900">Associate Degree</option>
              <option className="bg-slate-900">Bachelor's Degree</option>
              <option className="bg-slate-900">Master's Degree</option>
              <option className="bg-slate-900">PhD</option>
              <option className="bg-slate-900">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Applied Position *</label>
            <input
              type="text"
              name="role_position"
              value={lead.role_position}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Experience (Years) *</label>
            <input
              type="number"
              name="years_of_experience"
              value={lead.years_of_experience}
              onChange={handleChange}
              required
              min="0"
              max="50"
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-400 uppercase tracking-wider">Primary Skills *</label>
            <textarea
              name="skills"
              value={lead.skills}
              onChange={handleChange}
              required
              rows="3"
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="React, Node, AWS..."
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Location *</label>
            <input
              type="text"
              name="location"
              value={lead.location}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">LinkedIn</label>
            <input
              type="url"
              name="linkedin_profile"
              value={lead.linkedin_profile}
              onChange={handleChange}
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Expected Salary *</label>
            <input
              type="number"
              name="expected_salary"
              value={lead.expected_salary}
              onChange={handleChange}
              required
              min="0"
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Relocate *</label>
            <select
              name="willing_to_relocate"
              value={lead.willing_to_relocate}
              onChange={handleChange}
              required
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            >
              <option className="bg-slate-900">Yes</option>
              <option className="bg-slate-900">No</option>
              <option className="bg-slate-900">Maybe</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Company Name</label>
            <input
              type="text"
              name="company_name"
              value={lead.company_name}
              onChange={handleChange}
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="Acme Pvt Ltd"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 uppercase tracking-wider">Company Website</label>
            <input
              type="url"
              name="company_website"
              value={lead.company_website}
              onChange={handleChange}
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="https://example.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-400 uppercase tracking-wider">Company Email</label>
            <input
              type="email"
              name="company_email"
              value={lead.company_email}
              onChange={handleChange}
              className="mt-2 w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="contact@example.com"
            />
          </div>

        </div>

        <div className="mt-12">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-4 rounded-2xl font-semibold text-lg hover:scale-105 transition-all duration-300 disabled:opacity-50 shadow-xl shadow-emerald-500/20"
          >
            {loading ? "Analyzing with AI..." : "Add Candidate & Generate ML Prediction"}
          </button>
        </div>

      </form>

    </div>
  </div>
);
}
