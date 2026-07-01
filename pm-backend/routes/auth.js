import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  isPasswordReused,
  addPasswordToHistory,
} from "../utils/passwordHistory.js";
import { formatUserResponse } from "../utils/userFormatter.js";
import { logAudit } from "../middleware/audit.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Lockout configuration
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────────────────────────────────────

// Generate access token (short-lived)
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "15m" },
  );
}

// Generate refresh token (long-lived, random hex)
function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

// Persist refresh token in DB (7-day expiry)
function storeRefreshToken(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  db.prepare(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  ).run(userId, token, expiresAt.toISOString());
}

// Remove all expired refresh tokens (run on every login/refresh)
function cleanExpiredTokens() {
  db.prepare(
    "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')",
  ).run();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
      code: "MISSING_CREDENTIALS",
    });
  }

  try {
    // Fetch user including the two new lockout columns
    const user = db
      .prepare(
        `SELECT
          id, username, password, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          failed_login_attempts, locked_until
         FROM users WHERE username = ?`,
      )
      .get(username);

    // ── User not found ───────────────────────────────────────────────────────
    // Return the same generic message as a wrong password to prevent
    // username enumeration attacks.
    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // ── Check active lockout ─────────────────────────────────────────────────
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      const now = new Date();

      if (now < lockedUntil) {
        // Account is still locked — tell the user exactly how long to wait
        const msLeft = lockedUntil - now;
        const minutesLeft = Math.ceil(msLeft / 1000 / 60);

        return res.status(423).json({
          error: `Account is locked. Try again in ${minutesLeft} minute(s).`,
          code: "ACCOUNT_LOCKED",
          lockedUntil: lockedUntil.toISOString(),
        });
      }

      // Lock window has passed — auto-reset before proceeding
      db.prepare(
        `UPDATE users
         SET failed_login_attempts = 0,
             locked_until = NULL,
             updated_at = datetime('now')
         WHERE id = ?`,
      ).run(user.id);

      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    // ── Validate password ────────────────────────────────────────────────────
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      const newAttempts = (user.failed_login_attempts ?? 0) + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // ── Lock the account ─────────────────────────────────────────────────
        const lockedUntil = new Date(
          Date.now() + LOCK_DURATION_MS,
        ).toISOString();

        db.prepare(
          `UPDATE users
           SET failed_login_attempts = ?,
               locked_until = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
        ).run(newAttempts, lockedUntil, user.id);

        // Audit the lockout event so admins can see it in the audit log
        logAudit({
          userId: user.id,
          username: user.username,
          action: "ACCOUNT_LOCKED",
          entity: "auth",
          entityId: user.id,
          oldValue: null,
          newValue: {
            lockedUntil,
            reason: "Exceeded maximum failed login attempts",
          },
          ip: req.ip,
        });

        return res.status(423).json({
          error:
            "Account locked due to too many failed attempts. Try again in 1 hour.",
          code: "ACCOUNT_LOCKED",
          lockedUntil,
        });
      }

      // ── Increment counter, not yet locked ───────────────────────────────────
      db.prepare(
        `UPDATE users
         SET failed_login_attempts = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      ).run(newAttempts, user.id);

      const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts;

      return res.status(401).json({
        error: `Invalid username or password. ${attemptsLeft} attempt(s) remaining before lockout.`,
        code: "INVALID_CREDENTIALS",
        attemptsLeft,
      });
    }

    // ── Successful login — reset lockout counters ────────────────────────────
    db.prepare(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    cleanExpiredTokens();
    storeRefreshToken(user.id, refreshToken);

    // Audit successful login
    logAudit({
      userId: user.id,
      username: user.username,
      action: "LOGIN",
      entity: "auth",
      entityId: user.id,
      oldValue: null,
      newValue: null,
      ip: req.ip,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Login successful",
      token: accessToken,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "An error occurred during login",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
router.post("/refresh", (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      error: "Refresh token not found",
      code: "NO_REFRESH_TOKEN",
    });
  }

  try {
    cleanExpiredTokens();

    const tokenRecord = db
      .prepare("SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?")
      .get(refreshToken);

    if (!tokenRecord) {
      return res.status(403).json({
        error: "Invalid refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(
        refreshToken,
      );

      return res.status(403).json({
        error: "Refresh token expired",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    const user = db
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(tokenRecord.user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const accessToken = generateAccessToken(user);

    return res.json({
      message: "Token refreshed successfully",
      token: accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      error: "Token refresh failed",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/verify
// ─────────────────────────────────────────────────────────────────────────────
router.get("/verify", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password
         FROM users WHERE id = ?`,
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return res.json({
      valid: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Verify token error:", error);
    return res.status(500).json({
      error: "Token verification failed",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.post("/change-password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Current password and new password are required",
      code: "MISSING_FIELDS",
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: "New password must be at least 8 characters long",
      code: "WEAK_PASSWORD",
    });
  }

  try {
    const user = db
      .prepare("SELECT password, username, role FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Current password is incorrect",
        code: "INVALID_PASSWORD",
      });
    }

    const passwordReused = await isPasswordReused(userId, newPassword);

    if (passwordReused) {
      return res.status(400).json({
        error: "Cannot reuse any of your previous passwords",
        code: "PASSWORD_REUSED",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.prepare(
      `UPDATE users
       SET password = ?,
           must_change_password = 0,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(hashedPassword, userId);

    addPasswordToHistory(userId, user.password);

    const updatedUser = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password
         FROM users WHERE id = ?`,
      )
      .get(userId);

    const accessToken = generateAccessToken({
      id: userId,
      username: user.username,
      role: user.role,
    });

    // Audit password change — never log the actual hash values
    logAudit({
      userId: userId,
      username: user.username,
      action: "UPDATE",
      entity: "auth",
      entityId: userId,
      oldValue: null,
      newValue: null,
      ip: req.ip,
    });

    return res.json({
      message: "Password changed successfully",
      token: accessToken,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      error: "An error occurred while changing password",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get("/profile", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password, created_at
         FROM users WHERE id = ?`,
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return res.json({ user: formatUserResponse(user) });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      error: "An error occurred while fetching profile",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post("/logout", authenticateToken, (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken);
  }

  // Audit logout
  logAudit({
    userId: req.user.id,
    username: req.user.username,
    action: "LOGOUT",
    entity: "auth",
    entityId: req.user.id,
    oldValue: null,
    newValue: null,
    ip: req.ip,
  });

  res.clearCookie("refreshToken");

  return res.json({ message: "Logout successful" });
});

export default router;
