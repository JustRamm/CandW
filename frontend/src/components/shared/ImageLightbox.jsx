import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, ExternalLink, Maximize2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ImageLightbox
 * Fullscreen photo inspection viewer with:
 * - Touch swipe left/right on mobile
 * - Keyboard navigation (Left, Right, Escape)
 * - Next/Previous buttons
 * - Image counter & metadata display
 * - High-res original link
 */
export default function ImageLightbox({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  title = "Photo Inspection",
  subtitle = "",
  metadata = null,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const count = images.length;
  const currentImage = count > 0 ? images[currentIndex % count] : null;
  const currentUrl = typeof currentImage === "string" ? currentImage : currentImage?.url;
  const currentMeta = typeof currentImage === "object" ? currentImage : null;

  const handlePrev = useCallback((e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % count);
  }, [count]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) handlePrev();
      else if (e.key === "ArrowRight" && count > 1) handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    // Lock body scroll
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, count, handlePrev, handleNext, onClose]);

  // Touch Swipe Handlers for mobile phones
  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && count > 1) {
      handleNext();
    } else if (isRightSwipe && count > 1) {
      handlePrev();
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  if (!isOpen || !currentUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-black/95 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full max-w-5xl flex items-center justify-between py-2 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm sm:text-base font-semibold truncate text-white">
              {currentMeta?.title || title}
            </h3>
            {count > 1 && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-mono font-medium text-white/90">
                {(currentIndex % count) + 1} / {count}
              </span>
            )}
          </div>
          {(currentMeta?.subtitle || subtitle) && (
            <p className="text-[11px] sm:text-xs text-white/70 truncate">
              {currentMeta?.subtitle || subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 text-white/80 hover:text-white transition-colors"
            title="Open high-res original in new tab"
          >
            <ExternalLink className="size-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close viewer (Esc)"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left Arrow */}
        {count > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 z-20 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 p-2.5 text-white backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        {/* The Image */}
        <div className="relative max-h-[75vh] max-w-full flex items-center justify-center p-2">
          <img
            key={currentUrl}
            src={currentUrl}
            alt={title}
            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
          />
        </div>

        {/* Right Arrow */}
        {count > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 z-20 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 p-2.5 text-white backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip / Dots Bar */}
      <div
        className="w-full max-w-5xl flex flex-col items-center gap-2 pt-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Optional Metadata panel */}
        {(currentMeta?.info || metadata) && (
          <div className="text-center text-xs text-white/80 pb-1">
            {currentMeta?.info || metadata}
          </div>
        )}

        {count > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 px-3 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
            {images.map((img, idx) => {
              const url = typeof img === "string" ? img : img?.url;
              const isActive = idx === currentIndex % count;
              return (
                <button
                  key={url || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "relative size-8 sm:size-10 rounded-md overflow-hidden border transition-all shrink-0 cursor-pointer",
                    isActive
                      ? "border-primary ring-2 ring-primary/50 scale-105 opacity-100"
                      : "border-white/20 opacity-50 hover:opacity-80"
                  )}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
