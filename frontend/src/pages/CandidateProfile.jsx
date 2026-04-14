import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import api from "../api/Api";
import SmartEmailGeneratorModal from "../components/SmartEmailGeneratorModal";

const initialIntelligence = {
  industry: "Unknown",
  estimated_company_size: "Unknown",
  decision_makers: [],
  summary: "",
  provider_used: "",
};

const initialConversationIntelligence = {
  analysis: {
    sentiment: "neutral",
    client_intent: "neutral",
    objections: [],
    competitor_mentions: [],
    key_insights: [],
  },
  scores: {
    client_intent_score: 0,
    sales_rep_performance_score: 0,
    engagement_score: 0,
    balance_score: 0,
    response_quality_score: 0,
  },
  risk: {
    label: "Healthy Deal",
    flags: [],
  },
  analyzed_at: null,
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
  const [enrichmentSuccess, setEnrichmentSuccess] = useState("");
  const [intelligence, setIntelligence] = useState(initialIntelligence);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [conversationIntelligence, setConversationIntelligence] = useState(initialConversationIntelligence);
  const [conversationInput, setConversationInput] = useState("");
  const [conversationLoading, setConversationLoading] = useState(true);
  const [conversationAnalyzing, setConversationAnalyzing] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const fetchConversationIntelligence = async (leadIdentifier) => {
    if (!leadIdentifier) {
      setConversationIntelligence(initialConversationIntelligence);
      setConversationLoading(false);
      return;
    }

    try {
      setConversationLoading(true);
      const { data } = await api.get(`/conversation-intelligence/lead/${leadIdentifier}`);
      if (data?.success && data?.record) {
        setConversationIntelligence({
          ...initialConversationIntelligence,
          ...data.record,
          analysis: {
            ...initialConversationIntelligence.analysis,
            ...(data.record.analysis || {}),
          },
          scores: {
            ...initialConversationIntelligence.scores,
            ...(data.record.scores || {}),
          },
          risk: {
            ...initialConversationIntelligence.risk,
            ...(data.record.risk || {}),
          },
        });
      } else {
        setConversationIntelligence(initialConversationIntelligence);
      }
    } catch {
      setConversationIntelligence(initialConversationIntelligence);
    } finally {
      setConversationLoading(false);
    }
  };

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
        const leadIdentifier = profile?.unique_id || profile?._id;
        setConversationInput(profile?.conversation_text || profile?.notes || "");
        await fetchConversationIntelligence(leadIdentifier);
      } catch (requestError) {
        setError(requestError.response?.data?.detail || "Failed to load candidate profile");
        setConversationLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidate();
  }, [candidateId]);

  const handleEnrichCompany = async () => {
    setEnrichmentError("");
    setEnrichmentSuccess("");

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
        company_location: candidate?.location || null,
      });

      setIntelligence(data?.intelligence || initialIntelligence);
      const providerUsed = String(data?.intelligence?.provider_used || "").toLowerCase();
      const providerLabel = providerUsed === "gemini" ? "Gemini" : providerUsed === "openai" ? "OpenAI" : "fallback";
      setEnrichmentSuccess(`Company enrichment completed successfully via ${providerLabel}.`);
    } catch (requestError) {
      setEnrichmentError(requestError.response?.data?.detail || "Failed to enrich company data");
    } finally {
      setEnriching(false);
    }
  };

  const handleAnalyzeConversation = async () => {
    setConversationError("");

    const leadIdentifier = candidate?.unique_id || candidate?._id;
    if (!conversationInput.trim()) {
      setConversationError("Add conversation text to run analysis");
      return;
    }

    if (!leadIdentifier) {
      setConversationError("Lead identifier is missing for this candidate");
      return;
    }

    try {
      setConversationAnalyzing(true);
      const { data } = await api.post("/conversation-intelligence/analyze", {
        source_type: "chat_message",
        lead_id: leadIdentifier,
        conversation_text: conversationInput.trim(),
        metadata: {
          source: "candidate_profile",
        },
      });

      if (data?.success) {
        setConversationIntelligence({
          ...initialConversationIntelligence,
          ...data,
          analysis: {
            ...initialConversationIntelligence.analysis,
            ...(data.analysis || {}),
          },
          scores: {
            ...initialConversationIntelligence.scores,
            ...(data.scores || {}),
          },
          risk: {
            ...initialConversationIntelligence.risk,
            ...(data.risk || {}),
          },
        });
      }
    } catch (requestError) {
      setConversationError(requestError.response?.data?.detail || "Failed to analyze conversation intelligence");
    } finally {
      setConversationAnalyzing(false);
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

  const riskLabelStyle = (label) => {
    if (label === "Deal at Risk") return "bg-red-500/20 text-red-300 border border-red-500/40";
    if (label === "Moderate Risk") return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
    return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 transition"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            disabled={!candidate?.unique_id}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold transition disabled:opacity-60"
            title={
              candidate?.unique_id
                ? "Generate contextual follow-up email"
                : "Lead unique_id missing"
            }
          >
            <Sparkles size={16} />
            Generate Follow-up
          </button>
        </div>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
            Candidate Profile
          </h1>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Lead ID" value={candidate.unique_id || candidate._id || "N/A"} />
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
          {enrichmentSuccess && <p className="text-emerald-300 text-sm mt-4">{enrichmentSuccess}</p>}

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
            <InfoCard
              label="AI Provider"
              value={
                intelligence.provider_used
                  ? String(intelligence.provider_used).toUpperCase()
                  : "Unknown"
              }
            />
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

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-slate-100">Conversation Intelligence</h2>
          <p className="text-sm text-slate-400 mt-2">
            Analyze client interactions to detect sentiment, intent, objections, and deal risk.
          </p>

          <div className="mt-5">
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">Conversation Text</label>
            <textarea
              value={conversationInput}
              onChange={(event) => setConversationInput(event.target.value)}
              placeholder="Paste chat messages, email thread, or call transcript..."
              className="w-full min-h-[150px] bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {conversationError && <p className="text-red-400 text-sm mt-3">{conversationError}</p>}
            <button
              type="button"
              onClick={handleAnalyzeConversation}
              disabled={conversationAnalyzing}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold transition disabled:opacity-70"
            >
              <Sparkles size={16} />
              {conversationAnalyzing ? "Analyzing conversation..." : "Analyze Conversation"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              label="Sentiment"
              value={
                conversationLoading
                  ? "Loading..."
                  : String(conversationIntelligence.analysis?.sentiment || "neutral").toUpperCase()
              }
            />
            <InfoCard
              label="Client Intent"
              value={String(conversationIntelligence.analysis?.client_intent || "neutral").replace(/_/g, " ")}
            />
            <InfoCard
              label="Client Intent Score"
              value={String(conversationIntelligence.scores?.client_intent_score ?? 0)}
            />
            <InfoCard
              label="Rep Performance Score"
              value={String(conversationIntelligence.scores?.sales_rep_performance_score ?? 0)}
            />
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Risk Status</p>
            <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold ${riskLabelStyle(conversationIntelligence.risk?.label)}`}>
              {conversationIntelligence.risk?.label || "Healthy Deal"}
            </span>
            {Array.isArray(conversationIntelligence.risk?.flags) && conversationIntelligence.risk.flags.length ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-200 list-disc pl-5">
                {conversationIntelligence.risk.flags.map((flag, index) => (
                  <li key={`${flag}-${index}`}>{flag}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 mt-3">No active risk flags detected.</p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Key Insights</p>
            {Array.isArray(conversationIntelligence.analysis?.key_insights) && conversationIntelligence.analysis.key_insights.length ? (
              <ul className="space-y-1 text-sm text-slate-200 list-disc pl-5">
                {conversationIntelligence.analysis.key_insights.map((insight, index) => (
                  <li key={`${insight}-${index}`}>{insight}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No key insights generated yet.</p>
            )}
          </div>
        </section>
      </div>

      <SmartEmailGeneratorModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        uniqueId={candidate?.unique_id}
        leadName={candidate?.name}
      />
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
