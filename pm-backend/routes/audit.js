import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET /api/audit — paginated, filterable audit log (admin only)
router.get("/", authenticateToken, isAdmin, (req, res) => {
  const {
    userId,
    action,
    entity,
    startDate,
    endDate,
    page = 1,
    limit = 15,
  } = req.query;

  try {
    let conditions = [];
    let params = [];

    if (userId) {
      conditions.push("user_id = ?");
      params.push(userId);
    }
    if (action) {
      conditions.push("action = ?");
      params.push(action);
    }
    if (entity) {
      conditions.push("entity = ?");
      params.push(entity);
    }
    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(startDate);
    }
    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(endDate + " 23:59:59");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count for pagination
    const { count } = db
      .prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`)
      .get(...params);

    // Get paginated results
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = db
      .prepare(
        `SELECT * FROM audit_logs ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, parseInt(limit), offset);

    res.json({
      logs: logs.map((log) => ({
        ...log,
        old_value: log.old_value ? JSON.parse(log.old_value) : null,
        new_value: log.new_value ? JSON.parse(log.new_value) : null,
      })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({
      error: "Failed to fetch audit logs",
      code: "SERVER_ERROR",
    });
  }
});

// GET /api/audit/:id — single audit entry detail (admin only)
router.get("/:id", authenticateToken, isAdmin, (req, res) => {
  try {
    const entry = db
      .prepare("SELECT * FROM audit_logs WHERE id = ?")
      .get(req.params.id);

    if (!entry) {
      return res.status(404).json({
        error: "Audit entry not found",
        code: "NOT_FOUND",
      });
    }

    res.json({
      ...entry,
      old_value: entry.old_value ? JSON.parse(entry.old_value) : null,
      new_value: entry.new_value ? JSON.parse(entry.new_value) : null,
    });
  } catch (error) {
    console.error("Fetch audit entry error:", error);
    res.status(500).json({
      error: "Failed to fetch audit entry",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
