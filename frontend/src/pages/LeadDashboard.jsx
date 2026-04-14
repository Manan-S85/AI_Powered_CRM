import { Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getLeadGenerationDashboard } from "../services/leadGenerationService";

function formatError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return error?.message || "Request failed";
}

export default function LeadDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({ HOT: 0, WARM: 0, COLD: 0 });
  const [category, setCategory] = useState("ALL");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getLeadGenerationDashboard({
        limit: 120,
        category: category === "ALL" ? undefined : category,
      });

      setRecords(Array.isArray(response?.records) ? response.records : []);
      setCounts(response?.classification_counts || { HOT: 0, WARM: 0, COLD: 0 });
    } catch (requestError) {
      setRecords([]);
      setError(formatError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [category]);

  const total = useMemo(() => Number(counts.HOT || 0) + Number(counts.WARM || 0) + Number(counts.COLD || 0), [counts]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,_rgba(45,212,191,0.16),_transparent_32%),radial-gradient(circle_at_90%_14%,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#0b1224_56%,_#030712_100%)] px-6 py-8 text-white md:px-10 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="bg-gradient-to-r from-cyan-100 via-teal-100 to-sky-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
              Lead Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-base text-slate-300 md:text-lg">
              MongoDB-persisted lead-generation results classified into HOT/WARM/COLD.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={total} tone="slate" />
          <StatCard label="HOT" value={counts.HOT || 0} tone="rose" />
          <StatCard label="WARM" value={counts.WARM || 0} tone="amber" />
          <StatCard label="COLD" value={counts.COLD || 0} tone="cyan" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-slate-300">
              <Filter size={14} />
              Filter
            </span>

            {[
              { label: "All", value: "ALL" },
              { label: "HOT", value: "HOT" },
              { label: "WARM", value: "WARM" },
              { label: "COLD", value: "COLD" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  category === item.value
                    ? "border border-cyan-300/40 bg-cyan-500/15 text-cyan-100"
                    : "border border-slate-500/40 bg-slate-800/40 text-slate-200 hover:bg-slate-700/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

          {loading ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
              Loading dashboard data...
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
              No lead-generation records found yet. Run a query from Lead Generation page.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const lead = record?.lead || {};
                return (
                  <article key={record?._id || `${lead.business_name}-${record?.rank || 0}`} className="rounded-xl border border-white/10 bg-slate-900/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">{lead.business_name || "Unknown"}</h3>
                        <p className="mt-1 text-xs text-slate-400">{lead.industry || "Unknown"} | {lead.location || "Unknown"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeTone(lead.lead_category)}`}>
                        {lead.lead_category || "UNKNOWN"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <p><span className="text-slate-400">Query:</span> {record?.query || "N/A"}</p>
                      <p><span className="text-slate-400">Confidence:</span> {lead.confidence_score ?? 0}</p>
                      <p><span className="text-slate-400">Website:</span> {lead.company_website || lead.website_present || "Unknown"}</p>
                      <p><span className="text-slate-400">Who To Contact:</span> {lead.contact_person || "Founder / Operations Head"}</p>
                      <p><span className="text-slate-400">Phone:</span> {lead.contact_phone || "Unknown"}</p>
                      <p><span className="text-slate-400">Email:</span> {lead.contact_email || "Unknown"}</p>
                      <p className="md:col-span-2"><span className="text-slate-400">Primary Service:</span> {lead.primary_service_needed || "N/A"}</p>
                      <p className="md:col-span-2"><span className="text-slate-400">Secondary:</span> {Array.isArray(lead.secondary_services) && lead.secondary_services.length ? lead.secondary_services.join(", ") : "None"}</p>
                      <p className="md:col-span-2"><span className="text-slate-400">Source:</span> {lead.source_link || "Unknown"}</p>
                    </div>

                    <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                      {lead.reasoning || "No professional reasoning available."}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
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
  if (category === "HOT") return "border border-rose-400/40 bg-rose-500/15 text-rose-100";
  if (category === "WARM") return "border border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border border-cyan-400/40 bg-cyan-500/15 text-cyan-100";
}
