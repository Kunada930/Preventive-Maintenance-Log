// lib/auth.js

const API_URL =
  process.env.NEXT_PUBLIC_AUTH_URL || "http://172.16.20.78:4000/api/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Structured auth error — carries the backend's code, attemptsLeft, and
// lockedUntil fields through to the UI instead of collapsing them into a
// plain string message.
// ─────────────────────────────────────────────────────────────────────────────
export class AuthError extends Error {
  constructor({ message, code, attemptsLeft, lockedUntil }) {
    super(message);
    this.name = "AuthError";
    this.code = code || null;
    this.attemptsLeft = attemptsLeft ?? null;
    this.lockedUntil = lockedUntil ? new Date(lockedUntil) : null;
  }
}

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

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(username, password) {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Throw a structured error so the login page can read code,
      // attemptsLeft, and lockedUntil — not just the message string.
      throw new AuthError({
        message: data.error || "Login failed",
        code: data.code,
        attemptsLeft: data.attemptsLeft,
        lockedUntil: data.lockedUntil,
      });
    }

    // Store access token and user data (refresh token is in httpOnly cookie)
    localStorage.setItem("token", data.token);
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: data.user, token: data.token }),
    );

    return data;
  }

  // ── Refresh access token ───────────────────────────────────────────────────
  async refreshAccessToken() {
    try {
      const response = await fetch(`${API_URL}/refresh`, {
        method: "POST",
        credentials: "include",
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
        JSON.stringify({ ...auth, token: data.token }),
      );

      return data.token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.logout();
      throw error;
    }
  }

  // ── Verify token ───────────────────────────────────────────────────────────
  async verifyToken() {
    const token = this.getToken();

    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!response.ok) {
        try {
          await this.refreshAccessToken();
          return await this.verifyToken();
        } catch {
          this.logout();
          return null;
        }
      }

      const data = await response.json();

      // Update stored user data with fresh data from server
      const auth = JSON.parse(localStorage.getItem("auth") || "{}");
      localStorage.setItem(
        "auth",
        JSON.stringify({ ...auth, user: data.user }),
      );

      return data.user;
    } catch (error) {
      console.error("Token verification failed:", error);
      this.logout();
      return null;
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  getCurrentUser() {
    const auth = localStorage.getItem("auth");
    if (auth) {
      try {
        const { user } = JSON.parse(auth);
        return user;
      } catch {
        this.logout();
        return null;
      }
    }
    return null;
  }

  getToken() {
    return localStorage.getItem("token");
  }

  // ── QR Token Management ────────────────────────────────────────────────────
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

  // ── Logout ─────────────────────────────────────────────────────────────────
  async logout() {
    const token = this.getToken();

    if (token) {
      try {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    localStorage.removeItem("token");
    localStorage.removeItem("auth");
    this.clearQRToken();
  }

  isAuthenticated() {
    return !!(this.getToken() || this.getQRToken());
  }

  // ── fetchWithAuth — automatic token refresh + QR token support ────────────
  async fetchWithAuth(url, options = {}) {
    const qrToken = this.getQRToken();

    if (qrToken) {
      const separator = url.includes("?") ? "&" : "?";
      return fetch(`${url}${separator}qrToken=${qrToken}`, {
        ...options,
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      });
    }

    const token = this.getToken();

    if (!token) throw new Error("No authentication token found");

    const makeRequest = async (accessToken) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

    let response = await makeRequest(token);

    if (response.status === 401) {
      const data = await response.json();

      if (data.code === "TOKEN_EXPIRED") {
        if (this.isRefreshing) {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((newToken) => {
              resolve(makeRequest(newToken));
            });
          });
        }

        this.isRefreshing = true;

        try {
          const newToken = await this.refreshAccessToken();
          this.isRefreshing = false;
          this.onTokenRefreshed(newToken);
          response = await makeRequest(newToken);
        } catch (refreshError) {
          this.isRefreshing = false;
          this.logout();
          window.location.href = "/login";
          throw refreshError;
        }
      } else if (data.code === "INVALID_TOKEN" || data.code === "NO_TOKEN") {
        this.logout();
        window.location.href = "/login";
      }
    }

    return response;
  }

  // ── Change password ────────────────────────────────────────────────────────
  async changePassword(username, currentPassword, newPassword) {
    const response = await this.fetchWithAuth(`${API_URL}/change-password`, {
      method: "POST",
      body: JSON.stringify({ username, currentPassword, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Password change failed");
    }

    localStorage.setItem("token", data.token);
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    localStorage.setItem(
      "auth",
      JSON.stringify({ ...auth, user: data.user, token: data.token }),
    );

    return data;
  }
}

export const authService = new AuthService();
