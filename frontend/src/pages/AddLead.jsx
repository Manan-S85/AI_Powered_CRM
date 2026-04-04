import React, { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import api from "../api/Api";

const formatApiError = (requestError) => {
  const detail = requestError?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const fieldPath = Array.isArray(item?.loc) ? item.loc.join(" -> ") : "field";
        return `${fieldPath}: ${item?.msg || "Invalid value"}`;
      })
      .join(" | ");
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return requestError?.message || "Failed to add lead";
};

const initialLead = {
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
  company_name: "",
  company_website: "",
  company_email: "",
};

export default function AddLead() {
  const [lead, setLead] = useState(initialLead);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setLead((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        ...lead,
        phone: lead.phone?.trim() ? lead.phone.trim() : null,
        skills: lead.skills?.trim() ? lead.skills.trim() : null,
        location: lead.location?.trim() ? lead.location.trim() : null,
        linkedin_profile: lead.linkedin_profile?.trim() ? lead.linkedin_profile.trim() : null,
        company_name: lead.company_name?.trim() ? lead.company_name.trim() : null,
        company_website: lead.company_website?.trim() ? lead.company_website.trim() : null,
        years_of_experience: lead.years_of_experience ? Number(lead.years_of_experience) : 0,
        expected_salary: lead.expected_salary ? Number(lead.expected_salary) : 0,
        company_email: lead.company_email?.trim() ? lead.company_email.trim() : null,
      };

      const response = await api.post("/predict", payload);
      if (!response.data?.success) {
        throw new Error("Lead submission failed");
      }

      setPrediction(response.data.prediction || null);
      setSuccessMessage("Lead added and scored successfully.");
      setLead(initialLead);

      // Notify dashboard views to refetch leads immediately.
      localStorage.setItem("crm:lastLeadAddedAt", String(Date.now()));
      window.dispatchEvent(new CustomEvent("crm:lead-added"));
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const confidence = prediction?.confidence ? (prediction.confidence * 100).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.09),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.09),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
            Add Lead
          </h1>
          <p className="text-slate-400 mt-2 text-base">Capture candidate details and run instant ML lead-temperature scoring.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</label>
                <input type="text" name="name" value={lead.name} onChange={handleChange} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="Candidate full name" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                <input type="email" name="email" value={lead.email} onChange={handleChange} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="candidate@email.com" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</label>
                <input type="text" name="phone" value={lead.phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="+91 XXXXX XXXXX" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role Position</label>
                <input type="text" name="role_position" value={lead.role_position} onChange={handleChange} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="Backend Developer" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Highest Education</label>
                <input type="text" name="highest_education" value={lead.highest_education} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="B.Tech / MCA / etc." />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Experience (Years)</label>
                <input type="number" min="0" name="years_of_experience" value={lead.years_of_experience} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="3" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</label>
                <input type="text" name="location" value={lead.location} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="Bangalore" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected Salary (INR)</label>
                <input type="number" min="0" name="expected_salary" value={lead.expected_salary} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="1200000" />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Skills</label>
                <textarea name="skills" value={lead.skills} onChange={handleChange} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="Python, FastAPI, React, SQL..." />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">LinkedIn Profile</label>
                <input type="url" name="linkedin_profile" value={lead.linkedin_profile} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="https://linkedin.com/in/..." />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Willing To Relocate</label>
                <select name="willing_to_relocate" value={lead.willing_to_relocate} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Company Name</label>
                <input type="text" name="company_name" value={lead.company_name} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="Acme Pvt Ltd" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Company Website</label>
                <input type="url" name="company_website" value={lead.company_website} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="https://company.com" />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Company Email</label>
                <input type="email" name="company_email" value={lead.company_email} onChange={handleChange} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm" placeholder="hello@company.com" />
              </div>

              <div className="md:col-span-2 pt-2">
                <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold hover:from-emerald-500 hover:to-cyan-500 transition disabled:opacity-70">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? "Analyzing Lead..." : "Add Lead and Generate Prediction"}
                </button>
              </div>
            </form>
          </section>

          <aside className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Prediction Result</h2>

            {error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
            {successMessage ? (
              <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {successMessage}
              </div>
            ) : null}

            {prediction ? (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5">
                <p className="text-sm text-slate-400 mb-2">Lead Temperature</p>
                <p className="text-3xl font-bold text-emerald-300">{prediction.predicted_temperature}</p>

                <p className="text-sm text-slate-400 mt-5 mb-2">Confidence</p>
                <p className="text-2xl font-semibold text-cyan-300">{confidence}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${confidence || 0}%` }} />
                </div>

                <div className="mt-5 text-xs text-slate-400 leading-6">
                  <p className="inline-flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 size={14} />
                    Lead saved and scored by ML service.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm text-slate-400 leading-6">
                Submit the form to view prediction output, confidence score, and quality signal for this lead.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
