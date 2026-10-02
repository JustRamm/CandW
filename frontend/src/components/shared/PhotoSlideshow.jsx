import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2 } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import ImageLightbox from "@/components/shared/ImageLightbox";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getAssetVacantPhoto } from "@/lib/helpers";

/**
 * Slideshow over an asset's uploaded photo attachments.
 * Features:
 * - Touch swipe left/right on mobile screens
 * - Click to view full-size high-res in ImageLightbox
 * - `variant="card"` renders the compact grid-card version without controls.
 */
export default function PhotoSlideshow({
  asset,
  variant = "detail",
  className,
  imageClassName,
  fitMode = "cover",
  allowFullscreen = true,
}) {
  const isLive =
    asset?.status === "live" ||
    Boolean(asset?.current_brand && asset?.status !== "available" && asset?.status !== "closed");

  const vacantPhoto = isLive ? null : getAssetVacantPhoto(asset);
  const defaultShots = vacantPhoto ? [vacantPhoto] : [];

  const rawShots = [
    ...(asset?.photo_urls ?? []),
    ...(asset?.photo_url ? [asset.photo_url] : []),
    ...(asset?.proof_photo_url ? [asset.proof_photo_url] : []),
  ].filter(Boolean);

  const filterLiveShots = (list) => {
    if (!isLive) return list;
    return list.filter((u) => u !== "/asset.png" && u !== "/mallasset.png");
  };

  const initialShots = Array.from(new Set(filterLiveShots(rawShots)));
  const [shots, setShots] = useState(initialShots.length > 0 ? initialShots : defaultShots);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Touch Swipe state
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  useEffect(() => {
    let active = true;
    const known = Array.from(new Set(filterLiveShots(rawShots)));

    if (known.length > 0) {
      setShots(known);
      return;
    }

    if (!asset?.photo_ids?.length) {
      setShots(vacantPhoto ? [vacantPhoto] : []);
      return;
    }

    // Fallback: If no direct URLs are available but photo_ids exist, fetch from documents
    supabase
      .from("documents")
      .select("id, url, storage_path")
      .in("id", asset.photo_ids)
      .then(({ data }) => {
        if (!active) return;
        const fetched = (data ?? [])
          .map(
            (d) =>
              d.url ||
              (d.storage_path
                ? supabase.storage.from("documents").getPublicUrl(d.storage_path).data?.publicUrl
                : null),
          )
          .filter(Boolean);
        const combined = Array.from(
          new Set(
            filterLiveShots([
              ...fetched,
              ...(asset?.photo_url ? [asset.photo_url] : []),
              ...(asset?.proof_photo_url ? [asset.proof_photo_url] : []),
            ]),
          ),
        );
        setShots(combined.length > 0 ? combined : (vacantPhoto ? [vacantPhoto] : []));
      });

    return () => {
      active = false;
    };
  }, [
    asset?.id,
    asset?.status,
    asset?.current_brand,
    asset?.photo_url,
    asset?.proof_photo_url,
    JSON.stringify(asset?.photo_urls),
    JSON.stringify(asset?.photo_ids),
    vacantPhoto,
  ]);

  const [i, setI] = useState(0);
  const count = shots.length;
  const current = count ? shots[i % count] : null;

  const go = (delta) => (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setI((v) => (v + delta + count) % count);
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    if (distance > 40 && count > 1) {
      setI((v) => (v + 1) % count);
    } else if (distance < -40 && count > 1) {
      setI((v) => (v - 1 + count) % count);
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleOpenLightbox = (e) => {
    if (!allowFullscreen || !current) return;
    e?.preventDefault();
    e?.stopPropagation();
    setLightboxOpen(true);
  };

  if (!current) {
    return (
      <div
        className={cn(
          "flex flex-col size-full items-center justify-center bg-secondary/40 text-muted-foreground p-3 text-center gap-1.5",
          className,
        )}
        data-testid="photo-slideshow-empty"
      >
        <ImageIcon className="size-6 opacity-60" />
        {isLive && asset?.current_brand && (
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
            {asset.current_brand}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group/slide relative size-full overflow-hidden bg-secondary/30 flex items-center justify-center select-none",
          allowFullscreen && "cursor-pointer",
          className
        )}
        onClick={handleOpenLightbox}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="photo-slideshow"
      >
        <SmartImage
          src={current}
          alt={`${asset.location_name || "Asset"} photo ${i + 1} of ${count}`}
          preset={variant === "card" ? "card" : "hero"}
          aspectRatio="aspect-auto"
          containerClassName="size-full bg-transparent"
          className={cn(
            "size-full transition-transform duration-300 group-hover/slide:scale-[1.02]",
            fitMode === "contain" ? "object-contain" : "object-cover",
            imageClassName
          )}
          fallbackText={asset.asset_code}
        />

        {/* Hover / Tap Fullscreen Zoom Badge */}
        {allowFullscreen && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-md p-1.5 text-white/90 opacity-0 sm:group-hover/slide:opacity-100 transition-opacity duration-200">
            <Maximize2 className="size-3.5" />
          </div>
        )}

        {count > 1 && (
          <>
            {variant === "detail" && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 hover:bg-background border border-border/60 p-1.5 shadow-sm text-foreground opacity-70 sm:opacity-0 backdrop-blur transition-opacity duration-200 group-hover/slide:opacity-100 active:scale-95 cursor-pointer"
                  data-testid="photo-slideshow-prev"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 hover:bg-background border border-border/60 p-1.5 shadow-sm text-foreground opacity-70 sm:opacity-0 backdrop-blur transition-opacity duration-200 group-hover/slide:opacity-100 active:scale-95 cursor-pointer"
                  data-testid="photo-slideshow-next"
                >
                  <ChevronRight className="size-4" />
                </button>
              </>
            )}

            {/* Pagination Dots */}
            <div
              className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur-xs"
              data-testid="photo-slideshow-dots"
            >
              {shots.map((s, idx) => (
                <span
                  key={s}
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-200",
                    idx === i % count ? "bg-white w-3" : "bg-white/50",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {allowFullscreen && (
        <ImageLightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          images={shots}
          initialIndex={i % count}
          title={asset.location_name || asset.asset_code}
          subtitle={`${asset.asset_code} · ${asset.city || asset.district || ""} · ${asset.width_ft || ""}x${asset.height_ft || ""} ft`}
        />
      )}
    </>
  );
}
