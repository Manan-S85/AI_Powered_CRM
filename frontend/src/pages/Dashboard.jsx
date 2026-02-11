
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/Api";

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
      const res = await api.get("/leads?limit=50");
      const mapped = (res.data?.leads || []).map((item) => item.lead || item);
      setLeads(mapped);
      setError("");
    } catch (err) {
      setError("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const temperatureColor = (temp) => {
    if (temp === "Hot") return "bg-red-100 text-red-600";
    if (temp === "Warm") return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-600";
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
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">Leads Dashboard</h1>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-4">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Temperature</th>
              <th>Confidence</th>
              <th>Processed</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead._id}
                onClick={() => navigate(`/lead/${lead._id}`)}
                className="border-t hover:bg-indigo-50 transition cursor-pointer"
              >
                <td className="p-4 font-semibold">{lead.name}</td>
                <td>{lead.email}</td>
                <td>{lead.role_position}</td>

                <td>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${temperatureColor(
                      lead?.ml_prediction?.predicted_temperature
                    )}`}
                  >
                    {lead?.ml_prediction?.predicted_temperature || "Cold"}
                  </span>
                </td>

                <td>
                  {Math.round(
                    (lead?.ml_prediction?.confidence || 0) * 100
                  )}
                  %
                </td>

                <td>
                  {new Date(
                    lead?.ml_prediction?.prediction_timestamp
                  ).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}