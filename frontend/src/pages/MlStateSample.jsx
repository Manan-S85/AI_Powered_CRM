import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const MlStateSample = () => {
  const stats = {
    totalLeads: 1240,
    predictedLeads: 1180,
    coveragePercent: 95,
    avgConfidence: 87,
    tempDistribution: {
      Hot: 320,
      Warm: 540,
      Cold: 380,
    },
  };

  const barData = {
    labels: ["Hot", "Warm", "Cold"],
    datasets: [
      {
        label: "Leads",
        data: [
          stats.tempDistribution.Hot,
          stats.tempDistribution.Warm,
          stats.tempDistribution.Cold,
        ],
        backgroundColor: ["#ef4444", "#facc15", "#38bdf8"],
        borderRadius: 12,
      },
    ],
  };

  const pieData = {
    labels: ["Hot", "Warm", "Cold"],
    datasets: [
      {
        data: [
          stats.tempDistribution.Hot,
          stats.tempDistribution.Warm,
          stats.tempDistribution.Cold,
        ],
        backgroundColor: ["#ef4444", "#facc15", "#38bdf8"],
        borderWidth: 0,
      },
    ],
  };

  const confidenceData = {
    labels: ["Confidence", "Remaining"],
    datasets: [
      {
        data: [stats.avgConfidence, 100 - stats.avgConfidence],
        backgroundColor: ["#22c55e", "#1e293b"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-black px-14 py-12 text-slate-200">

      <div className="flex justify-between items-center mb-14">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            AI Lead Intelligence
          </h1>
          <p className="text-slate-400 mt-3 text-sm tracking-wide">
            Real-time machine learning analytics dashboard
          </p>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-400/40 px-6 py-2 rounded-full text-sm text-emerald-400 flex items-center gap-3 shadow-lg">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
          Model Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-14">

        {[
          { label: "Total Leads", value: stats.totalLeads },
          { label: "ML Predictions", value: stats.predictedLeads },
          { label: "Coverage", value: stats.coveragePercent + "%" },
          { label: "Avg Confidence", value: stats.avgConfidence + "%" },
        ].map((item, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl hover:scale-[1.03] hover:border-cyan-400/30 transition duration-300"
          >
            <p className="text-slate-400 text-xs uppercase tracking-wider">
              {item.label}
            </p>
            <h2 className="text-4xl font-bold mt-4">{item.value}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <h3 className="text-xl font-semibold mb-8">
            Lead Temperature Distribution
          </h3>
          <Bar data={barData} />
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <h3 className="text-xl font-semibold mb-8">
            Temperature Breakdown
          </h3>
          <Pie data={pieData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <h3 className="text-xl font-semibold mb-8">
            Prediction Confidence
          </h3>
          <Doughnut data={confidenceData} />
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">

          <h3 className="text-xl font-semibold mb-10">
            Model Insights
          </h3>

          <div className="space-y-6">

            {[
              { label: "Hot Leads", value: stats.tempDistribution.Hot, color: "text-red-400" },
              { label: "Warm Leads", value: stats.tempDistribution.Warm, color: "text-yellow-400" },
              { label: "Cold Leads", value: stats.tempDistribution.Cold, color: "text-cyan-400" },
            ].map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-white/5 px-6 py-4 rounded-xl border border-white/10"
              >
                <span className={`${item.color}`}>{item.label}</span>
                <span className="text-lg font-semibold">{item.value}</span>
              </div>
            ))}

            <div className="mt-8 pt-6 border-t border-white/10 text-slate-400 text-sm space-y-2">
              <p>Algorithm: Random Forest Classifier</p>
              <p>Last Updated: {new Date().toLocaleDateString()}</p>
              <p>Model Version: v2.4.1</p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};

export default MlStateSample;