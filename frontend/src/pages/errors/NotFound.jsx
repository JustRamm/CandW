import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 text-center select-none">
      {/* Visual Accent */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-primary/5 animate-pulse">
          <Compass className="size-12 text-primary" />
        </div>
        <span className="absolute -bottom-2 font-mono text-xs font-bold uppercase tracking-widest text-primary bg-background px-2.5 py-0.5 rounded-full border border-primary/20 shadow-xs">
          404 Error
        </span>
      </div>

      {/* Headings */}
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        The billboard inventory, campaign link, or management section you're trying to reach doesn't exist or has moved.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Go back
        </Button>
        <Link to="/dashboard">
          <Button size="sm" className="gap-2 shadow-xs">
            <Home className="size-4" />
            Go to dashboard
          </Button>
        </Link>
        <Link to="/assets">
          <Button variant="secondary" size="sm" className="gap-2">
            <MapPin className="size-4" />
            Browse assets
          </Button>
        </Link>
      </div>

      {/* Footer Branding */}
      <p className="mt-12 text-xs font-mono text-muted-foreground/60">
        Carbon & Whale · Inventory Management System
      </p>
    </div>
  );
}
