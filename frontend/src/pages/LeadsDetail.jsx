import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/Api";
import { ArrowLeft } from "lucide-react";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/leads/${id}`);
      const rawLead = res.data?.lead;

      if (rawLead) {
        setLead({
          ...rawLead,
          name: rawLead.name || rawLead.full_name || "N/A",
          role_position: rawLead.role_position || rawLead.applied_position || rawLead.position || "N/A",
          email: rawLead.email || "N/A",
        });
      } else {
        setLead(null);
      }
      setError("");
    } catch (err) {
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
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 px-4 py-2 bg-white shadow rounded-lg hover:bg-gray-100 inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">{lead.name}</h1>
            <p className="text-gray-500">{lead.email}</p>
          </div>

          <span
            className={`px-4 py-2 rounded-full font-semibold ${temperatureColor(
              lead?.ml_prediction?.predicted_temperature
            )}`}
          >
            {lead?.ml_prediction?.predicted_temperature}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-semibold">{lead.role_position}</p>
          </div>

          <div>
            <p className="text-gray-500">Confidence</p>
            <p className="font-semibold">
              {Math.round((lead?.ml_prediction?.confidence || 0) * 100)}%
            </p>
          </div>

          <div>
            <p className="text-gray-500">Model Version</p>
            <p className="font-semibold">
              {lead?.ml_prediction?.model_version}
            </p>
          </div>

          <div>
            <p className="text-gray-500">Prediction Date</p>
            <p className="font-semibold">
              {new Date(
                lead?.ml_prediction?.prediction_timestamp
              ).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
