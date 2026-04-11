import { Gauge, Loader2, RefreshCw, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  predictConversionLeadScore,
  trainConversionLeadModel,
} from "../services/conversionLeadScoringService";

const initialForm = {
  industry: "SaaS",
  budget: "80000",
  response_speed: "2",
  meeting_count: "3",
  email_open_rate: "65",
  website_visits: "14",
};

const initialTrainSettings = {
  limit: "5000",
  min_rows: "40",
};

function parseNumeric(value) {
  if (value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

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

export default function ConversionLeadScoring() {
  const [form, setForm] = useState(initialForm);
  const [trainSettings, setTrainSettings] = useState(initialTrainSettings);

  const [predicting, setPredicting] = useState(false);
  const [training, setTraining] = useState(false);

  const [predictError, setPredictError] = useState("");
  const [trainError, setTrainError] = useState("");

  const [predictionResult, setPredictionResult] = useState(null);
  const [trainingResult, setTrainingResult] = useState(null);

  const probabilityPct = Number(predictionResult?.conversion_probability_pct || 0);
  const gaugeWidth = `${Math.max(0, Math.min(100, probabilityPct)).toFixed(2)}%`;

  const healthTone = useMemo(() => {
    if (probabilityPct >= 70) return "text-emerald-300";
    if (probabilityPct >= 40) return "text-amber-300";
    return "text-cyan-300";
  }, [probabilityPct]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onTrainChange = (event) => {
    const { name, value } = event.target;
    setTrainSettings((prev) => ({ ...prev, [name]: value }));
  };

  const useSampleHighIntent = () => {
    setForm({
      industry: "SaaS",
      budget: "120000",
      response_speed: "1",
      meeting_count: "5",
      email_open_rate: "82",
      website_visits: "28",
    });
    setPredictError("");
  };

  const useSampleLowIntent = () => {
    setForm({
      industry: "Retail",
      budget: "8000",
      response_speed: "36",
      meeting_count: "0",
      email_open_rate: "11",
      website_visits: "2",
    });
    setPredictError("");
  };

  const handleTrain = async () => {
    try {
      setTraining(true);
      setTrainError("");
      setTrainingResult(null);

      const response = await trainConversionLeadModel({
        limit: parseNumeric(trainSettings.limit),
        min_rows: parseNumeric(trainSettings.min_rows),
      });

      setTrainingResult(response);
    } catch (error) {
      setTrainError(formatError(error));
    } finally {
      setTraining(false);
    }
  };

  const handlePredict = async (event) => {
    event.preventDefault();

    try {
      setPredicting(true);
      setPredictError("");
      setPredictionResult(null);

      const payload = {
        industry: form.industry.trim(),
        budget: parseNumeric(form.budget),
        response_speed: parseNumeric(form.response_speed),
        meeting_count: parseNumeric(form.meeting_count),
        email_open_rate: parseNumeric(form.email_open_rate),
        website_visits: parseNumeric(form.website_visits),
      };

      const response = await predictConversionLeadScore(payload);
      setPredictionResult(response?.result || null);
    } catch (error) {
      setPredictError(formatError(error));
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,_rgba(34,197,94,0.16),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#0b1224_50%,_#030712_100%)] px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200 mb-4">
            <Sparkles size={14} />
            Conversion Probability Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-200 via-cyan-200 to-sky-200 bg-clip-text text-transparent">
            Lead Scoring (Dynamic ML)
          </h1>
          <p className="text-slate-300 mt-3 text-base md:text-lg">
            Retrain from historical closed-won/lost outcomes and predict conversion probability from six business inputs.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8">
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-6 md:p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <div className="rounded-xl border border-white/10 bg-slate-900/45 p-4 mb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Train Model From Historical Data</h2>
                  <p className="text-xs text-slate-400 mt-1">Uses historical lead outcomes in MongoDB (closed won vs lost style statuses).</p>
                </div>
                <button
                  type="button"
                  onClick={handleTrain}
                  disabled={training}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-70"
                >
                  {training ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {training ? "Training..." : "Train now"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">History Limit</label>
                  <input
                    type="number"
                    name="limit"
                    min="50"
                    value={trainSettings.limit}
                    onChange={onTrainChange}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-slate-400">Minimum Train Rows</label>
                  <input
                    type="number"
                    name="min_rows"
                    min="10"
                    value={trainSettings.min_rows}
                    onChange={onTrainChange}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {trainError ? (
                <div className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {trainError}
                </div>
              ) : null}

              {trainingResult?.success ? (
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Trained rows: {trainingResult?.trained_rows || 0} | Model: {trainingResult?.metadata?.model_name || "N/A"}
                </div>
              ) : null}
            </div>

            <form onSubmit={handlePredict} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Industry" name="industry" value={form.industry} onChange={onChange} required />
              <NumberField label="Budget" name="budget" value={form.budget} onChange={onChange} min="0" required />
              <NumberField label="Response Speed" name="response_speed" value={form.response_speed} onChange={onChange} min="0" required />
              <NumberField label="Meeting Count" name="meeting_count" value={form.meeting_count} onChange={onChange} min="0" required />
              <NumberField
                label="Email Open Rate (0-100 or 0-1)"
                name="email_open_rate"
                value={form.email_open_rate}
                onChange={onChange}
                min="0"
                required
              />
              <NumberField label="Website Visits" name="website_visits" value={form.website_visits} onChange={onChange} min="0" required />

              <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={useSampleHighIntent}
                  className="rounded-md border border-cyan-400/40 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                >
                  Use high-intent sample
                </button>
                <button
                  type="button"
                  onClick={useSampleLowIntent}
                  className="rounded-md border border-slate-500/60 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-500/10"
                >
                  Use low-intent sample
                </button>
              </div>

              {predictError ? (
                <div className="md:col-span-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {predictError}
                </div>
              ) : null}

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={predicting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-3 text-sm font-semibold hover:from-emerald-500 hover:to-cyan-500 transition disabled:opacity-70"
                >
                  {predicting ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                  {predicting ? "Predicting..." : "Predict Conversion Probability"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-6 md:p-7 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Prediction Result</h2>

            {predictionResult ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Conversion Probability</p>
                    <Gauge size={16} className="text-slate-400" />
                  </div>
                  <p className={`mt-2 text-3xl font-bold ${healthTone}`}>{probabilityPct.toFixed(2)}%</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-400" style={{ width: gaugeWidth }} />
                  </div>
                </div>

                <InfoRow label="Probability Ratio" value={String(predictionResult?.conversion_probability_ratio ?? "N/A")} />
                <InfoRow label="Model" value={String(predictionResult?.model_name || "N/A")} />
                <InfoRow label="Trained At" value={String(predictionResult?.trained_at || "N/A")} />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
                Train model (recommended), then submit the six required inputs to view conversion probability percentage.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TextField({ label, name, value, onChange, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
      />
    </div>
  );
}

function NumberField({ label, name, value, onChange, min, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        min={min}
        required={required}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm"
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-100 mt-2 break-all">{value}</p>
    </div>
  );
}
