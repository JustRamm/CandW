import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 12,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 24, 48],
  className,
  itemLabel = "items",
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  if (totalItems <= pageSize && safePage === 1 && !onPageSizeChange) {
    return null;
  }

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) {
        pages.push("ellipsis-1");
      }
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safePage < totalPages - 2) {
        pages.push("ellipsis-2");
      }
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const handlePageSelect = (p) => {
    if (p >= 1 && p <= totalPages && p !== safePage) {
      onPageChange(p);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60 text-xs text-muted-foreground select-none",
        className
      )}
      data-testid="pagination-container"
    >
      {/* Left: Summary Count & Page Size */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <p className="text-xs text-muted-foreground font-medium">
          Showing <span className="font-semibold text-foreground">{startItem}</span>–
          <span className="font-semibold text-foreground">{endItem}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
        </p>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                onPageSizeChange(Number(val));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-[11px] px-2 py-0">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
          onClick={() => handlePageSelect(1)}
          disabled={safePage <= 1}
          title="First page"
          aria-label="First page"
          data-testid="pagination-first-btn"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
          onClick={() => handlePageSelect(safePage - 1)}
          disabled={safePage <= 1}
          title="Previous page"
          aria-label="Previous page"
          data-testid="pagination-prev-btn"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {/* Numeric page buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((item, idx) => {
            if (typeof item === "string" && item.startsWith("ellipsis")) {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground font-mono text-xs">
                  …
                </span>
              );
            }
            const isCurrent = item === safePage;
            return (
              <button
                key={item}
                type="button"
                onClick={() => handlePageSelect(item)}
                className={cn(
                  "size-7 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center",
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs font-bold ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
                data-testid={`pagination-page-${item}`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
          onClick={() => handlePageSelect(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Next page"
          aria-label="Next page"
          data-testid="pagination-next-btn"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
          onClick={() => handlePageSelect(totalPages)}
          disabled={safePage >= totalPages}
          title="Last page"
          aria-label="Last page"
          data-testid="pagination-last-btn"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
