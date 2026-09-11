/**
 * Supabase Storage Image Transformation & Optimization Helpers
 */

/**
 * Returns an optimized image URL for a given Supabase storage asset.
 * If the image is hosted on Supabase Storage, it attempts to use the render endpoint.
 *
 * @param {string} url - Original public image URL
 * @param {Object} options - { width, height, quality, resize }
 * @returns {string} Optimized URL or original URL
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== "string") return "";

  const { width, height, quality = 80, resize = "cover" } = options;

  // Check if it's a Supabase storage object URL
  const supabaseStorageRegex = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
  const match = url.match(supabaseStorageRegex);

  if (match) {
    const bucket = match[1];
    const path = match[2];
    const baseUrl = url.substring(0, url.indexOf("/storage/v1/"));

    const params = new URLSearchParams();
    if (width) params.set("width", width.toString());
    if (height) params.set("height", height.toString());
    if (quality) params.set("quality", quality.toString());
    if (resize) params.set("resize", resize);

    return `${baseUrl}/storage/v1/render/image/public/${bucket}/${path}?${params.toString()}`;
  }

  return url;
}

/**
 * Common thumbnail presets
 */
export const IMAGE_PRESETS = {
  avatar: { width: 96, height: 96, resize: "cover", quality: 80 },
  card: { width: 480, height: 320, resize: "cover", quality: 80 },
  tableThumb: { width: 80, height: 80, resize: "cover", quality: 75 },
  hero: { width: 1280, height: 720, resize: "contain", quality: 85 },
  mapPopup: { width: 360, height: 200, resize: "cover", quality: 80 },
};
