import { useEffect, Component, lazy, Suspense } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import PageLoadingFallback from "@/components/shared/PageLoadingFallback";
import PwaInstallPrompt from "@/components/shared/PwaInstallPrompt";
import { useMe } from "@/lib/queries";

import { NotFound, Forbidden, ServerError, OfflineBanner } from "@/pages/errors";

// Safe lazy loader that gracefully handles deployment version chunk updates
function safeLazy(importFn) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      const isChunkError =
        err?.message?.includes("Failed to fetch dynamically imported module") ||
        err?.message?.includes("Importing a module script failed") ||
        err?.name === "TypeError";
      if (isChunkError) {
        const reloadKey = `chunk_reload_${Date.now()}`;
        const lastReload = sessionStorage.getItem("last_chunk_reload");
        if (!lastReload || Date.now() - Number(lastReload) > 10000) {
          sessionStorage.setItem("last_chunk_reload", String(Date.now()));
          window.location.reload();
          return { default: () => null };
        }
      }
      throw err;
    }
  });
}

// Route-level Code Splitting for ultra-fast initial bundle loading
const Login = safeLazy(() => import("@/pages/Login"));
const Dashboard = safeLazy(() => import("@/pages/Dashboard"));
const Assets = safeLazy(() => import("@/pages/Assets"));
const AssetDetail = safeLazy(() => import("@/pages/AssetDetail"));
const Queue = safeLazy(() => import("@/pages/Queue"));
const Brands = safeLazy(() => import("@/pages/Brands"));
const BrandDetail = safeLazy(() => import("@/pages/BrandDetail"));
const Campaigns = safeLazy(() => import("@/pages/Campaigns"));
const CampaignDetail = safeLazy(() => import("@/pages/CampaignDetail"));
const Audit = safeLazy(() => import("@/pages/Audit"));
const Admin = safeLazy(() => import("@/pages/Admin"));
const ClientPortal = safeLazy(() => import("@/pages/ClientPortal"));

// ErrorBoundary catches any render-time crash and renders ServerError recovery page
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    if (
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed")
    ) {
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <ServerError
          error={this.state.error}
          onReset={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

// PrivateRoute guards authentication and role authorization at route level
function PrivateRoute({ children, allowedRoles }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) {
    return <PageLoadingFallback />;
  }
  if (!me?.id) return <Navigate to="/login" replace />;
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(me.role)) {
    return <Forbidden requiredRoles={allowedRoles} />;
  }
  return children;
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.jsx.
export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to /login whenever Supabase session is invalidated
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login initialMode="signup" />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
          <Route path="/assets/:assetId" element={<PrivateRoute><AssetDetail /></PrivateRoute>} />
          <Route path="/queue" element={<PrivateRoute><Queue /></PrivateRoute>} />
          <Route path="/brands" element={<PrivateRoute><Brands /></PrivateRoute>} />
          <Route path="/brands/:brandId" element={<PrivateRoute><BrandDetail /></PrivateRoute>} />
          <Route path="/campaigns" element={<PrivateRoute><Campaigns /></PrivateRoute>} />
          <Route path="/campaigns/:campaignId" element={<PrivateRoute><CampaignDetail /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute allowedRoles={["admin", "finance", "finance_manager"]}><Audit /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute allowedRoles={["admin"]}><Admin /></PrivateRoute>} />
          <Route path="/portal/:brandKey" element={<ClientPortal />} />
          <Route path="/view/:campaignId" element={<ClientPortal />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <PwaInstallPrompt />
      <Toaster position="top-right" />
    </ErrorBoundary>
  );
}

