import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Radio, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { useMe } from "@/lib/queries";
import { errMessage } from "@/lib/helpers";

const DEMO = [
  { email: "admin@ims.test", role: "Admin" },
  { email: "sales@ims.test", role: "Sales" },
  { email: "ops@ims.test", role: "Operations" },
  { email: "finance@ims.test", role: "Finance" },
  { email: "fm@ims.test", role: "Finance Manager" },
];

export default function Login() {
  const navigate = useNavigate();
  const { data: me, isSuccess } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123");

  const login = useMutation({
    mutationFn: (body) => apiPost("/auth/login", body),
    onSuccess: (user) => {
      beginSession();
      toast.success(`Signed in as ${user.name} · ${user.role_label}`);
      navigate("/dashboard");
    },
    onError: (err) => toast.error(errMessage(err, "Sign in failed")),
  });

  // Already signed in — don't make an authenticated user re-enter credentials.
  // Declared after every hook so the hook order stays stable across renders.
  if (isSuccess && me) return <Navigate to="/dashboard" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-12 py-14 lg:flex">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1558910034-2145cd06626f?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17]/95 via-[#0B0F17]/85 to-[#0B0F17]/55" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Radio className="size-6 text-primary" />
            <span className="font-heading text-lg font-bold tracking-tight">OOH-Sync</span>
          </div>
          <h1 className="mt-14 max-w-lg font-heading text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
            Metro &amp; mall bench inventory, from interest to release.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            A single workflow spine across Sales, Operations, Finance and Admin — visible waitlists,
            business-day expiry in IST, geo-tagged proof cycles and an immutable audit trail.
          </p>
        </div>
        <div className="relative grid max-w-lg grid-cols-3 gap-6">
          {[
            ["5", "business-day active slot"],
            ["28", "day GTP cadence"],
            ["100%", "actions audited"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-heading text-3xl font-bold text-primary">{v}</p>
              <p className="mono-label mt-1 text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Radio className="size-5 text-primary" />
            <span className="font-heading text-base font-bold">OOH-Sync</span>
          </div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts are created by your administrator.
          </p>

          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ email, password });
            }}
            data-testid="login-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full transition-transform duration-150 active:scale-[0.99]"
              disabled={login.isPending}
              data-testid="login-submit-button"
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-border/70 bg-card/60 p-4">
            <p className="mono-label flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Demo accounts · Password123
            </p>
            <ul className="mt-3 space-y-1" data-testid="demo-accounts-list">
              {DEMO.map((d) => (
                <li key={d.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword("Password123");
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-secondary/70"
                    data-testid={`demo-account-${d.role.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span className="font-mono text-[11px] text-foreground">{d.email}</span>
                    <span className="text-muted-foreground">{d.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
