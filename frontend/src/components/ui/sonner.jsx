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
            "group font-sans flex items-center gap-3 w-full p-3.5 px-4 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-lg shadow-black/5 text-foreground transition-all duration-200 text-xs sm:text-sm",
          title: "font-medium font-heading text-foreground",
          description: "text-xs text-muted-foreground mt-0.5",
          actionButton:
            "bg-primary text-primary-foreground font-medium rounded-lg text-xs px-2.5 py-1.5 hover:bg-primary/90 transition-colors",
          cancelButton:
            "bg-secondary text-secondary-foreground font-medium rounded-lg text-xs px-2.5 py-1.5 hover:bg-secondary/80 transition-colors",
          closeButton:
            "text-muted-foreground hover:text-foreground border border-border/60 bg-background/80 rounded-full",
          success:
            "!border-emerald-500/25 !bg-emerald-50/95 !text-emerald-950 dark:!bg-emerald-950/50 dark:!text-emerald-100 dark:!border-emerald-800/60 shadow-emerald-900/5",
          error:
            "!border-red-500/25 !bg-red-50/95 !text-red-950 dark:!bg-red-950/50 dark:!text-red-100 dark:!border-red-800/60 shadow-red-900/5",
          info:
            "!border-sky-500/25 !bg-sky-50/95 !text-sky-950 dark:!bg-sky-950/50 dark:!text-sky-100 dark:!border-sky-800/60 shadow-sky-900/5",
          warning:
            "!border-amber-500/25 !bg-amber-50/95 !text-amber-950 dark:!bg-amber-950/50 dark:!text-amber-100 dark:!border-amber-800/60 shadow-amber-900/5",
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

