import { useState, useEffect } from "react";
import { Image as ImageIcon, MapPin } from "lucide-react";
import { getOptimizedImageUrl, IMAGE_PRESETS } from "@/lib/imageOptimization";
import { cn } from "@/lib/utils";

export default function SmartImage({
  src,
  alt = "Asset image",
  className,
  containerClassName,
  preset = "card",
  width,
  height,
  fallbackText,
  aspectRatio = "aspect-video",
}) {
  const options = {
    ...(IMAGE_PRESETS[preset] || {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  const optimized = src ? getOptimizedImageUrl(src, options) : "";
  const [currentSrc, setCurrentSrc] = useState(optimized);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }
    const opt = getOptimizedImageUrl(src, options);
    setCurrentSrc(opt);
    setIsLoading(true);
    setHasError(false);
  }, [src, preset, width, height]);

  const handleError = () => {
    // If the optimized URL failed, fallback to the raw original URL
    if (currentSrc !== src && src) {
      setCurrentSrc(src);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/40 flex items-center justify-center select-none",
        aspectRatio,
        containerClassName
      )}
    >
      {/* Loading Skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted/50 via-muted/20 to-muted/50" />
      )}

      {/* Actual Image */}
      {!hasError && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            isLoading ? "opacity-0 scale-[1.02]" : "opacity-100 scale-100",
            className
          )}
        />
      )}

      {/* Fallback Graphic */}
      {hasError && (
        <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center text-muted-foreground/70">
          <div className="rounded-full bg-muted/70 p-2 text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
          {fallbackText ? (
            <span className="text-[11px] font-medium tracking-tight text-muted-foreground line-clamp-1">
              {fallbackText}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-mono">
              No photo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
