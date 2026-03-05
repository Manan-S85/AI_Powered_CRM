import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Users, Briefcase, TrendingUp } from "lucide-react";

import img1 from "../assets/ai1.jpg";
import img2 from "../assets/ai2.jpg";
import img3 from "../assets/ai3.jpg";

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBg, setCurrentBg] = useState(0);

  const navigate = useNavigate();
  const images = [img1, img2, img3];

  // Mock data
  const mockLeads = [
    {
      _id: "1",
      name: "Deepak Yadav",
      email: "deepak@example.com",
      role_position: "Frontend Developer",
      years_of_experience: 2,
      location: "Jaipur",
      expected_salary: 500000,
      ml_prediction: { predicted_temperature: "Hot", confidence: 0.92 },
    },
    {
      _id: "2",
      name: "Rahul Sharma",
      email: "rahul@example.com",
      role_position: "Backend Developer",
      years_of_experience: 3,
      location: "Mumbai",
      expected_salary: 700000,
      ml_prediction: { predicted_temperature: "Warm", confidence: 0.78 },
    },
    {
      _id: "3",
      name: "Sneha Kapoor",
      email: "sneha@example.com",
      role_position: "Fullstack Developer",
      years_of_experience: 4,
      location: "Bangalore",
      expected_salary: 900000,
      ml_prediction: { predicted_temperature: "Cold", confidence: 0.55 },
    },
  ];

  useEffect(() => {
    // simulate API fetch
    setTimeout(() => {
      setLeads(mockLeads);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % images.length);
    }, 5000); // rotate background
    return () => clearInterval(interval);
  }, []);

  const temperatureColor = (temp) => {
    if (temp === "Hot") return "bg-red-100 text-red-600";
    if (temp === "Warm") return "bg-amber-100 text-amber-700";
    return "bg-cyan-100 text-cyan-700";
  };

  const formatSalaryINR = (value) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <img
          src={images[currentBg]}
          alt=""
          className="absolute w-full h-full object-cover transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-indigo-900/70 to-purple-900/80" />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-emerald-500 mx-auto mb-6"></div>
          <p className="text-white text-lg tracking-wide">Loading AI Insights...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen relative overflow-hidden">
      <img
        src={images[currentBg]}
        alt=""
        className="absolute w-full h-full object-cover transition-all duration-1000"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-indigo-900/70 to-purple-900/80" />
      <div className="absolute w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 -top-32 -left-32" />
      <div className="absolute w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 -bottom-32 -right-32" />

      <div className="relative z-10 text-white px-10 py-10">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              AI Recruiter Dashboard
            </h1>
            <p className="text-slate-300 mt-3 text-lg">Intelligent candidate scoring & analytics</p>
          </div>

          <button
            onClick={() => setLeads(mockLeads)}
            className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-600 px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-emerald-600/20 hover:scale-105"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-emerald-500/10 transition">
            <div className="flex items-center gap-5">
              <Users className="text-emerald-400" size={34} />
              <div>
                <p className="text-slate-300 text-sm uppercase tracking-wider">Total Candidates</p>
                <h2 className="text-3xl font-bold mt-1">{leads.length}</h2>
              </div>
            </div>
          </div>
          {/* You can add Hot Leads & Avg Confidence using same mock data */}
        </div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/10 text-slate-300 text-sm uppercase tracking-wider">
                <tr>
                  <th className="p-5 text-left">Candidate</th>
                  <th className="p-5 text-left">Role</th>
                  <th className="p-5 text-left">Experience</th>
                  <th className="p-5 text-left">Location</th>
                  <th className="p-5 text-left">Salary</th>
                  <th className="p-5 text-left">AI Score</th>
                  <th className="p-5 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => navigate(`/lead/${lead._id}`)}
                    className="border-t border-white/5 hover:bg-white/10 transition-all duration-300 cursor-pointer"
                  >
                    <td className="p-5">
                      <p className="font-semibold text-lg">{lead.name}</p>
                      <p className="text-sm text-slate-400 mt-1">{lead.email}</p>
                    </td>
                    <td className="p-5 font-medium text-slate-200">{lead.role_position}</td>
                    <td className="p-5 text-slate-300">{lead.years_of_experience} yrs</td>
                    <td className="p-5 text-slate-300">{lead.location}</td>
                    <td className="p-5 font-semibold text-slate-200">{formatSalaryINR(lead.expected_salary)}</td>
                    <td className="p-5">
                      <span
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold ${temperatureColor(
                          lead.ml_prediction?.predicted_temperature
                        )}`}
                      >
                        {lead.ml_prediction?.predicted_temperature || "Cold"}
                      </span>
                    </td>
                    <td className="p-5 font-bold text-emerald-400">
                      {Math.round((lead.ml_prediction?.confidence || 0) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
