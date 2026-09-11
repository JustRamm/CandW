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
} from "lucide-react";
import { AssetStatusBadge } from "@/components/shared/StatusBadges";
import SmartImage from "@/components/shared/SmartImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/helpers";
import { cn } from "@/lib/utils";

// Known city center coordinates
const CITY_COORDINATES = {
  ernakulam: [9.9816, 76.2999],
  kochi: [9.9816, 76.2999],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  trivandrum: [8.5241, 76.9366],
  thiruvananthapuram: [8.5241, 76.9366],
  calicut: [11.2588, 75.7804],
  kozhikode: [11.2588, 75.7804],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  hyderabad: [17.385, 78.4867],
};

// Deterministic pseudo-random offset for assets without exact GPS
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

  // Simple string hash
  let hash = 0;
  const str = asset.asset_code || asset.id || "0";
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  // Spread within ~5-8km radius around city center
  const offsetLat = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.08;
  const offsetLng = ((Math.abs(hash >> 3) % 1000) / 1000 - 0.5) * 0.08;

  return [base[0] + offsetLat, base[1] + offsetLng];
}

const STATUS_THEMES = {
  available: {
    bg: "#10b981",
    border: "#059669",
    halo: "rgba(16, 185, 129, 0.2)",
    label: "Available",
  },
  reserved: {
    bg: "#f59e0b",
    border: "#d97706",
    halo: "rgba(245, 158, 11, 0.2)",
    label: "Reserved",
  },
  onboarding: {
    bg: "#0284c7",
    border: "#0369a1",
    halo: "rgba(2, 132, 199, 0.2)",
    label: "Onboarding",
  },
  live: {
    bg: "#6366f1",
    border: "#4f46e5",
    halo: "rgba(99, 102, 241, 0.2)",
    label: "Live",
  },
  closing: {
    bg: "#8b5cf6",
    border: "#7c3aed",
    halo: "rgba(139, 92, 246, 0.2)",
    label: "Closing",
  },
  closed: {
    bg: "#64748b",
    border: "#475569",
    halo: "rgba(100, 116, 139, 0.2)",
    label: "Closed",
  },
};

function createMarkerIcon(status, isSelected) {
  const theme = STATUS_THEMES[status] || STATUS_THEMES.available;
  const size = isSelected ? 38 : 30;
  const scale = isSelected ? "scale-110 ring-4 ring-primary" : "";

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
      box-shadow: 0 4px 12px ${theme.halo}, 0 2px 4px rgba(0,0,0,0.25);
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      transform-origin: center;
    " class="${scale}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
  const userMarkerRef = useRef(null);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [geofenceRadius, setGeofenceRadius] = useState(500); // meters
  const [showAllGeofences, setShowAllGeofences] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = mappedAssets[0]?.coords || [9.9816, 76.2999];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
    });

    // Clean, free OpenStreetMap tile layer (no watermark, no API key required)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const geofenceLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    geofenceLayerRef.current = geofenceLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Geofences
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
        setSelectedAsset(asset);
        if (onSelectAsset) onSelectAsset(asset);
        map.panTo(asset.coords, { animate: true, duration: 0.5 });
      });

      marker.addTo(markersLayer);
      bounds.extend(asset.coords);

      // Draw Geofence Circle (if selected or if showAllGeofences is active)
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

    // Auto-fit on first load
    if (bounds.isValid() && !selectedAsset) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mappedAssets, selectedAsset, showAllGeofences, geofenceRadius, onSelectAsset]);

  // Fit bounds helper
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || mappedAssets.length === 0) return;
    const bounds = L.latLngBounds(mappedAssets.map((a) => a.coords));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  };

  // HTML5 Locate Me
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        const map = mapInstanceRef.current;
        if (!map) return;

        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        const userIcon = L.divIcon({
          html: `
            <div style="
              width: 20px;
              height: 20px;
              background: #2563eb;
              border: 3px solid white;
              border-radius: 9999px;
              box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.3);
            "></div>
          `,
          className: "user-gps-dot",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([latitude, longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup("<b>You are here</b><br>Technician Proximity")
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
    <div className="relative h-[620px] w-full overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-background/95 p-1.5 shadow-md backdrop-blur-md">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleFitAll}
          className="h-7 gap-1 px-2 text-xs font-medium"
        >
          <Maximize2 className="size-3.5" />
          Fit all ({mappedAssets.length})
        </Button>

        <div className="h-4 w-[1px] bg-border/80" />

        <Button
          variant={showAllGeofences ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setShowAllGeofences((prev) => !prev)}
          className="h-7 gap-1 px-2 text-xs font-medium"
        >
          <Layers className="size-3.5" />
          Geofences: {showAllGeofences ? "All" : "Active"}
        </Button>

        <div className="h-4 w-[1px] bg-border/80" />

        <div className="flex items-center gap-1 pl-1 pr-1 text-xs">
          <span className="text-[11px] text-muted-foreground font-mono">Radius:</span>
          {[300, 500, 1000].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setGeofenceRadius(r)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
                geofenceRadius === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
            </button>
          ))}
        </div>
      </div>

      {/* GPS Proximity Button */}
      <div className="absolute top-3 right-3 z-[400]">
        <Button
          variant="outline"
          size="xs"
          onClick={handleLocateMe}
          disabled={locatingUser}
          className="h-8 gap-1.5 border-border/80 bg-background/95 shadow-md backdrop-blur-md text-xs font-medium"
        >
          <Crosshair className={cn("size-3.5 text-sky-600", locatingUser && "animate-spin")} />
          {locatingUser ? "Locating..." : "Locate Me"}
        </Button>
      </div>

      {/* Map Status Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 rounded-lg border border-border/70 bg-background/90 px-3 py-1.5 text-xs shadow-md backdrop-blur-md">
        {Object.entries(STATUS_THEMES).slice(0, 4).map(([status, theme]) => (
          <div key={status} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: theme.bg }}
            />
            <span className="capitalize text-muted-foreground">{theme.label}</span>
          </div>
        ))}
      </div>

      {/* Selected Asset Overlay Card (Bottom / Slide-over) */}
      {selectedAsset && (
        <div className="absolute bottom-3 right-3 z-[400] w-full max-w-sm rounded-xl border border-border/80 bg-card p-3 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <AssetStatusBadge status={selectedAsset.status} />
                <Badge variant="outline" className="font-mono text-[10px]">
                  {selectedAsset.asset_type}
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
              className="size-6 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setSelectedAsset(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border/50">
            <div className="w-24 shrink-0 overflow-hidden rounded-md border border-border/60">
              <SmartImage
                src={selectedAsset.photo_url}
                alt={selectedAsset.location_name}
                preset="card"
                aspectRatio="aspect-square"
                fallbackText={selectedAsset.asset_code}
              />
            </div>

            <div className="flex flex-1 flex-col justify-between py-0.5">
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {selectedAsset.city || selectedAsset.district}
                  </span>{" "}
                  · {selectedAsset.width_ft}×{selectedAsset.height_ft} ft
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Geofence radius:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {selectedAsset.radius}m
                  </span>
                </p>
                {selectedAsset.rate_monthly ? (
                  <p className="font-heading font-semibold text-foreground">
                    {fmtMoney(selectedAsset.rate_monthly)}
                    <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                  </p>
                ) : null}
              </div>

              <div className="pt-2">
                <Link
                  to={`/assets/${selectedAsset.id}`}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                >
                  View full details
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
