
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/Api";
import { RefreshCw, Users, Briefcase, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");
      console.log("[Dashboard] Fetching leads from /leads?limit=50");
      const res = await api.get("/leads?limit=50");
      console.log("[Dashboard] Response:", res.data);
      
      if (res.data && res.data.success) {
        const leadsData = res.data.leads || [];
        console.log("[Dashboard] Got", leadsData.length, "leads");

        const canonicalize = (key) =>
          String(key || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const normalizeLead = (lead) => {
          const index = Object.entries(lead || {}).reduce((accumulator, [rawKey, value]) => {
            accumulator[canonicalize(rawKey)] = value;
            return accumulator;
          }, {});

          const getValue = (...aliases) => {
            for (const alias of aliases) {
              const value = index[canonicalize(alias)];
              if (value !== undefined && value !== null && String(value).trim() !== "") {
                return value;
              }
            }
            return undefined;
          };

          const firstName = getValue("firstName", "first_name");
          const lastName = getValue("lastName", "last_name");
          const fullName = `${firstName || ""} ${lastName || ""}`.trim();

          return {
            ...lead,
            name:
              getValue("name", "full_name", "full name", "candidate name") ||
              fullName ||
              "N/A",
            email: getValue("email", "email address") || "N/A",
            phone:
              getValue("phone", "phoneNumber", "mobile_number", "mobile number", "contact number") ||
              "N/A",
            highest_education:
              getValue("highest_education", "highest education", "education", "qualification") ||
              "N/A",
            role_position:
              getValue("role_position", "applied_position", "position", "applied position", "job role") ||
              "N/A",
            years_of_experience:
              getValue("years_of_experience", "years of experience", "experience", "exp") ?? 0,
            skills:
              getValue("skills", "primary_skills", "primary skills", "expertise", "technologies") ||
              "N/A",
            location:
              getValue("location", "current_location", "current location", "city") ||
              "N/A",
            linkedin_profile:
              getValue("linkedin_profile", "linkedin profile", "linkedin") ||
              "N/A",
            expected_salary:
              getValue("expected_salary", "expected salary", "salary", "annual salary") ?? 0,
            willing_to_relocate:
              getValue("willing_to_relocate", "willing to relocate", "relocate") ||
              "N/A",
          };
        };
        
        const normalizedLeads = leadsData.map(normalizeLead);
        
        setLeads(normalizedLeads);
      } else {
        console.error("[Dashboard] Unexpected response format:", res.data);
        setError("Unexpected response format from server");
      }
    } catch (err) {
      console.error("[Dashboard] Error fetching leads:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load leads. Check if backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const temperatureColor = (temp) => {
    if (temp === "Hot") return "bg-red-100 text-red-600";
    if (temp === "Warm") return "bg-amber-100 text-amber-700";
    return "bg-cyan-100 text-cyan-700";
  };

  const formatSalaryINR = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";

    const numericValue =
      typeof value === "number"
        ? value
        : Number(String(value).replace(/[^0-9.]/g, ""));

    if (!Number.isFinite(numericValue) || numericValue <= 0) return "N/A";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numericValue);
  };

  if (loading)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-emerald-500 mx-auto mb-6"></div>
        <p className="text-slate-300 text-lg tracking-wide">
          Loading AI Insights...
        </p>
      </div>
    </div>
  );

return (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white px-10 py-10">
    
    <div className="flex justify-between items-center mb-12">
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          AI Recruiter Dashboard
        </h1>
        <p className="text-slate-400 mt-3 text-lg">
          Intelligent candidate scoring & analytics
        </p>
      </div>

      <button
        onClick={fetchLeads}
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
            <p className="text-slate-400 text-sm uppercase tracking-wider">
              Total Candidates
            </p>
            <h2 className="text-3xl font-bold mt-1">{leads.length}</h2>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-red-500/10 transition">
        <div className="flex items-center gap-5">
          <Briefcase className="text-red-400" size={34} />
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wider">
              Hot Leads
            </p>
            <h2 className="text-3xl font-bold mt-1">
              {leads.filter(l => l.ml_prediction?.predicted_temperature === "Hot").length}
            </h2>
          </div>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-cyan-500/10 transition">
        <div className="flex items-center gap-5">
          <TrendingUp className="text-cyan-400" size={34} />
          <div>
            <p className="text-slate-400 text-sm uppercase tracking-wider">
              Avg Confidence
            </p>
            <h2 className="text-3xl font-bold mt-1">
              {leads.length
                ? Math.round(
                    (leads.reduce((acc, l) => acc + (l.ml_prediction?.confidence || 0), 0) /
                      leads.length) *
                      100
                  )
                : 0}%
            </h2>
          </div>
        </div>
      </div>
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

                <td className="p-5 font-medium text-slate-200">
                  {lead.role_position}
                </td>

                <td className="p-5 text-slate-300">
                  {lead.years_of_experience} yrs
                </td>

                <td className="p-5 text-slate-300">
                  {lead.location}
                </td>

                <td className="p-5 font-semibold text-slate-200">
                  {formatSalaryINR(lead.expected_salary)}
                </td>

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
);
}