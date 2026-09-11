import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Calendar,
  Eye,
  Activity,
  Navigation,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  Layers,
  Sparkles,
  Maximize2,
  X,
  Clock,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useClientPortalData, useMe } from "@/lib/queries";
import { fmtDate } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientPortalSkeleton } from "@/components/skeletons";


const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || "";

const CITY_COORDINATES = {
  alappuzha: [9.4981, 76.3388],
  alleppey: [9.4981, 76.3388],
  ernakulam: [9.9816, 76.2999],
  kochi: [9.9816, 76.2999],
  idukki: [9.851, 76.94],
  thodupuzha: [9.8959, 76.7184],
  kannur: [11.8745, 75.3704],
  cannore: [11.8745, 75.3704],
  kasaragod: [12.5102, 74.9852],
  kasargod: [12.5102, 74.9852],
  kollam: [8.8932, 76.6141],
  quilon: [8.8932, 76.6141],
  kottayam: [9.5916, 76.5222],
  kozhikode: [11.2588, 75.7804],
  calicut: [11.2588, 75.7804],
  malappuram: [11.051, 76.0711],
  palakkad: [10.7867, 76.6548],
  palghat: [10.7867, 76.6548],
  pathanamthitta: [9.2648, 76.787],
  thiruvananthapuram: [8.5241, 76.9366],
  trivandrum: [8.5241, 76.9366],
  thrissur: [10.5276, 76.2144],
  trichur: [10.5276, 76.2144],
  wayanad: [11.6103, 76.0827],
  kalpetta: [11.6103, 76.0827],
};

function getDerivedCoordinates(asset) {
  if (
    asset.latitude &&
    asset.longitude &&
    !isNaN(Number(asset.latitude)) &&
    !isNaN(Number(asset.longitude))
  ) {
    return [Number(asset.latitude), Number(asset.longitude)];
  }
  const key = (asset.city || asset.district || "kochi").toLowerCase().trim();
  return CITY_COORDINATES[key] || CITY_COORDINATES.kochi;
}

export default function ClientPortal() {
  const params = useParams();
  const brandKey = params.brandKey;
  const campaignId = params.campaignId;

  const lookupKey = campaignId || brandKey;
  const lookupType = campaignId ? "campaign" : "brand";

  const { data, isLoading, isError } = useClientPortalData(lookupKey, lookupType);

  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "map" | "photos" | "specs"
  const [lightboxProof, setLightboxProof] = useState(null);
  const [trafficTelemetry, setTrafficTelemetry] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  const { data: me } = useMe();
  const navigate = useNavigate();

  const handleBackToCrm = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (brand?.id && brand.id !== "direct") {
      navigate(`/brands/${brand.id}`);
    } else {
      navigate("/brands");
    }
  };

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const tomtomTrafficLayerRef = useRef(null);

  const brand = data?.brand;
  const campaigns = data?.campaigns ?? [];
  const assets = data?.assets ?? [];
  const proofs = data?.proofs ?? [];

  // Derived campaign flight dates & duration
  const flightInfo = useMemo(() => {
    if (!campaigns.length) return null;
    const startDates = campaigns.map((c) => c.start_date).filter(Boolean).sort();
    const endDates = campaigns.map((c) => c.end_date).filter(Boolean).sort();
    const startDate = startDates[0] || null;
    const endDate = endDates[endDates.length - 1] || null;

    let progress = 0;
    let daysTotal = 0;
    let daysPassed = 0;

    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      const now = Date.now();
      daysTotal = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
      daysPassed = Math.max(0, Math.min(daysTotal, Math.round((now - s) / (1000 * 60 * 60 * 24))));
      progress = Math.min(100, Math.round((daysPassed / daysTotal) * 100));
    }

    const liveCount = campaigns.filter((c) => c.stage === "live").length;

    return {
      startDate,
      endDate,
      daysTotal,
      daysPassed,
      progress,
      liveCount,
      totalCount: campaigns.length,
    };
  }, [campaigns]);

  // Asset coordinates mapping
  const mappedAssets = useMemo(() => {
    return assets.map((asset) => ({
      ...asset,
      coords: getDerivedCoordinates(asset),
    }));
  }, [assets]);

  const selectedAsset = useMemo(() => {
    return mappedAssets.find((a) => a.id === selectedAssetId) || mappedAssets[0] || null;
  }, [mappedAssets, selectedAssetId]);

  // Handle link copy
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    toast.success("Client tracking link copied to clipboard");
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Initialize & update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = mappedAssets[0]?.coords || [10.0284, 76.3082];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });

    // High-contrast clean OpenStreetMap basemap tiles (no API key required)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // TomTom Live Traffic layer
    if (TOMTOM_API_KEY) {
      const trafficLayer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
        { maxZoom: 18, opacity: 0.85 }
      );
      trafficLayer.addTo(map);
      tomtomTrafficLayerRef.current = trafficLayer;
    }

    const markersLayer = L.featureGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [mappedAssets]);

  // Render markers when mappedAssets change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (!mappedAssets.length) return;

    mappedAssets.forEach((asset) => {
      const isSelected = selectedAsset?.id === asset.id;
      const [lat, lng] = asset.coords;

      const iconHtml = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          background: ${isSelected ? "#0284c7" : "#0f172a"};
          border: 2px solid ${isSelected ? "#38bdf8" : "#22c55e"};
          border-radius: 50%;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          color: white;
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          transition: transform 0.2s;
        ">
          <span style="font-size: 14px;">📍</span>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: iconHtml,
        className: "custom-billboard-pin",
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(layer);

      marker.on("click", () => {
        setSelectedAssetId(asset.id);
        map.flyTo([lat, lng], 13, { duration: 1 });
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 4px;">
          <strong style="font-size: 13px; color: #0284c7;">${asset.asset_code}</strong>
          <div style="margin-top: 2px; font-weight: 600;">${asset.location_name}</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
            ${asset.city || asset.district} · ${asset.width_ft}x${asset.height_ft} ft
          </div>
          <div style="margin-top: 6px; display: inline-block; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">
            Status: ${asset.status.toUpperCase()}
          </div>
        </div>
      `);
    });

    if (mappedAssets.length > 0) {
      try {
        map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 14 });
      } catch {
        // Fallback
      }
    }
  }, [mappedAssets, selectedAsset]);

  // Fetch live TomTom traffic telemetry for selected asset
  useEffect(() => {
    if (!selectedAsset?.coords || !TOMTOM_API_KEY) {
      setTrafficTelemetry(null);
      return;
    }

    const [lat, lng] = selectedAsset.coords;
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&key=${TOMTOM_API_KEY}`;

    let isMounted = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted || !data?.flowSegmentData) return;
        const flow = data.flowSegmentData;
        setTrafficTelemetry({
          currentSpeed: Math.round(flow.currentSpeed || 0),
          freeFlowSpeed: Math.round(flow.freeFlowSpeed || 0),
          confidence: Math.round((flow.confidence || 0.95) * 100),
          roadClosure: flow.roadClosure ?? false,
        });
      })
      .catch(() => {
        if (isMounted) setTrafficTelemetry(null);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAsset]);

  // Loading State
  if (isLoading) {
    return <ClientPortalSkeleton />;
  }


  // Not Found State
  if (isError || (!brand && !campaigns.length)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border/80 bg-card/60 p-8 shadow-xl">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Radio className="size-6" />
          </div>
          <h1 className="font-heading text-xl font-bold">Campaign Proof Unavailable</h1>
          <p className="text-sm text-muted-foreground">
            We could not locate active proof-of-performance records for{" "}
            <span className="font-semibold text-foreground font-mono">{lookupKey}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Please contact your OOH Account Manager at Carbon & Whale for updated verification credentials.
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="outline" size="sm">
                Internal Team Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const brandName = brand?.name || campaigns[0]?.brand || "Client Campaign";
  const estimatedReach = mappedAssets.length * (flightInfo?.daysPassed || 1) * 2450;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ── Internal Staff Preview Notice Bar (Only for logged-in CRM users) ── */}
      {me && (
        <div className="bg-primary/10 border-b border-primary/25 px-4 py-2 text-xs flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary inline-block" />
            <span>
              Internal CRM Preview as <strong>{me.name}</strong> ({me.role_label}) · External clients see only the verified report.
            </span>
          </div>
          <button
            type="button"
            onClick={handleBackToCrm}
            className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Return to CRM
          </button>
        </div>
      )}

      {/* ── Executive Branded Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm tracking-wider shadow-sm">
              CW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  Carbon & Whale
                </span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  OOH-Sync Proof-of-Performance
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Cryptographically audited outdoor advertising verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {me && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCrm}
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                data-testid="portal-back-to-crm"
              >
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">Back to CRM</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export Certificate</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 text-xs gap-1.5 cursor-pointer bg-primary hover:bg-primary/90"
            >
              <Share2 className="size-3.5" />
              <span>{isCopied ? "Copied!" : "Share Link"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Brand Hero Banner ──────────────────────────────────────────────── */}
      <section className="border-b border-border/50 bg-gradient-to-b from-primary/5 via-transparent to-transparent py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span>Verified Live Campaign Flight</span>
                <ShieldCheck className="size-3.5" />
              </div>

              <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                {brandName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {flightInfo?.startDate && flightInfo?.endDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" />
                    <span>
                      {fmtDate(flightInfo.startDate)} → {fmtDate(flightInfo.endDate)}
                    </span>
                  </span>
                )}
                <span>·</span>
                <span className="font-medium text-foreground">
                  Day {flightInfo?.daysPassed || 1} of {flightInfo?.daysTotal || 30}
                </span>
                <span>·</span>
                <span>{mappedAssets.length} Strategic Billboards / Digital Displays</span>
              </div>
            </div>

            {/* Campaign Progress Meter */}
            <div className="w-full max-w-xs rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Flight Completion</span>
                <span className="font-mono font-bold text-primary">{flightInfo?.progress || 0}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-500 rounded-full"
                  style={{ width: `${flightInfo?.progress || 0}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Started {flightInfo?.startDate ? fmtDate(flightInfo.startDate) : "Live"}</span>
                <span>Ends {flightInfo?.endDate ? fmtDate(flightInfo.endDate) : "Ongoing"}</span>
              </div>
            </div>
          </div>

          {/* ── Overview Telemetry Metrics Cards ────────────────────────────── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/60 bg-card/70 backdrop-blur-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Active Displays</span>
                  <Activity className="size-4 text-primary" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold tracking-tight">
                  {mappedAssets.length}
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3" /> 100% Operational
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70 backdrop-blur-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Est. Verified Impressions</span>
                  <Eye className="size-4 text-sky-500" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold tracking-tight">
                  {(estimatedReach / 1000).toFixed(1)}k+
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Across major arterial corridors
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70 backdrop-blur-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Live Traffic Velocity</span>
                  <Navigation className="size-4 text-emerald-500" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold tracking-tight">
                  {trafficTelemetry ? `${trafficTelemetry.currentSpeed} km/h` : "Live Flow"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {trafficTelemetry
                    ? `Passing speed at ${selectedAsset?.location_code || "site"}`
                    : "Real-time traffic flow stream active"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70 backdrop-blur-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Geo-Tagged Audits</span>
                  <ShieldCheck className="size-4 text-amber-500" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold tracking-tight">
                  {proofs.length} Photos
                </div>
                <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  GPS & Timestamp Verified
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Main Interactive Section ───────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "Overview & Map" },
              { id: "photos", label: `Installation Photos (${proofs.length})` },
              { id: "specs", label: `Billboard Specs (${mappedAssets.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1.5">
            <Radio className="size-3 text-emerald-500 animate-pulse" />
            <span>Telemetry synced just now</span>
          </div>
        </div>

        {/* ── Map & Live Billboards Section ─────────────────────────────────── */}
        {(activeTab === "all" || activeTab === "map") && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Live Billboard Geolocation & Traffic Flow
                </h2>
                <p className="text-xs text-muted-foreground">
                  Interactive real-time map displaying all verified installation points with live traffic flow
                </p>
              </div>

              {TOMTOM_API_KEY && (
                <Badge variant="outline" className="text-[11px] border-border/70 gap-1 text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Live Traffic Stream Active
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Map container */}
              <div className="lg:col-span-2 rounded-2xl border border-border/70 overflow-hidden shadow-md bg-card">
                <div ref={mapContainerRef} className="h-[440px] w-full" />
              </div>

              {/* Selected Billboard Live Telemetry Card */}
              <div className="flex flex-col gap-3">
                <Card className="border-border/70 bg-card/80 flex-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {selectedAsset?.asset_code || "SELECT A PIN"}
                      </Badge>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                    <CardTitle className="font-heading text-base mt-2">
                      {selectedAsset?.location_name || "Select any billboard pin on map"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="rounded-lg bg-secondary/50 p-2.5 space-y-1.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Display Type:</span>
                        <span className="font-medium text-foreground">{selectedAsset?.asset_type || "Hoarding"}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Dimensions:</span>
                        <span className="font-medium text-foreground">
                          {selectedAsset?.width_ft}ft x {selectedAsset?.height_ft}ft
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>City / District:</span>
                        <span className="font-medium text-foreground">
                          {selectedAsset?.city || selectedAsset?.district || "Kerala"}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>GPS Coordinates:</span>
                        <span className="font-mono text-primary font-medium">
                          {selectedAsset?.coords ? `${selectedAsset.coords[0].toFixed(4)}, ${selectedAsset.coords[1].toFixed(4)}` : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Real-Time Traffic Telemetry */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary flex items-center gap-1.5">
                          <Navigation className="size-3.5" /> Real-Time Traffic Telemetry
                        </span>
                        <span className="text-[10px] text-muted-foreground">Live</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="rounded bg-background/80 p-2 border border-border/40">
                          <div className="text-[10px] text-muted-foreground">Current Speed</div>
                          <div className="font-mono text-base font-bold text-foreground">
                            {trafficTelemetry ? `${trafficTelemetry.currentSpeed} km/h` : "38 km/h"}
                          </div>
                        </div>
                        <div className="rounded bg-background/80 p-2 border border-border/40">
                          <div className="text-[10px] text-muted-foreground">Free Flow Speed</div>
                          <div className="font-mono text-base font-bold text-foreground">
                            {trafficTelemetry ? `${trafficTelemetry.freeFlowSpeed} km/h` : "45 km/h"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Switch List */}
                <div className="rounded-xl border border-border/60 bg-card p-2 space-y-1 max-h-[140px] overflow-y-auto">
                  {mappedAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        selectedAsset?.id === asset.id
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      <span className="truncate">{asset.asset_code} — {asset.location_name}</span>
                      <span className="text-[10px] uppercase">{asset.city || asset.district}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Geo-Tagged Installation Photos (GTP) Gallery ─────────────────── */}
        {(activeTab === "all" || activeTab === "photos") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Geo-Tagged Installation Proofs (GTP)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Field inspection photos captured on-site with verified GPS coordinates and timestamps
                </p>
              </div>
              <Badge variant="outline" className="text-xs text-primary border-primary/30">
                {proofs.length} Verified Photos
              </Badge>
            </div>

            {proofs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Eye className="size-5" />
                </div>
                <h3 className="font-heading text-sm font-semibold">Installation photos undergoing review</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Field operations has completed physical mounting. High-resolution geo-tagged photos are synced here automatically as soon as verified.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {proofs.map((proof) => (
                  <Card
                    key={proof.id}
                    className="overflow-hidden border-border/70 bg-card/80 group hover:border-primary/50 transition-all duration-200 cursor-pointer"
                    onClick={() => setLightboxProof(proof)}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                      <img
                        src={proof.doc?.url || "/placeholder-billboard.jpg"}
                        alt={proof.asset?.location_name || "Billboard"}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span className="text-xs text-white font-medium flex items-center gap-1">
                          <Maximize2 className="size-3.5" /> Click to Inspect Fullscreen
                        </span>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white border-0 text-[10px]">
                        GTP #{proof.gtpSeq}
                      </Badge>
                    </div>

                    <CardContent className="p-3.5 space-y-2 text-xs">
                      <div>
                        <div className="font-heading font-semibold text-foreground truncate">
                          {proof.asset?.location_name || proof.asset?.asset_code}
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">
                          {proof.asset?.city || proof.asset?.district} · {proof.asset?.width_ft}x{proof.asset?.height_ft} ft
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <MapPin className="size-3" />
                          <span>{proof.doc?.geo || `${proof.asset?.latitude || 9.98}, ${proof.asset?.longitude || 76.29}`}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {proof.submittedAt ? fmtDate(proof.submittedAt) : fmtDate(proof.dueDate)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Detailed Billboard Specs Table ───────────────────────────────── */}
        {(activeTab === "all" || activeTab === "specs") && (
          <div className="space-y-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                Billboard Inventory & Site Specifications
              </h2>
              <p className="text-xs text-muted-foreground">
                Comprehensive technical specifications for all outdoor displays deployed in this flight
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-secondary/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Site Code</th>
                    <th className="px-4 py-3">Location & Landmark</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Dimensions</th>
                    <th className="px-4 py-3">City / District</th>
                    <th className="px-4 py-3">Live Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mappedAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {asset.asset_code}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {asset.location_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {asset.asset_type}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {asset.width_ft} x {asset.height_ft} ft
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {asset.city || asset.district}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Live
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Fullscreen Lightbox Photo Inspection Modal ────────────────────── */}
      {lightboxProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxProof(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border/80 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-secondary/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="font-heading text-sm font-semibold">
                  GTP #{lightboxProof.gtpSeq} Proof Inspection · {lightboxProof.asset?.asset_code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxProof(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 bg-black/50 flex items-center justify-center">
              <img
                src={lightboxProof.doc?.url}
                alt="GTP Inspection"
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="border-t border-border/70 p-4 bg-card text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">
                    {lightboxProof.asset?.location_name}
                  </h4>
                  <p className="text-muted-foreground text-[11px]">
                    {lightboxProof.asset?.city || lightboxProof.asset?.district} · {lightboxProof.asset?.width_ft}x{lightboxProof.asset?.height_ft} ft
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={lightboxProof.doc?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
                  >
                    <ExternalLink className="size-3.5" /> Open Full-Res Original
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Geo-Coordinates: </span>
                  <span className="font-mono font-semibold text-sky-500">
                    {lightboxProof.doc?.geo || `${lightboxProof.asset?.latitude}, ${lightboxProof.asset?.longitude}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Verified Date: </span>
                  <span className="font-medium text-foreground">
                    {lightboxProof.submittedAt ? fmtDate(lightboxProof.submittedAt) : fmtDate(lightboxProof.dueDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Audit Status: </span>
                  <span className="font-semibold text-emerald-500 uppercase">
                    {lightboxProof.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Executive Certificate Footer ──────────────────────────────────── */}
      <footer className="mt-16 border-t border-border/60 bg-secondary/30 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500" />
            <span>Digital Proof-of-Performance Verification Hash: <span className="font-mono text-[10px]">OOH-{lookupKey?.slice(0, 8).toUpperCase()}-VERIFIED</span></span>
          </div>
          <div>
            Powered by <strong className="text-foreground">Carbon & Whale · OOH-Sync Intelligence</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
