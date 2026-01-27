"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is logged in on mount and verify token
    const checkAuth = async () => {
      try {
        const token = authService.getToken();

        // If no token, user is not authenticated
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Verify token with backend
        const verifiedUser = await authService.verifyToken();

        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          // Token is invalid, clear everything
          setUser(null);
          authService.logout();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setUser(null);
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password);

      // IMPORTANT: After login, verify the token to get complete user data
      // This ensures consistency between login and token verification
      const verifiedUser = await authService.verifyToken();

      if (verifiedUser) {
        setUser(verifiedUser);
      } else {
        // Fallback to login response if verify fails
        setUser(data.user);
      }

      return data;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    router.push("/login");
  };

  // Update user state
  const updateUser = (updatedUserData) => {
    setUser((prevUser) => {
      const newUser = { ...prevUser, ...updatedUserData };
      // Also update in localStorage
      const storedAuth = localStorage.getItem("auth");
      if (storedAuth) {
        const auth = JSON.parse(storedAuth);
        localStorage.setItem(
          "auth",
          JSON.stringify({
            ...auth,
            user: newUser,
          }),
        );
      }
      return newUser;
    });
  };

  // Refresh user data from backend
  const refreshUser = async () => {
    try {
      const verifiedUser = await authService.verifyToken();
      if (verifiedUser) {
        setUser(verifiedUser);
        return verifiedUser;
      }
      return null;
    } catch (error) {
      console.error("Failed to refresh user:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, updateUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
