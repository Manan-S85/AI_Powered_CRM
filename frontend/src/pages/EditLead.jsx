import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function EditLead() {
  const { id } = useParams(); // /lead/edit/:id
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch lead
  useEffect(() => {
    const fetchLead = async () => {
      try {
        const res = await fetch(`http://localhost:8001/lead/${id}`);
        const data = await res.json();

        if (data.success) {
          setLead(data.lead);
        } else {
          setError("Failed to load lead");
        }
      } catch {
        setError("Server error");
      } finally {
        setLoading(false);
      }
    };

    fetchLead();
  }, [id]);

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  // Update lead
  const handleUpdate = async () => {
    setSaving(true);

    try {
      const res = await fetch(`http://localhost:8001/lead/${id}`, {
        method: "PUT", // change to PATCH if your backend uses it
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lead),
      });

      const data = await res.json();

      if (data.success) {
        alert("Lead updated successfully!");
        navigate("/");
      } else {
        alert("Update failed");
      }
    } catch {
      alert("Server error");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-10 text-center text-lg">Loading lead...</div>;

  if (error)
    return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center p-8">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Edit Lead</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <input
            name="name"
            value={lead.name || ""}
            onChange={handleChange}
            placeholder="Name"
            className="border p-3 rounded-lg"
          />

          <input
            name="email"
            value={lead.email || ""}
            onChange={handleChange}
            placeholder="Email"
            className="border p-3 rounded-lg"
          />

          <input
            name="role_position"
            value={lead.role_position || ""}
            onChange={handleChange}
            placeholder="Role"
            className="border p-3 rounded-lg"
          />

          <input
            type="number"
            name="years_of_experience"
            value={lead.years_of_experience || 0}
            onChange={handleChange}
            placeholder="Experience"
            className="border p-3 rounded-lg"
          />

          <input
            name="location"
            value={lead.location || ""}
            onChange={handleChange}
            placeholder="Location"
            className="border p-3 rounded-lg"
          />

          <select
            name="interview_status"
            value={lead.interview_status || "New"}
            onChange={handleChange}
            className="border p-3 rounded-lg"
          >
            <option>New</option>
            <option>Scheduled</option>
            <option>Completed</option>
            <option>Rejected</option>
          </select>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-200 rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            {saving ? "Updating..." : "Update Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
