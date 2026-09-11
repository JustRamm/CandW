import { useEffect, Component } from "react";
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
import { useMe } from "@/lib/queries";

// Bug #24: ErrorBoundary catches any render-time crash and shows a recovery UI
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message ?? "An unexpected error occurred. Please refresh the page."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Bug #19: PrivateRoute guards all protected pages at route level
// AppShell also guards inside, but this prevents any future page without AppShell from leaking
function PrivateRoute({ children }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!me?.id) return <Navigate to="/login" replace />;
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
        <Route path="/audit" element={<PrivateRoute><Audit /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </ErrorBoundary>
  );
}
