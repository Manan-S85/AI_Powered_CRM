import React, { useEffect, useState } from "react";
import { Bar, Pie, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from "chart.js";
import api from "../api/Api";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  Target,
  Flame,
  TrendingUp,
  Zap,
  Thermometer,
  Snowflake,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

export default function MLStatsSample() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      console.log("[ML Stats] Fetching leads from /leads?limit=100");
      const res = await api.get("/leads?limit=100");
      console.log("[ML Stats] Response:", res.data);
      
      if (!res.data || !res.data.success) {
        throw new Error("Invalid response format from server");
      }
      
      const allLeads = res.data.leads || [];
      console.log("[ML Stats] Processing", allLeads.length, "leads");
      
      if (allLeads.length === 0) {
        console.warn("[ML Stats] No leads found in database");
        setStats({
          totalLeads: 0,
          predictedLeads: 0,
          coveragePercent: 0,
          tempDistribution: { Hot: 0, Warm: 0, Cold: 0 },
          avgConfidence: 0,
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
        });
        setLoading(false);
        return;
      }
      
      // Calculate statistics
      const totalLeads = allLeads.length;
      const withPredictions = allLeads.filter(l => l.ml_prediction?.predicted_temperature);
      
      const tempDistribution = {
        Hot: withPredictions.filter(l => l.ml_prediction?.predicted_temperature === "Hot").length,
        Warm: withPredictions.filter(l => l.ml_prediction?.predicted_temperature === "Warm").length,
        Cold: withPredictions.filter(l => l.ml_prediction?.predicted_temperature === "Cold").length,
      };

      const avgConfidence = withPredictions.length > 0
        ? withPredictions.reduce((sum, l) => sum + (l.ml_prediction?.confidence || 0), 0) / withPredictions.length
        : 0;

      const highConfidence = withPredictions.filter(l => (l.ml_prediction?.confidence || 0) >= 0.8).length;
      const mediumConfidence = withPredictions.filter(l => (l.ml_prediction?.confidence || 0) >= 0.5 && (l.ml_prediction?.confidence || 0) < 0.8).length;
      const lowConfidence = withPredictions.filter(l => (l.ml_prediction?.confidence || 0) < 0.5).length;

      setStats({
        totalLeads,
        predictedLeads: withPredictions.length,
        coveragePercent: totalLeads > 0 ? Math.round((withPredictions.length / totalLeads) * 100) : 0,
        tempDistribution,
        avgConfidence: Math.round(avgConfidence * 100),
        confidenceDistribution: { high: highConfidence, medium: mediumConfidence, low: lowConfidence },
      });
      
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading ML Analytics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <p className="text-red-500 text-lg">Failed to load statistics</p>
      </div>
    );
  }

  const barData = {
    labels: ["Hot", "Warm", "Cold"],
    datasets: [
      {
        label: "Lead Count",
        data: [stats.tempDistribution.Hot, stats.tempDistribution.Warm, stats.tempDistribution.Cold],
        backgroundColor: [
          "rgba(239, 68, 68, 0.8)",
          "rgba(251, 191, 36, 0.8)",
          "rgba(96, 165, 250, 0.8)",
        ],
        borderColor: [
          "rgb(220, 38, 38)",
          "rgb(245, 158, 11)",
          "rgb(59, 130, 246)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const pieData = {
    labels: ["Hot", "Warm", "Cold"],
    datasets: [
      {
        data: [stats.tempDistribution.Hot, stats.tempDistribution.Warm, stats.tempDistribution.Cold],
        backgroundColor: [
          "rgba(239, 68, 68, 0.9)",
          "rgba(251, 191, 36, 0.9)",
          "rgba(96, 165, 250, 0.9)",
        ],
        borderColor: "#fff",
        borderWidth: 3,
      },
    ],
  };

  const confidenceData = {
    labels: ["High (≥80%)", "Medium (50-79%)", "Low (<50%)"],
    datasets: [
      {
        data: [stats.confidenceDistribution.high, stats.confidenceDistribution.medium, stats.confidenceDistribution.low],
        backgroundColor: [
          "rgba(34, 197, 94, 0.9)",
          "rgba(251, 191, 36, 0.9)",
          "rgba(239, 68, 68, 0.9)",
        ],
        borderColor: "#fff",
        borderWidth: 3,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ML Prediction Analytics</h1>
        <p className="text-gray-600">Real-time Machine Learning insights and lead temperature scoring</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-600 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-gray-800">{stats.totalLeads}</p>
            </div>
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
              <BarChart3 size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">ML Predictions</p>
              <p className="text-3xl font-bold text-gray-800">{stats.predictedLeads}</p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <Bot size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-600 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Coverage</p>
              <p className="text-3xl font-bold text-gray-800">{stats.coveragePercent}%</p>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600 hover:shadow-xl transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Avg Confidence</p>
              <p className="text-3xl font-bold text-gray-800">{stats.avgConfidence}%</p>
            </div>
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center">
              <Target size={24} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Temperature Distribution Bar Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Flame size={20} className="text-red-600" />
            Lead Temperature Distribution
          </h2>
          <Bar
            data={barData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title: { display: false },
              },
              scales: {
                y: { beginAtZero: true },
              },
            }}
          />
        </div>

        {/* Temperature Pie Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" />
            Temperature Breakdown
          </h2>
          <Pie
            data={pieData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
              },
            }}
          />
        </div>
      </div>

      {/* Confidence Distribution & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Confidence Distribution */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target size={20} className="text-yellow-600" />
            Prediction Confidence Distribution
          </h2>
          <Doughnut
            data={confidenceData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
              },
            }}
          />
        </div>

        {/* Model Performance Insights */}
        <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Zap size={20} className="text-purple-600" />
            Model Performance Insights
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
              <span className="font-medium text-gray-700 inline-flex items-center gap-2">
                <Flame size={16} className="text-red-600" />
                Hot Leads
              </span>
              <span className="text-lg font-bold text-red-700">{stats.tempDistribution.Hot}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
              <span className="font-medium text-gray-700 inline-flex items-center gap-2">
                <Thermometer size={16} className="text-yellow-700" />
                Warm Leads
              </span>
              <span className="text-lg font-bold text-yellow-700">{stats.tempDistribution.Warm}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <span className="font-medium text-gray-700 inline-flex items-center gap-2">
                <Snowflake size={16} className="text-blue-700" />
                Cold Leads
              </span>
              <span className="text-lg font-bold text-blue-700">{stats.tempDistribution.Cold}</span>
            </div>
            <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Model Status:</strong>{" "}
                <span className="text-green-600 inline-flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  Active
                </span>
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Algorithm:</strong> Random Forest Classifier
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
