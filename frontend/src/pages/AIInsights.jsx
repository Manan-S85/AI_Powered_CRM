import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/Api";

const validSourceTypes = ["call_transcript", "whatsapp_chat", "meeting_notes"];

export default function AIInsights() {
  const [searchParams] = useSearchParams();
  const initialSource = searchParams.get("source");
  const [sourceType, setSourceType] = useState(validSourceTypes.includes(initialSource) ? initialSource : "call_transcript");
  const [conversationText, setConversationText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [insights, setInsights] = useState({
    pain_points: [],
    budget_probability: "Unknown",
    urgency_level: "Unknown",
    suggested_next_action: "Follow up to clarify requirements",
    follow_up_timeline_days: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recordId, setRecordId] = useState(null);
  const [conversationRecordId, setConversationRecordId] = useState(null);
  const [conversationStored, setConversationStored] = useState(false);

  useEffect(() => {
    if (validSourceTypes.includes(initialSource)) {
      setSourceType(initialSource);
    }
  }, [initialSource]);

  const handleGenerate = async () => {
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("source_type", sourceType);

      if (conversationText.trim()) {
        formData.append("conversation_text", conversationText.trim());
      }

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const { data } = await api.post("/ai-insights/generate", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setInsights(data.insights);
      setRecordId(data.record_id || null);
      setConversationStored(Boolean(data.conversation_intelligence_stored));
      setConversationRecordId(data.conversation_intelligence_record_id || null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  const getBadgeStyle = (value) => {
    if (value === "High") {
      return "bg-red-500/15 text-red-300 border-red-500/40";
    }
    if (value === "Medium") {
      return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    }
    if (value === "Low") {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    }
    return "bg-slate-500/15 text-slate-300 border-slate-500/40";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
          AI Insights
        </h1>
        <p className="text-slate-400 mt-2 text-base">
          Upload call transcript, WhatsApp chat, or meeting notes to generate AI intelligence insights.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-8">
        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
          <label className="block text-base font-semibold text-slate-200 mb-4">Input</label>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Source Type</label>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="call_transcript">Call Transcript</option>
              <option value="whatsapp_chat">WhatsApp Chat</option>
              <option value="meeting_notes">Meeting Notes</option>
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Upload File (Optional)</label>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              For call transcripts, audio files are supported via Whisper. Text input can be combined with uploads.
            </p>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Conversation Text (Optional)</label>
          <textarea
            value={conversationText}
            onChange={(event) => setConversationText(event.target.value)}
            placeholder="Paste the client conversation transcript here..."
            className="w-full h-[280px] md:h-[300px] bg-slate-950/70 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-sm font-semibold transition disabled:opacity-70 shadow-[0_12px_24px_-12px_rgba(16,185,129,0.85)]"
            >
              {loading ? "Generating..." : "Generate Insights"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConversationText("");
                setSelectedFile(null);
                setError("");
                setRecordId(null);
                setConversationStored(false);
                setConversationRecordId(null);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition"
            >
              Clear
            </button>
          </div>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 md:p-7 backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-200">Insights Summary</h2>
            {loading && <span className="text-xs text-emerald-300">Processing...</span>}
          </div>

          {recordId && <p className="text-xs text-slate-500 mb-5">Record ID: {recordId}</p>}
          {conversationStored ? (
            <p className="text-xs text-emerald-300/90 mb-5">
              Conversation intelligence saved{conversationRecordId ? ` (Record: ${conversationRecordId})` : ""}.
              Dashboard metrics will include this analysis.
            </p>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Client Pain Points</p>
              {insights.pain_points?.length ? (
                <ul className="space-y-2">
                  {insights.pain_points.map((painPoint, index) => (
                    <li key={`${painPoint.description}-${index}`} className="text-sm text-slate-200 flex items-start justify-between gap-3">
                      <span className="leading-6">{painPoint.description}</span>
                      <span className="text-xs px-2.5 py-1 rounded-full border border-cyan-500/30 text-cyan-300 whitespace-nowrap">
                        {painPoint.category}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No explicit pain points identified.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Budget Probability</p>
                <span className={`inline-flex px-3 py-1.5 rounded-full border text-sm font-semibold ${getBadgeStyle(insights.budget_probability)}`}>
                  {insights.budget_probability}
                </span>
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Urgency Level</p>
                <span className={`inline-flex px-3 py-1.5 rounded-full border text-sm font-semibold ${getBadgeStyle(insights.urgency_level)}`}>
                  {insights.urgency_level}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Suggested Next Action</p>
              <p className="text-sm text-slate-200 leading-6">{insights.suggested_next_action}</p>
            </div>

            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Follow-up Timeline</p>
              <p className="text-sm text-slate-200">
                {insights.follow_up_timeline_days === null
                  ? "Not available"
                  : `${insights.follow_up_timeline_days} day${insights.follow_up_timeline_days === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
