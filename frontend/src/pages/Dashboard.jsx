import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Briefcase, Eye, RefreshCw, TrendingUp, Users, X } from "lucide-react";
import api from "../api/Api";

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

const emptyConversationOverview = {
  total_analyzed: 0,
  average_client_intent_score: 0,
  average_rep_performance_score: 0,
  risk_distribution: {
    "Deal at Risk": 0,
    "Moderate Risk": 0,
    "Healthy Deal": 0,
  },
};

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
    ml_prediction: (() => {
      const prediction = lead?.ml_prediction || { predicted_temperature: "Cold", confidence: 0 };
      const currentLabel = String(prediction?.predicted_temperature || "").trim();
      if (currentLabel !== "Uncertain") {
        return prediction;
      }

      // Backward compatibility for records stored before uncertainty was moved to metadata.
      const fallbackLabel =
        prediction?.base_model_temperature ||
        prediction?.uncertainty?.top_label ||
        prediction?.final_label ||
        "Cold";

      return {
        ...prediction,
        predicted_temperature: fallbackLabel,
        final_label: fallbackLabel,
        is_uncertain: true,
      };
    })(),
    name: getValue("name", "full_name", "full name", "candidate name") || fullName || "N/A",
    email: getValue("email", "email address") || "N/A",
    role_position:
      getValue("role_position", "applied_position", "position", "applied position", "job role") || "N/A",
    years_of_experience: getValue("years_of_experience", "years of experience", "experience", "exp") ?? 0,
    location: getValue("location", "current_location", "current location", "city") || "N/A",
    expected_salary: getValue("expected_salary", "expected salary", "salary", "annual salary") ?? 0,
  };
};

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conversationOverview, setConversationOverview] = useState(emptyConversationOverview);
  const [activeUncertainty, setActiveUncertainty] = useState(null);

  const navigate = useNavigate();

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/leads?limit=50");
      if (res.data && res.data.success) {
        const leadsData = Array.isArray(res.data.leads) ? res.data.leads : [];
        setLeads(leadsData.map(normalizeLead));
      } else {
        setError("Unexpected response format from server. Showing sample dashboard data.");
        setLeads(mockLeads);
      }

      try {
        const overviewRes = await api.get("/conversation-intelligence/overview?limit=300");
        if (overviewRes?.data?.success && overviewRes?.data?.overview) {
          setConversationOverview({
            ...emptyConversationOverview,
            ...overviewRes.data.overview,
            risk_distribution: {
              ...emptyConversationOverview.risk_distribution,
              ...(overviewRes.data.overview.risk_distribution || {}),
            },
          });
        }
      } catch {
        // Conversation intelligence is optional; keep default metrics when unavailable.
      }
    } catch (err) {
      setError(err.message || "Failed to load leads. Showing sample dashboard data.");
      setLeads(mockLeads);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
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

  const riskLabelStyle = (label) => {
    if (label === "Deal at Risk") return "bg-red-500/20 text-red-300 border border-red-500/40";
    if (label === "Moderate Risk") return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  };

  const getUncertaintyData = (lead) => {
    const prediction = lead?.ml_prediction || {};
    const uncertainty =
      prediction?.uncertainty && typeof prediction.uncertainty === "object"
        ? prediction.uncertainty
        : {};

    const reasons = Array.isArray(uncertainty.reasons)
      ? uncertainty.reasons.filter((item) => String(item || "").trim())
      : [];

    const isUncertain = Boolean(
      prediction?.is_uncertain ?? uncertainty?.is_uncertain ?? false
    );

    return {
      isUncertain,
      classifiedAs: prediction?.predicted_temperature || "Cold",
      summary:
        uncertainty?.summary ||
        prediction?.uncertainty_reason ||
        "Uncertainty flag raised for this classification.",
      reasons,
      recommendedAction:
        uncertainty?.recommended_action ||
        "Collect additional lead context before taking high-priority actions.",
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-emerald-500 mx-auto mb-6"></div>
          <p className="text-white text-lg tracking-wide">Loading AI Insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.08),_transparent_38%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] text-white px-6 md:px-10 py-8 md:py-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-slate-300 mt-3 text-lg">Intelligent candidate scoring and analytics</p>
          </div>

          <button
            type="button"
            onClick={fetchLeads}
            className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-600 px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-emerald-600/20 hover:scale-105"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-emerald-500/10 transition">
            <div className="flex items-center gap-5">
              <Users className="text-emerald-400" size={34} />
              <div>
                <p className="text-slate-400 text-sm uppercase tracking-wider">Total Candidates</p>
                <h2 className="text-3xl font-bold mt-1">{leads.length}</h2>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-red-500/10 transition">
            <div className="flex items-center gap-5">
              <Briefcase className="text-red-400" size={34} />
              <div>
                <p className="text-slate-400 text-sm uppercase tracking-wider">Hot Leads</p>
                <h2 className="text-3xl font-bold mt-1">
                  {leads.filter((lead) => lead.ml_prediction?.predicted_temperature === "Hot").length}
                </h2>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl hover:shadow-cyan-500/10 transition">
            <div className="flex items-center gap-5">
              <TrendingUp className="text-cyan-400" size={34} />
              <div>
                <p className="text-slate-400 text-sm uppercase tracking-wider">Avg Confidence</p>
                <h2 className="text-3xl font-bold mt-1">
                  {leads.length
                    ? Math.round(
                        (leads.reduce((acc, lead) => acc + (lead.ml_prediction?.confidence || 0), 0) /
                          leads.length) *
                          100
                      )
                    : 0}
                  %
                </h2>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Conversation Intelligence</h2>
              <p className="text-sm text-slate-400 mt-1">Sentiment and intent scoring from conversations, emails, and transcripts.</p>
            </div>
            <span className="text-xs px-3 py-1.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Analyzed: {conversationOverview.total_analyzed}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Client Intent Score</p>
              <p className="text-2xl font-bold text-emerald-300 mt-2">{Math.round(conversationOverview.average_client_intent_score || 0)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Sales Rep Performance</p>
              <p className="text-2xl font-bold text-cyan-300 mt-2">{Math.round(conversationOverview.average_rep_performance_score || 0)}</p>
            </div>
            {Object.entries(conversationOverview.risk_distribution || {}).map(([label, count]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold ${riskLabelStyle(label)}`}>
                  {count}
                </span>
              </div>
            ))}
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
                  <th className="p-5 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => {
                  const uncertainty = getUncertaintyData(lead);

                  return (
                    <tr
                      key={lead._id}
                      className="border-t border-white/5 hover:bg-white/10 transition-all duration-300"
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
                      {uncertainty.isUncertain ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-amber-300">
                          <span
                            className="inline-flex items-center"
                            title={`Uncertain confidence: still classified as ${uncertainty.classifiedAs}`}
                          >
                            <AlertTriangle size={14} />
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveUncertainty({
                                leadName: lead.name,
                                ...uncertainty,
                              })
                            }
                            className="text-xs underline underline-offset-2 hover:text-amber-200"
                          >
                            Uncertain
                          </button>
                        </div>
                      ) : null}
                    </td>

                    <td className="p-5 font-bold text-emerald-400">
                      {Math.round((lead.ml_prediction?.confidence || 0) * 100)}%
                    </td>

                    <td className="p-5">
                      <button
                        type="button"
                        onClick={() => navigate(`/candidate/${lead.unique_id || lead._id}`)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/10 transition"
                        title="View Candidate Profile"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {activeUncertainty ? (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-amber-400/30 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-white/10">
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-300">Uncertainty Explanation</p>
                  <h3 className="text-lg font-semibold mt-1 text-white">
                    {activeUncertainty.leadName} classified as {activeUncertainty.classifiedAs}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveUncertainty(null)}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-sm text-slate-200">
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <p>{activeUncertainty.summary}</p>
                </div>

                {activeUncertainty.reasons.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Why flagged as uncertain</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {activeUncertainty.reasons.map((reason, index) => (
                        <li key={`${reason}-${index}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-slate-400">No additional uncertainty factors were recorded.</p>
                )}

                <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-cyan-300 mb-1">Recommended action</p>
                  <p>{activeUncertainty.recommendedAction}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
