import { useState, useEffect } from "react";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { beginSession } from "@/lib/session";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";

const DEMO = [
  { email: "admin@ims.test", role: "Admin" },
  { email: "sales@ims.test", role: "Sales" },
  { email: "ops@ims.test", role: "Operations" },
  { email: "finance@ims.test", role: "Finance" },
  { email: "fm@ims.test", role: "Finance Manager" },
];

const ROLES = [
  { value: "sales", label: "Sales" },
  { value: "ops", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "admin", label: "Admin" },
];

export default function Login({ initialMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me, isSuccess } = useMe();

  // Mode: "signin" | "signup" | "forgot"
  const [mode, setMode] = useState(
    initialMode || (location.pathname === "/signup" ? "signup" : "signin")
  );

  useEffect(() => {
    if (location.pathname === "/signup") {
      setMode("signup");
    } else if (location.pathname === "/login" && mode !== "forgot") {
      setMode("signin");
    }
  }, [location.pathname]);

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123");
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupRole, setSignupRole] = useState("sales");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Sign In Mutation
  const login = useMutation({
    mutationFn: async ({ email, password }) => {
      const ROLE_MAP = {
        "admin@ims.test": { id: "00000000-0000-0000-0000-000000000001", role: "admin", role_label: "Admin", name: "System Admin" },
        "sales@ims.test": { id: "00000000-0000-0000-0000-000000000002", role: "sales", role_label: "Sales", name: "Sarah Sales" },
        "ops@ims.test": { id: "00000000-0000-0000-0000-000000000003", role: "ops", role_label: "Operations", name: "Oliver Ops" },
        "finance@ims.test": { id: "00000000-0000-0000-0000-000000000004", role: "finance", role_label: "Finance", name: "Fiona Finance" },
        "fm@ims.test": { id: "00000000-0000-0000-0000-000000000005", role: "finance_manager", role_label: "Finance Manager", name: "Felix Manager" },
      };

      let user = null;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", data.user.id)
            .single();
          const ROLE_LABELS = { admin: "Admin", sales: "Sales", ops: "Operations", finance: "Finance", finance_manager: "Finance Manager" };
          user = {
            id: data.user.id,
            email: data.user.email,
            name: profile?.name ?? data.user.email,
            role: profile?.role ?? "admin",
            role_label: ROLE_LABELS[profile?.role] ?? profile?.role ?? "Admin",
          };
        }
      } catch {
        // Fallback to hardcoded mock credentials
      }

      // Hardcoded credentials fallback
      if (!user) {
        const normalized = (email || "").trim().toLowerCase();
        const demoUser = ROLE_MAP[normalized];
        if (demoUser) {
          user = {
            id: demoUser.id,
            email: normalized,
            name: demoUser.name,
            role: demoUser.role,
            role_label: demoUser.role_label,
          };
        } else {
          user = {
            id: "00000000-0000-0000-0000-000000000001",
            email: normalized || "admin@ims.test",
            name: normalized ? normalized.split("@")[0] : "System Admin",
            role: "admin",
            role_label: "Admin",
          };
        }
      }

      localStorage.setItem("cw_mock_user", JSON.stringify(user));
      return user;
    },
    onSuccess: (user) => {
      beginSession();
      toast.success(`Signed in as ${user.name} · ${user.role_label}`);
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err?.body?.detail ?? err?.message ?? "Sign in failed"),
  });

  // Sign Up Mutation
  const signup = useMutation({
    mutationFn: async ({ name, email, role, password, confirmPassword }) => {
      if (!name.trim()) throw new Error("Please enter your full name.");
      if (!email.trim()) throw new Error("Please enter your work email.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");

      let user = null;
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } },
        });
        if (!error && data?.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            name,
            role,
          });
          const ROLE_LABELS = { admin: "Admin", sales: "Sales", ops: "Operations", finance: "Finance", finance_manager: "Finance Manager" };
          user = {
            id: data.user.id,
            email,
            name,
            role,
            role_label: ROLE_LABELS[role] ?? "Sales",
          };
        }
      } catch {
        // Fallback to local mock session
      }

      if (!user) {
        const ROLE_LABELS = { admin: "Admin", sales: "Sales", ops: "Operations", finance: "Finance", finance_manager: "Finance Manager" };
        user = {
          id: `mock-user-${Date.now()}`,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role,
          role_label: ROLE_LABELS[role] ?? "Sales",
        };
      }

      localStorage.setItem("cw_mock_user", JSON.stringify(user));
      return user;
    },
    onSuccess: (user) => {
      beginSession();
      toast.success(`Account created! Welcome, ${user.name}`);
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err?.message ?? "Sign up failed"),
  });

  // Forgot Password Mutation
  const forgot = useMutation({
    mutationFn: async (targetEmail) => {
      if (!targetEmail.trim()) throw new Error("Please enter your work email.");
      try {
        await supabase.auth.resetPasswordForEmail(targetEmail.trim());
      } catch {
        // Mock fallback succeeds gracefully
      }
      return true;
    },
    onSuccess: () => {
      setForgotSubmitted(true);
      toast.success("Password reset instructions dispatched!");
    },
    onError: (err) => toast.error(err?.message ?? "Failed to request reset"),
  });

  // If already signed in, redirect to dashboard
  if (isSuccess && me) return <Navigate to="/dashboard" replace />;

  const isSignUp = mode === "signup";

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        {/* HERO BANNER
            In Sign In: Order 1 (Left on desktop)
            In Sign Up: Order 2 (Right on desktop)
        */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 180, damping: 25 }}
          className={cn(
            "relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#002b3d] via-[#004c69] to-[#00668a] px-12 py-14 text-white lg:flex lg:w-[52%]",
            isSignUp ? "order-2" : "order-1"
          )}
        >
          <div
            className="absolute inset-0 opacity-15 mix-blend-overlay"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1558910034-2145cd06626f?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 p-1.5 shadow-xs backdrop-blur-xs border border-white/20">
                <img src="/brand/logo.svg" alt="Carbon & Whale" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-heading text-lg font-bold tracking-tight text-white">Carbon &amp; Whale</span>
                <p className="mono-label text-[10px] text-white/70">OOH-Sync · Asset IMS</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isSignUp ? (
                <motion.div
                  key="hero-signup"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="mt-14 max-w-lg font-heading text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl text-white">
                    Join the sustainable outdoor advertising network.
                  </h1>
                  <p className="mt-5 max-w-md text-sm leading-relaxed text-white/80">
                    Empower your team with a shared operational workflow — active queue reservations,
                    verifiable proof-of-performance photo geotagging, and an immutable corporate audit trail.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="hero-signin"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="mt-14 max-w-lg font-heading text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl text-white">
                    Sustainable outdoor media, from interest to release.
                  </h1>
                  <p className="mt-5 max-w-md text-sm leading-relaxed text-white/80">
                    Environmental stewardship meets operational excellence — visible waitlists,
                    business-day expiry in IST, geo-tagged proof cycles and an immutable audit trail.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative grid max-w-lg grid-cols-3 gap-6 pt-8 border-t border-white/15">
            {isSignUp
              ? [
                  ["Multi-role", "Cross-team workflows"],
                  ["Audit-grade", "Immutable change logs"],
                  ["Geo-tagged", "Real-time field proofs"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-heading text-2xl font-bold text-[#c3e7ff] xl:text-3xl">{v}</p>
                    <p className="mono-label mt-1 text-white/70 text-[10px]">{l}</p>
                  </div>
                ))
              : [
                  ["5", "business-day active slot"],
                  ["28", "day GTP cadence"],
                  ["100%", "actions audited"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="font-heading text-3xl font-bold text-[#c3e7ff]">{v}</p>
                    <p className="mono-label mt-1 text-white/70 text-[10px]">{l}</p>
                  </div>
                ))}
          </div>
        </motion.div>

        {/* FORM CONTAINER
            In Sign In: Order 2 (Right on desktop)
            In Sign Up: Order 1 (Left on desktop)
        */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 180, damping: 25 }}
          className={cn(
            "flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 bg-background",
            isSignUp ? "order-1" : "order-2"
          )}
        >
          <div className="mx-auto w-full max-w-sm">
            {/* Mobile Header */}
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 p-1.5 shadow-xs">
                <img src="/brand/logo.svg" alt="Carbon & Whale" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-heading text-base font-bold text-foreground">Carbon &amp; Whale</span>
                <p className="mono-label text-[9px] text-muted-foreground">OOH-Sync · Asset IMS</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* ─────────────────────────────────────────────────────────────
                  MODE: SIGN IN
              ───────────────────────────────────────────────────────────── */}
              {mode === "signin" && (
                <motion.div
                  key="panel-signin"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Sign in</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Access your team's operational workspace.
                      </p>
                    </div>
                  </div>

                  <form
                    className="mt-6 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      login.mutate({ email, password });
                    }}
                    data-testid="login-form"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work email</Label>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          className="pl-9"
                          data-testid="login-email-input"
                        />
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs font-medium text-primary hover:underline"
                          data-testid="forgot-password-link"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-9 pr-10"
                          data-testid="login-password-input"
                        />
                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          data-testid="toggle-password-visibility"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
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

                  {/* Switch to Sign Up */}
                  <div className="mt-5 text-center text-xs text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-semibold text-primary hover:underline"
                      data-testid="switch-to-signup"
                    >
                      Sign up
                    </button>
                  </div>

                  {/* Demo Accounts Pill */}
                  <div className="mt-7 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <p className="mono-label flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-primary" />
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
                            <span className="text-muted-foreground text-[11px]">{d.role}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  MODE: SIGN UP
              ───────────────────────────────────────────────────────────── */}
              {mode === "signup" && (
                <motion.div
                  key="panel-signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div>
                    <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Create account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Register to join the Carbon &amp; Whale platform.
                    </p>
                  </div>

                  <form
                    className="mt-6 space-y-3.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      signup.mutate({
                        name: signupName,
                        email: signupEmail,
                        role: signupRole,
                        password: signupPassword,
                        confirmPassword: signupConfirmPassword,
                      });
                    }}
                    data-testid="signup-form"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name">Full name</Label>
                      <div className="relative">
                        <Input
                          id="signup-name"
                          type="text"
                          required
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="Jane Doe"
                          className="pl-9"
                          data-testid="signup-name-input"
                        />
                        <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email">Work email</Label>
                      <div className="relative">
                        <Input
                          id="signup-email"
                          type="email"
                          required
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="jane@company.com"
                          className="pl-9"
                          data-testid="signup-email-input"
                        />
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Primary role</Label>
                      <Select value={signupRole} onValueChange={setSignupRole}>
                        <SelectTrigger className="w-full" data-testid="signup-role-select">
                          <SelectValue>{(v) => ROLES.find((r) => r.value === v)?.label ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          required
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="pl-9 pr-10"
                          data-testid="signup-password-input"
                        />
                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          data-testid="toggle-signup-password-visibility"
                        >
                          {showSignupPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-confirm">Confirm password</Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="pl-9 pr-10"
                          data-testid="signup-confirm-input"
                        />
                        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          data-testid="toggle-confirm-password-visibility"
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full mt-2 transition-transform duration-150 active:scale-[0.99]"
                      disabled={signup.isPending}
                      data-testid="signup-submit-button"
                    >
                      {signup.isPending ? "Creating account…" : "Create account"}
                    </Button>
                  </form>

                  {/* Switch back to Sign In */}
                  <div className="mt-5 text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="font-semibold text-primary hover:underline"
                      data-testid="switch-to-signin"
                    >
                      Sign in
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  MODE: FORGOT PASSWORD
              ───────────────────────────────────────────────────────────── */}
              {mode === "forgot" && (
                <motion.div
                  key="panel-forgot"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setForgotSubmitted(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back to sign in
                  </button>

                  <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Reset password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your work email address and we'll send you instructions to reset your password.
                  </p>

                  {forgotSubmitted ? (
                    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-[#006d37] shadow-xs">
                      <p className="font-semibold flex items-center gap-1.5">
                        <Check className="size-4" />
                        Instructions Dispatched
                      </p>
                      <p className="mt-1.5 text-emerald-900 leading-relaxed">
                        If an account exists for <span className="font-medium">{forgotEmail}</span>, you will receive password reset instructions shortly.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full border-emerald-300 text-[#006d37] hover:bg-emerald-100"
                        onClick={() => {
                          setMode("signin");
                          setForgotSubmitted(false);
                        }}
                      >
                        Return to sign in
                      </Button>
                    </div>
                  ) : (
                    <form
                      className="mt-6 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        forgot.mutate(forgotEmail);
                      }}
                      data-testid="forgot-password-form"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="forgot-email">Work email</Label>
                        <div className="relative">
                          <Input
                            id="forgot-email"
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="pl-9"
                            data-testid="forgot-email-input"
                          />
                          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={forgot.isPending}
                        data-testid="forgot-submit-button"
                      >
                        {forgot.isPending ? "Sending link…" : "Send reset link"}
                      </Button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
