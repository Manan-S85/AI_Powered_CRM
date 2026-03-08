import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import api from "../api/Api";

const initialIntelligence = {
  industry: "Unknown",
  estimated_company_size: "Unknown",
  decision_makers: [],
  summary: "",
};

export default function CandidateProfile() {
  const { candidate_id: candidateId } = useParams();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState("");
  const [intelligence, setIntelligence] = useState(initialIntelligence);

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/candidate/${candidateId}`);
        const profile = data?.candidate || null;
        setCandidate(profile);
        setCompanyName(profile?.company_name || "");
        setCompanyWebsite(profile?.company_website || "");
        setCompanyEmail(profile?.company_email || "");
      } catch (requestError) {
        setError(requestError.response?.data?.detail || "Failed to load candidate profile");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidate();
  }, [candidateId]);

  const handleEnrichCompany = async () => {
    setEnrichmentError("");

    if (!companyName.trim()) {
      setEnrichmentError("Company name is required for enrichment");
      return;
    }

    try {
      setEnriching(true);
      const { data } = await api.post("/lead-enrichment/enrich-company", {
        company_name: companyName.trim(),
        company_website: companyWebsite.trim() || null,
        company_email: companyEmail.trim() || null,
      });

      setIntelligence(data?.intelligence || initialIntelligence);
    } catch (requestError) {
      setEnrichmentError(requestError.response?.data?.detail || "Failed to enrich company data");
    } finally {
      setEnriching(false);
    }
  };

  const formattedSalary = useMemo(() => {
    if (!candidate?.expected_salary) {
      return "N/A";
    }

    const numericSalary = Number(String(candidate.expected_salary).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numericSalary) || numericSalary <= 0) {
      return "N/A";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numericSalary);
  }, [candidate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white flex items-center justify-center">
        <p className="text-slate-300">Loading candidate profile...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-400">{error || "Candidate not found"}</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white px-6 md:px-10 py-8 md:py-10">
      <div className="max-w-6xl mx-auto space-y-7">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 transition"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
            Candidate Profile
          </h1>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Full Name" value={candidate.name || "N/A"} />
            <InfoCard label="Email" value={candidate.email || "N/A"} />
            <InfoCard label="Mobile" value={candidate.phone || "N/A"} />
            <InfoCard label="Role" value={candidate.role_position || "N/A"} />
            <InfoCard label="Experience" value={`${candidate.years_of_experience ?? 0} yrs`} />
            <InfoCard label="Location" value={candidate.location || "N/A"} />
            <InfoCard label="Salary" value={formattedSalary} />
            <InfoCard label="Skills" value={candidate.skills || "N/A"} />
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-slate-100">Company Information</h2>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Company Name"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Acme Pvt Ltd"
            />
            <Field
              label="Company Website"
              value={companyWebsite}
              onChange={setCompanyWebsite}
              placeholder="https://example.com"
            />
            <Field
              label="Company Email"
              value={companyEmail}
              onChange={setCompanyEmail}
              placeholder="contact@example.com"
              className="md:col-span-2"
            />
          </div>

          {enrichmentError && <p className="text-red-400 text-sm mt-4">{enrichmentError}</p>}

          <button
            type="button"
            onClick={handleEnrichCompany}
            disabled={enriching}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold transition disabled:opacity-70"
          >
            <Sparkles size={16} />
            {enriching ? "Analyzing company data..." : "Enrich Company Data"}
          </button>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-slate-100">AI Company Intelligence</h2>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Industry" value={intelligence.industry || "Unknown"} />
            <InfoCard label="Estimated Company Size" value={intelligence.estimated_company_size || "Unknown"} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Decision Makers</p>
            {Array.isArray(intelligence.decision_makers) && intelligence.decision_makers.length ? (
              <ul className="space-y-1 text-sm text-slate-200 list-disc pl-5">
                {intelligence.decision_makers.map((maker, index) => (
                  <li key={`${maker}-${index}`}>{maker}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No decision makers identified yet.</p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Summary</p>
            <p className="text-sm text-slate-200 leading-6">{intelligence.summary || "No summary generated yet."}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm md:text-base text-slate-100 mt-2 break-words">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
