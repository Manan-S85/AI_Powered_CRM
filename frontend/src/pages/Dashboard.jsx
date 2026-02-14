
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/Api";
import { RefreshCw, Info } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading leads...</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchLeads}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Leads Dashboard</h1>
          <p className="text-gray-600 mt-2">Total Candidates: {leads.length}</p>
        </div>
        <button
          onClick={fetchLeads}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-md inline-flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Info banner if leads exist but may be from old schema */}
      {leads.length > 0 && leads.some(l => !l.highest_education || l.highest_education === 'N/A') && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="mr-3 text-yellow-600">
              <Info size={24} />
            </span>
            <div>
              <p className="text-yellow-800 font-medium">Legacy Data Detected</p>
              <p className="text-yellow-700 text-sm mt-1">
                Some leads are from an older format and may not display all fields. Add new candidates to see the full Google Sheets integration.
              </p>
            </div>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No leads found. Add your first candidate!</p>
          <button
            onClick={() => navigate("/addlead")}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            + Add Lead
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gradient-to-r from-slate-700 to-emerald-700 text-white">
                <tr>
                  <th className="p-4 text-left font-semibold">Full Name</th>
                  <th className="p-4 text-left font-semibold">Email</th>
                  <th className="p-4 text-left font-semibold">Phone</th>
                  <th className="p-4 text-left font-semibold">Education</th>
                  <th className="p-4 text-left font-semibold">Position</th>
                  <th className="p-4 text-left font-semibold">Experience</th>
                  <th className="p-4 text-left font-semibold">Skills</th>
                  <th className="p-4 text-left font-semibold">Location</th>
                  <th className="p-4 text-left font-semibold">Salary</th>
                  <th className="p-4 text-left font-semibold">Relocate</th>
                  <th className="p-4 text-left font-semibold">ML Score</th>
                  <th className="p-4 text-left font-semibold">Confidence</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead, idx) => (
                  <tr
                    key={lead._id}
                    onClick={() => navigate(`/lead/${lead._id}`)}
                    className={`border-t hover:bg-slate-50 transition cursor-pointer ${
                      idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <td className="p-4 font-semibold text-gray-800">{lead.name || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-600">{lead.email || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-600">{lead.phone || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-600">{lead.highest_education || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-700 font-medium">{lead.role_position || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-600">{lead.years_of_experience || 0} yrs</td>
                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={lead.skills}>
                      {lead.skills || "N/A"}
                    </td>
                    <td className="p-4 text-sm text-gray-600">{lead.location || "N/A"}</td>
                    <td className="p-4 text-sm text-gray-700 font-medium">
                      {formatSalaryINR(lead.expected_salary)}
                    </td>
                    <td className="p-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          lead.willing_to_relocate === "Yes"
                            ? "bg-green-100 text-green-700"
                            : lead.willing_to_relocate === "No"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {lead.willing_to_relocate || "N/A"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${temperatureColor(
                          lead?.ml_prediction?.predicted_temperature
                        )}`}
                      >
                        {lead?.ml_prediction?.predicted_temperature || "Cold"}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-semibold text-gray-700">
                      {Math.round((lead?.ml_prediction?.confidence || 0) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}