import React, { useMemo, useState } from "react";
import api from "../api/Api";

const EXAMPLES = [
  "Show high probability leads from last 30 days",
  "Add a new lead named Priya Sharma with email priya@acme.com and role position Data Analyst",
  "Analyze this meeting note: Customer is blocked by integration timeline and budget approval pending",
  "Enrich company Acme Corp using website https://acme.com",
  "Get CRM stats",
];

const USER_CONTEXT_KEY = "chatbot_user_context";

const getSavedContext = () => {
  try {
    const raw = localStorage.getItem(USER_CONTEXT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveContext = (context) => {
  try {
    localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context || {}));
  } catch {
    // Ignore localStorage failures in privacy-restricted browsers.
  }
};

const buildEnrichmentMessage = (data) => {
  const company = data?.company || "Company";
  const domain = data?.domain || "unavailable";
  const website = data?.website || "not provided";
  const quality = String(data?.enrichment_quality || "unknown").toUpperCase();
  const intelligence = data?.intelligence || {};
  const industry = intelligence?.industry || "Unknown";
  const size = intelligence?.estimated_company_size || "Unknown";
  const summary = intelligence?.summary || "No summary generated.";

  const decisionMakers = Array.isArray(intelligence?.decision_makers)
    ? intelligence.decision_makers.filter((item) => String(item || "").trim())
    : [];
  const decisionText = decisionMakers.length ? decisionMakers.join(", ") : "Not identified";

  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations.filter((item) => String(item || "").trim())
    : [];
  const nextSteps = recommendations.length ? `\nNext steps: ${recommendations.join(" | ")}` : "";

  return (
    `Company intelligence for ${company}\n` +
    `Domain: ${domain} | Website: ${website} | Quality: ${quality}\n` +
    `Industry: ${industry}\n` +
    `Estimated size: ${size}\n` +
    `Decision makers: ${decisionText}\n` +
    `Summary: ${summary}${nextSteps}`
  );
};

const buildAssistantMessage = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "The chatbot returned an invalid response.";
  }

  if (payload.success === false) {
    return payload?.error?.message || payload?.message || "Chatbot request failed.";
  }

  const tool = payload.tool;
  const data = payload.data;
  if (tool === "enrich_company" && data && typeof data === "object") {
    return buildEnrichmentMessage(data);
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (tool === "get_leads" && data && typeof data === "object") {
    const count = Number(data.count || 0);
    return `Found ${count} lead${count === 1 ? "" : "s"}.`;
  }

  if (tool === "get_stats") {
    return "CRM statistics fetched successfully.";
  }

  return "Request completed successfully.";
};

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "CRM Assistant is ready. Ask me to fetch leads, add a lead, analyze conversations, enrich company data, or get stats.",
      meta: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userContext, setUserContext] = useState(getSavedContext);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: trimmed, meta: null }]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post("/chatbot/chat", {
        user_input: trimmed,
        user_context: userContext,
      }, {
        timeout: 60000,
      });

      const nextContext = data?.data?.conversation_memory || userContext;
      setUserContext(nextContext);
      saveContext(nextContext);

      const assistantText = buildAssistantMessage(data);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: assistantText,
          meta: data,
        },
      ]);
    } catch (error) {
      const apiError = error?.response?.data;
      const errMessage =
        apiError?.error?.message ||
        apiError?.detail ||
        error.message ||
        "Failed to reach chatbot service.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error: ${errMessage}`,
          meta: apiError || null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
          CRM AI Chatbot
        </h1>
        <p className="text-slate-400 mt-2 text-base">
          Natural language assistant powered by Gemini tool routing.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)] p-5 md:p-6">
          <div className="h-[60vh] overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-auto bg-emerald-600/20 border border-emerald-500/30 text-emerald-100"
                    : "mr-auto bg-slate-800/80 border border-slate-700 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>
                {message.meta?.tool && (
                  <p className="mt-2 text-xs text-slate-400">Tool: {message.meta.tool}</p>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto max-w-[85%] rounded-xl px-4 py-3 text-sm bg-slate-800/80 border border-slate-700 text-slate-100">
                Thinking...
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask something like: Show high probability leads from last 30 days"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={() => sendMessage(input)}
              className="rounded-xl px-5 py-3 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 transition"
            >
              Send
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_-35px_rgba(15,23,42,0.9)] p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-300 mb-3">Quick Prompts</h2>
          <div className="space-y-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => sendMessage(example)}
                disabled={loading}
                className="w-full text-left rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:border-emerald-500/60 hover:bg-slate-900 transition disabled:opacity-60"
              >
                {example}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setMessages((prev) => prev.slice(0, 1));
              setUserContext({});
              saveContext({});
            }}
            className="mt-5 w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs font-semibold transition"
          >
            Clear Chat Memory
          </button>
        </aside>
      </div>
    </div>
  );
}
