"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  LogIn,
  Shield,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Countdown hook — returns a live "Xm Ys" string, null when time is up
// ─────────────────────────────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const calculate = useCallback(() => {
    if (!targetDate) return null;
    const diff = new Date(targetDate) - Date.now();
    if (diff <= 0) return null;
    const totalSeconds = Math.ceil(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0
      ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
      : `${seconds}s`;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculate);

  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => {
      const remaining = calculate();
      setTimeLeft(remaining);
      if (!remaining) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate, calculate]);

  return timeLeft;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lockout banner — shown when code === "ACCOUNT_LOCKED"
// ─────────────────────────────────────────────────────────────────────────────
function LockoutBanner({ lockedUntil, onExpire }) {
  const timeLeft = useCountdown(lockedUntil);

  useEffect(() => {
    if (!timeLeft) onExpire?.();
  }, [timeLeft, onExpire]);

  return (
    <div className="bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 flex flex-col gap-1 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 text-destructive font-medium text-sm">
        <Lock className="w-4 h-4 shrink-0" />
        Account Locked
      </div>
      <p className="text-destructive/80 text-xs leading-relaxed">
        Too many failed attempts. Your account has been locked for 1 hour.
        Contact your administrator if you need immediate access.
      </p>
      {timeLeft && (
        <div className="flex items-center gap-1.5 mt-1 text-destructive/70 text-xs font-mono">
          <Clock className="w-3.5 h-3.5" />
          Unlocks in {timeLeft}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attempts warning — shown when attemptsLeft > 0
// ─────────────────────────────────────────────────────────────────────────────
function AttemptsWarning({ attemptsLeft }) {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2">
      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-yellow-700 dark:text-yellow-400 text-sm font-medium">
          Invalid username or password
        </p>
        <p className="text-yellow-600/80 dark:text-yellow-500 text-xs">
          {attemptsLeft === 1
            ? "1 attempt remaining before your account is locked for 1 hour."
            : `${attemptsLeft} attempts remaining before lockout.`}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic error banner — shown for all other errors
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBanner({ message }) {
  return (
    <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
      <span className="text-base mt-0.5">⚠</span>
      <span className="flex-1">{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Three distinct error states the backend can return
  const [errorState, setErrorState] = useState({
    type: null, // "locked" | "attempts" | "generic" | null
    message: "",
    attemptsLeft: null,
    lockedUntil: null,
  });

  const clearError = () =>
    setErrorState({
      type: null,
      message: "",
      attemptsLeft: null,
      lockedUntil: null,
    });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Only clear non-lockout errors on input change — keep the lockout banner
    // visible even while the user edits the form
    if (errorState.type !== "locked") clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      const data = await login(formData.username, formData.password);

      if (data.user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/pm-logs");
      }
    } catch (err) {
      // AuthError carries structured fields; plain Error only has .message
      if (err.code === "ACCOUNT_LOCKED") {
        setErrorState({
          type: "locked",
          message: err.message,
          attemptsLeft: null,
          lockedUntil: err.lockedUntil,
        });
      } else if (
        err.code === "INVALID_CREDENTIALS" &&
        err.attemptsLeft !== null
      ) {
        setErrorState({
          type: "attempts",
          message: err.message,
          attemptsLeft: err.attemptsLeft,
          lockedUntil: null,
        });
      } else {
        setErrorState({
          type: "generic",
          message: err.message || "An unexpected error occurred.",
          attemptsLeft: null,
          lockedUntil: null,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // When the countdown reaches zero the lock has expired — clear the banner
  // so the user can try again without a page reload
  const handleLockExpire = () => clearError();

  // Disable the form while the account is actively locked
  const isLocked = errorState.type === "locked" && !!errorState.lockedUntil;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-muted/40 backdrop-blur-sm bg-card/95 relative z-10">
        <CardHeader className="space-y-4 flex flex-col items-center pb-8 pt-8">
          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-xl" />
            <div className="relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-4 border border-primary/20 shadow-lg">
              <Image
                src="/ghost.ico"
                alt="ghost logo"
                width={64}
                height={64}
                className="rounded-full"
                priority
              />
            </div>
          </div>

          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              PM Log System
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Secure access to your dashboard
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Error banners ─────────────────────────────────────────── */}
            {errorState.type === "locked" && (
              <LockoutBanner
                lockedUntil={errorState.lockedUntil}
                onExpire={handleLockExpire}
              />
            )}

            {errorState.type === "attempts" && (
              <AttemptsWarning attemptsLeft={errorState.attemptsLeft} />
            )}

            {errorState.type === "generic" && (
              <ErrorBanner message={errorState.message} />
            )}

            {/* ── Username ──────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-sm font-medium flex items-center gap-2"
              >
                <User className="w-3.5 h-3.5 text-primary" />
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={isLoading || isLocked}
                className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all h-11"
              />
            </div>

            {/* ── Password ──────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 text-primary" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading || isLocked}
                  className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLocked}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Submit ────────────────────────────────────────────────── */}
            <Button
              type="submit"
              className="w-full font-semibold h-11 mt-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading || isLocked}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : isLocked ? (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Account Locked
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-muted/40 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Preventive Maintenance Log System.
              All rights reserved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
