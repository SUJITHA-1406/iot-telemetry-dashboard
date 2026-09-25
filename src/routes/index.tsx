import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  HardHat,
  ShieldCheck,
  Cpu,
  FileBarChart2,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { registerUser, loginUser } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Authentication — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Register and Sign in to Smart Construction Estimator with Email or Username.",
      },
      { property: "og:title", content: "Smart Construction Estimator - Auth" },
      {
        property: "og:description",
        content: "AI blueprint analysis and construction cost estimation platform.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Form states
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("login");
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Sign In fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up fields
  const [username, setUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Redirect to new project if already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/projects/new" });
    }
  }, [loading, user, navigate]);

  // Password validation checks
  const hasMinLength = regPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasLetter && hasNumber;

  // Handle Email / Username and Password Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = loginIdentifier.trim();
    if (!identifier || !loginPassword) {
      toast.error("Please enter your username/email and password.");
      return;
    }

    setBusy(true);

    try {
      const result = await loginUser({
        identifier,
        password: loginPassword,
      });

      if (!result.success) {
        toast.error(result.error || "Invalid username or password");
        setBusy(false);
        return;
      }

      toast.success("Signed in successfully! Redirecting to new project...");
      window.location.href = "/projects/new";
    } catch (err: any) {
      toast.error("Invalid username or password");
    } finally {
      setBusy(false);
    }
  };

  // Handle Email / Username Sign Up (Register)
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !regPassword || !cleanUsername) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    // Password requirements: Minimum 8 characters, letters and numbers
    if (!hasMinLength) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (!hasLetter || !hasNumber) {
      toast.error("Password must contain both letters and numbers.");
      return;
    }

    if (regPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please verify your password.");
      return;
    }

    setBusy(true);

    try {
      const result = await registerUser({
        username: cleanUsername,
        email: cleanEmail,
        password: regPassword,
      });

      if (!result.success) {
        toast.error(result.error || "Registration failed. Please try again.");
        setBusy(false);
        return;
      }

      toast.success("Account created and signed in! Redirecting...");
      window.location.href = "/projects/new";
    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Branding Showcase */}
      <section className="relative hidden flex-col justify-between bg-gradient-navy p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-accent text-accent-foreground shadow-lg shadow-accent/20">
            <HardHat className="size-6" />
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-wide">SMART ESTIMATOR</p>
            <p className="text-xs text-primary-foreground/60">Construction Intelligence Platform</p>
          </div>
        </div>

        <div className="max-w-lg animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent mb-4">
            <ShieldCheck className="size-3.5" />
            <span>Two-Step Registration & Sign In</span>
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            AI Blueprint Analysis & Real-Time Quantity Take-Off
          </h2>
          <p className="mt-4 text-sm text-primary-foreground/75 leading-relaxed">
            Upload civil, electrical, and mechanical engineering blueprints to detect structural components, compute exact material quantities, and calculate real market construction costs.
          </p>
          <div className="mt-8 grid gap-3.5">
            {[
              {
                icon: Cpu,
                t: "AI Blueprint Component Detection",
                d: "Detects walls, columns, beams, wiring, pipes, and HVAC with confidence scores.",
              },
              {
                icon: FileBarChart2,
                t: "Automated Material Quantities",
                d: "Instantly computes cement, steel, bricks, sand, wiring conduits, and plumbing take-off.",
              },
              {
                icon: ShieldCheck,
                t: "Bankable Cost Estimates",
                d: "Live material pricing catalogues and professional downloadable PDF reports.",
              },
            ].map((f) => (
              <div
                key={f.t}
                className="flex gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <f.icon className="mt-0.5 size-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{f.t}</p>
                  <p className="text-xs text-primary-foreground/60 mt-0.5">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-primary-foreground/50">
          Trusted by civil engineers, estimators, and construction contractors.
        </p>
      </section>

      {/* Right Auth Card */}
      <section className="flex items-center justify-center bg-blueprint-grid p-6 sm:p-10">
        <div className="surface-panel w-full max-w-md p-8 shadow-xl animate-rise border border-border/80">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-accent text-accent-foreground">
                <HardHat className="size-5" />
              </div>
              <span className="font-display font-bold text-sm tracking-wide">SMART ESTIMATOR</span>
            </div>
          </div>

          {/* Workflow Steps Indicator Banner */}
          <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
              <span className={activeTab === "register" ? "text-primary font-bold" : ""}>
                1. Register Account
              </span>
              <ArrowRight className="size-3 text-muted-foreground" />
              <span className={activeTab === "login" ? "text-primary font-bold" : ""}>
                2. Sign In to Workspace
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              New users must register first. After registration, sign in with your password to continue.
            </p>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {activeTab === "login" ? "Sign In" : "Register (Sign Up)"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeTab === "login"
              ? "Enter your registered credentials to launch your workspace."
              : "Create your new account credentials below."}
          </p>

          {/* Banner if user just completed registration */}
          {registeredEmail && activeTab === "login" && (
            <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span>
                Account created for <strong>{registeredEmail}</strong>. Please enter your password below to Sign In.
              </span>
            </div>
          )}

          {/* Auth Mode Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-5">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="login" className="text-xs font-semibold">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="text-xs font-semibold">
                Sign Up (Register)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SIGN IN */}
            <TabsContent value="login" className="mt-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-id" className="text-xs font-semibold">
                    Email or Username
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="login-id"
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="you@company.com or username"
                      className="pl-9 h-10 text-xs"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-pass" className="text-xs font-semibold">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="login-pass"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-9 h-10 text-xs"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      title={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-xs font-semibold shadow-md mt-2"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Sign In to Workspace
                </Button>

                {/* Switch to Register Prompt */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("register");
                      setRegisteredEmail(null);
                    }}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Don't have an account yet? <strong>Register here first →</strong>
                  </button>
                </div>
              </form>
            </TabsContent>

            {/* TAB 2: SIGN UP / REGISTER */}
            <TabsContent value="register" className="mt-5">
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-xs font-semibold">
                    Username *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reg-username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. john_doe"
                      className="pl-9 h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs font-semibold">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="pl-9 h-10 text-xs"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass" className="text-xs font-semibold">
                    Password *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reg-pass"
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="At least 8 chars (letters & numbers)"
                      className="pl-9 pr-9 h-10 text-xs"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showRegPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>

                  {/* Password validation indicators */}
                  {regPassword.length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-2 text-[11px] space-y-1 border border-border/60">
                      <div className="flex items-center gap-1.5">
                        {hasMinLength ? (
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="size-3 text-muted-foreground shrink-0" />
                        )}
                        <span className={hasMinLength ? "text-foreground font-medium" : "text-muted-foreground"}>
                          At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {hasLetter && hasNumber ? (
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="size-3 text-muted-foreground shrink-0" />
                        )}
                        <span className={hasLetter && hasNumber ? "text-foreground font-medium" : "text-muted-foreground"}>
                          Contains both letters and numbers
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm" className="text-xs font-semibold">
                    Confirm Password *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reg-confirm"
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="pl-9 h-10 text-xs"
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <XCircle className="size-3" /> Passwords do not match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-xs font-semibold shadow-md mt-2"
                  disabled={busy || !isPasswordValid || (confirmPassword.length > 0 && !passwordsMatch)}
                >
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Register Account
                </Button>

                {/* Switch to Sign In Prompt */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab("login")}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Already registered? <strong>Switch to Sign In →</strong>
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Step 1: Register account • Step 2: Sign In with your credentials.
          </p>
        </div>
      </section>
    </div>
  );
}
