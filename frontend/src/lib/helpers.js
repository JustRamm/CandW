// File upload helpers — use Supabase Storage instead of the old /api/uploads endpoint.
import { supabase } from "@/lib/supabase";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import sound from "@/lib/sound";

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export async function uploadFile(file, { label = "", geo = "" } = {}) {
  const cleanExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fileId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const path = `${fileId}.${cleanExt}`;
  
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) throw new ApiError(400, { detail: uploadError.message });

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: fileId,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size: file.size || 0,
      label,
      geo,
      storage_path: path,
      url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    // Bug #3 fix: do NOT silently return — throw so callers know the document wasn't tracked.
    // The file is already in storage; the caller can retry or surface the error to the user.
    throw new ApiError(500, { detail: `File uploaded but record could not be saved: ${insertError.message}` });
  }
  return { id: doc.id, filename: doc.filename, content_type: doc.content_type, size: doc.size, url: doc.url };
}

export async function uploadMany(files, opts) {
  const out = [];
  for (const f of Array.from(files)) out.push(await uploadFile(f, opts));
  return out;
}

/**
 * RFC 4180 compliant CSV parser:
 * - Properly handles quoted fields containing commas and line breaks
 * - Unescapes double-double quotes ("" -> ")
 * - Strips UTF-8 Byte Order Mark (\uFEFF)
 */
export function parseCsv(text) {
  if (!text) return [];
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((col) => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((col) => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Live Dynamic Geocoding Engine
 * Queries real-time OpenStreetMap Nominatim and Photon Geocoders for ANY mall, venue, station, or landmark.
 * No hardcoded coordinates — dynamically handles new malls and custom venues added by users.
 */
/** Comprehensive Kerala Mall & Metro Station reference coordinates */
export const KNOWN_KERALA_VENUES = {
  // LuLu Group Malls
  "lulu kochi": { lat: 10.0275, lng: 76.3081, district: "Ernakulam", city: "Edappally, Kochi" },
  "lulu tvm": { lat: 8.4897, lng: 76.9063, district: "Thiruvananthapuram", city: "Akkulam, Thiruvananthapuram" },
  "lulu thiruvananthapuram": { lat: 8.4897, lng: 76.9063, district: "Thiruvananthapuram", city: "Akkulam, Thiruvananthapuram" },
  "lulu kottayam": { lat: 9.5843, lng: 76.5367, district: "Kottayam", city: "Kottayam" },
  "lulu thrissur": { lat: 10.5362, lng: 76.2215, district: "Thrissur", city: "Thrissur" },
  "lulu calicut": { lat: 11.2687, lng: 75.7924, district: "Kozhikode", city: "Mankavu, Kozhikode" },
  "lulu kozhikode": { lat: 11.2687, lng: 75.7924, district: "Kozhikode", city: "Mankavu, Kozhikode" },

  // HiLite Group Malls
  "hilite calicut": { lat: 11.2505, lng: 75.8340, district: "Kozhikode", city: "Poovangal, Kozhikode" },
  "hilite kozhikode": { lat: 11.2505, lng: 75.8340, district: "Kozhikode", city: "Poovangal, Kozhikode" },
  "hilite thrissur": { lat: 10.5186, lng: 76.2163, district: "Thrissur", city: "Puzhakkal, Thrissur" },
  "hilite chemmad": { lat: 11.0425, lng: 75.9234, district: "Malappuram", city: "Chemmad, Malappuram" },
  "hilite malappuram": { lat: 11.0734, lng: 76.0740, district: "Malappuram", city: "Malappuram" },

  // Other Premium & Regional Malls
  "oberon kochi": { lat: 10.0158, lng: 76.3113, district: "Ernakulam", city: "Edappally, Kochi" },
  "oberon mall": { lat: 10.0158, lng: 76.3113, district: "Ernakulam", city: "Edappally, Kochi" },
  "centre square": { lat: 9.9765, lng: 76.2828, district: "Ernakulam", city: "MG Road, Kochi" },
  "center square": { lat: 9.9765, lng: 76.2828, district: "Ernakulam", city: "MG Road, Kochi" },
  "sobha city": { lat: 10.5562, lng: 76.1824, district: "Thrissur", city: "Puzhakkal, Thrissur" },
  "shobha city": { lat: 10.5562, lng: 76.1824, district: "Thrissur", city: "Puzhakkal, Thrissur" },
  "falcon thrissur": { lat: 10.5276, lng: 76.2144, district: "Thrissur", city: "Thrissur" },
  "falcon mall": { lat: 10.5276, lng: 76.2144, district: "Thrissur", city: "Thrissur" },
  "kannur secura": { lat: 11.8745, lng: 75.3704, district: "Kannur", city: "Kannur" },
  "secura kannur": { lat: 11.8745, lng: 75.3704, district: "Kannur", city: "Kannur" },
  "secura centre": { lat: 11.8745, lng: 75.3704, district: "Kannur", city: "Kannur" },
  "mall of travancore": { lat: 8.4856, lng: 76.9312, district: "Thiruvananthapuram", city: "Chakai, Thiruvananthapuram" },
  "mot": { lat: 8.4856, lng: 76.9312, district: "Thiruvananthapuram", city: "Chakai, Thiruvananthapuram" },
  "gokulam mall": { lat: 11.2588, lng: 75.7804, district: "Kozhikode", city: "Kozhikode" },
  "y mall": { lat: 10.5052, lng: 76.2155, district: "Thrissur", city: "Triprayar, Thrissur" },

  // Kochi Metro Stations
  "edappally metro": { lat: 10.0245, lng: 76.3075, district: "Ernakulam", city: "Kochi" },
  "edappally": { lat: 10.0245, lng: 76.3075, district: "Ernakulam", city: "Kochi" },
  "aluva metro": { lat: 10.1082, lng: 76.3533, district: "Ernakulam", city: "Aluva, Kochi" },
  "aluva": { lat: 10.1082, lng: 76.3533, district: "Ernakulam", city: "Aluva, Kochi" },
  "town hall metro": { lat: 9.9922, lng: 76.2877, district: "Ernakulam", city: "Kochi" },
  "town hall": { lat: 9.9922, lng: 76.2877, district: "Ernakulam", city: "Kochi" },
  "ernakulam south": { lat: 9.9678, lng: 76.2912, district: "Ernakulam", city: "Kochi" },
  "vytilla metro": { lat: 9.9658, lng: 76.3204, district: "Ernakulam", city: "Kochi" },
  "vytilla": { lat: 9.9658, lng: 76.3204, district: "Ernakulam", city: "Kochi" },
  "thrippunithura": { lat: 9.9482, lng: 76.3508, district: "Ernakulam", city: "Kochi" },
  "tripunithura": { lat: 9.9482, lng: 76.3508, district: "Ernakulam", city: "Kochi" },
  "kalamassery": { lat: 10.0468, lng: 76.3175, district: "Ernakulam", city: "Kochi" },
  "palarivattom": { lat: 10.0052, lng: 76.3068, district: "Ernakulam", city: "Kochi" },
  "pulinchode": { lat: 10.0963, lng: 76.3472, district: "Ernakulam", city: "Kochi" },
  "companypady": { lat: 10.0825, lng: 76.3392, district: "Ernakulam", city: "Kochi" },
  "ambattukavu": { lat: 10.0718, lng: 76.3325, district: "Ernakulam", city: "Kochi" },
  "muttom": { lat: 10.0601, lng: 76.3262, district: "Ernakulam", city: "Kochi" },
  "cusat": { lat: 10.0401, lng: 76.3195, district: "Ernakulam", city: "Kochi" },
  "pathadipalam": { lat: 10.0335, lng: 76.3148, district: "Ernakulam", city: "Kochi" },
  "jln stadium": { lat: 10.0001, lng: 76.3005, district: "Ernakulam", city: "Kochi" },
  "kadavanthra": { lat: 9.9672, lng: 76.2998, district: "Ernakulam", city: "Kochi" },
  "vadakkekotta": { lat: 9.9515, lng: 76.3440, district: "Ernakulam", city: "Kochi" },
  "thaikoodam": { lat: 9.9610, lng: 76.3312, district: "Ernakulam", city: "Kochi" },
  "petta": { lat: 9.9575, lng: 76.3395, district: "Ernakulam", city: "Kochi" },
  "sn junction": { lat: 9.9535, lng: 76.3430, district: "Ernakulam", city: "Kochi" },
  "maharajas": { lat: 9.9723, lng: 76.2845, district: "Ernakulam", city: "Kochi" },
  "mg road": { lat: 9.9816, lng: 76.2828, district: "Ernakulam", city: "Kochi" },
  "kaloor": { lat: 9.9952, lng: 76.2915, district: "Ernakulam", city: "Kochi" },
  "changampuzha": { lat: 10.0152, lng: 76.3045, district: "Ernakulam", city: "Kochi" },
};

/**
 * Live Dynamic Geocoding Engine
 * 1. Checks fast instant venue dictionary for known Kerala Malls and Metro stations.
 * 2. Queries real-time OpenStreetMap Nominatim and Photon Geocoders for ANY other custom mall or venue.
 */
export async function fetchCoordinatesForLocation(query, district = "") {
  if (!query || query.trim().length < 2) return null;

  const rawQuery = query.trim();
  const lower = rawQuery.toLowerCase();

  // 1. Instant match in known Kerala venues dictionary
  for (const [key, val] of Object.entries(KNOWN_KERALA_VENUES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return {
        lat: val.lat,
        lng: val.lng,
        district: val.district,
        city: val.city,
        displayName: rawQuery,
        source: "Kerala Venue Registry",
      };
    }
  }

  // 2. Clean query: strip section / atrium / platform descriptors to extract core venue name
  const baseVenueName = rawQuery
    .split(/[—–-]/)[0]
    .replace(/\b(ground|first|second|third|4th|5th|atrium|concourse|platform|gate|corridor|entry|exit|floor|level|phase|block)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Check dictionary again with cleaned venue name
  const cleanLower = baseVenueName.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_KERALA_VENUES)) {
    if (cleanLower.includes(key) || key.includes(cleanLower)) {
      return {
        lat: val.lat,
        lng: val.lng,
        district: val.district,
        city: val.city,
        displayName: rawQuery,
        source: "Kerala Venue Registry",
      };
    }
  }

  const searchCandidates = [
    `${rawQuery}, ${district || "Kerala"}, India`,
    `${baseVenueName}, ${district || "Kerala"}, India`,
    `${baseVenueName}, India`,
    rawQuery,
  ];

  // Try Nominatim with progressive query broadening
  for (const qStr of searchCandidates) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qStr)}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
            lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
            displayName: data[0].display_name,
            source: "OpenStreetMap",
          };
        }
      }
    } catch {
      // Continue to next candidate or fallback
    }
  }

  // Fallback: Photon Komoot OpenStreetMap POI engine
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(`${baseVenueName || rawQuery} Kerala`)}&limit=1`
    );
    if (photonRes.ok) {
      const pData = await photonRes.json();
      if (pData?.features?.length > 0) {
        const coords = pData.features[0].geometry.coordinates; // [lng, lat]
        return {
          lat: parseFloat(coords[1].toFixed(6)),
          lng: parseFloat(coords[0].toFixed(6)),
          displayName: pData.features[0].properties.name || baseVenueName,
          source: "Photon OSM",
        };
      }
    }
  } catch {
    // Dynamic lookup complete
  }

  return null;
}

/**
 * Parses coordinates from any Google Maps URL or raw coordinate string.
 * Supports:
 * - Desktop/Browser URLs with /@lat,lng/ (e.g. https://www.google.com/maps/place/.../@10.027548,76.308105,17z/...)
 * - Search URLs with ?q=lat,lng or ?ll=lat,lng (e.g. https://maps.google.com/?q=10.027548,76.308105)
 * - Embed / Place URLs with !3dlat!4dlng (e.g. !3d10.027548!4d76.308105)
 * - Raw comma-separated coordinate strings (e.g. "10.027548, 76.308105")
 */
export function parseGoogleMapsUrl(text) {
  if (!text || typeof text !== "string") return null;
  const str = text.trim();

  // 1. Direct "@lat,lng" format from Google Maps URL path
  const atMatch = str.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, source: "Google Maps URL" };
    }
  }

  // 2. Query param "?q=lat,lng" or "?ll=lat,lng" or "?center=lat,lng"
  const qMatch = str.match(/[?&](?:q|ll|center|daddr|saddr)=([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, source: "Google Maps Query" };
    }
  }

  // 3. Embedded data "!3dlat!4dlng"
  const dataMatch = str.match(/!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, source: "Google Maps Data" };
    }
  }

  // 4. Raw "lat, lng" coordinates (e.g. "10.027548, 76.308105")
  const rawMatch = str.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, source: "GPS Coordinates" };
    }
  }

  return null;
}

/** Obtains device's live GPS hardware coordinates with high accuracy */
export function getCurrentDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          source: "Device GPS",
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export async function importAssetsCsv(file) {
  const text = await file.text();
  const parsedRows = parseCsv(text);
  if (parsedRows.length < 2) {
    return { created: 0, updated: 0, total: 0, codes: [], errors: ["File is empty or contains only headers"] };
  }

  // Normalize headers: lowercase, trim, spaces/dashes to underscores
  const rawHeaders = parsedRows[0];
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/^"|"$/g, "")
  );

  const dataRows = parsedRows.slice(1);
  const created = [];
  const updated = [];
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const values = dataRows[i];
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });

    try {
      // Flexible field resolution
      let assetCode = (row.asset_code || row.code || row.id || "").trim();
      const locationName = (
        row.location_name ||
        row.location ||
        row.property ||
        row.location_property ||
        row["location_/_property"] ||
        row.station_name ||
        row.station ||
        row.station_cluster ||
        row.mall ||
        row.mall_name ||
        row.venue ||
        row.name ||
        ""
      ).trim();

      const isMetro =
        Boolean(row.station_name || row.station || row.station_cluster) ||
        /metro|station/i.test(locationName) ||
        (row.location_type || "").toLowerCase() === "metro";

      const assetType = (
        row.asset_type ||
        row.type ||
        row.segment ||
        (isMetro ? "Metro Bench" : "Digital Screen")
      ).trim();

      let locationCode = (row.location_code || row.loc_code || "").trim().toUpperCase();

      // If location_code is missing, derive it from asset_code or location_name
      if (!locationCode) {
        if (assetCode.includes("-")) {
          const parts = assetCode.split("-");
          locationCode = parts[1]?.toUpperCase() || "LOC";
        } else if (locationName) {
          locationCode = locationName
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 5)
            .toUpperCase() || "LOC";
        } else {
          locationCode = "LOC";
        }
      }

      // If asset_code is missing, generate sequential code: TYPE-LOC-NNN
      if (!assetCode) {
        const prefix = `${assetType.toUpperCase().replace(/\s+/g, "").slice(0, 5)}-${locationCode}`;
        const { count } = await supabase
          .from("assets")
          .select("*", { count: "exact", head: true })
          .like("asset_code", `${prefix}-%`);
        assetCode = `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;
      }

      // Flexible Status Resolution: maps booked, vacant, active, expired to standard stages
      const rawStatus = (row.status || "").trim().toLowerCase();
      let status = "available";
      if (rawStatus === "booked" || rawStatus === "live" || rawStatus === "active") {
        status = "live";
      } else if (rawStatus === "reserved" || rawStatus === "queue") {
        status = "reserved";
      } else if (rawStatus === "onboarding") {
        status = "onboarding";
      } else if (rawStatus === "closing" || rawStatus === "expired" || rawStatus === "expiring") {
        status = "closing";
      } else if (rawStatus === "closed") {
        status = "closed";
      } else {
        status = "available";
      }

      let lat = parseFloat(row.latitude || row.lat);
      let lng = parseFloat(row.longitude || row.lng || row.long);
      let derivedCity = (row.city || row.area || "").trim();
      let derivedDistrict = (row.district || row.city || "").trim();

      const rawMapUrl = (
        row.map_url ||
        row.map_link ||
        row.google_maps_url ||
        row.maps_url ||
        row.location_link ||
        row.gmaps_url ||
        row.gmaps_link ||
        ""
      ).trim();

      // Extract GPS directly if Google Maps URL or raw coordinates were provided
      if (rawMapUrl) {
        const parsedMapsCoords = parseGoogleMapsUrl(rawMapUrl);
        if (parsedMapsCoords) {
          if (isNaN(lat) || isNaN(lng)) {
            lat = parsedMapsCoords.lat;
            lng = parsedMapsCoords.lng;
          }
        }
      }

      // Auto-resolve coordinates and district from venue lookup if missing
      if ((isNaN(lat) || isNaN(lng) || !derivedDistrict) && locationName) {
        const autoGeo = await fetchCoordinatesForLocation(locationName, derivedDistrict || derivedCity);
        if (autoGeo) {
          if (isNaN(lat) || isNaN(lng)) {
            lat = autoGeo.lat;
            lng = autoGeo.lng;
          }
          if (!derivedDistrict && autoGeo.district) derivedDistrict = autoGeo.district;
          if (!derivedCity && autoGeo.city) derivedCity = autoGeo.city;
        }
      }

      const radius = parseInt(
        row.geofence_radius_m ||
          row.geofence_radius ||
          row.geofence ||
          row.geofence_status ||
          row.radius,
        10
      );

      // Parse brand details: supports brand_name, brand_1/2, brand_names, and inline notes extraction
      const brandList = [];
      if (row.brand_1) brandList.push(row.brand_1.trim());
      if (row.brand_2) brandList.push(row.brand_2.trim());
      if (row.brand_name) {
        row.brand_name.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.brand) {
        row.brand.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.brands || row.brand_names) {
        const multi = row.brands || row.brand_names;
        multi.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.current_brand) {
        row.current_brand.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }

      // If no explicit brand column, extract brand from notes/description e.g. "Active (DDRC Agilus Pathlab) / Vacant"
      const notesText = (row.notes || row.description || "").trim();
      if (!brandList.length && notesText) {
        const activeMatch = notesText.match(/(?:Active|Live|Booked)\s*\(([^)]+)\)/i);
        const expiredMatch = notesText.match(/Expired\s*\(([^)]+)\)/i);
        const matchedStr = activeMatch ? activeMatch[1] : expiredMatch ? expiredMatch[1] : null;
        if (matchedStr && matchedStr.trim()) {
          matchedStr.split(/[/,]/).forEach((b) => {
            const trimmed = b.replace(/\(\d+\)/g, "").trim();
            if (trimmed && trimmed.toLowerCase() !== "vacant" && !brandList.includes(trimmed)) {
              brandList.push(trimmed);
            }
          });
          if (activeMatch) status = "live";
          if (expiredMatch && status === "available") status = "closing";
        }
      }

      const currentBrandSummary = brandList.length ? brandList.join(", ") : (row.current_brand || "").trim();
      const startDate = (row.start_date || row.campaign_start_date || "").trim();
      const endDate = (row.end_date || row.campaign_end_date || "").trim();

      // Normalize asset type: e.g. "Ad Bench" with location_type "Metro" -> "Metro Bench", "Mall" -> "Mall Bench"
      let normalizedAssetType = assetType;
      if (assetType.toLowerCase() === "ad bench") {
        normalizedAssetType = (row.location_type || "").toLowerCase() === "metro" ? "Metro Bench" : "Mall Bench";
      }

      const payload = {
        asset_type: normalizedAssetType,
        location_type: (row.location_type || (isMetro ? "Metro" : "Mall")).trim(),
        location_code: locationCode,
        location_name: locationName || `${locationCode} Display`,
        city: (derivedCity || derivedDistrict || "Ernakulam").trim(),
        district: (derivedDistrict || derivedCity || "Ernakulam").trim(),
        width_ft: parseFloat(row.width_ft || row.width) || 10,
        height_ft: parseFloat(row.height_ft || row.height) || 4,
        photo_url: (row.photo_url || row.photo || row.image || "").trim(),
        description: (row.description || row.desc || "").trim(),
        notes: (row.notes || "").trim(),
        current_brand: currentBrandSummary || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
        latitude: !isNaN(lat) ? lat : null,
        longitude: !isNaN(lng) ? lng : null,
        map_url: rawMapUrl || (!isNaN(lat) && !isNaN(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null),
        geofence_radius_m: !isNaN(radius) && radius > 0 ? radius : 500,
      };

      // Check if asset already exists
      const { data: existing } = await supabase
        .from("assets")
        .select("id")
        .eq("asset_code", assetCode)
        .maybeSingle();

      let targetAssetId = existing?.id;

      if (existing) {
        // Update existing record
        const { error: updateErr } = await supabase
          .from("assets")
          .update(payload)
          .eq("id", existing.id);
        if (updateErr) throw new Error(updateErr.message);
        updated.push(assetCode);
      } else {
        // Insert new record
        targetAssetId = randomId();
        const { error: insertErr } = await supabase
          .from("assets")
          .insert({
            id: targetAssetId,
            asset_code: assetCode,
            photo_ids: [],
            created_at: new Date().toISOString(),
            ...payload,
          });
        if (insertErr) throw new Error(insertErr.message);
        created.push(assetCode);
      }

      // Link brand details and auto-create campaigns if brand details were included
      if (brandList.length > 0 && targetAssetId) {
        const campStartDate = startDate || new Date().toISOString().split("T")[0];
        const campEndDate =
          endDate ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const durationDays = Math.max(
          1,
          Math.round(
            (new Date(campEndDate) - new Date(campStartDate)) / (1000 * 60 * 60 * 24)
          )
        );

        for (const bName of brandList) {
          // Check if brand exists in brands table
          let brandId = null;
          const { data: existingBrand } = await supabase
            .from("brands")
            .select("id")
            .ilike("name", bName)
            .maybeSingle();

          if (existingBrand) {
            brandId = existingBrand.id;
          } else {
            const newBId = randomId();
            const { data: createdBrand } = await supabase
              .from("brands")
              .insert({
                id: newBId,
                name: bName,
                created_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();
            brandId = createdBrand?.id || newBId;
          }

          // Check if active campaign already exists on this asset for this brand
          const { data: existingCamp } = await supabase
            .from("campaigns")
            .select("id")
            .eq("asset_id", targetAssetId)
            .ilike("brand", bName)
            .neq("stage", "closed")
            .maybeSingle();

          if (!existingCamp) {
            await supabase.from("campaigns").insert({
              id: randomId(),
              asset_id: targetAssetId,
              asset_code: assetCode,
              brand_id: brandId,
              brand: bName,
              stage: payload.status === "live" ? "live" : "onboarding",
              priority: "high",
              start_date: campStartDate,
              end_date: campEndDate,
              duration_days: durationDays,
              proposed_duration_days: durationDays,
              notes:
                brandList.length > 1
                  ? "Multi-Brand Ad Loop Slot (Imported from CSV)"
                  : "Exclusive Brand Slot (Imported from CSV)",
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return {
    created: created.length,
    updated: updated.length,
    total: created.length + updated.length,
    codes: [...created, ...updated],
    errors,
  };
}

export function errMessage(err, fallback = "Something went wrong") {
  const d = err?.body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(", ");
  return err?.message || fallback;
}

export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    toast.info("No records to export");
    return false;
  }

  // Collect all unique keys from all rows to ensure no columns are omitted
  const headerSet = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const esc = (v) => {
    if (v === null || v === undefined) return '""';
    if (typeof v === "object") {
      return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    }
    return `"${String(v).replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\r\n");

  const cleanFilename = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;

  // \uFEFF Byte Order Mark ensures correct character encoding when opened in Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cleanFilename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);

  sound.success();
  toast.success(`Exported ${cleanFilename}`, {
    description: `${rows.length} record(s) downloaded successfully.`,
  });
  return true;
}

/** Downloads a ready-to-use CSV template for importing assets */
export function downloadAssetCsvTemplate() {
  sound.click();
  const sampleRows = [
    {
      asset_code: "DIGIT-LULUTVM-001",
      asset_type: "Digital Screen",
      location_code: "LULUTVM",
      location_name: "Lulu Mall TVM — Ground Atrium",
      location_type: "Mall",
      city: "Thiruvananthapuram",
      district: "Thiruvananthapuram",
      width_ft: 12,
      height_ft: 6,
      brand_names: "Nike, Adidas",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      map_url: "https://maps.google.com/?q=8.4975,76.9038",
      latitude: 8.4975,
      longitude: 76.9038,
      geofence_radius_m: 500,
      status: "live",
      description: "P4 UHD Digital Totem Display with 2-brand rotation loop",
      notes: "Main atrium entrance facing central escalator",
    },
    {
      asset_code: "METRO-MG-001",
      asset_type: "Backlit Static",
      location_code: "MG",
      location_name: "MG Road Metro Station",
      location_type: "Metro",
      city: "Kochi",
      district: "Ernakulam",
      width_ft: 10,
      height_ft: 4,
      brand_name: "Tata Motors",
      start_date: "2026-10-01",
      end_date: "2026-11-30",
      map_url: "https://maps.google.com/?q=9.9723,76.2845",
      latitude: 9.9723,
      longitude: 76.2845,
      geofence_radius_m: 300,
      status: "live",
      description: "Backlit flex display panel",
      notes: "Concourse ticketing hall entrance",
    },
    {
      asset_code: "MALL-CSMK-002",
      asset_type: "Mall Bench",
      location_code: "CSMK",
      location_name: "Center Square Mall Kochi — 2nd Floor",
      location_type: "Mall",
      city: "Kochi",
      district: "Ernakulam",
      width_ft: 6,
      height_ft: 3,
      brand_name: "",
      start_date: "",
      end_date: "",
      map_url: "https://maps.google.com/?q=9.9765,76.2825",
      latitude: 9.9765,
      longitude: 76.2825,
      geofence_radius_m: 400,
      status: "available",
      description: "Branded seating bench unit",
      notes: "Food court corridor",
    },
  ];
  return downloadCsv("assets_import_template.csv", sampleRows);
}

export const STAGE_LABELS = {
  onboarding: "Onboarding",
  invoicing: "Invoice Pending",
  live: "Live",
  closing: "Closing",
  closed: "Closed",
};

export const ASSET_STATUS_LABELS = {
  available: "Available",
  reserved: "In Queue",
  onboarding: "Onboarding",
  live: "Live",
};

export const REASON_LABELS = {
  advance_payment: "Advance Payment",
  signed_agreement: "Signed Agreement",
  purchase_order: "Purchase Order",
  invoice: "Invoice Raised",
};

export function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(v) {
  if (v == null) return "—";
  return `₹${Number(v).toLocaleString("en-IN")}`;
}
