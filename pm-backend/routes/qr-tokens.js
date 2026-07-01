import express from "express";
import crypto from "crypto";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import { logAudit } from "../middleware/audit.js";

const router = express.Router();

// ============================================
// Generate QR token for a device
// ============================================
router.post("/generate", authenticateToken, (req, res) => {
  const { deviceId, expiresInHours = 24 } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      error: "Device ID is required",
      code: "MISSING_DEVICE_ID",
    });
  }

  try {
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

    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const result = db
      .prepare(
        `INSERT INTO qr_tokens (token, device_id, generated_by, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(token, deviceId, req.user.id, expiresAt.toISOString());

    const qrUrl = `${process.env.FRONTEND_URL || "http://172.16.20.78:3000"}/pm-history?token=${token}`;

    // Audit: who generated access for which device
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "CREATE",
      entity: "qr_token",
      entityId: result.lastInsertRowid,
      oldValue: null,
      newValue: {
        deviceId,
        deviceName: device.device_name,
        expiresAt: expiresAt.toISOString(),
        expiresInHours,
      },
      ip: req.ip,
    });

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

// ============================================
// Validate QR token — called when QR code is scanned
// (public endpoint, no auth required)
// NOTE: access_count in qr_tokens already tracks scan frequency.
// No audit log needed here — it would create excessive noise
// for every public scan. The qr_tokens table handles this itself.
// ============================================
router.get("/validate/:token", (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      error: "Token is required",
      code: "MISSING_TOKEN",
    });
  }

  try {
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

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(403).json({
        error: "QR token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    db.prepare(
      `UPDATE qr_tokens
       SET access_count = access_count + 1,
           last_accessed_at = datetime('now')
       WHERE token = ?`,
    ).run(token);

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

// ============================================
// Revoke QR token
// ============================================
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

    // Only the generator or an admin can revoke
    if (tokenRecord.generated_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        error: "Access denied",
        code: "FORBIDDEN",
      });
    }

    db.prepare("DELETE FROM qr_tokens WHERE token = ?").run(token);

    // Audit: who revoked access and for which device
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "qr_token",
      entityId: tokenRecord.id,
      oldValue: {
        deviceId: tokenRecord.device_id,
        expiresAt: tokenRecord.expires_at,
        accessCount: tokenRecord.access_count,
        generatedBy: tokenRecord.generated_by,
      },
      newValue: null,
      ip: req.ip,
    });

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

// ============================================
// Get all QR tokens for a device (read-only, no audit)
// ============================================
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

// ============================================
// Cleanup expired tokens
// ============================================
router.post("/cleanup", authenticateToken, (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM qr_tokens WHERE expires_at < datetime('now')")
      .run();

    // Audit: maintenance action worth recording
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "qr_token_cleanup",
      entityId: null,
      oldValue: null,
      newValue: { deletedCount: result.changes },
      ip: req.ip,
    });

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
