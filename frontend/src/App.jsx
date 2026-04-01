import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EditLead from "./pages/EditLead";
import LeadDetail from "./pages/LeadsDetail";
import AddLead from "./pages/AddLead";
import MLStatsSample from "./pages/MlStateSample";
import AIInsights from "./pages/AIInsights";
import CandidateProfile from "./pages/CandidateProfile";
import Chatbot from "./pages/Chatbot";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";

function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
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
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
