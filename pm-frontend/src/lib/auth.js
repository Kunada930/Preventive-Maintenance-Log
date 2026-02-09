// lib/auth.js

const API_URL =
  process.env.NEXT_PUBLIC_AUTH_URL || "http://172.16.21.12:4000/api/auth";

class AuthService {
  constructor() {
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  // Subscribe to token refresh
  subscribeTokenRefresh(callback) {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers when token is refreshed
  onTokenRefreshed(token) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  async login(username, password) {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important: includes cookies
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Store access token and user data (refresh token is in httpOnly cookie)
    localStorage.setItem("token", data.token);
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: data.user, token: data.token }),
    );

    return data;
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${API_URL}/refresh`, {
        method: "POST",
        credentials: "include", // Important: sends refresh token cookie
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      // Update stored access token
      localStorage.setItem("token", data.token);
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      localStorage.setItem(
        "auth",
        JSON.stringify({
          ...auth,
          token: data.token,
        }),
      );

      return data.token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.logout();
      throw error;
    }
  }

  async verifyToken() {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        // Try to refresh token
        try {
          await this.refreshAccessToken();
          // Retry verification with new token
          return await this.verifyToken();
        } catch (refreshError) {
          this.logout();
          return null;
        }
      }

      const data = await response.json();

      // Update stored user data with fresh data from server
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      localStorage.setItem(
        "auth",
        JSON.stringify({
          ...auth,
          user: data.user,
        }),
      );

      return data.user;
    } catch (error) {
      console.error("Token verification failed:", error);
      this.logout();
      return null;
    }
  }

  getCurrentUser() {
    const auth = localStorage.getItem("auth");
    if (auth) {
      try {
        const { user } = JSON.parse(auth);
        return user;
      } catch (error) {
        console.error("Failed to parse auth data:", error);
        this.logout();
        return null;
      }
    }
    return null;
  }

  getToken() {
    return localStorage.getItem("token");
  }

  // QR Token Management
  getQRToken() {
    return sessionStorage.getItem("qrAccessToken");
  }

  setQRToken(token) {
    sessionStorage.setItem("qrAccessToken", token);
  }

  clearQRToken() {
    sessionStorage.removeItem("qrAccessToken");
  }

  isQRAccess() {
    return !!this.getQRToken();
  }

  async logout() {
    const token = this.getToken();

    // Call logout endpoint to revoke refresh token
    if (token) {
      try {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include", // Important: sends refresh token cookie
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    // Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("auth");

    // Clear QR token if exists
    this.clearQRToken();
  }

  isAuthenticated() {
    const token = this.getToken();
    const qrToken = this.getQRToken();
    return !!(token || qrToken);
  }

  // Enhanced fetchWithAuth with automatic token refresh AND QR token support
  async fetchWithAuth(url, options = {}) {
    // Check for QR token first
    const qrToken = this.getQRToken();

    if (qrToken) {
      // QR token access - add as query parameter
      const separator = url.includes("?") ? "&" : "?";
      const qrUrl = `${url}${separator}qrToken=${qrToken}`;

      return fetch(qrUrl, {
        ...options,
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      });
    }

    // Regular authenticated access
    const token = this.getToken();

    if (!token) {
      throw new Error("No authentication token found");
    }

    const makeRequest = async (accessToken) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: includes cookies
      });
    };

    let response = await makeRequest(token);

    // If token expired, try to refresh
    if (response.status === 401) {
      const data = await response.json();

      if (data.code === "TOKEN_EXPIRED") {
        // If already refreshing, wait for it
        if (this.isRefreshing) {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((newToken) => {
              resolve(makeRequest(newToken));
            });
          });
        }

        this.isRefreshing = true;

        try {
          // Refresh the token
          const newToken = await this.refreshAccessToken();
          this.isRefreshing = false;
          this.onTokenRefreshed(newToken);

          // Retry the original request with new token
          response = await makeRequest(newToken);
        } catch (refreshError) {
          this.isRefreshing = false;
          this.logout();
          window.location.href = "/login";
          throw refreshError;
        }
      } else if (data.code === "INVALID_TOKEN" || data.code === "NO_TOKEN") {
        // Token is completely invalid, logout
        this.logout();
        window.location.href = "/login";
      }
    }

    return response;
  }

  // Helper method for change password
  async changePassword(username, currentPassword, newPassword) {
    const response = await this.fetchWithAuth(`${API_URL}/change-password`, {
      method: "POST",
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Password change failed");
    }

    // Update stored token
    localStorage.setItem("token", data.token);
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    localStorage.setItem(
      "auth",
      JSON.stringify({
        ...auth,
        user: data.user,
        token: data.token,
      }),
    );

    return data;
  }
}

export const authService = new AuthService();
