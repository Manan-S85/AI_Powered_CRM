import { useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EditLead from "./pages/EditLead";
import LeadDetail from "./pages/LeadsDetail";
import AddLead from "./pages/AddLead";
import MLStatsSample from "./pages/MlStateSample";
import AIInsights from "./pages/AIInsights";
import CandidateProfile from "./pages/CandidateProfile";
import Chatbot from "./pages/Chatbot";
import FollowupOptimizer from "./pages/FollowupOptimizer";
import SalesForecasting from "./pages/SalesForecasting";
import ClientLtvPrediction from "./pages/ClientLtvPrediction";
import ConversionLeadScoring from "./pages/ConversionLeadScoring";
import LeadGeneration from "./pages/LeadGeneration";
import LeadDashboard from "./pages/LeadDashboard";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";

function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <main
        className={`pb-8 pt-16 transition-all duration-300 lg:pt-6 ${
          isSidebarCollapsed ? "lg:ml-24" : "lg:ml-72"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lead/edit/:id" element={<EditLead />} />
          <Route path="/lead/:id" element={<LeadDetail />} />
          <Route path="/candidate/:candidate_id" element={<CandidateProfile />} />
          <Route path="/addleads" element={<AddLead />} />
          <Route path="/mlstats" element={<MLStatsSample />} />
          <Route path="/ai-insights" element={<AIInsights />} />
          <Route path="/sales-forecasting" element={<SalesForecasting />} />
          <Route path="/client-ltv" element={<ClientLtvPrediction />} />
          <Route path="/lead-scoring-conversion" element={<ConversionLeadScoring />} />
          <Route path="/lead-generation" element={<LeadGeneration />} />
          <Route path="/lead-dashboard" element={<LeadDashboard />} />
          <Route path="/followup-optimizer" element={<FollowupOptimizer />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
