import React from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function MLStatsSample() {
  const stats = {
    total_leads: 32,
    total_predictions: 28,
    coverage_percentage: 87,
    temperature_distribution: [
      { temperature: "Hot", count: 10 },
      { temperature: "Warm", count: 12 },
      { temperature: "Cold", count: 10 },
    ],
  };

  const barData = {
    labels: stats.temperature_distribution.map((t) => t.temperature),
    datasets: [
      {
        label: "Leads",
        data: stats.temperature_distribution.map((t) => t.count),
        backgroundColor: ["#f87171", "#facc15", "#60a5fa"],
      },
    ],
  };

  const pieData = {
    labels: stats.temperature_distribution.map((t) => t.temperature),
    datasets: [
      {
        label: "Temperature Distribution",
        data: stats.temperature_distribution.map((t) => t.count),
        backgroundColor: ["#f87171", "#facc15", "#60a5fa"],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-6">ML Prediction Stats</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Total Leads</h2>
          <p className="text-4xl font-bold">{stats.total_leads}</p>
          <p className="text-gray-500 mt-2">
            Predictions made: {stats.total_predictions} (
            {stats.coverage_percentage}%)
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Temperature Distribution</h2>
          <Pie data={pieData} />
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Leads by Temperature</h2>
        <Bar data={barData} />
      </div>
    </div>
  );
}
