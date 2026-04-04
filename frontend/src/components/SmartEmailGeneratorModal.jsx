import React, { useState } from "react";
import { generateFollowupEmail } from "../services/smartEmailService";

const DEAL_STAGES = ["Prospect", "Qualified", "Negotiation", "Closed Won", "Closed Lost"];

export default function SmartEmailGeneratorModal({
  isOpen,
  onClose,
  uniqueId,
  leadName,
}) {
  const [dealStage, setDealStage] = useState("Prospect");
  const [pastCommunication, setPastCommunication] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [emailResult, setEmailResult] = useState(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!uniqueId) {
      setError("This lead does not have a unique_id. Cannot generate follow-up email.");
      return;
    }

    try {
      setIsGenerating(true);
      setError("");
      const result = await generateFollowupEmail({
        unique_id: uniqueId,
        deal_stage: dealStage,
        past_communication: pastCommunication,
      });
      setEmailResult(result);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Failed to generate follow-up email"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!emailResult) return;

    const content = `Subject: ${emailResult.subject}\n\n${emailResult.body}`;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setError("Could not copy email to clipboard.");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="crm-surface max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="bg-gradient-to-r from-emerald-200 to-cyan-200 bg-clip-text text-2xl font-bold text-transparent">
              Smart Email Generator
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Generate contextual follow-up for {leadName || "this lead"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">Deal Stage</label>
            <select
              value={dealStage}
              onChange={(event) => setDealStage(event.target.value)}
              className="crm-field w-full rounded-xl px-3.5 py-2.5 text-slate-100"
            >
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-400 mb-2">
              Past Communication
            </label>
            <textarea
              rows={5}
              value={pastCommunication}
              onChange={(event) => setPastCommunication(event.target.value)}
              placeholder="Add summary of last call, objections, and next steps..."
              className="crm-field w-full rounded-xl px-3.5 py-3 text-slate-100"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="crm-button-primary rounded-xl px-5 py-2.5 font-semibold disabled:opacity-70"
            >
              {isGenerating ? "Generating..." : emailResult ? "Regenerate" : "Generate Follow-up"}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!emailResult}
              className="rounded-xl border border-white/20 px-5 py-2.5 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Copy Email
            </button>
          </div>

          {emailResult ? (
            <div className="mt-2 space-y-3 rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Subject</p>
                <p className="text-slate-100 font-semibold mt-1">{emailResult.subject}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Body</p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-200 leading-6">
                  {emailResult.body}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
