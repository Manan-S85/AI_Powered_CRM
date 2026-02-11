import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EditLead from "./pages/EditLead";
import LeadDetail from "./pages/LeadsDetail";
import AddLeadSample from "./pages/AddLead";
import MLStatsSample from "./pages/MlStateSample";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login route without navbar */}
        <Route path="/" element={<Login />} />

        {/* Routes that should have Navbar */}
        <Route
          path="/*"
          element={
            <>
              <Navbar />
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="lead/edit/:id" element={<EditLead />} />
                <Route path="lead/:id" element={<LeadDetail />} />
                <Route path="addleads" element={<AddLeadSample />} />
                <Route path="mlstats" element={<MLStatsSample />} />
              </Routes>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
