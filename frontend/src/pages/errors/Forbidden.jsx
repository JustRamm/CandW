import { Link } from "react-router-dom";
import { ShieldAlert, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/queries";
import { endSession } from "@/lib/session";

export default function Forbidden({ requiredRoles = [] }) {
  const { data: me } = useMe();

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 text-center select-none">
      {/* Visual Accent */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="size-24 rounded-full bg-amber-500/10 flex items-center justify-center ring-8 ring-amber-500/5">
          <ShieldAlert className="size-12 text-amber-600" />
        </div>
        <span className="absolute -bottom-2 font-mono text-xs font-bold uppercase tracking-widest text-amber-600 bg-background px-2.5 py-0.5 rounded-full border border-amber-500/20 shadow-xs">
          403 Access Denied
        </span>
      </div>

      {/* Headings */}
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Restricted Area
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        Your current account role (
        <span className="font-semibold text-foreground">
          {me?.role_label || me?.role || "User"}
        </span>
        ) does not have permission to access this module.
        {requiredRoles.length > 0 && (
          <span className="block mt-1 text-xs text-muted-foreground/80 font-mono">
            Required role: {requiredRoles.join(" or ")}
          </span>
        )}
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/dashboard">
          <Button size="sm" className="gap-2 shadow-xs">
            <Home className="size-4" />
            Return to dashboard
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => endSession("/login")}
          className="gap-2 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-4" />
          Switch account
        </Button>
      </div>

      <p className="mt-12 text-xs font-mono text-muted-foreground/60">
        Contact your workspace administrator if you need elevated access.
      </p>
    </div>
  );
}
