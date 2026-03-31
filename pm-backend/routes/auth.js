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

// Generate refresh token (long-lived)
function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

// Store refresh token in database
function storeRefreshToken(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  db.prepare(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  ).run(userId, token, expiresAt.toISOString());
}

// Clean up expired refresh tokens
function cleanExpiredTokens() {
  db.prepare(
    "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')",
  ).run();
}

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
      code: "MISSING_CREDENTIALS",
    });
  }

  try {
    const user = db
      .prepare(
        "SELECT id, username, password, lastName, firstName, middleName, position, role, profile_picture, must_change_password FROM users WHERE username = ?",
      )
      .get(username);

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid username or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    cleanExpiredTokens();
    storeRefreshToken(user.id, refreshToken);

    // Audit login
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

    res.json({
      message: "Login successful",
      token: accessToken,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "An error occurred during login",
      code: "SERVER_ERROR",
    });
  }
});

// Refresh token route
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

    res.json({
      message: "Token refreshed successfully",
      token: accessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      error: "Token refresh failed",
      code: "SERVER_ERROR",
    });
  }
});

// Verify token route
router.get("/verify", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        "SELECT id, username, lastName, firstName, middleName, position, role, profile_picture, must_change_password FROM users WHERE id = ?",
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({
      valid: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Verify token error:", error);
    res.status(500).json({
      error: "Token verification failed",
      code: "SERVER_ERROR",
    });
  }
});

// Change password route
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
      "UPDATE users SET password = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
    ).run(hashedPassword, userId);

    addPasswordToHistory(userId, user.password);

    const updatedUser = db
      .prepare(
        "SELECT id, username, lastName, firstName, middleName, position, role, profile_picture, must_change_password FROM users WHERE id = ?",
      )
      .get(userId);

    const accessToken = generateAccessToken({
      id: userId,
      username: user.username,
      role: user.role,
    });

    // Audit password change
    logAudit({
      userId: userId,
      username: user.username,
      action: "UPDATE",
      entity: "auth",
      entityId: userId,
      oldValue: null, // never log password hashes
      newValue: null,
      ip: req.ip,
    });

    res.json({
      message: "Password changed successfully",
      token: accessToken,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      error: "An error occurred while changing password",
      code: "SERVER_ERROR",
    });
  }
});

// Get current user profile
router.get("/profile", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        "SELECT id, username, lastName, firstName, middleName, position, role, profile_picture, must_change_password, created_at FROM users WHERE id = ?",
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "An error occurred while fetching profile",
      code: "SERVER_ERROR",
    });
  }
});

// Logout route
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

  res.json({
    message: "Logout successful",
  });
});

export default router;
