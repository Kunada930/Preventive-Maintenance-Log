"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { authService } from "@/lib/auth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is PM history page with QR token
    const qrToken = searchParams.get("token");
    const isPMHistoryWithQR = pathname === "/pm-history" && qrToken;

    // If PM history with QR token, store it and allow access
    if (isPMHistoryWithQR) {
      console.log("PM history with QR token detected - allowing public access");
      authService.setQRToken(qrToken);
      return; // Skip all other auth checks
    }

    // Wait for auth check to complete
    if (loading) return;

    // Public routes that don't require authentication
    const publicRoutes = ["/login", "/", "/pm-history"];

    // If no user and trying to access protected route
    if (!user && !publicRoutes.includes(pathname)) {
      router.push("/login");
      return;
    }

    // RBAC: Admin-only routes
    const adminOnlyRoutes = ["/settings"];
    const isAdminRoute = adminOnlyRoutes.some((route) =>
      pathname.startsWith(route),
    );

    // If non-admin user tries to access admin route, redirect
    if (user && user.role !== "admin" && isAdminRoute) {
      console.warn("Non-admin user attempted to access admin route");
      router.push("/pm-logs"); // Redirect to default page
      return;
    }

    // If user exists and must change password
    if (user && user.mustChangePassword && pathname !== "/change-password") {
      router.push("/change-password");
      return;
    }

    // If user changed password and still on change-password page
    if (user && !user.mustChangePassword && pathname === "/change-password") {
      router.push("/pm-logs");
      return;
    }

    // If user is logged in and tries to access login page
    if (user && pathname === "/login") {
      if (user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/pm-logs");
      }
    }
  }, [user, loading, pathname, searchParams, router]);

  // Check for QR token access
  const qrToken = searchParams.get("token");
  const isPMHistoryWithQR = pathname === "/pm-history" && qrToken;

  // Allow immediate render for PM history with QR token
  if (isPMHistoryWithQR) {
    return <>{children}</>;
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Pages that should NOT have the sidebar
  const pagesWithoutSidebar = [
    "/login",
    "/",
    "/change-password",
    "/pm-history",
  ];
  const shouldShowSidebar = user && !pagesWithoutSidebar.includes(pathname);

  // If user is authenticated and on a protected page, show with sidebar
  if (shouldShowSidebar) {
    return <AppLayout>{children}</AppLayout>;
  }

  // Otherwise render without sidebar (login, change password, pm-history, etc.)
  return <>{children}</>;
}
