import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Helper function to format PM log response
function formatPMLogResponse(log) {
  return {
    id: log.id,
    deviceId: log.device_id,
    deviceName: log.device_name,
    serialNumber: log.serial_number,
    manufacturer: log.manufacturer,
    date: log.date,
    fullyFunctional: log.fully_functional,
    recommendation: log.recommendation,
    performedBy: log.performed_by,
    validatedBy: log.validated_by,
    acknowledgedBy: log.acknowledged_by,
    findingsSolutions: log.findings_solutions,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
  };
}

// Helper function to format PM log task response
function formatPMLogTaskResponse(task) {
  return {
    id: task.id,
    pmLogId: task.pm_log_id,
    taskDescription: task.task_description,
    maintenanceType: task.maintenance_type,
    isChecked: Boolean(task.is_checked),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// Middleware to validate QR token OR regular auth
function authenticateOrQRToken(req, res, next) {
  // Check if QR token is provided in query params
  const qrToken = req.query.qrToken || req.headers["x-qr-token"];

  if (qrToken) {
    try {
      // Validate QR token
      const tokenRecord = db
        .prepare("SELECT * FROM qr_tokens WHERE token = ?")
        .get(qrToken);

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

      // Update access count
      db.prepare(
        `UPDATE qr_tokens 
         SET access_count = access_count + 1, 
             last_accessed_at = datetime('now')
         WHERE token = ?`,
      ).run(qrToken);

      // Attach QR token info to request
      req.qrAccess = {
        deviceId: tokenRecord.device_id,
        token: qrToken,
      };

      return next();
    } catch (error) {
      console.error("QR token validation error:", error);
      return res.status(500).json({
        error: "Token validation failed",
        code: "SERVER_ERROR",
      });
    }
  }

  // Fall back to regular authentication
  return authenticateToken(req, res, next);
}

// Get all PM logs
router.get("/", authenticateToken, (req, res) => {
  const { deviceId, startDate, endDate, fullyFunctional } = req.query;

  try {
    let query = "SELECT * FROM pm_logs WHERE 1=1";
    const params = [];

    if (deviceId) {
      query += " AND device_id = ?";
      params.push(deviceId);
    }

    if (fullyFunctional) {
      query += " AND fully_functional = ?";
      params.push(fullyFunctional);
    }

    if (startDate) {
      query += " AND date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      query += " AND date <= ?";
      params.push(endDate);
    }

    query += " ORDER BY date DESC, created_at DESC";

    const logs = db.prepare(query).all(...params);

    res.json({
      logs: logs.map(formatPMLogResponse),
      total: logs.length,
    });
  } catch (error) {
    console.error("Get PM logs error:", error);
    res.status(500).json({
      error: "An error occurred while fetching PM logs",
      code: "SERVER_ERROR",
    });
  }
});

// Get PM logs by device (with history) - SUPPORTS QR TOKEN ACCESS
router.get("/device/:deviceId", authenticateOrQRToken, (req, res) => {
  const { deviceId } = req.params;
  const { limit = 10 } = req.query;

  try {
    // If QR access, verify the token matches the device
    if (req.qrAccess) {
      if (parseInt(req.qrAccess.deviceId) !== parseInt(deviceId)) {
        return res.status(403).json({
          error: "QR token is not valid for this device",
          code: "DEVICE_MISMATCH",
        });
      }
    }

    // Check if device exists
    const device = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(deviceId);

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Get PM logs for this device
    const logs = db
      .prepare(
        `SELECT * FROM pm_logs 
         WHERE device_id = ? 
         ORDER BY date DESC, created_at DESC 
         LIMIT ?`,
      )
      .all(deviceId, parseInt(limit));

    // Get the last PM date
    const lastPM = logs.length > 0 ? logs[0] : null;

    // Get logs with task counts
    const logsWithTasks = logs.map((log) => {
      const taskStats = db
        .prepare(
          `SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) as checked_tasks
           FROM pm_log_tasks
           WHERE pm_log_id = ?`,
        )
        .get(log.id);

      return {
        ...formatPMLogResponse(log),
        totalTasks: taskStats.total_tasks,
        checkedTasks: taskStats.checked_tasks,
      };
    });

    res.json({
      device: {
        id: device.id,
        deviceName: device.device_name,
        serialNumber: device.serial_number,
        manufacturer: device.manufacturer,
        model: device.model,
        location: device.location,
      },
      lastPMDate: lastPM ? lastPM.date : null,
      lastPMPerformedBy: lastPM ? lastPM.performed_by : null,
      logs: logsWithTasks,
      total: logs.length,
      accessMode: req.qrAccess ? "qr" : "authenticated",
    });
  } catch (error) {
    console.error("Get device PM logs error:", error);
    res.status(500).json({
      error: "An error occurred while fetching device PM logs",
      code: "SERVER_ERROR",
    });
  }
});

// Get single PM log with tasks - SUPPORTS QR TOKEN ACCESS
router.get("/:id", authenticateOrQRToken, (req, res) => {
  const { id } = req.params;

  try {
    const log = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(id);

    if (!log) {
      return res.status(404).json({
        error: "PM log not found",
        code: "PM_LOG_NOT_FOUND",
      });
    }

    // If QR access, verify the token matches the device
    if (req.qrAccess) {
      if (parseInt(req.qrAccess.deviceId) !== parseInt(log.device_id)) {
        return res.status(403).json({
          error: "QR token is not valid for this device",
          code: "DEVICE_MISMATCH",
        });
      }
    }

    // Get all tasks for this log
    const tasks = db
      .prepare(
        `SELECT * FROM pm_log_tasks 
         WHERE pm_log_id = ? 
         ORDER BY maintenance_type, id ASC`,
      )
      .all(id);

    // Group tasks by maintenance type
    const tasksByType = tasks.reduce((acc, task) => {
      const type = task.maintenance_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(formatPMLogTaskResponse(task));
      return acc;
    }, {});

    // Calculate statistics
    const stats = {
      totalTasks: tasks.length,
      checkedTasks: tasks.filter((t) => t.is_checked === 1).length,
      uncheckedTasks: tasks.filter((t) => t.is_checked === 0).length,
    };

    res.json({
      log: formatPMLogResponse(log),
      tasks: tasks.map(formatPMLogTaskResponse),
      tasksByType,
      statistics: stats,
      accessMode: req.qrAccess ? "qr" : "authenticated",
    });
  } catch (error) {
    console.error("Get PM log error:", error);
    res.status(500).json({
      error: "An error occurred while fetching PM log",
      code: "SERVER_ERROR",
    });
  }
});

// Create new PM log
router.post("/", authenticateToken, (req, res) => {
  const {
    deviceId,
    date,
    fullyFunctional,
    recommendation,
    performedBy,
    validatedBy,
    acknowledgedBy,
    findingsSolutions,
  } = req.body;

  // Validate required fields
  if (!deviceId || !date || !fullyFunctional || !performedBy) {
    return res.status(400).json({
      error:
        "Device ID, date, fully functional status, and performed by are required",
      code: "MISSING_FIELDS",
    });
  }

  // Validate fullyFunctional value
  if (!["Yes", "No"].includes(fullyFunctional)) {
    return res.status(400).json({
      error: 'Fully functional must be either "Yes" or "No"',
      code: "INVALID_FULLY_FUNCTIONAL",
    });
  }

  try {
    // Get device details
    const device = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(deviceId);

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Create transaction to create log and copy tasks
    const transaction = db.transaction(() => {
      // Insert PM log
      const logResult = db
        .prepare(
          `INSERT INTO pm_logs (
            device_id, 
            device_name, 
            serial_number, 
            manufacturer, 
            date, 
            fully_functional, 
            recommendation, 
            performed_by, 
            validated_by, 
            acknowledged_by, 
            findings_solutions
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          device.id,
          device.device_name,
          device.serial_number,
          device.manufacturer,
          date,
          fullyFunctional,
          recommendation || null,
          performedBy,
          validatedBy || null,
          acknowledgedBy || null,
          findingsSolutions || null,
        );

      const logId = logResult.lastInsertRowid;

      // Get all checklists and tasks for this device
      const checklists = db
        .prepare(
          `SELECT * FROM pm_checklists 
           WHERE device_id = ? 
           ORDER BY maintenance_type`,
        )
        .all(deviceId);

      // Copy all tasks from checklists to pm_log_tasks
      for (const checklist of checklists) {
        const tasks = db
          .prepare("SELECT * FROM pm_tasks WHERE checklist_id = ?")
          .all(checklist.id);

        for (const task of tasks) {
          db.prepare(
            `INSERT INTO pm_log_tasks (pm_log_id, task_description, maintenance_type)
             VALUES (?, ?, ?)`,
          ).run(logId, task.task_description, checklist.maintenance_type);
        }
      }

      return logId;
    });

    const logId = transaction();

    // Get the newly created log with tasks
    const newLog = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(logId);
    const tasks = db
      .prepare("SELECT * FROM pm_log_tasks WHERE pm_log_id = ?")
      .all(logId);

    res.status(201).json({
      message: "PM log created successfully",
      log: formatPMLogResponse(newLog),
      tasks: tasks.map(formatPMLogTaskResponse),
    });
  } catch (error) {
    console.error("Create PM log error:", error);
    res.status(500).json({
      error: "An error occurred while creating PM log",
      code: "SERVER_ERROR",
    });
  }
});

// Update PM log
router.put("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const {
    date,
    fullyFunctional,
    recommendation,
    performedBy,
    validatedBy,
    acknowledgedBy,
    findingsSolutions,
  } = req.body;

  try {
    const log = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(id);

    if (!log) {
      return res.status(404).json({
        error: "PM log not found",
        code: "PM_LOG_NOT_FOUND",
      });
    }

    // Validate fullyFunctional if provided
    if (fullyFunctional && !["Yes", "No"].includes(fullyFunctional)) {
      return res.status(400).json({
        error: 'Fully functional must be either "Yes" or "No"',
        code: "INVALID_FULLY_FUNCTIONAL",
      });
    }

    // Update PM log
    db.prepare(
      `UPDATE pm_logs 
       SET date = COALESCE(?, date),
           fully_functional = COALESCE(?, fully_functional),
           recommendation = COALESCE(?, recommendation),
           performed_by = COALESCE(?, performed_by),
           validated_by = COALESCE(?, validated_by),
           acknowledged_by = COALESCE(?, acknowledged_by),
           findings_solutions = COALESCE(?, findings_solutions),
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      date || null,
      fullyFunctional || null,
      recommendation !== undefined ? recommendation : null,
      performedBy || null,
      validatedBy !== undefined ? validatedBy : null,
      acknowledgedBy !== undefined ? acknowledgedBy : null,
      findingsSolutions !== undefined ? findingsSolutions : null,
      id,
    );

    const updatedLog = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(id);

    res.json({
      message: "PM log updated successfully",
      log: formatPMLogResponse(updatedLog),
    });
  } catch (error) {
    console.error("Update PM log error:", error);
    res.status(500).json({
      error: "An error occurred while updating PM log",
      code: "SERVER_ERROR",
    });
  }
});

// Delete PM log (admin only) - ADD isAdmin middleware
router.delete("/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const log = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(id);

    if (!log) {
      return res.status(404).json({
        error: "PM log not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Delete PM log (tasks will be deleted automatically due to CASCADE)
    db.prepare("DELETE FROM pm_logs WHERE id = ?").run(id);

    res.json({
      message: "PM log deleted successfully",
      log: formatPMLogResponse(log),
    });
  } catch (error) {
    console.error("Delete PM log error:", error);
    res.status(500).json({
      error: "An error occurred while deleting PM log",
      code: "SERVER_ERROR",
    });
  }
});

// Update PM log task (check/uncheck)
router.put("/tasks/:taskId", authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const { isChecked } = req.body;

  if (isChecked === undefined) {
    return res.status(400).json({
      error: "isChecked field is required",
      code: "MISSING_FIELD",
    });
  }

  try {
    const task = db
      .prepare("SELECT * FROM pm_log_tasks WHERE id = ?")
      .get(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
      });
    }

    db.prepare(
      `UPDATE pm_log_tasks 
       SET is_checked = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(isChecked ? 1 : 0, taskId);

    const updatedTask = db
      .prepare("SELECT * FROM pm_log_tasks WHERE id = ?")
      .get(taskId);

    res.json({
      message: "Task updated successfully",
      task: formatPMLogTaskResponse(updatedTask),
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({
      error: "An error occurred while updating task",
      code: "SERVER_ERROR",
    });
  }
});

// Add a new task to a PM log manually
router.post("/:id/tasks", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { taskDescription, maintenanceType } = req.body;

  if (!taskDescription || !maintenanceType) {
    return res.status(400).json({
      error: "Task description and maintenance type are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // Check if PM log exists
    const log = db.prepare("SELECT * FROM pm_logs WHERE id = ?").get(id);

    if (!log) {
      return res.status(404).json({
        error: "PM log not found",
        code: "PM_LOG_NOT_FOUND",
      });
    }

    // Validate maintenance type
    const validMaintenanceTypes = [
      "Hardware Maintenance",
      "Software Maintenance",
      "Storage Maintenance",
      "Network and Connectivity",
      "Power Source",
      "Performance and Optimization",
    ];

    if (!validMaintenanceTypes.includes(maintenanceType)) {
      return res.status(400).json({
        error: "Invalid maintenance type",
        code: "INVALID_MAINTENANCE_TYPE",
      });
    }

    // Insert new task
    const result = db
      .prepare(
        `INSERT INTO pm_log_tasks (pm_log_id, task_description, maintenance_type)
         VALUES (?, ?, ?)`,
      )
      .run(id, taskDescription, maintenanceType);

    const newTask = db
      .prepare("SELECT * FROM pm_log_tasks WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: "Task added successfully",
      task: formatPMLogTaskResponse(newTask),
    });
  } catch (error) {
    console.error("Add task error:", error);
    res.status(500).json({
      error: "An error occurred while adding task",
      code: "SERVER_ERROR",
    });
  }
});

// Delete a task from PM log (admin only) - ADD isAdmin middleware
router.delete("/tasks/:taskId", authenticateToken, isAdmin, (req, res) => {
  const { taskId } = req.params;

  try {
    const task = db
      .prepare("SELECT * FROM pm_log_tasks WHERE id = ?")
      .get(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
      });
    }

    db.prepare("DELETE FROM pm_log_tasks WHERE id = ?").run(taskId);

    res.json({
      message: "Task deleted successfully",
      task: formatPMLogTaskResponse(task),
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      error: "An error occurred while deleting task",
      code: "SERVER_ERROR",
    });
  }
});

// Get statistics
router.get("/statistics/overview", authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    let dateFilter = "";
    const params = [];

    if (startDate) {
      dateFilter += " AND date >= ?";
      params.push(startDate);
    }

    if (endDate) {
      dateFilter += " AND date <= ?";
      params.push(endDate);
    }

    // Get overall statistics
    const stats = db
      .prepare(
        `SELECT 
          COUNT(*) as total_logs,
          SUM(CASE WHEN fully_functional = 'Yes' THEN 1 ELSE 0 END) as functional_count,
          SUM(CASE WHEN fully_functional = 'No' THEN 1 ELSE 0 END) as not_functional_count
         FROM pm_logs
         WHERE 1=1 ${dateFilter}`,
      )
      .get(...params);

    // Get logs by device
    const logsByDevice = db
      .prepare(
        `SELECT 
          device_id,
          device_name,
          COUNT(*) as log_count,
          MAX(date) as last_pm_date
         FROM pm_logs
         WHERE 1=1 ${dateFilter}
         GROUP BY device_id, device_name
         ORDER BY last_pm_date DESC`,
      )
      .all(...params);

    res.json({
      statistics: stats,
      logsByDevice: logsByDevice,
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      error: "An error occurred while fetching statistics",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
