"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group font-sans"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group font-sans flex items-start gap-3 w-full p-4 rounded-xl border border-border/80 bg-card shadow-lg shadow-black/5 text-foreground transition-all duration-200 text-xs sm:text-sm",
          title: "font-semibold font-heading text-sm text-foreground leading-snug",
          description: "!text-xs !text-slate-800 dark:!text-slate-200 !mt-1 !opacity-100 !leading-relaxed font-normal",
          actionButton:
            "bg-primary text-primary-foreground font-medium rounded-lg text-xs px-2.5 py-1.5 hover:bg-primary/90 transition-colors",
          cancelButton:
            "bg-secondary text-secondary-foreground font-medium rounded-lg text-xs px-2.5 py-1.5 hover:bg-secondary/80 transition-colors",
          closeButton:
            "text-muted-foreground hover:text-foreground border border-border/60 bg-background/80 rounded-full",
          success:
            "!border-emerald-500/40 !bg-emerald-50 !text-emerald-950 dark:!bg-emerald-950 dark:!text-emerald-50 [&_[data-title]]:!text-emerald-950 dark:[&_[data-title]]:!text-emerald-100 [&_[data-description]]:!text-emerald-900 dark:[&_[data-description]]:!text-emerald-200",
          error:
            "!border-red-500/40 !bg-red-50 !text-red-950 dark:!bg-red-950 dark:!text-red-50 [&_[data-title]]:!text-red-950 dark:[&_[data-title]]:!text-red-100 [&_[data-description]]:!text-red-900 dark:[&_[data-description]]:!text-red-200",
          info:
            "!border-sky-500/40 !bg-sky-50 !text-sky-950 dark:!bg-sky-950 dark:!text-sky-50 [&_[data-title]]:!text-sky-950 dark:[&_[data-title]]:!text-sky-100 [&_[data-description]]:!text-sky-900 dark:[&_[data-description]]:!text-sky-200",
          warning:
            "!border-amber-500/40 !bg-amber-50 !text-amber-950 dark:!bg-amber-950 dark:!text-amber-50 [&_[data-title]]:!text-amber-950 dark:[&_[data-title]]:!text-amber-100 [&_[data-description]]:!text-amber-900 dark:[&_[data-description]]:!text-amber-200",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />,
        info: <Info className="size-4.5 shrink-0 text-sky-600 dark:text-sky-400" />,
        warning: <AlertTriangle className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />,
        error: <XCircle className="size-4.5 shrink-0 text-red-600 dark:text-red-400" />,
        loading: <Loader2 className="size-4.5 shrink-0 animate-spin text-primary" />,
      }}
      {...props}
    />
  );
};

export { Toaster };

