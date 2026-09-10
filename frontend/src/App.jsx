import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import AssetDetail from "@/pages/AssetDetail";
import Queue from "@/pages/Queue";
import Brands from "@/pages/Brands";
import BrandDetail from "@/pages/BrandDetail";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import Audit from "@/pages/Audit";
import Admin from "@/pages/Admin";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.jsx.
export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to /login whenever Supabase session is invalidated
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      const mockUser = localStorage.getItem("cw_mock_user");
      if (event === "SIGNED_OUT" && !mockUser) navigate("/login", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login initialMode="signup" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/:assetId" element={<AssetDetail />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/brands/:brandId" element={<BrandDetail />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}
