import { useEffect, useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Crosshair,
  Maximize2,
  ExternalLink,
  Layers,
  X,
  Flame,
  Users,
  Activity,
  Clock,
  TrendingUp,
  Eye,
} from "lucide-react";
import { AssetStatusBadge } from "@/components/shared/StatusBadges";
import SmartImage from "@/components/shared/SmartImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, KNOWN_KERALA_VENUES } from "@/lib/helpers";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";
import {
  TIME_SLOTS,
  getAssetFootfallPoints,
  calculateAssetImpressions,
} from "@/lib/densityData";
import { createHeatmapLayer } from "./HeatmapCanvasLayer";

// TomTom Live Traffic API Key from environment (.env)
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || "";

// Official Kerala District and major city reference centers
const CITY_COORDINATES = {
  alappuzha: [9.4981, 76.3388],
  alleppey: [9.4981, 76.3388],
  ernakulam: [9.9816, 76.2999],
  kochi: [9.9816, 76.2999],
  idukki: [9.8510, 76.9400],
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
  malappuram: [11.0510, 76.0711],
  palakkad: [10.7867, 76.6548],
  palghat: [10.7867, 76.6548],
  pathanamthitta: [9.2648, 76.7870],
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

  // 1. Check known Kerala venue dictionary by location_name
  const locName = (asset.location_name || "").toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_KERALA_VENUES || {})) {
    if (locName.includes(key) || key.includes(locName)) {
      return [val.lat, val.lng];
    }
  }

  // 2. Fallback to district / city center
  const key = (asset.district || asset.city || "kochi").toLowerCase().trim();
  return CITY_COORDINATES[key] || CITY_COORDINATES.kochi;
}

const STATUS_THEMES = {
  available: { bg: "#10b981", border: "#059669", halo: "rgba(16, 185, 129, 0.25)", label: "Available" },
  reserved: { bg: "#f59e0b", border: "#d97706", halo: "rgba(245, 158, 11, 0.25)", label: "Reserved" },
  onboarding: { bg: "#0284c7", border: "#0369a1", halo: "rgba(2, 132, 199, 0.25)", label: "Onboarding" },
  live: { bg: "#6366f1", border: "#4f46e5", halo: "rgba(99, 102, 241, 0.25)", label: "Live" },
  closing: { bg: "#8b5cf6", border: "#7c3aed", halo: "rgba(139, 92, 246, 0.25)", label: "Closing" },
  closed: { bg: "#64748b", border: "#475569", halo: "rgba(100, 116, 139, 0.25)", label: "Closed" },
};

function createMarkerIcon(status, isSelected) {
  const theme = STATUS_THEMES[status] || STATUS_THEMES.available;
  const size = isSelected ? 40 : 30;
  const ring = isSelected ? "box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.8), 0 8px 24px rgba(0,0,0,0.45);" : "";

  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${size}px;
      height: ${size}px;
      background: ${theme.bg};
      border: 2.5px solid #ffffff;
      border-radius: 9999px;
      box-shadow: 0 4px 14px ${theme.halo}, 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      ${ring}
    ">
      <svg width="${isSelected ? 16 : 13}" height="${isSelected ? 16 : 13}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function AssetMap({ assets = [], onSelectAsset, selectedAssetId }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const geofenceLayerRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const corridorsLayerRef = useRef(null);
  const tomtomTrafficLayerRef = useRef(null);
  const tomtomIncidentsLayerRef = useRef(null);
  const userMarkerRef = useRef(null);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState(500);
  const [showAllGeofences, setShowAllGeofences] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  // New Geospatial Intelligence Controls
  const [heatmapMode, setHeatmapMode] = useState("traffic"); // "traffic" | "footfall" | "off"
  const [showArterials, setShowArterials] = useState(true);
  const [timeSlotId, setTimeSlotId] = useState("evening");

  const activeTimeSlot = useMemo(
    () => TIME_SLOTS.find((s) => s.id === timeSlotId) || TIME_SLOTS[2],
    [timeSlotId]
  );

  // Sync with selectedAssetId prop if provided
  useEffect(() => {
    if (selectedAssetId) {
      const match = assets.find((a) => a.id === selectedAssetId);
      if (match) setSelectedAsset(match);
    }
  }, [selectedAssetId, assets]);

  // Compute coordinates for all assets
  const mappedAssets = useMemo(() => {
    return assets.map((asset) => {
      const coords = getDerivedCoordinates(asset);
      return {
        ...asset,
        coords,
        radius: asset.geofence_radius_m || geofenceRadius,
      };
    });
  }, [assets, geofenceRadius]);

  // Derived impression calculations for currently selected asset
  const selectedImpressions = useMemo(() => {
    return calculateAssetImpressions(selectedAsset, timeSlotId);
  }, [selectedAsset, timeSlotId]);

  // ── 1. Initialize Map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = mappedAssets[0]?.coords || [9.9816, 76.2999];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
    });

    // Clean, standard OpenStreetMap tile layer
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Heatmap Layer (renders above tiles, below markers)
    const heatmapLayer = createHeatmapLayer({ mode: "traffic" });
    heatmapLayer.addTo(map);
    heatmapLayerRef.current = heatmapLayer;

    // Arterial Road Corridors Layer
    const corridorsLayer = L.layerGroup().addTo(map);
    corridorsLayerRef.current = corridorsLayer;

    // Geofences Layer
    const geofenceLayer = L.layerGroup().addTo(map);
    geofenceLayerRef.current = geofenceLayer;

    // Markers Layer
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    mapInstanceRef.current = map;

    // Automatic resize invalidation on screen/container size changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (tomtomTrafficLayerRef.current && map) {
        map.removeLayer(tomtomTrafficLayerRef.current);
        tomtomTrafficLayerRef.current = null;
      }
      if (tomtomIncidentsLayerRef.current && map) {
        map.removeLayer(tomtomIncidentsLayerRef.current);
        tomtomIncidentsLayerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── 2. Live TomTom Traffic Telemetry for Selected Asset ───────────────────
  useEffect(() => {
    if (!selectedAsset?.coords || !TOMTOM_API_KEY) {
      setLiveTelemetry(null);
      return;
    }
    let isCurrent = true;
    setLoadingTelemetry(true);
    const [lat, lng] = selectedAsset.coords;

    fetch(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&key=${TOMTOM_API_KEY}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCurrent) return;
        setLiveTelemetry(data?.flowSegmentData || null);
        setLoadingTelemetry(false);
      })
      .catch(() => {
        if (isCurrent) {
          setLiveTelemetry(null);
          setLoadingTelemetry(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedAsset?.id]);

  // ── 3. Update Heatmap & Live TomTom Satellite Traffic ─────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const heatmap = heatmapLayerRef.current;

    // Real-Time Live TomTom Satellite Traffic Flow & Incidents Layers
    if (map && TOMTOM_API_KEY) {
      if (heatmapMode === "traffic") {
        if (!tomtomTrafficLayerRef.current) {
          const tomtomLayer = L.tileLayer(
            `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
            {
              maxZoom: 19,
              opacity: 0.92,
              zIndex: 350,
              attribution: '&copy; <a href="https://www.tomtom.com/">TomTom</a> Live Traffic',
            }
          );
          tomtomLayer.addTo(map);
          tomtomTrafficLayerRef.current = tomtomLayer;
        }

        if (!tomtomIncidentsLayerRef.current) {
          const incidentsLayer = L.tileLayer(
            `https://api.tomtom.com/traffic/map/4/tile/incidents/s0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
            {
              maxZoom: 19,
              opacity: 0.95,
              zIndex: 360,
            }
          );
          incidentsLayer.addTo(map);
          tomtomIncidentsLayerRef.current = incidentsLayer;
        }
      } else {
        if (tomtomTrafficLayerRef.current) {
          map.removeLayer(tomtomTrafficLayerRef.current);
          tomtomTrafficLayerRef.current = null;
        }
        if (tomtomIncidentsLayerRef.current) {
          map.removeLayer(tomtomIncidentsLayerRef.current);
          tomtomIncidentsLayerRef.current = null;
        }
      }
    }

    if (!heatmap) return;

    if (heatmapMode === "off" || heatmapMode === "traffic") {
      heatmap.setPoints([], "off");
      return;
    }

    const multiplier = activeTimeSlot.factor;

    if (heatmapMode === "footfall") {
      const points = getAssetFootfallPoints(mappedAssets, multiplier);
      heatmap.setPoints(points, "footfall");
    }
  }, [heatmapMode, activeTimeSlot, mappedAssets]);

  // ── 5. Update Markers & Geofences ─────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const geofenceLayer = geofenceLayerRef.current;
    if (!map || !markersLayer || !geofenceLayer) return;

    markersLayer.clearLayers();
    geofenceLayer.clearLayers();

    if (mappedAssets.length === 0) return;

    const bounds = L.latLngBounds([]);

    mappedAssets.forEach((asset) => {
      const isSelected = selectedAsset?.id === asset.id;
      const theme = STATUS_THEMES[asset.status] || STATUS_THEMES.available;

      // Draw Marker
      const marker = L.marker(asset.coords, {
        icon: createMarkerIcon(asset.status, isSelected),
        title: `${asset.asset_code} · ${asset.location_name}`,
      });

      marker.on("click", () => {
        sound.click();
        setSelectedAsset(asset);
        if (onSelectAsset) onSelectAsset(asset);
        map.panTo(asset.coords, { animate: true, duration: 0.5 });
      });

      marker.addTo(markersLayer);
      bounds.extend(asset.coords);

      // Draw Geofence Circle
      if (isSelected || showAllGeofences) {
        const radius = asset.radius || geofenceRadius;
        L.circle(asset.coords, {
          radius,
          color: theme.border,
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.9 : 0.4,
          fillColor: theme.bg,
          fillOpacity: isSelected ? 0.16 : 0.06,
          dashArray: isSelected ? undefined : "4, 6",
        }).addTo(geofenceLayer);
      }
    });

    // Auto-fit on initial load if no asset is selected
    if (bounds.isValid() && !selectedAsset) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mappedAssets, selectedAsset, showAllGeofences, geofenceRadius, onSelectAsset]);

  // Fit bounds helper
  const handleFitAll = () => {
    sound.click();
    const map = mapInstanceRef.current;
    if (!map || mappedAssets.length === 0) return;
    const bounds = L.latLngBounds(mappedAssets.map((a) => a.coords));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  };

  // HTML5 Locate Me
  const handleLocateMe = () => {
    sound.click();
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        const userIcon = L.divIcon({
          html: `
            <div style="
              width: 22px;
              height: 22px;
              background: #0284c7;
              border: 3px solid white;
              border-radius: 9999px;
              box-shadow: 0 0 0 8px rgba(2, 132, 199, 0.35);
            "></div>
          `,
          className: "user-gps-dot",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup("<b>Technician Location</b><br>Field Audit Proximity")
          .openPopup();

        userMarkerRef.current = marker;
        map.setView([latitude, longitude], 14, { animate: true });
      },
      () => {
        setLocatingUser(false);
        alert("Unable to retrieve your location.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative h-[520px] sm:h-[620px] lg:h-[700px] w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* ── TOP UNIFIED CONTROL STACK (Fully responsive for mobile & desktop) ── */}
      <div className="absolute top-2 inset-x-2 sm:top-2.5 sm:inset-x-2.5 z-[400] flex flex-col gap-1.5 pointer-events-none max-w-full">
        {/* Row 1: Primary Toolbar */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          {/* Left Cluster: Layers & Heatmap Mode (horizontally scrollable on mobile without wrapping) */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-md max-w-[calc(100%-48px)] sm:max-w-none overflow-x-auto no-scrollbar">
            {/* Heatmap Layer Selector */}
            <div className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setHeatmapMode("traffic");
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shrink-0",
                  heatmapMode === "traffic"
                    ? "bg-red-500/90 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
                <Flame className="size-3.5 text-amber-300" />
                <span className="hidden xs:inline sm:inline">Live Traffic</span>
                <span className="inline xs:hidden sm:hidden">Traffic</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setHeatmapMode("footfall");
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shrink-0",
                  heatmapMode === "footfall"
                    ? "bg-purple-600/90 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <Users className="size-3.5 text-pink-300" />
                Footfall
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setHeatmapMode("off");
                }}
                className={cn(
                  "rounded-md px-1.5 sm:px-2 py-1 text-xs font-medium transition-all cursor-pointer shrink-0",
                  heatmapMode === "off"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Off
              </button>
            </div>

            <div className="h-4 w-[1px] bg-border/80 mx-0.5 hidden sm:block shrink-0" />

            {/* Highways & Corridors (Arterials) Toggle */}
            <button
              type="button"
              onClick={() => {
                sound.click();
                setShowArterials((prev) => !prev);
              }}
              title="Toggle major high-capacity arterial highways and bypass corridors"
              className={cn(
                "hidden md:flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                showArterials ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Activity className="size-3 text-red-500" />
              Highways: {showArterials ? "ON" : "OFF"}
            </button>

            {/* Geofences Toggle */}
            <button
              type="button"
              onClick={() => {
                sound.click();
                setShowAllGeofences((prev) => !prev);
              }}
              className={cn(
                "hidden sm:flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0",
                showAllGeofences ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Layers className="size-3" />
              Geofences: {showAllGeofences ? "All" : "Active"}
            </button>

            {showAllGeofences && (
              <div className="hidden md:flex items-center gap-0.5 pl-1 text-[11px] text-muted-foreground font-mono shrink-0">
                {[300, 500, 1000].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      sound.click();
                      setGeofenceRadius(r);
                    }}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer",
                      geofenceRadius === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
            )}

            {/* Fit Bounds */}
            <Button
              variant="ghost"
              size="xs"
              onClick={handleFitAll}
              className="h-7 gap-1 px-1.5 sm:px-2 text-xs font-medium cursor-pointer shrink-0"
              title="Fit all assets in view"
            >
              <Maximize2 className="size-3.5" />
              <span>Fit</span>
              <span className="hidden sm:inline">({mappedAssets.length})</span>
            </Button>
          </div>

          {/* Right Cluster: GPS Locate Me */}
          <div className="pointer-events-auto flex items-center rounded-xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-md shrink-0">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleLocateMe}
              disabled={locatingUser}
              className="h-7 gap-1 px-2 sm:px-2.5 text-xs font-medium text-sky-600 hover:text-sky-700 cursor-pointer"
              title="Locate my position on map"
            >
              <Crosshair className={cn("size-3.5", locatingUser && "animate-spin")} />
              <span className="hidden sm:inline">{locatingUser ? "Locating..." : "Locate Me"}</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Peak Simulation Bar (Smooth horizontal scroll on mobile) */}
        {heatmapMode !== "off" && (
          <div className="pointer-events-auto self-start flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/95 px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 max-w-full overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground pr-1 shrink-0">
              <Clock className="size-3.5 text-primary" />
              <span className="hidden xs:inline sm:inline">Peak Simulation:</span>
              <span className="inline xs:hidden sm:hidden">Sim:</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    sound.click();
                    setTimeSlotId(slot.id);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 sm:px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap",
                    timeSlotId === slot.id
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{slot.label}</span>
                  <span className="font-mono text-[9px] opacity-80 hidden sm:inline">({slot.time.split(" ")[0]})</span>
                </button>
              ))}
            </div>

            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 bg-primary/5 text-primary ml-1 hidden lg:inline-flex shrink-0">
              {activeTimeSlot.factor}× Multiplier
            </Badge>
          </div>
        )}
      </div>

      {/* ── BOTTOM LEFT: Dynamic Heatmap Density Legend ──────────────────── */}
      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-[400] flex flex-col gap-1 rounded-xl border border-border/80 bg-background/95 p-1.5 sm:p-2 shadow-lg backdrop-blur-md max-w-[calc(100%-16px)] sm:max-w-xs">
        {heatmapMode !== "off" && (
          <div className="space-y-1 pb-1 border-b border-border/60">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>{heatmapMode === "traffic" ? "Vehicular Traffic" : "Footfall Density"}</span>
              <span className="font-mono font-semibold text-foreground text-[9px]">
                {heatmapMode === "traffic" ? "VPD / Hour" : "Pedestrians / Day"}
              </span>
            </div>
            <div
              className={cn(
                "h-1.5 sm:h-2 w-36 sm:w-48 rounded-full shadow-inner",
                heatmapMode === "traffic"
                  ? "bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-red-500"
                  : "bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-300"
              )}
            />
            <div className="flex justify-between text-[8px] sm:text-[9px] font-mono text-muted-foreground">
              <span>Low</span>
              <span>Moderate</span>
              <span className="font-semibold text-foreground">Peak (75k+)</span>
            </div>
          </div>
        )}

        {/* Billboard Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5">
          {Object.entries(STATUS_THEMES).slice(0, 4).map(([status, theme]) => (
            <div key={status} className="flex items-center gap-1 text-[10px] sm:text-[11px]">
              <span className="inline-block size-2 sm:size-2.5 rounded-full ring-1 ring-white/50 shrink-0" style={{ backgroundColor: theme.bg }} />
              <span className="capitalize text-muted-foreground">{theme.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SELECTED ASSET OVERLAY CARD (EXPECTED IMPRESSION INTELLIGENCE) ── */}
      {selectedAsset && selectedImpressions && (
        <div className="absolute inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-3 sm:right-3 z-[400] w-auto sm:w-full sm:max-w-md max-h-[58vh] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-3 sm:p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-250">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <AssetStatusBadge status={selectedAsset.status} />
                <Badge variant="outline" className="font-mono text-[10px]">
                  {selectedAsset.asset_type}
                </Badge>
                <Badge variant="secondary" className="font-bold text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/30">
                  Grade {selectedImpressions.visibilityGrade}
                </Badge>
              </div>
              <h4 className="mt-1 truncate font-heading text-sm font-bold text-foreground">
                {selectedAsset.location_name}
              </h4>
              <p className="mono-label text-xs text-muted-foreground">{selectedAsset.asset_code}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              onClick={() => setSelectedAsset(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Expected Impression Highlight Banner */}
          <div className="my-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                  Expected Daily Impressions
                </span>
              </div>
              <span className="font-heading text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {selectedImpressions.dailyImpressions.toLocaleString()}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/day</span>
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Peak: <b className="text-foreground">{selectedImpressions.peakHourlyTraffic.toLocaleString()} views/hr</b></span>
              <span>Est. CPM: <b className="text-foreground">{selectedImpressions.cpm}</b></span>
              <span>Dwell: <b className="text-foreground">{selectedImpressions.dwellTime}</b></span>
            </div>
          </div>

          {/* TomTom Real-Time Road Traffic Flow Telemetry */}
          {liveTelemetry && (
            <div className="my-1.5 flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] shadow-2xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span>TomTom Flow:</span>
                <b className="text-foreground">{liveTelemetry.currentSpeed} km/h</b>
                <span className="text-muted-foreground text-[10px]">(Free-flow: {liveTelemetry.freeFlowSpeed} km/h)</span>
              </div>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                liveTelemetry.roadClosure
                  ? "bg-red-500/20 text-red-600"
                  : liveTelemetry.currentSpeed < liveTelemetry.freeFlowSpeed * 0.6
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-emerald-500/20 text-emerald-600"
              )}>
                {liveTelemetry.roadClosure ? "Closed" : liveTelemetry.currentSpeed < liveTelemetry.freeFlowSpeed * 0.6 ? "Congested" : "Normal Flow"}
              </span>
            </div>
          )}

          {/* Audience Demographic Distribution Bar */}
          <div className="space-y-1 py-1">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-muted-foreground">Audience Demographics</span>
              <span className="font-mono text-xs text-foreground">
                {selectedImpressions.demographics.commuters}% Commuters · {selectedImpressions.demographics.shoppers}% Shoppers
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                style={{ width: `${selectedImpressions.demographics.commuters}%` }}
                className="bg-sky-500 transition-all duration-300"
                title={`Commuters: ${selectedImpressions.demographics.commuters}%`}
              />
              <div
                style={{ width: `${selectedImpressions.demographics.shoppers}%` }}
                className="bg-pink-500 transition-all duration-300"
                title={`Shoppers: ${selectedImpressions.demographics.shoppers}%`}
              />
              <div
                style={{ width: `${selectedImpressions.demographics.techWorkers}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title={`Professionals: ${selectedImpressions.demographics.techWorkers}%`}
              />
            </div>
          </div>

          {/* Media Thumbnail & Specs */}
          <div className="flex gap-3 pt-2.5 mt-1 border-t border-border/50">
            <div className="w-20 shrink-0 overflow-hidden rounded-lg border border-border/60">
              <SmartImage
                src={selectedAsset.photo_url}
                alt={selectedAsset.location_name}
                preset="card"
                aspectRatio="aspect-square"
                fallbackText={selectedAsset.asset_code}
              />
            </div>

            <div className="flex flex-1 flex-col justify-between py-0.5">
              <div className="space-y-0.5 text-xs">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {selectedAsset.city || selectedAsset.district}
                  </span>{" "}
                  · {selectedAsset.width_ft}×{selectedAsset.height_ft} ft
                </p>
                {selectedAsset.rate_monthly ? (
                  <p className="font-heading font-bold text-foreground">
                    {fmtMoney(selectedAsset.rate_monthly)}
                    <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                  </p>
                ) : null}
              </div>

              <div className="pt-2">
                <Link
                  to={`/assets/${selectedAsset.id}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  <Eye className="size-3.5" />
                  View full site dossier
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
