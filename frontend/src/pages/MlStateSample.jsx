import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  Gauge,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import api from "../api/Api";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const toPercentValue = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? numeric * 100 : numeric;
};

const formatPercent = (value) => `${toPercentValue(value).toFixed(1)}%`;

const temperatureStyle = {
  Hot: {
    label: "Hot",
    color: "#fb7185",
    bg: "rgba(244, 63, 94, 0.18)",
  },
  Warm: {
    label: "Warm",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.18)",
  },
  Cold: {
    label: "Cold",
    color: "#22d3ee",
    bg: "rgba(34, 211, 238, 0.18)",
  },
};

const kpiCards = [
  { key: "total_leads", label: "Total Leads", icon: Database, tone: "text-cyan-300" },
  { key: "total_predictions", label: "Predictions", icon: Activity, tone: "text-emerald-300" },
  { key: "coverage", label: "Coverage", icon: Target, tone: "text-violet-300" },
  { key: "accuracy", label: "Model Accuracy", icon: Gauge, tone: "text-amber-300" },
];

export default function MLStatsSample() {
  const [stats, setStats] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");

    try {
      const [statsRes, modelRes] = await Promise.all([api.get("/stats"), api.get("/model/info")]);
      setStats(statsRes.data?.stats || null);
      setModelInfo(modelRes.data?.model_info || null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || "Failed to load ML stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const distribution = useMemo(() => {
    return Array.isArray(stats?.temperature_distribution) ? stats.temperature_distribution : [];
  }, [stats]);

  const normalizedDistribution = useMemo(() => {
    const preferredOrder = ["Hot", "Warm", "Cold"];
    const map = distribution.reduce((acc, item) => {
      const label = String(item?.temperature || item?._id || "Unknown");
      acc[label] = {
        count: Number(item?.count || 0),
        avgConfidence: Number(item?.avg_confidence || 0),
      };
      return acc;
    }, {});

    return preferredOrder.map((label) => ({
      label,
      count: map[label]?.count || 0,
      avgConfidence: map[label]?.avgConfidence || 0,
      style: temperatureStyle[label],
    }));
  }, [distribution]);

  const totalLeads = Number(stats?.total_leads || 0);
  const totalPredictions = Number(stats?.total_predictions || 0);
  const coveragePercent = Math.min(100, Math.max(0, toPercentValue(stats?.coverage_percentage)));
  const modelAccuracyPercent = modelInfo?.accuracy ? toPercentValue(modelInfo.accuracy) : 0;
  const inferencePipeline = modelInfo?.inference_pipeline || {};
  const hasPipelineInfo = Boolean(modelInfo?.inference_pipeline);

  const calibrationValue = String(inferencePipeline?.probability_calibration || "").trim();
  const hybridRuleValue = String(inferencePipeline?.hybrid_rule_engine || "").trim();
  const llmFallbackValue = String(inferencePipeline?.llm_fallback || "").trim();

  const calibrationDisplay = calibrationValue
    ? calibrationValue.toUpperCase()
    : "ENABLED (DEFAULT)";
  const hybridRuleDisplay = hybridRuleValue
    ? hybridRuleValue.toUpperCase()
    : "ENABLED (DEFAULT)";
  const llmFallbackDisplay = llmFallbackValue
    ? llmFallbackValue.toUpperCase()
    : "DISABLED (OPTIONAL)";

  const uncertaintyEnabled =
    typeof inferencePipeline?.uncertainty_detection?.enabled === "boolean"
      ? inferencePipeline.uncertainty_detection.enabled
      : true;
  const uncertaintyThresholdPercent = toPercentValue(
    inferencePipeline?.uncertainty_detection?.confidence_threshold || 0.7
  );

  const dominantTemperature = useMemo(() => {
    return normalizedDistribution.reduce(
      (max, item) => (item.count > max.count ? item : max),
      { label: "N/A", count: 0, avgConfidence: 0, style: { color: "#94a3b8", bg: "rgba(148,163,184,0.15)" } }
    );
  }, [normalizedDistribution]);

  const doughnutData = useMemo(() => {
    return {
      labels: normalizedDistribution.map((item) => item.label),
      datasets: [
        {
          data: normalizedDistribution.map((item) => item.count),
          backgroundColor: normalizedDistribution.map((item) => item.style.color),
          borderColor: ["#111827"],
          borderWidth: 3,
          hoverOffset: 10,
        },
      ],
    };
  }, [normalizedDistribution]);

  const barData = useMemo(() => {
    return {
      labels: normalizedDistribution.map((item) => item.label),
      datasets: [
        {
          label: "Lead Count",
          data: normalizedDistribution.map((item) => item.count),
          backgroundColor: normalizedDistribution.map((item) => item.style.bg),
          borderColor: normalizedDistribution.map((item) => item.style.color),
          borderWidth: 1.4,
          borderRadius: 12,
        },
      ],
    };
  }, [normalizedDistribution]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#cbd5e1",
          font: { family: "Segoe UI", size: 12, weight: 600 },
          padding: 16,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(2, 6, 23, 0.95)",
        borderColor: "rgba(100, 116, 139, 0.35)",
        borderWidth: 1,
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(2, 6, 23, 0.95)",
        borderColor: "rgba(100, 116, 139, 0.35)",
        borderWidth: 1,
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(100, 116, 139, 0.16)" },
        ticks: { color: "#a5b4fc", font: { family: "Segoe UI", weight: 600 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(100, 116, 139, 0.16)" },
        ticks: { color: "#94a3b8", precision: 0 },
      },
    },
  };

  const cardValues = {
    total_leads: totalLeads,
    total_predictions: totalPredictions,
    coverage: formatPercent(coveragePercent),
    accuracy: modelInfo?.accuracy ? formatPercent(modelAccuracyPercent) : "N/A",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,_rgba(16,185,129,0.16),_transparent_30%),radial-gradient(circle_at_90%_15%,_rgba(59,130,246,0.18),_transparent_32%),radial-gradient(circle_at_50%_100%,_rgba(244,63,94,0.08),_transparent_36%),linear-gradient(180deg,_#020617_0%,_#081126_45%,_#030712_100%)] px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-10 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200 mb-4">
              <Sparkles size={14} />
              ML Intelligence Center
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-200 via-sky-200 to-emerald-200 bg-clip-text text-transparent leading-tight">
              Model Performance Dashboard
            </h1>
            <p className="text-slate-300 mt-3 text-base md:text-lg max-w-3xl">
              Live analytics from MongoDB with lead temperature distribution, prediction coverage, and model quality signals.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-500/60 bg-slate-950/70 px-4 py-3 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-70"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.key} className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-5 shadow-[0_22px_40px_-32px_rgba(8,47,73,0.9)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{card.label}</p>
                  <Icon size={16} className="text-slate-400" />
                </div>
                <p className={`mt-3 text-3xl font-bold ${card.tone}`}>{cardValues[card.key]}</p>
              </article>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8 mb-8">
          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Temperature Histogram</h2>
            <div className="h-[330px]">
              <Bar data={barData} options={barOptions} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Lead Mix Composition</h2>
            <div className="h-[330px]">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-8">
          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">Prediction Health</h2>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-5 mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-300">Coverage</span>
                <span className="text-cyan-300 font-semibold">{coveragePercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500" style={{ width: `${coveragePercent}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
              <p className="text-sm text-slate-300 mb-3">Dominant Segment</p>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{ color: dominantTemperature.style.color, backgroundColor: dominantTemperature.style.bg }}
              >
                {dominantTemperature.label} ({dominantTemperature.count} leads)
              </span>
              <p className="text-xs text-slate-400 mt-4">
                Avg confidence in this segment: {formatPercent(dominantTemperature.avgConfidence)}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">Model Intelligence</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Model Type</p>
                <p className="text-sm text-slate-100 mt-2">{modelInfo?.model_type || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Features</p>
                <p className="text-sm text-slate-100 mt-2">{modelInfo?.features_count ?? "N/A"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Accuracy</p>
                <p className="text-sm text-amber-300 mt-2">{modelInfo?.accuracy ? formatPercent(modelAccuracyPercent) : "N/A"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Training Date</p>
                <p className="text-sm text-slate-100 mt-2">{modelInfo?.training_date || "N/A"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 mb-5">
              <p className="text-xs uppercase tracking-wide text-cyan-300 mb-3">Inference Pipeline</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <PipelineItem
                  label="Base Model"
                  value={inferencePipeline?.base_model || "Random Forest"}
                />
                <PipelineItem
                  label="Probability Calibration"
                  value={calibrationDisplay}
                />
                <PipelineItem
                  label="Hybrid Rule Engine"
                  value={hybridRuleDisplay}
                />
                <PipelineItem
                  label="Uncertainty Detection"
                  value={`${uncertaintyEnabled ? "ENABLED" : "DISABLED"} (${uncertaintyThresholdPercent.toFixed(0)}% threshold)`}
                />
                <PipelineItem
                  label="LLM Fallback"
                  value={llmFallbackDisplay}
                />
              </div>
              {!hasPipelineInfo ? (
                <p className="text-[11px] text-amber-200 mt-3">
                  Backend is running an older model-info schema. Displaying production defaults for calibration and hybrid rules.
                </p>
              ) : null}
              <p className="text-xs text-slate-300 mt-3">
                Production scoring uses Random Forest classification with post-processing calibration and rule-based refinement.
                Low-confidence outcomes are flagged as uncertain while preserving Hot/Warm/Cold class labels.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4 text-xs text-slate-400">
              Last updated from MongoDB stats pipeline: {stats?.last_updated || "N/A"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PipelineItem({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-100 mt-1">{value}</p>
    </div>
  );
}
