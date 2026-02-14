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
    <div className="min-h-screen bg-gray-50 p-8 flex justify-center">
      <div className="bg-white w-full md:w-3/4 lg:w-2/3 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-6 text-slate-800">Add New Candidate</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {prediction && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 px-6 py-4 rounded-lg mb-6 shadow-md">
            <h3 className="font-bold text-lg text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 size={20} />
              ML Prediction Result
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Temperature:</p>
                <p className="text-2xl font-bold text-green-700">{prediction.predicted_temperature}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Confidence:</p>
                <p className="text-2xl font-bold text-green-700">{(prediction.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Full Name */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                name="name"
                value={lead.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={lead.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="john@example.com"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Mobile Number *</label>
              <input
                type="tel"
                name="phone"
                value={lead.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+1 234 567 8900"
              />
            </div>

            {/* Highest Education */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Highest Education *</label>
              <select
                name="highest_education"
                value={lead.highest_education}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Education</option>
                <option value="High School">High School</option>
                <option value="Associate Degree">Associate Degree</option>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="Master's Degree">Master's Degree</option>
                <option value="PhD">PhD</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Applied Position */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Applied Position *</label>
              <input
                type="text"
                name="role_position"
                value={lead.role_position}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Software Engineer"
              />
            </div>

            {/* Years of Experience */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Years of Experience *</label>
              <input
                type="number"
                name="years_of_experience"
                value={lead.years_of_experience}
                onChange={handleChange}
                required
                min="0"
                max="50"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="5"
              />
            </div>

            {/* Primary Skills */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-gray-700 mb-2">Primary Skills *</label>
              <textarea
                name="skills"
                value={lead.skills}
                onChange={handleChange}
                required
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Python, React, Node.js, AWS..."
              />
            </div>

            {/* Current Location */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Current Location *</label>
              <input
                type="text"
                name="location"
                value={lead.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="New York, USA"
              />
            </div>

            {/* LinkedIn Profile */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">LinkedIn Profile</label>
              <input
                type="url"
                name="linkedin_profile"
                value={lead.linkedin_profile}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://linkedin.com/in/johndoe"
              />
            </div>

            {/* Expected Salary */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Expected Salary (Annual) *</label>
              <input
                type="number"
                name="expected_salary"
                value={lead.expected_salary}
                onChange={handleChange}
                required
                min="0"
                step="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="80000"
              />
            </div>

            {/* Willing to Relocate */}
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Willing to Relocate *</label>
              <select
                name="willing_to_relocate"
                value={lead.willing_to_relocate}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Maybe">Maybe</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-3 rounded-lg font-semibold text-lg hover:from-emerald-700 hover:to-teal-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? "Processing..." : "Add Candidate & Get ML Prediction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
