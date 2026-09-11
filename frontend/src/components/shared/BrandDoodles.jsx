import { cn } from "@/lib/utils";

/**
 * BrandDoodles
 * Subtle, eco-marine watermark doodles (plastic bottle, geometric whale, waves, recycling loop)
 * tailored for Carbon & Whale brand identity.
 * Rendered only on white/light content screens, never on navbars/tabs.
 */
export default function BrandDoodles({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none -z-0 opacity-[0.038] dark:opacity-[0.025] transition-opacity duration-300",
        className
      )}
    >
      {/* ── 1. Top Right: Recycled Plastic Bottle & Eco Droplet ── */}
      <svg
        className="absolute -top-6 right-8 size-48 md:size-64 stroke-current text-sky-950"
        viewBox="0 0 160 160"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Plastic Bottle Doodle */}
        <g transform="translate(40, 20) rotate(18)">
          {/* Bottle Cap */}
          <rect x="22" y="4" width="12" height="6" rx="1.5" />
          <line x1="20" y1="10" x2="36" y2="10" />
          {/* Bottle Neck */}
          <path d="M24 10 V18 C24 24 16 28 16 34 V82 C16 88 20 92 28 92 C36 92 40 88 40 82 V34 C40 28 32 24 32 18 V10" />
          {/* Bottle Ridges / Texture */}
          <path d="M16 48 C20 46 36 46 40 48" strokeDasharray="2 2" />
          <path d="M16 64 C20 62 36 62 40 64" strokeDasharray="2 2" />
          {/* Recycle Loop on Bottle */}
          <path d="M25 54 L30 50 L31 56" />
          <path d="M31 52 C33 55 32 58 29 60 L24 57" />
          <path d="M23 58 C21 56 22 53 25 51" />
        </g>
        {/* Subtle Water Ripples */}
        <path d="M10 110 C30 106 50 114 70 110 C90 106 110 114 130 110" strokeDasharray="3 3" />
        <path d="M25 124 C45 120 65 128 85 124 C105 120 125 128 145 124" strokeDasharray="4 4" />
      </svg>

      {/* ── 2. Bottom Right: Carbon & Whale Geometric Silhouette ── */}
      <svg
        className="absolute -bottom-10 right-4 size-64 md:size-80 fill-current text-sky-950"
        viewBox="0 0 200 160"
      >
        {/* Polygon Whale Silhouette matching Brand Logo */}
        <g transform="translate(10, 15) scale(0.08)">
          <polygon points="398,951 1371,848 1862,960 1904,1164 1731,1053 1257,1395 1111,1615 941,1429 400,1247" />
        </g>
        {/* Ocean Current Swirls */}
        <path
          d="M20 130 C60 120 100 138 140 126 C165 118 185 122 195 130"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
      </svg>

      {/* ── 3. Bottom Left: Whale Fluke Splash & Sprout ── */}
      <svg
        className="absolute bottom-6 left-6 size-44 md:size-56 stroke-current text-sky-950"
        viewBox="0 0 140 140"
        fill="none"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Whale Tail Fluke */}
        <path d="M70 110 C68 85 55 70 30 65 C45 60 62 65 70 80 C78 65 95 60 110 65 C85 70 72 85 70 110 Z" />
        {/* Water Droplets */}
        <circle cx="45" cy="45" r="2.5" />
        <circle cx="70" cy="35" r="3" />
        <circle cx="95" cy="45" r="2.5" />
        {/* Ocean Waves */}
        <path d="M15 115 C35 110 55 120 75 115 C95 110 115 120 135 115" />
      </svg>

      {/* ── 4. Center Background: Topographic Ocean Contours ── */}
      <svg
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] stroke-current text-sky-950 pointer-events-none"
        viewBox="0 0 600 300"
        fill="none"
        strokeWidth="1"
      >
        <path
          d="M 50,150 C 150,80 250,220 350,140 C 450,60 520,180 580,120"
          strokeDasharray="4 6"
        />
        <path
          d="M 20,190 C 130,120 220,260 320,180 C 420,100 500,210 570,160"
          strokeDasharray="6 8"
        />
        <path
          d="M 60,110 C 170,50 270,180 370,100 C 470,20 530,140 590,90"
          strokeDasharray="2 4"
        />
      </svg>
    </div>
  );
}
