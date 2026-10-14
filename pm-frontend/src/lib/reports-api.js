// The only file the reports pages use to talk to the backend. It builds on
// authService.fetchWithAuth, so the access token, automatic refresh and
// redirect-to-login on expiry all work the same as the rest of your app.

import { authService } from "@/lib/auth";

// Backend origin (no trailing path). Derived from your existing auth URL
// (".../api/auth"), so no new env variable is needed. Set NEXT_PUBLIC_API_URL
// only if you want to override it.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (
    process.env.NEXT_PUBLIC_AUTH_URL || "http://172.16.20.78:4000/api/auth"
  ).replace(/\/api\/auth\/?$/, "");

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// path: "/api/reports/compliance"  params: { location: "Rack A", page: 2 }
export async function apiFetch(path, params = {}) {
  const url = new URL(path, API_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await authService.fetchWithAuth(url.toString());
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      body?.error ?? "Failed to load report",
      res.status,
      body?.code,
    );
  }

  return body;
}
