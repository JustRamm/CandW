/**
 * Carbon & Whale · OOH Geospatial Intelligence & Density Engine
 * Traffic volume, demographic footfall, arterial road networks,
 * and algorithmic impression calculations for billboard inventory.
 */

// ── 1. Peak Hour Time Curves & Multipliers ──────────────────────────────────
export const TIME_SLOTS = [
  { id: "morning", label: "Morning Rush", time: "08:00 – 11:00", factor: 1.45, desc: "High commuter traffic, arterial bottlenecks, metro transit" },
  { id: "midday", label: "Midday Commerce", time: "11:00 – 16:00", factor: 1.10, desc: "Steady commercial flow, retail shopper arrivals" },
  { id: "evening", label: "Evening Peak", time: "17:00 – 21:00", factor: 1.85, desc: "Maximum footfall at malls, return highway commute, prime dwell time" },
  { id: "night", label: "Late Night", time: "22:00 – 06:00", factor: 0.35, desc: "Inter-city freight, late entertainment, reduced pedestrian count" },
];

// ── 2. Curated Urban Traffic & Footfall Heatmap Anchors ──────────────────────
// Each anchor point has coordinates [lat, lng], density intensity [0.1 - 1.0], and radius (meters)
export const TRAFFIC_HEAT_NODES = [
  // Kochi / Ernakulam Arterials
  { name: "Edappally Toll Bypass Junction", coords: [10.0261, 76.3082], intensity: 0.98, radius: 450, vph: 14200 },
  { name: "Palarivattom Flyover Junction", coords: [10.0034, 76.3072], intensity: 0.94, radius: 420, vph: 12800 },
  { name: "Kaloor Stadium Link Road", coords: [9.9984, 76.2995], intensity: 0.88, radius: 380, vph: 11200 },
  { name: "MG Road North End (Madhava Pharmacy)", coords: [9.9882, 76.2845], intensity: 0.91, radius: 350, vph: 11900 },
  { name: "MG Road South End (Jos Junction)", coords: [9.9678, 76.2869], intensity: 0.89, radius: 360, vph: 10800 },
  { name: "Vyttila Mobility Hub", coords: [9.9676, 76.3195], intensity: 1.00, radius: 520, vph: 16500 },
  { name: "Kundanur Highway Interchange", coords: [9.9392, 76.3218], intensity: 0.92, radius: 480, vph: 13400 },
  { name: "Infopark Expressway (Kakkanad)", coords: [10.0094, 76.3639], intensity: 0.95, radius: 450, vph: 13800 },
  { name: "Marine Drive Promenade", coords: [9.9818, 76.2755], intensity: 0.78, radius: 340, vph: 8500 },
  { name: "Aluva Bypass Flyover", coords: [10.1076, 76.3516], intensity: 0.89, radius: 460, vph: 12100 },

  // Thiruvananthapuram Arterials
  { name: "Technopark Phase 1 Main Gate", coords: [8.5581, 76.8812], intensity: 0.95, radius: 440, vph: 13900 },
  { name: "Pattom Junction Ring Road", coords: [8.5284, 76.9443], intensity: 0.90, radius: 380, vph: 11500 },
  { name: "Thampanoor Central Terminal", coords: [8.4891, 76.9535], intensity: 0.96, radius: 460, vph: 14800 },
  { name: "Kowdiar Avenue Corridor", coords: [8.5247, 76.9602], intensity: 0.84, radius: 350, vph: 9800 },

  // Kozhikode Arterials
  { name: "Mavoor Road Bus Stand Junction", coords: [11.2588, 75.7925], intensity: 0.92, radius: 410, vph: 12400 },
  { name: "Calicut Bypass (Palazhi)", coords: [11.2482, 75.8341], intensity: 0.89, radius: 450, vph: 11800 },

  // Bangalore Arterials
  { name: "Silk Board Junction", coords: [12.9172, 77.6228], intensity: 1.00, radius: 550, vph: 18500 },
  { name: "Hebbal Flyover Corridor", coords: [13.0358, 77.597], intensity: 0.96, radius: 500, vph: 15900 },
  { name: "Indiranagar 100ft Road", coords: [12.9719, 77.6412], intensity: 0.90, radius: 380, vph: 12300 },
];

export const FOOTFALL_HEAT_NODES = [
  // Major Kerala Malls & High-Street Retail
  { name: "Lulu International Mall Kochi", coords: [10.0275, 76.308], intensity: 1.00, radius: 480, dailyFootfall: 75000 },
  { name: "Center Square Mall Kochi", coords: [9.9796, 76.2842], intensity: 0.92, radius: 360, dailyFootfall: 42000 },
  { name: "Oberon Mall Kochi", coords: [10.0169, 76.3115], intensity: 0.85, radius: 320, dailyFootfall: 28000 },
  { name: "Forum Kochi (Maradu)", coords: [9.9482, 76.3265], intensity: 0.94, radius: 420, dailyFootfall: 52000 },
  { name: "Lulu Mall Thiruvananthapuram", coords: [8.5089, 76.8996], intensity: 0.98, radius: 490, dailyFootfall: 68000 },
  { name: "Mall of Travancore (MOT)", coords: [8.4875, 76.9242], intensity: 0.88, radius: 360, dailyFootfall: 35000 },
  { name: "Hilite Mall Kozhikode", coords: [11.2487, 75.8346], intensity: 0.95, radius: 450, dailyFootfall: 58000 },
  { name: "Sobha City Mall Thrissur", coords: [10.5518, 76.1925], intensity: 0.90, radius: 400, dailyFootfall: 44000 },

  // Metro Stations & Transit Nodes
  { name: "Edappally Metro Station", coords: [10.0248, 76.3075], intensity: 0.95, radius: 300, dailyFootfall: 48000 },
  { name: "Aluva Metro Terminal", coords: [10.1082, 76.353], intensity: 0.92, radius: 320, dailyFootfall: 42000 },
  { name: "MG Road Metro Station Kochi", coords: [9.9802, 76.284], intensity: 0.91, radius: 280, dailyFootfall: 39000 },
  { name: "Palarivattom Metro Station", coords: [10.0041, 76.3078], intensity: 0.88, radius: 290, dailyFootfall: 34000 },
];

// ── 3. Arterial Road Corridors (Vector Lines with Traffic Density) ───────────
export const ARTERIAL_CORRIDORS = [
  {
    name: "NH66 Kochi Bypass Arterial Corridor",
    tier: "National Highway / Expressway",
    color: "#ef4444",
    weight: 4,
    trafficLevel: "Severe / High Capacity",
    dailyVehicles: "115,000+ VPD",
    points: [
      [10.075, 76.335],
      [10.045, 76.315],
      [10.026, 76.308], // Edappally
      [10.003, 76.307], // Palarivattom
      [9.9676, 76.3195], // Vyttila
      [9.9392, 76.3218], // Kundannoor
      [9.905, 76.327], // Aroor link
    ],
  },
  {
    name: "Mahatma Gandhi (MG) Road Commercial Spine",
    tier: "Prime Urban Arterial",
    color: "#f59e0b",
    weight: 3.5,
    trafficLevel: "Dense Commercial / High Footfall",
    dailyVehicles: "65,000+ VPD",
    points: [
      [9.992, 76.284],
      [9.985, 76.2842],
      [9.975, 76.285],
      [9.965, 76.287],
    ],
  },
  {
    name: "Infopark – Kakkanad IT Corridor",
    tier: "Corporate Commuter Expressway",
    color: "#06b6d4",
    weight: 3.5,
    trafficLevel: "Peak Commute Concentration",
    dailyVehicles: "72,000+ VPD",
    points: [
      [10.003, 76.307], // Palarivattom
      [10.015, 76.345], // Vazhakkala
      [10.018, 76.362], // Kakkanad Civil Station
      [10.0094, 76.3639], // Infopark
    ],
  },
  {
    name: "Trivandrum Bypass (Kazhakkoottam – Enchakkal)",
    tier: "Airport & IT Corridor",
    color: "#8b5cf6",
    weight: 4,
    trafficLevel: "High Speed Multi-Lane",
    dailyVehicles: "85,000+ VPD",
    points: [
      [8.572, 76.868],
      [8.558, 76.881], // Technopark
      [8.509, 76.899], // Lulu TVM
      [8.485, 76.924], // Airport link
      [8.472, 76.945],
    ],
  },
];

// ── 4. Algorithmic Asset Impression & Demographic Calculator ────────────────
/**
 * Calculates estimated impressions, demographic splits, and CPM for an asset
 * based on its dimensions, location type, city, and active peak hour factor.
 */
export function calculateAssetImpressions(asset, timeSlotId = "evening") {
  if (!asset) return null;

  const slot = TIME_SLOTS.find((s) => s.id === timeSlotId) || TIME_SLOTS[2];
  const factor = slot.factor;

  // Base daily impressions by location type
  let baseDaily = 42000;
  const locType = (asset.location_type || "").toLowerCase();
  const locName = (asset.location_name || "").toLowerCase();

  if (locType.includes("mall") || locName.includes("mall") || locName.includes("atrium")) {
    baseDaily = 58000;
    if (locName.includes("lulu")) baseDaily = 78000;
    else if (locName.includes("center square")) baseDaily = 62000;
  } else if (locType.includes("metro") || locName.includes("metro") || locName.includes("transit")) {
    baseDaily = 65000;
  } else if (locName.includes("bypass") || locName.includes("highway") || locName.includes("junction")) {
    baseDaily = 85000;
  }

  // Size multiplier (larger billboard = larger visual cone & dwell retention)
  const width = Number(asset.width_ft) || 6;
  const height = Number(asset.height_ft) || 3;
  const sqft = width * height;
  const sizeMultiplier = Math.min(1.4, Math.max(0.85, Math.sqrt(sqft / 20)));

  // Final adjusted figures
  const totalDailyImpressions = Math.round(baseDaily * sizeMultiplier);
  const currentHourlyImpressions = Math.round((totalDailyImpressions / 16) * factor);
  const peakHourlyTraffic = Math.round((totalDailyImpressions / 16) * 1.85);

  // Audience Demographic Breakdown (Realistic split by venue)
  let demographics = { commuters: 55, shoppers: 30, techWorkers: 15 };
  if (locType.includes("mall") || locName.includes("mall")) {
    demographics = { commuters: 22, shoppers: 63, techWorkers: 15 };
  } else if (locType.includes("metro")) {
    demographics = { commuters: 68, shoppers: 18, techWorkers: 14 };
  } else if (locName.includes("infopark") || locName.includes("technopark")) {
    demographics = { commuters: 45, shoppers: 10, techWorkers: 45 };
  }

  // Cost Per Mille (CPM) = (Monthly Rate / (Monthly Impressions / 1000))
  const monthlyRate = Number(asset.rate_monthly) || 35000;
  const monthlyImpressions = totalDailyImpressions * 30;
  const cpm = (monthlyRate / (monthlyImpressions / 1000)).toFixed(2);

  // Visibility Grade based on size and location
  let visibilityGrade = "A";
  let dwellTime = "18s – 25s";
  if (sqft >= 32 || baseDaily >= 70000) {
    visibilityGrade = "A+";
    dwellTime = "25s – 40s";
  } else if (sqft < 15) {
    visibilityGrade = "B+";
    dwellTime = "10s – 15s";
  }

  return {
    dailyImpressions: totalDailyImpressions,
    hourlyImpressions: currentHourlyImpressions,
    peakHourlyTraffic,
    demographics,
    cpm: `₹${cpm}`,
    visibilityGrade,
    dwellTime,
    activeSlot: slot,
  };
}
