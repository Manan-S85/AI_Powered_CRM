import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { fetchSalesForecast } from "../services/salesForecastService";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const MONTH_OPTIONS = [
  { label: "Last 3 months", value: 3 },
  { label: "Last 6 months", value: 6 },
  { label: "Last 12 months", value: 12 },
];

const toCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const healthTone = {
  Excellent: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  Good: "text-cyan-300 border-cyan-400/40 bg-cyan-500/10",
  Watch: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  Poor: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

export default function SalesForecasting() {
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forecast, setForecast] = useState(null);

  const loadForecast = async (selectedMonths = months) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchSalesForecast({ months: selectedMonths });
      if (!response?.success) {
        throw new Error("Unexpected sales forecast response");
      }

      setForecast(response.forecast || null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || "Failed to load sales forecast");
      setForecast(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast(months);
  }, [months]);

  const overview = forecast?.overview || {};
  const revenue = forecast?.monthly_revenue || {};
  const pipeline = forecast?.pipeline_health || {};
  const closure = forecast?.deal_closure_trends || {};
  const monthlySeries = Array.isArray(closure.monthly_series) ? closure.monthly_series : [];

  const revenueLineData = useMemo(() => {
    return {
      labels: monthlySeries.map((point) => point.label),
      datasets: [
        {
          label: "Monthly Revenue",
          data: monthlySeries.map((point) => Number(point.monthly_revenue || 0)),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.2)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [monthlySeries]);

  const closureBarData = useMemo(() => {
    return {
      labels: monthlySeries.map((point) => point.label),
      datasets: [
        {
          label: "Closed Deals",
          data: monthlySeries.map((point) => Number(point.closed_deals || 0)),
          backgroundColor: "rgba(16, 185, 129, 0.38)",
          borderColor: "#34d399",
          borderWidth: 1.2,
          borderRadius: 10,
        },
      ],
    };
  }, [monthlySeries]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#cbd5e1",
          font: { family: "Segoe UI", size: 12, weight: "600" },
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
    scales: {
      x: {
        grid: { color: "rgba(100, 116, 139, 0.18)" },
        ticks: { color: "#a5b4fc" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(100, 116, 139, 0.18)" },
        ticks: { color: "#94a3b8" },
      },
    },
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,_rgba(16,185,129,0.14),_transparent_32%),radial-gradient(circle_at_92%_0%,_rgba(34,211,238,0.14),_transparent_36%),radial-gradient(circle_at_50%_100%,_rgba(59,130,246,0.10),_transparent_44%),linear-gradient(180deg,_#020617_0%,_#0b1222_50%,_#030712_100%)] px-6 md:px-10 py-8 md:py-10 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8 md:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200 mb-4">
              <BarChart3 size={14} />
              Founder Decision Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-200 via-emerald-200 to-sky-200 bg-clip-text text-transparent leading-tight">
              Sales Forecasting
            </h1>
            <p className="text-slate-300 mt-3 text-base md:text-lg max-w-3xl">
              Forecast monthly revenue, monitor pipeline health, and track closure trends to plan growth confidently.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadForecast(months)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500/60 bg-slate-950/70 px-4 py-2.5 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-70"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <article className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-[0.12em]">
              <span>Current Month Revenue</span>
              <CircleDollarSign size={16} />
            </div>
            <p className="mt-3 text-3xl font-bold text-cyan-300">{toCurrency(revenue.current_month)}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-[0.12em]">
              <span>Projected Next Month</span>
              <ArrowUpRight size={16} />
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-300">{toCurrency(revenue.projected_next_month)}</p>
            <p className="text-xs text-slate-400 mt-2">Trend: {revenue.trend || "Stable"}</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-[0.12em]">
              <span>Pipeline Health</span>
              <ShieldCheck size={16} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${healthTone[pipeline.status] || healthTone.Watch}`}
              >
                {pipeline.status || "Watch"}
              </span>
              <span className="text-slate-300 text-sm">{toPercent(pipeline.close_rate)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Close rate</p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-[0.12em]">
              <span>Closure Trend</span>
              <TrendingUp size={16} />
            </div>
            <p className="mt-3 text-3xl font-bold text-violet-300">{closure.trend || "Stable"}</p>
            <p className="text-xs text-slate-400 mt-2">Direction across selected months</p>
          </article>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-8 mb-8">
          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Monthly Revenue Trend</h2>
            <div className="h-[330px]">
              <Line data={revenueLineData} options={chartOptions} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
            <h2 className="text-lg font-semibold text-slate-100 mb-5">Deal Closure Volume</h2>
            <div className="h-[330px]">
              <Bar data={closureBarData} options={chartOptions} />
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-950/55 backdrop-blur-2xl p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,1)]">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">Founder Brief</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total Leads</p>
              <p className="text-xl text-slate-100 mt-2 font-semibold">{Number(overview.total_leads || 0)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Closed Deals</p>
              <p className="text-xl text-emerald-300 mt-2 font-semibold">{Number(overview.closed_deals || 0)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Open Pipeline Value</p>
              <p className="text-xl text-cyan-300 mt-2 font-semibold">{toCurrency(pipeline.open_pipeline_value)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Reporting Window</p>
              <p className="text-xl text-violet-300 mt-2 font-semibold inline-flex items-center gap-2">
                <CalendarDays size={18} />
                {Number(overview.reporting_months || months)} months
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 md:p-5 text-sm text-emerald-100">
            <p className="inline-flex items-center gap-2 font-semibold mb-2">
              <Activity size={15} />
              Strategic Recommendation
            </p>
            <p>{forecast?.founder_insight || "No insight available yet. Please refresh after adding lead data."}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
