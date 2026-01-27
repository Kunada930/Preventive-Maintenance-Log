"use client";

import { useState } from "react";
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
import { Eye, EyeOff, Lock, User, LogIn, Shield } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await login(formData.username, formData.password);

      if (data.user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/pm-logs");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-muted/40 backdrop-blur-sm bg-card/95 relative z-10">
        <CardHeader className="space-y-4 flex flex-col items-center pb-8 pt-8">
          {/* Logo with gradient background */}
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
            {error && (
              <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-lg text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                <span className="text-base mt-0.5">⚠</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

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
                disabled={isLoading}
                className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all h-11"
              />
            </div>

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
                  disabled={isLoading}
                  className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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

            <Button
              type="submit"
              className="w-full font-semibold h-11 mt-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
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
              © {new Date().getFullYear()} Preventive Maintenace Log System. All
              rights reserved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
