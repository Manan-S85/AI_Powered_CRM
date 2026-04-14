import { Loader2, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { runLeadGenerationQuery } from "../services/leadGenerationService";

function formatError(error) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc) ? item.loc.join(" -> ") : "field";
        return `${field}: ${item?.msg || "Invalid value"}`;
      })
      .join(" | ");
  }

  if (typeof detail === "string" && detail.trim()) return detail;
  return error?.message || "Request failed";
}

export default function LeadGeneration() {
  const [query, setQuery] = useState("Give me details of businesses in Indore that have no websites");
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [lastQuery, setLastQuery] = useState("");
  const [persistedCount, setPersistedCount] = useState(0);

  const totals = useMemo(() => {
    const hot = leads.filter((lead) => lead.lead_category === "HOT").length;
    const warm = leads.filter((lead) => lead.lead_category === "WARM").length;
    const cold = leads.filter((lead) => lead.lead_category === "COLD").length;
    return { hot, warm, cold, all: leads.length };
  }, [leads]);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await runLeadGenerationQuery(query, {
        max_results: maxResults,
        persist: true,
      });

      setLeads(Array.isArray(response?.leads) ? response.leads : []);
      setPersistedCount(Number(response?.persisted_count || 0));
      setLastQuery(String(response?.query || query));
    } catch (requestError) {
      setLeads([]);
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,_rgba(45,212,191,0.16),_transparent_32%),radial-gradient(circle_at_90%_14%,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#0b1224_56%,_#030712_100%)] px-6 py-8 text-white md:px-10 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 md:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100">
            <Sparkles size={14} />
            Lead Generation Intelligence
          </div>
          <h1 className="bg-gradient-to-r from-cyan-100 via-teal-100 to-sky-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
            Search Result to Qualified Lead Engine
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-300 md:text-lg">
            Enter one natural-language query. The system fetches results from SerpApi, classifies leads, and stores them in MongoDB for the Lead Dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)] backdrop-blur-xl md:p-7">
            <h2 className="text-lg font-semibold text-slate-100">Lead Discovery Query</h2>
            <p className="mt-1 text-sm text-slate-400">
              Example: Give me details of businesses in Indore that have no websites.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Describe the type of businesses you want to discover..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400/40 transition focus:ring"
              />

              <div className="max-w-xs">
                <label className="text-xs uppercase tracking-wide text-slate-400">Max Results</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxResults}
                  onChange={(event) => setMaxResults(Number(event.target.value || 10))}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold transition hover:from-teal-500 hover:to-cyan-500 disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? "Analyzing..." : "Generate Qualified Leads"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuery("Give me details of businesses in Indore that have no websites");
                  setMaxResults(10);
                  setError("");
                }}
                className="rounded-xl border border-slate-500/60 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-500/10"
              >
                Load Sample Query
              </button>
            </div>

            {lastQuery ? (
              <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                Last run query: {lastQuery} | Persisted to MongoDB: {persistedCount}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)] backdrop-blur-xl md:p-7">
            <h2 className="text-lg font-semibold text-slate-100">Qualified Leads</h2>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <StatCard label="Total" value={totals.all} tone="slate" />
              <StatCard label="HOT" value={totals.hot} tone="rose" />
              <StatCard label="WARM" value={totals.warm} tone="amber" />
              <StatCard label="COLD" value={totals.cold} tone="cyan" />
            </div>

            <div className="mt-5 space-y-3">
              {leads.length === 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
                  No leads yet. Submit search results to generate CRM-ready lead intelligence.
                </div>
              ) : (
                leads.map((lead, index) => (
                  <article key={`${lead.business_name || "lead"}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">{lead.business_name || "Unknown"}</h3>
                        <p className="mt-1 text-xs text-slate-400">{lead.industry || "Unknown"} | {lead.location || "Unknown"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTone(lead.lead_category)}`}>
                        {lead.lead_category || "UNKNOWN"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <p>
                        <span className="text-slate-400">Website:</span> {lead.website_present || "Unknown"}
                      </p>
                      <p>
                        <span className="text-slate-400">Confidence:</span> {lead.confidence_score ?? 0}
                      </p>
                      <p>
                        <span className="text-slate-400">Company Website:</span> {lead.company_website || "Unknown"}
                      </p>
                      <p>
                        <span className="text-slate-400">Who To Contact:</span> {lead.contact_person || "Founder / Operations Head"}
                      </p>
                      <p>
                        <span className="text-slate-400">Phone:</span> {lead.contact_phone || "Unknown"}
                      </p>
                      <p>
                        <span className="text-slate-400">Email:</span> {lead.contact_email || "Unknown"}
                      </p>
                      <p className="md:col-span-2">
                        <span className="text-slate-400">Primary Service:</span> {lead.primary_service_needed || "N/A"}
                      </p>
                      <p className="md:col-span-2">
                        <span className="text-slate-400">Secondary Services:</span>{" "}
                        {Array.isArray(lead.secondary_services) && lead.secondary_services.length > 0
                          ? lead.secondary_services.join(", ")
                          : "None"}
                      </p>
                      <p className="md:col-span-2">
                        <span className="text-slate-400">Source:</span> {lead.source_link || "Unknown"}
                      </p>
                    </div>

                    <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                      {lead.reasoning || "No reasoning available."}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
      : tone === "amber"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
      : tone === "cyan"
      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
      : "border-slate-500/30 bg-slate-700/20 text-slate-100";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function badgeTone(category) {
  if (category === "HOT") {
    return "border border-rose-400/40 bg-rose-500/15 text-rose-100";
  }
  if (category === "WARM") {
    return "border border-amber-400/40 bg-amber-500/15 text-amber-100";
  }
  return "border border-cyan-400/40 bg-cyan-500/15 text-cyan-100";
}
