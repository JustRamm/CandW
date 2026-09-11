import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Slideshow over an asset's uploaded photo attachments.
 * `variant="card"` renders the compact grid-card version without controls.
 */
export default function PhotoSlideshow({ asset, variant = "detail", className }) {
  const initialShots = Array.from(
    new Set(
      [
        ...(asset?.photo_urls ?? []),
        ...(asset?.photo_url ? [asset.photo_url] : []),
      ].filter(Boolean),
    ),
  );

  const [shots, setShots] = useState(initialShots);

  useEffect(() => {
    let active = true;
    const known = Array.from(
      new Set(
        [
          ...(asset?.photo_urls ?? []),
          ...(asset?.photo_url ? [asset.photo_url] : []),
        ].filter(Boolean),
      ),
    );

    if (known.length > 0 || !asset?.photo_ids?.length) {
      setShots(known);
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
        setShots(
          Array.from(new Set([...fetched, ...(asset?.photo_url ? [asset.photo_url] : [])].filter(Boolean))),
        );
      });

    return () => {
      active = false;
    };
  }, [asset?.id, asset?.photo_url, JSON.stringify(asset?.photo_urls), JSON.stringify(asset?.photo_ids)]);

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
        className={cn("flex size-full items-center justify-center bg-secondary/60", className)}
        data-testid="photo-slideshow-empty"
      >
        <ImageIcon className="size-7 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("group/slide relative size-full overflow-hidden bg-secondary/60", className)} data-testid="photo-slideshow">
      <SmartImage
        src={current}
        alt={`${asset.location_name} photo ${i + 1} of ${count}`}
        preset={variant === "card" ? "card" : "hero"}
        aspectRatio="aspect-auto"
        containerClassName="size-full"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
