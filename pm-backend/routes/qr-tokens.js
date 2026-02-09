import express from "express";
import crypto from "crypto";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Generate QR token for a device (authenticated users only)
router.post("/generate", authenticateToken, (req, res) => {
  const { deviceId, expiresInHours = 24 } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      error: "Device ID is required",
      code: "MISSING_DEVICE_ID",
    });
  }

  try {
    // Verify device exists
    const device = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(deviceId);

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Clean up expired tokens for this device
    db.prepare(
      "DELETE FROM qr_tokens WHERE device_id = ? AND expires_at < datetime('now')",
    ).run(deviceId);

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Store token in database
    const result = db
      .prepare(
        `INSERT INTO qr_tokens (token, device_id, generated_by, expires_at)
       VALUES (?, ?, ?, ?)`,
      )
      .run(token, deviceId, req.user.id, expiresAt.toISOString());

    // Generate QR code URL
    const qrUrl = `${process.env.FRONTEND_URL || "http://172.16.21.12:3000"}/pm-history?token=${token}`;

    res.status(201).json({
      message: "QR token generated successfully",
      token: token,
      qrUrl: qrUrl,
      deviceId: deviceId,
      deviceName: device.device_name,
      expiresAt: expiresAt.toISOString(),
      expiresInHours: expiresInHours,
    });
  } catch (error) {
    console.error("Generate QR token error:", error);
    res.status(500).json({
      error: "An error occurred while generating QR token",
      code: "SERVER_ERROR",
    });
  }
});

// Validate QR token and get device info (public endpoint - no auth required)
router.get("/validate/:token", (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      error: "Token is required",
      code: "MISSING_TOKEN",
    });
  }

  try {
    // Find token in database
    const tokenRecord = db
      .prepare(
        `SELECT qr.*, d.device_name, d.serial_number, d.manufacturer, d.location,
              u.username as generated_by_username
       FROM qr_tokens qr
       JOIN devices d ON qr.device_id = d.id
       LEFT JOIN users u ON qr.generated_by = u.id
       WHERE qr.token = ?`,
      )
      .get(token);

    if (!tokenRecord) {
      return res.status(404).json({
        error: "Invalid QR token",
        code: "INVALID_QR_TOKEN",
      });
    }

    // Check if token expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(403).json({
        error: "QR token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    // Update access count and last accessed time
    db.prepare(
      `UPDATE qr_tokens 
       SET access_count = access_count + 1, 
           last_accessed_at = datetime('now')
       WHERE token = ?`,
    ).run(token);

    // Return device info
    res.json({
      valid: true,
      deviceId: tokenRecord.device_id,
      deviceName: tokenRecord.device_name,
      serialNumber: tokenRecord.serial_number,
      manufacturer: tokenRecord.manufacturer,
      location: tokenRecord.location,
      expiresAt: tokenRecord.expires_at,
      accessCount: tokenRecord.access_count + 1,
    });
  } catch (error) {
    console.error("Validate QR token error:", error);
    res.status(500).json({
      error: "An error occurred while validating token",
      code: "SERVER_ERROR",
    });
  }
});

// Revoke QR token (authenticated users only)
router.delete("/revoke/:token", authenticateToken, (req, res) => {
  const { token } = req.params;

  try {
    const tokenRecord = db
      .prepare("SELECT * FROM qr_tokens WHERE token = ?")
      .get(token);

    if (!tokenRecord) {
      return res.status(404).json({
        error: "Token not found",
        code: "TOKEN_NOT_FOUND",
      });
    }

    // Only allow the user who generated it or admin to revoke
    if (tokenRecord.generated_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Access denied",
        code: "FORBIDDEN",
      });
    }

    // Delete token
    db.prepare("DELETE FROM qr_tokens WHERE token = ?").run(token);

    res.json({
      message: "QR token revoked successfully",
    });
  } catch (error) {
    console.error("Revoke QR token error:", error);
    res.status(500).json({
      error: "An error occurred while revoking token",
      code: "SERVER_ERROR",
    });
  }
});

// Get all QR tokens for a device (authenticated users only)
router.get("/device/:deviceId", authenticateToken, (req, res) => {
  const { deviceId } = req.params;

  try {
    const tokens = db
      .prepare(
        `SELECT qr.*, u.username as generated_by_username
       FROM qr_tokens qr
       LEFT JOIN users u ON qr.generated_by = u.id
       WHERE qr.device_id = ?
       ORDER BY qr.created_at DESC`,
      )
      .all(deviceId);

    res.json({
      tokens: tokens,
      total: tokens.length,
    });
  } catch (error) {
    console.error("Get device QR tokens error:", error);
    res.status(500).json({
      error: "An error occurred while fetching tokens",
      code: "SERVER_ERROR",
    });
  }
});

// Clean up expired tokens (can be called by a cron job or manually)
router.post("/cleanup", authenticateToken, (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM qr_tokens WHERE expires_at < datetime('now')")
      .run();

    res.json({
      message: "Expired tokens cleaned up successfully",
      deletedCount: result.changes,
    });
  } catch (error) {
    console.error("Cleanup QR tokens error:", error);
    res.status(500).json({
      error: "An error occurred during cleanup",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
