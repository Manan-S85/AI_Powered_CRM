import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/Api";
import SmartEmailGeneratorModal from "../components/SmartEmailGeneratorModal";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/lead/${id}`);
      setLead(res.data?.lead);
      setError("");
    } catch {
      setError("Failed to load lead details");
    } finally {
      setLoading(false);
    }
  };

  const temperatureColor = (temp) => {
    if (temp === "Hot") return "bg-red-100 text-red-600";
    if (temp === "Warm") return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading lead...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchLead}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!lead) return null;

  return (
  <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-black px-6 py-14">

    <div className="max-w-5xl mx-auto">

      <button
        onClick={() => navigate(-1)}
        className="mb-8 px-6 py-2 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-slate-300 hover:bg-white/10 transition"
      >
        ← Back
      </button>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-10">

        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-10">

          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              {lead.name}
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              {lead.email}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-4">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              disabled={!lead?.unique_id}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold transition disabled:opacity-60"
              title={lead?.unique_id ? "Generate contextual follow-up email" : "Lead unique_id missing"}
            >
              Generate Follow-up
            </button>

            <span
              className={`px-6 py-2 rounded-full font-semibold text-sm ${temperatureColor(
                lead?.ml_prediction?.predicted_temperature
              )}`}
            >
              {lead?.ml_prediction?.predicted_temperature}
            </span>

            <div className="text-sm text-slate-400">
              Confidence Score
              <div className="mt-2 w-40 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{
                    width: `${
                      Math.round(
                        (lead?.ml_prediction?.confidence || 0) * 100
                      )
                    }%`,
                  }}
                ></div>
              </div>
              <p className="mt-2 text-white font-medium">
                {Math.round(
                  (lead?.ml_prediction?.confidence || 0) * 100
                )}%
              </p>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Role Position</p>
            <p className="text-xl font-semibold text-white mt-2">
              {lead.role_position}
            </p>
          </div>

          <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Model Version</p>
            <p className="text-xl font-semibold text-white mt-2">
              {lead?.ml_prediction?.model_version}
            </p>
          </div>

          <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Prediction Date</p>
            <p className="text-lg font-semibold text-white mt-2">
              {new Date(
                lead?.ml_prediction?.prediction_timestamp
              ).toLocaleString()}
            </p>
          </div>

          <div className="bg-[#1e293b]/60 border border-slate-700 rounded-2xl p-6">
            <p className="text-slate-400 text-sm">Lead ID</p>
            <p className="text-lg font-semibold text-white mt-2">
              {lead._id}
            </p>
          </div>

        </div>

      </div>

    </div>

    <SmartEmailGeneratorModal
      isOpen={isEmailModalOpen}
      onClose={() => setIsEmailModalOpen(false)}
      uniqueId={lead?.unique_id}
      leadName={lead?.name}
    />
  </div>
);
}
