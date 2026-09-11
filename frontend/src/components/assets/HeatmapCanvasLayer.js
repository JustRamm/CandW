import L from "leaflet";

/**
 * Custom Leaflet Canvas Gaussian Heatmap Layer
 * High-performance, zero external dependency, renders ultra-smooth glowing gradients.
 */
export const HeatmapCanvasLayer = L.Layer.extend({
  options: {
    points: [], // Array of { coords: [lat, lng], intensity: 0.1-1.0, radius: meters }
    mode: "traffic", // "traffic" | "footfall"
    opacity: 0.85,
    blur: 15,
  },

  initialize: function (options) {
    L.setOptions(this, options);
    this._canvas = null;
    this._ctx = null;
  },

  onAdd: function (map) {
    this._map = map;

    if (!this._canvas) {
      this._canvas = L.DomUtil.create("canvas", "leaflet-heatmap-canvas");
      this._canvas.style.position = "absolute";
      this._canvas.style.pointerEvents = "none";
      this._canvas.style.zIndex = "350";
      this._canvas.style.mixBlendMode = "screen";
      this._ctx = this._canvas.getContext("2d");
    }

    map.getPanes().overlayPane.appendChild(this._canvas);

    map.on("moveend zoomend viewreset resize", this._reset, this);
    this._reset();
  },

  onRemove: function (map) {
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    map.off("moveend zoomend viewreset resize", this._reset, this);
  },

  setPoints: function (points, mode = "traffic") {
    this.options.points = points || [];
    this.options.mode = mode;
    this._draw();
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    if (this._canvas) {
      this._canvas.style.opacity = opacity;
    }
  },

  _reset: function () {
    if (!this._map || !this._canvas) return;

    const size = this._map.getSize();
    const bounds = this._map.getBounds();
    const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());

    // Scale canvas to device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = size.x * dpr;
    this._canvas.height = size.y * dpr;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;

    L.DomUtil.setPosition(this._canvas, topLeft);

    if (this._ctx) {
      this._ctx.scale(dpr, dpr);
    }

    this._draw();
  },

  _draw: function () {
    if (!this._map || !this._ctx || !this._canvas) return;

    const ctx = this._ctx;
    const size = this._map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    const points = this.options.points || [];
    if (points.length === 0) return;

    const currentZoom = this._map.getZoom();
    const isFootfall = this.options.mode === "footfall";

    // Draw each point with a multi-stop radial gradient
    points.forEach((pt) => {
      if (!pt.coords || pt.coords.length < 2) return;
      const point = this._map.latLngToContainerPoint(pt.coords);

      // Skip points outside visible canvas + padding
      if (point.x < -150 || point.x > size.x + 150 || point.y < -150 || point.y > size.y + 150) {
        return;
      }

      // Dynamic radius scaling based on map zoom level
      const zoomFactor = Math.pow(1.3, currentZoom - 12);
      const baseRadius = (pt.radius || 400) / 12;
      const r = Math.max(22, Math.min(180, baseRadius * zoomFactor));

      const intensity = Math.min(1.0, Math.max(0.2, pt.intensity || 0.7));

      const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, r);

      if (isFootfall) {
        // Footfall palette: Violet -> Hot Pink -> Vibrant Gold
        grad.addColorStop(0, `rgba(250, 204, 21, ${0.92 * intensity})`);
        grad.addColorStop(0.3, `rgba(236, 72, 153, ${0.75 * intensity})`);
        grad.addColorStop(0.65, `rgba(139, 92, 246, ${0.45 * intensity})`);
        grad.addColorStop(1, "rgba(99, 102, 241, 0)");
      } else {
        // Traffic palette: Electric Cyan -> Lime -> Neon Amber -> Crimson Red
        grad.addColorStop(0, `rgba(239, 68, 68, ${0.95 * intensity})`);
        grad.addColorStop(0.35, `rgba(245, 158, 11, ${0.8 * intensity})`);
        grad.addColorStop(0.65, `rgba(16, 185, 129, ${0.5 * intensity})`);
        grad.addColorStop(0.85, `rgba(6, 182, 212, ${0.25 * intensity})`);
        grad.addColorStop(1, "rgba(6, 182, 212, 0)");
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  },
});

export function createHeatmapLayer(options) {
  return new HeatmapCanvasLayer(options);
}
