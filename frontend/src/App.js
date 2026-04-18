import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AppShell from "./pages/AppShell";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Compare from "./pages/Compare";
import Calculators from "./pages/Calculators";
import Advisor from "./pages/Advisor";
import Portfolio from "./pages/Portfolio";
import Pricing from "./pages/Pricing";
import Admin from "./pages/Admin";
import Guide from "./pages/Guide";
import Referrals from "./pages/Referrals";
import DisclaimerPage from "./pages/DisclaimerPage";
import SharedReport from "./pages/SharedReport";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/disclaimer" element={<DisclaimerPage />} />
            <Route path="/share/:id" element={<SharedReport />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="compare" element={<Compare />} />
              <Route path="calculators" element={<Calculators />} />
              <Route path="advisor" element={<Advisor />} />
              <Route path="guide" element={<Guide />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
