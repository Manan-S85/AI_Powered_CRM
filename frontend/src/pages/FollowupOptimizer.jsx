import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import api from "../api/Api";

const CHANNEL_OPTIONS = ["email", "call", "whatsapp", "linkedin", "sms"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const AMPM_OPTIONS = ["AM", "PM"];

const createInteractionRow = () => ({
  sent_date: "",
  sent_hour: "09",
  sent_minute: "00",
  sent_ampm: "AM",
  reply_date: "",
  reply_hour: "09",
  reply_minute: "00",
  reply_ampm: "AM",
  channel: "email",
});

const formatApiError = (requestError) => {
  const detail = requestError?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc.join(" -> ") : "field";
        return `${loc}: ${item?.msg || "Invalid value"}`;
      })
      .join(" | ");
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return requestError?.message || "Failed to optimize follow-up strategy.";
};

const toIsoFromParts = (dateValue, hourValue, minuteValue, ampmValue) => {
  if (!dateValue) return null;

  const parsedHour = Number(hourValue);
  const parsedMinute = Number(minuteValue);
  if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute)) {
    return null;
  }

  let hour24 = parsedHour % 12;
  if (ampmValue === "PM") {
    hour24 += 12;
  }

  const hh = String(hour24).padStart(2, "0");
  const mm = String(parsedMinute).padStart(2, "0");
  return `${dateValue}T${hh}:${mm}:00`;
};

export default function FollowupOptimizer() {
  const [leadId, setLeadId] = useState("");
  const [leadOptions, setLeadOptions] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [interactions, setInteractions] = useState([createInteractionRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchLeadOptions = async () => {
      try {
        setLoadingLeads(true);
        const { data } = await api.get("/leads?limit=200", { timeout: 20000 });
        const rows = Array.isArray(data?.leads) ? data.leads : [];

        const options = rows
          .map((lead) => {
            const id = String(lead?.unique_id || lead?._id || "").trim();
            if (!id) return null;
            const name = String(lead?.name || "Unknown").trim();
            const email = String(lead?.email || "no-email").trim();
            return {
              id,
              label: `${name} (${email})`,
            };
          })
          .filter(Boolean);

        setLeadOptions(options);
      } catch {
        setLeadOptions([]);
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchLeadOptions();
  }, []);

  const canSubmit = useMemo(
    () =>
      leadId.trim().length > 0 &&
      interactions.length > 0 &&
      interactions.every((item) => item.sent_date.trim()),
    [leadId, interactions]
  );

  const handleRowChange = (index, key, value) => {
    setInteractions((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setInteractions((prev) => [...prev, createInteractionRow()]);
  };

  const removeRow = (index) => {
    setInteractions((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Please select sent date for every interaction row.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const payload = {
        lead_id: leadId.trim(),
        interactions: interactions.map((row) => ({
          sent_time: toIsoFromParts(row.sent_date, row.sent_hour, row.sent_minute, row.sent_ampm),
          reply_time: row.reply_date
            ? toIsoFromParts(row.reply_date, row.reply_hour, row.reply_minute, row.reply_ampm)
            : null,
          channel: row.channel,
        })),
      };

      const { data } = await api.post("/followup/optimize", payload, { timeout: 60000 });
      setResult(data);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const confidenceValue = result?.confidence || "N/A";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
            Follow-up Optimization AI
          </h1>
          <p className="text-slate-400 mt-2 text-base">
            Submit historical interactions and get the best day, time, and channel to follow up.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8">
          <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Select Lead</label>
                <select
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingLeads ? "Loading leads..." : "Choose lead by name/email"}
                  </option>
                  {leadOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Lead ID</label>
                <input
                  type="text"
                  value={leadId}
                  onChange={(event) => setLeadId(event.target.value)}
                  required
                  placeholder="e.g. LEAD_12345"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Interaction History</h2>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold"
                >
                  <Plus size={14} />
                  Add Row
                </button>
              </div>

              <div className="space-y-4">
                {interactions.map((row, index) => (
                  <div key={`interaction-${index}`} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Sent Date</label>
                        <input
                          type="date"
                          value={row.sent_date}
                          onChange={(event) => handleRowChange(index, "sent_date", event.target.value)}
                          required
                          className="crm-date-input mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Sent Time</label>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <select
                            value={row.sent_hour}
                            onChange={(event) => handleRowChange(index, "sent_hour", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                          >
                            {HOUR_OPTIONS.map((value) => (
                              <option key={`sent-hour-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>

                          <select
                            value={row.sent_minute}
                            onChange={(event) => handleRowChange(index, "sent_minute", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                          >
                            {MINUTE_OPTIONS.map((value) => (
                              <option key={`sent-minute-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>

                          <select
                            value={row.sent_ampm}
                            onChange={(event) => handleRowChange(index, "sent_ampm", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                          >
                            {AMPM_OPTIONS.map((value) => (
                              <option key={`sent-ampm-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Channel</label>
                        <select
                          value={row.channel}
                          onChange={(event) => handleRowChange(index, "channel", event.target.value)}
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                        >
                          {CHANNEL_OPTIONS.map((channel) => (
                            <option key={channel} value={channel}>
                              {channel}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Reply Date (Optional)</label>
                        <input
                          type="date"
                          value={row.reply_date}
                          onChange={(event) => handleRowChange(index, "reply_date", event.target.value)}
                          className="crm-date-input mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-wide text-slate-400">Reply Time (Optional)</label>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <select
                            value={row.reply_hour}
                            onChange={(event) => handleRowChange(index, "reply_hour", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                            disabled={!row.reply_date}
                          >
                            {HOUR_OPTIONS.map((value) => (
                              <option key={`reply-hour-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>

                          <select
                            value={row.reply_minute}
                            onChange={(event) => handleRowChange(index, "reply_minute", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                            disabled={!row.reply_date}
                          >
                            {MINUTE_OPTIONS.map((value) => (
                              <option key={`reply-minute-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>

                          <select
                            value={row.reply_ampm}
                            onChange={(event) => handleRowChange(index, "reply_ampm", event.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm"
                            disabled={!row.reply_date}
                          >
                            {AMPM_OPTIONS.map((value) => (
                              <option key={`reply-ampm-${value}`} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={interactions.length === 1}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold hover:from-emerald-500 hover:to-cyan-500 transition disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Analyzing Patterns..." : "Optimize Follow-up"}
              </button>
            </form>
          </section>

          <aside className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Optimization Result</h2>

            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ResultCard label="Best Day" value={result.best_day || "N/A"} />
                  <ResultCard label="Best Time" value={result.best_time || "N/A"} />
                  <ResultCard label="Best Channel" value={result.best_channel || "N/A"} />
                  <ResultCard label="Confidence" value={confidenceValue} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ResultCard label="Lead ID" value={result.lead_id || "N/A"} />
                  <ResultCard label="Model" value={result.model || "N/A"} />
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Reason</p>
                  <p className="mt-2 text-sm text-slate-200 leading-6">
                    {result.reason || "No reasoning available."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm text-slate-400 leading-6">
                Submit interaction history to view best day, best time, best channel, and model confidence.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-emerald-300">{value}</p>
    </div>
  );
}
