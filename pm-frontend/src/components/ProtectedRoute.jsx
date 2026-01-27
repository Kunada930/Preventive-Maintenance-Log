"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for auth check to complete
    if (loading) return;

    // Public routes that don't require authentication
    const publicRoutes = ["/login", "/"];

    // If no user and trying to access protected route
    if (!user && !publicRoutes.includes(pathname)) {
      router.push("/login");
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
  }, [user, loading, pathname, router]);

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
  const pagesWithoutSidebar = ["/login", "/", "/change-password"];
  const shouldShowSidebar = user && !pagesWithoutSidebar.includes(pathname);

  // If user is authenticated and on a protected page, show with sidebar
  if (shouldShowSidebar) {
    return <AppLayout>{children}</AppLayout>;
  }

  // Otherwise render without sidebar (login, change password, etc.)
  return <>{children}</>;
}
