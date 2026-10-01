import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getAssetVacantPhoto } from "@/lib/helpers";

/**
 * Slideshow over an asset's uploaded photo attachments.
 * `variant="card"` renders the compact grid-card version without controls.
 */
export default function PhotoSlideshow({
  asset,
  variant = "detail",
  className,
  imageClassName,
  fitMode = "cover",
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
    e.preventDefault();
    e.stopPropagation();
    setI((v) => (v + delta + count) % count);
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
    <div className={cn("group/slide relative size-full overflow-hidden bg-secondary/30 flex items-center justify-center", className)} data-testid="photo-slideshow">
      <SmartImage
        src={current}
        alt={`${asset.location_name} photo ${i + 1} of ${count}`}
        preset={variant === "card" ? "card" : "hero"}
        aspectRatio="aspect-auto"
        containerClassName="size-full bg-transparent"
        className={cn(
          "size-full transition-transform duration-300 group-hover:scale-[1.02]",
          fitMode === "contain" ? "object-contain" : "object-cover",
          imageClassName
        )}
        fallbackText={asset.asset_code}
      />
      {count > 1 && (
        <>
          {variant === "detail" && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 opacity-0 backdrop-blur transition-opacity duration-200 hover:bg-background group-hover/slide:opacity-100"
                data-testid="photo-slideshow-prev"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1.5 opacity-0 backdrop-blur transition-opacity duration-200 hover:bg-background group-hover/slide:opacity-100"
                data-testid="photo-slideshow-next"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1" data-testid="photo-slideshow-dots">
            {shots.map((s, idx) => (
              <span
                key={s}
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-200",
                  idx === i % count ? "bg-primary" : "bg-foreground/35",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
