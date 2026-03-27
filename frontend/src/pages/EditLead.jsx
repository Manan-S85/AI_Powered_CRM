
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
  <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-black flex justify-center items-center px-6 py-16">

    <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-12">

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Edit Candidate
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Update lead information and interview status
          </p>
        </div>

        <div className="text-sm px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-400">
          Lead ID: {id}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Full Name</label>
          <input
            name="name"
            value={lead.name || ""}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Email Address</label>
          <input
            name="email"
            value={lead.email || ""}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Role Position</label>
          <input
            name="role_position"
            value={lead.role_position || ""}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Years of Experience</label>
          <input
            type="number"
            name="years_of_experience"
            value={lead.years_of_experience || 0}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Location</label>
          <input
            name="location"
            value={lead.location || ""}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-slate-400 text-sm">Interview Status</label>
          <select
            name="interview_status"
            value={lead.interview_status || "New"}
            onChange={handleChange}
            className="bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          >
            <option>New</option>
            <option>Scheduled</option>
            <option>Completed</option>
            <option>Rejected</option>
          </select>
        </div>

      </div>

      <div className="flex justify-end gap-5 mt-12">

        <button
          onClick={() => navigate(-1)}
          className="px-8 py-3 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
        >
          Cancel
        </button>

        <button
          onClick={handleUpdate}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-medium hover:opacity-90 transition shadow-lg"
        >
          {saving ? "Updating..." : "Update Lead"}
        </button>

      </div>

    </div>
  </div>
);
}
