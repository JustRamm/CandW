import { cn } from "@/lib/utils";

/**
 * BrandDoodles
 * WhatsApp-style repeating seamless doodle pattern tailored for Carbon & Whale:
 * - Mini recycled plastic bottles
 * - Mini geometric whales & fluke splashes
 * - Mini OOH media billboards & bus benches
 * - Mini ocean waves & water droplets
 * - Mini recycling loops & eco sprouts
 * - Mini geolocation pins & workflow clocks
 * 
 * Styled as a subtle, elegant, low-opacity background watermark on white/light screens.
 * Never rendered on navbars, sidebars, or tabs.
 */
export default function BrandDoodles({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none -z-0 opacity-[0.045] dark:opacity-[0.03] transition-opacity duration-300",
        className
      )}
    >
      <svg
        className="h-full w-full stroke-current text-sky-950 dark:text-sky-200"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          <pattern
            id="cw-whatsapp-doodles"
            x="0"
            y="0"
            width="160"
            height="160"
            patternUnits="userSpaceOnUse"
          >
            {/* 1. Mini Recycled Plastic Bottle (top-left) */}
            <g transform="translate(18, 14) rotate(12)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2" width="6" height="3" rx="0.75" />
              <path d="M7 5 V8 C7 11 3 13 3 16 V32 C3 34.5 4.8 36 9 36 C13.2 36 15 34.5 15 32 V16 C15 13 11 11 11 8 V5" />
              {/* Bottle ribs */}
              <line x1="4" y1="20" x2="14" y2="20" strokeDasharray="1.5 1" />
              <line x1="4" y1="26" x2="14" y2="26" strokeDasharray="1.5 1" />
              {/* Mini Recycle Arrow on bottle */}
              <path d="M7.5 22.5 L9 21 L9.5 23.5" />
              <path d="M9 22 C10 23 9.5 24.5 8 25" />
            </g>

            {/* 2. Mini Geometric Whale (top-center) */}
            <g transform="translate(68, 16) scale(0.015)" fill="currentColor" stroke="none">
              <polygon points="398,951 1371,848 1862,960 1904,1164 1731,1053 1257,1395 1111,1615 941,1429 400,1247" />
            </g>

            {/* 3. Mini OOH Display Billboard (top-right) */}
            <g transform="translate(122, 16)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="0" y="0" width="22" height="14" rx="1.5" />
              <line x1="4" y1="14" x2="4" y2="22" />
              <line x1="18" y1="14" x2="18" y2="22" />
              <circle cx="6" cy="5" r="1.5" fill="currentColor" />
              <path d="M10 10 L14 6 L18 10" />
            </g>

            {/* 4. Mini Eco Leaf / Sprout (upper-center right) */}
            <g transform="translate(138, 52)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 14 C2 6 8 2 14 2 C14 8 10 14 2 14 Z" />
              <path d="M2 14 C6 10 10 6 14 2" />
            </g>

            {/* 5. Mini Water Droplets / Splash (upper-left) */}
            <g transform="translate(32, 60)" strokeWidth="1.1" strokeLinecap="round">
              <path d="M6 2 C6 2 2 7 2 9 C2 11.2 3.8 13 6 13 C8.2 13 10 11.2 10 9 C10 7 6 2 6 2 Z" />
              <circle cx="16" cy="11" r="1.5" fill="currentColor" stroke="none" />
            </g>

            {/* 6. Mini 3-Arrow Recycling Loop (center) */}
            <g transform="translate(78, 62)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2 L13 6 L7 6 Z" fill="currentColor" />
              <path d="M10 5 C15 5 18 8 18 13" />
              <path d="M18 13 L15 15 L19 18 Z" fill="currentColor" />
              <path d="M17 14 C15 18 11 20 6 19" />
              <path d="M4 16 L2 12 L6 13 Z" fill="currentColor" />
              <path d="M4 14 C3 10 6 6 9 5" />
            </g>

            {/* 7. Mini Map Location Pin (center-right) */}
            <g transform="translate(118, 86)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1 C4.1 1 1 4.1 1 8 C1 13.5 8 19 8 19 C8 19 15 13.5 15 8 C15 4.1 11.9 1 8 1 Z" />
              <circle cx="8" cy="8" r="2.5" />
            </g>

            {/* 8. Mini Whale Tail Fluke Splash (mid-left) */}
            <g transform="translate(14, 102)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 18 C12.5 13 9.5 10.5 4 9.5 C7 8.5 10.5 9.5 13 12.5 C15.5 9.5 19 8.5 22 9.5 C16.5 10.5 13.5 13 13 18 Z" />
              <circle cx="8" cy="4" r="1" fill="currentColor" stroke="none" />
              <circle cx="18" cy="4" r="1" fill="currentColor" stroke="none" />
            </g>

            {/* 9. Mini Ocean Wave Ripple (bottom-center left) */}
            <g transform="translate(54, 114)" strokeWidth="1.2" strokeLinecap="round">
              <path d="M0 6 C4 3 8 9 12 6 C16 3 20 9 24 6" />
              <path d="M3 11 C7 8 11 14 15 11 C19 8 23 14 27 11" strokeDasharray="1.5 1.5" />
            </g>

            {/* 10. Mini Workflow Clock / Cadence Timer (bottom-center right) */}
            <g transform="translate(94, 118)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="7" />
              <polyline points="8 4 8 8 11 10" />
            </g>

            {/* 11. Mini Sparkle Star (bottom-right) */}
            <g transform="translate(138, 126)" strokeWidth="1.2" strokeLinecap="round">
              <line x1="6" y1="1" x2="6" y2="11" />
              <line x1="1" y1="6" x2="11" y2="6" />
            </g>

            {/* 12. Mini Second Plastic Bottle (bottom-center, angled opposite) */}
            <g transform="translate(68, 138) rotate(-20)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="1" width="4" height="2" rx="0.5" />
              <path d="M4.5 3 V5 C4.5 7 2 8 2 10 V20 C2 21.5 3 22.5 6 22.5 C9 22.5 10 21.5 10 20 V10 C10 8 7.5 7 7.5 5 V3" />
            </g>

            {/* 13. Mini Wave Accent (bottom-left) */}
            <g transform="translate(18, 146)" strokeWidth="1.1" strokeLinecap="round">
              <path d="M0 4 C3 2 6 6 9 4 C12 2 15 6 18 4" />
            </g>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#cw-whatsapp-doodles)" />
      </svg>
    </div>
  );
}
