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
import { fmtMoney } from "@/lib/helpers";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";
import {
  TIME_SLOTS,
  TRAFFIC_HEAT_NODES,
  FOOTFALL_HEAT_NODES,
  ARTERIAL_CORRIDORS,
  calculateAssetImpressions,
} from "@/lib/densityData";
import { createHeatmapLayer } from "./HeatmapCanvasLayer";

// Known city center coordinates (All 14 Kerala Districts with >90% municipal precision)
const CITY_COORDINATES = {
  // 14 Official Districts of Kerala
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

  // Other major metropolitans
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  hyderabad: [17.385, 78.4867],
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
  const base = CITY_COORDINATES[key] || CITY_COORDINATES.kochi;

  let hash = 0;
  const str = asset.asset_code || asset.id || "0";
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const offsetLat = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.08;
  const offsetLng = ((Math.abs(hash >> 3) % 1000) / 1000 - 0.5) * 0.08;

  return [base[0] + offsetLat, base[1] + offsetLng];
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
  const userMarkerRef = useRef(null);

  const [selectedAsset, setSelectedAsset] = useState(null);
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

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── 3. Update Heatmap Layer Data & Mode ────────────────────────────────────
  useEffect(() => {
    const heatmap = heatmapLayerRef.current;
    if (!heatmap) return;

    if (heatmapMode === "off") {
      heatmap.setPoints([], "off");
      return;
    }

    const multiplier = activeTimeSlot.factor;

    if (heatmapMode === "traffic") {
      const points = TRAFFIC_HEAT_NODES.map((node) => ({
        coords: node.coords,
        intensity: Math.min(1.0, node.intensity * (0.8 + multiplier * 0.2)),
        radius: node.radius * (0.85 + multiplier * 0.15),
      }));
      heatmap.setPoints(points, "traffic");
    } else if (heatmapMode === "footfall") {
      const points = FOOTFALL_HEAT_NODES.map((node) => ({
        coords: node.coords,
        intensity: Math.min(1.0, node.intensity * (0.75 + multiplier * 0.25)),
        radius: node.radius * (0.9 + multiplier * 0.1),
      }));
      heatmap.setPoints(points, "footfall");
    }
  }, [heatmapMode, activeTimeSlot]);

  // ── 4. Update Arterial Corridors ──────────────────────────────────────────
  useEffect(() => {
    const layer = corridorsLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (!showArterials) return;

    ARTERIAL_CORRIDORS.forEach((corridor) => {
      // Background glow line
      L.polyline(corridor.points, {
        color: corridor.color,
        weight: corridor.weight + 5,
        opacity: 0.25,
        lineCap: "round",
      }).addTo(layer);

      // Core crisp vector corridor
      const poly = L.polyline(corridor.points, {
        color: corridor.color,
        weight: corridor.weight,
        opacity: 0.9,
        dashArray: corridor.tier.includes("Expressway") ? undefined : "6, 8",
      });

      poly.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <b style="font-size: 13px; color: ${corridor.color}">${corridor.name}</b>
          <p style="font-size: 11px; margin: 4px 0 2px 0; color: #64748b;">${corridor.tier}</p>
          <p style="font-size: 12px; margin: 2px 0; font-weight: 600;">Traffic Density: ${corridor.dailyVehicles}</p>
          <span style="display:inline-block; font-size: 10px; background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: 500;">
            ${corridor.trafficLevel}
          </span>
        </div>
      `);

      poly.addTo(layer);
    });
  }, [showArterials]);

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
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* ── TOP CONTROL BAR: Geospatial Layer & Presentation Deck ────────── */}
      <div className="absolute top-3 inset-x-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Cluster: Layers & Heatmap Mode */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-md">
          {/* Heatmap Layer Selector */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
            <button
              type="button"
              onClick={() => {
                sound.click();
                setHeatmapMode("traffic");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                heatmapMode === "traffic"
                  ? "bg-red-500/90 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <Flame className="size-3.5 text-amber-300" />
              Traffic Heatmap
            </button>

            <button
              type="button"
              onClick={() => {
                sound.click();
                setHeatmapMode("footfall");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                heatmapMode === "footfall"
                  ? "bg-purple-600/90 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <Users className="size-3.5 text-pink-300" />
              Footfall Density
            </button>

            <button
              type="button"
              onClick={() => {
                sound.click();
                setHeatmapMode("off");
              }}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer",
                heatmapMode === "off"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Off
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border/80 mx-0.5 hidden sm:block" />

          {/* Highways & Corridors (Arterials) Toggle */}
          <button
            type="button"
            onClick={() => {
              sound.click();
              setShowArterials((prev) => !prev);
            }}
            title="Toggle major high-capacity arterial highways and bypass corridors (NH66, MG Road, Infopark)"
            className={cn(
              "hidden sm:flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
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
              "hidden sm:flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
              showAllGeofences ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Layers className="size-3" />
            Geofences: {showAllGeofences ? "All" : "Active"}
          </button>

          {showAllGeofences && (
            <div className="hidden md:flex items-center gap-0.5 pl-1 text-[11px] text-muted-foreground font-mono">
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
            className="h-7 gap-1 px-2 text-xs font-medium cursor-pointer"
          >
            <Maximize2 className="size-3.5" />
            Fit ({mappedAssets.length})
          </Button>
        </div>

        {/* Right Cluster: GPS Locate Me */}
        <div className="pointer-events-auto flex items-center rounded-xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-md">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleLocateMe}
            disabled={locatingUser}
            className="h-7 gap-1 px-2.5 text-xs font-medium text-sky-600 hover:text-sky-700 cursor-pointer"
          >
            <Crosshair className={cn("size-3.5", locatingUser && "animate-spin")} />
            <span>{locatingUser ? "Locating..." : "Locate Me"}</span>
          </Button>
        </div>
      </div>

      {/* ── PEAK FOOTFALL & TRAFFIC HOURS SIMULATION BAR ──────────────────── */}
      {heatmapMode !== "off" && (
        <div className="absolute top-16 left-3 z-[400] flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-background/95 px-2.5 py-1.5 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground pr-1">
            <Clock className="size-3.5 text-primary" />
            <span>Peak Simulation:</span>
          </div>

          <div className="flex items-center gap-1">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => {
                  sound.click();
                  setTimeSlotId(slot.id);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  timeSlotId === slot.id
                    ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{slot.label}</span>
                <span className="font-mono text-[9px] opacity-80">({slot.time.split(" ")[0]})</span>
              </button>
            ))}
          </div>

          <Badge variant="outline" className="text-[10px] font-mono border-primary/40 bg-primary/5 text-primary ml-1 hidden lg:inline-flex">
            {activeTimeSlot.factor}× Traffic Multiplier
          </Badge>
        </div>
      )}

      {/* ── BOTTOM LEFT: Dynamic Heatmap Density Legend ──────────────────── */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-1 rounded-xl border border-border/80 bg-background/95 p-2 shadow-lg backdrop-blur-md">
        {heatmapMode !== "off" && (
          <div className="space-y-1 pb-1.5 border-b border-border/60">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>{heatmapMode === "traffic" ? "Vehicular Traffic" : "Footfall Density"}</span>
              <span className="font-mono font-semibold text-foreground">
                {heatmapMode === "traffic" ? "VPD / Hour" : "Pedestrians / Day"}
              </span>
            </div>
            <div
              className={cn(
                "h-2 w-48 rounded-full shadow-inner",
                heatmapMode === "traffic"
                  ? "bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-red-500"
                  : "bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-300"
              )}
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
              <span>Low (4k)</span>
              <span>Moderate</span>
              <span>Dense</span>
              <span className="font-semibold text-foreground">Peak (75k+)</span>
            </div>
          </div>
        )}

        {/* Billboard Status Indicators */}
        <div className="flex items-center gap-3 pt-0.5">
          {Object.entries(STATUS_THEMES).slice(0, 4).map(([status, theme]) => (
            <div key={status} className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block size-2.5 rounded-full ring-1 ring-white/50" style={{ backgroundColor: theme.bg }} />
              <span className="capitalize text-muted-foreground">{theme.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SELECTED ASSET OVERLAY CARD (EXPECTED IMPRESSION INTELLIGENCE) ── */}
      {selectedAsset && selectedImpressions && (
        <div className="absolute bottom-3 right-3 z-[400] w-full max-w-sm sm:max-w-md rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-250">
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
