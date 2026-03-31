import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";
import { logAudit, auditMiddleware } from "../middleware/audit.js";

const router = express.Router();

// Helper function to format checklist response
function formatChecklistResponse(checklist) {
  let maintenanceType = checklist.maintenance_type;
  try {
    maintenanceType = JSON.parse(checklist.maintenance_type);
  } catch (e) {
    // If it's not JSON, keep it as is (for backward compatibility)
  }

  return {
    id: checklist.id,
    deviceId: checklist.device_id,
    deviceName: checklist.device_name,
    serialNumber: checklist.serial_number,
    manufacturer: checklist.manufacturer,
    deviceIdNumber: checklist.device_id_number,
    datePurchased: checklist.date_purchased,
    responsiblePerson: checklist.responsible_person,
    location: checklist.location,
    maintenanceType: maintenanceType,
    taskFrequency: checklist.task_frequency,
    createdAt: checklist.created_at,
    updatedAt: checklist.updated_at,
  };
}

// Helper function to format task response
function formatTaskResponse(task) {
  return {
    id: task.id,
    checklistId: task.checklist_id,
    taskDescription: task.task_description,
    isCompleted: Boolean(task.is_completed),
    completedBy: task.completed_by,
    completedAt: task.completed_at,
    notes: task.notes,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// ============================================
// GET all checklists (all authenticated users)
// ============================================
router.get("/", authenticateToken, (req, res) => {
  try {
    const checklists = db
      .prepare("SELECT * FROM pm_checklists ORDER BY created_at DESC")
      .all();

    res.json({
      checklists: checklists.map(formatChecklistResponse),
    });
  } catch (error) {
    console.error("Fetch checklists error:", error);
    res.status(500).json({
      error: "An error occurred while fetching checklists",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// GET single checklist by ID with tasks
// ============================================
router.get("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    const tasks = db
      .prepare("SELECT * FROM pm_tasks WHERE checklist_id = ? ORDER BY id ASC")
      .all(id);

    res.json({
      checklist: formatChecklistResponse(checklist),
      tasks: tasks.map(formatTaskResponse),
    });
  } catch (error) {
    console.error("Fetch checklist error:", error);
    res.status(500).json({
      error: "An error occurred while fetching checklist",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// CREATE checklist — audit via middleware
// ============================================
router.post(
  "/",
  authenticateToken,
  auditMiddleware("CREATE", "pm_checklist"),
  (req, res) => {
    const { deviceId, maintenanceTypes, taskFrequency, tasks } = req.body;

    if (
      !deviceId ||
      !maintenanceTypes ||
      !Array.isArray(maintenanceTypes) ||
      maintenanceTypes.length === 0 ||
      !taskFrequency ||
      !tasks ||
      !Array.isArray(tasks)
    ) {
      return res.status(400).json({
        error:
          "Device ID, maintenance types array, task frequency, and tasks array are required",
        code: "MISSING_FIELDS",
      });
    }

    if (tasks.length === 0) {
      return res.status(400).json({
        error: "At least one task is required",
        code: "NO_TASKS",
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

      const validMaintenanceTypes = [
        "Hardware Maintenance",
        "Software Maintenance",
        "Storage Maintenance",
        "Network and Connectivity",
        "Power Source",
        "Performance and Optimization",
      ];

      for (const type of maintenanceTypes) {
        if (!validMaintenanceTypes.includes(type)) {
          return res.status(400).json({
            error: `Invalid maintenance type: ${type}`,
            code: "INVALID_MAINTENANCE_TYPE",
          });
        }
      }

      const validFrequencies = [
        "Daily",
        "Weekly",
        "Monthly",
        "Quarterly",
        "Annually",
      ];
      if (!validFrequencies.includes(taskFrequency)) {
        return res.status(400).json({
          error:
            "Invalid task frequency. Must be: Daily, Weekly, Monthly, Quarterly, or Annually",
          code: "INVALID_FREQUENCY",
        });
      }

      const maintenanceTypesJson = JSON.stringify(maintenanceTypes);

      const insertChecklist = db.prepare(`
        INSERT INTO pm_checklists (
          device_id, device_name, serial_number, manufacturer,
          device_id_number, date_purchased, responsible_person,
          location, maintenance_type, task_frequency
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertTask = db.prepare(`
        INSERT INTO pm_tasks (checklist_id, task_description)
        VALUES (?, ?)
      `);

      const transaction = db.transaction(() => {
        const checklistResult = insertChecklist.run(
          device.id,
          device.device_name,
          device.serial_number,
          device.manufacturer,
          device.device_id,
          device.date_purchased,
          device.responsible_person,
          device.location,
          maintenanceTypesJson,
          taskFrequency,
        );

        const checklistId = checklistResult.lastInsertRowid;

        for (const task of tasks) {
          if (!task.taskDescription || task.taskDescription.trim() === "") {
            throw new Error("Task description cannot be empty");
          }
          insertTask.run(checklistId, task.taskDescription);
        }

        return checklistId;
      });

      const checklistId = transaction();

      const checklist = db
        .prepare("SELECT * FROM pm_checklists WHERE id = ?")
        .get(checklistId);

      const checklistTasks = db
        .prepare(
          "SELECT * FROM pm_tasks WHERE checklist_id = ? ORDER BY id ASC",
        )
        .all(checklistId);

      res.status(201).json({
        message: "Checklist created successfully",
        checklist: formatChecklistResponse(checklist),
        tasks: checklistTasks.map(formatTaskResponse),
      });
    } catch (error) {
      console.error("Create checklist error:", error);
      res.status(500).json({
        error: error.message || "An error occurred while creating checklist",
        code: "SERVER_ERROR",
      });
    }
  },
);

// ============================================
// UPDATE checklist — logAudit directly (needs old/new snapshot)
// ============================================
router.put("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { maintenanceTypes, taskFrequency } = req.body;

  try {
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    if (maintenanceTypes) {
      if (!Array.isArray(maintenanceTypes) || maintenanceTypes.length === 0) {
        return res.status(400).json({
          error: "Maintenance types must be a non-empty array",
          code: "INVALID_MAINTENANCE_TYPES",
        });
      }

      const validMaintenanceTypes = [
        "Hardware Maintenance",
        "Software Maintenance",
        "Storage Maintenance",
        "Network and Connectivity",
        "Power Source",
        "Performance and Optimization",
      ];

      for (const type of maintenanceTypes) {
        if (!validMaintenanceTypes.includes(type)) {
          return res.status(400).json({
            error: `Invalid maintenance type: ${type}`,
            code: "INVALID_MAINTENANCE_TYPE",
          });
        }
      }
    }

    if (taskFrequency) {
      const validFrequencies = [
        "Daily",
        "Weekly",
        "Monthly",
        "Quarterly",
        "Annually",
      ];
      if (!validFrequencies.includes(taskFrequency)) {
        return res.status(400).json({
          error:
            "Invalid task frequency. Must be: Daily, Weekly, Monthly, Quarterly, or Annually",
          code: "INVALID_FREQUENCY",
        });
      }
    }

    const maintenanceTypesJson = maintenanceTypes
      ? JSON.stringify(maintenanceTypes)
      : null;

    db.prepare(
      `
      UPDATE pm_checklists
      SET maintenance_type = COALESCE(?, maintenance_type),
          task_frequency = COALESCE(?, task_frequency),
          updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(maintenanceTypesJson, taskFrequency || null, id);

    const updatedChecklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    // Audit with before/after snapshot
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "UPDATE",
      entity: "pm_checklist",
      entityId: parseInt(id),
      oldValue: formatChecklistResponse(checklist),
      newValue: formatChecklistResponse(updatedChecklist),
      ip: req.ip,
    });

    res.json({
      message: "Checklist updated successfully",
      checklist: formatChecklistResponse(updatedChecklist),
    });
  } catch (error) {
    console.error("Update checklist error:", error);
    res.status(500).json({
      error: "An error occurred while updating checklist",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// DELETE checklist (admin only)
// ============================================
router.delete("/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    db.prepare("DELETE FROM pm_tasks WHERE checklist_id = ?").run(id);
    db.prepare("DELETE FROM pm_checklists WHERE id = ?").run(id);

    // Audit before the record is gone
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "pm_checklist",
      entityId: parseInt(id),
      oldValue: formatChecklistResponse(checklist),
      newValue: null,
      ip: req.ip,
    });

    res.json({
      message: "Checklist deleted successfully",
      checklist: formatChecklistResponse(checklist),
    });
  } catch (error) {
    console.error("Delete checklist error:", error);
    res.status(500).json({
      error: "An error occurred while deleting checklist",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// CREATE task for a checklist — audit via middleware
// ============================================
router.post(
  "/:id/tasks",
  authenticateToken,
  auditMiddleware("CREATE", "pm_checklist_task"),
  (req, res) => {
    const { id } = req.params;
    const { taskDescription } = req.body;

    try {
      const checklist = db
        .prepare("SELECT * FROM pm_checklists WHERE id = ?")
        .get(id);

      if (!checklist) {
        return res.status(404).json({
          error: "Checklist not found",
          code: "CHECKLIST_NOT_FOUND",
        });
      }

      if (!taskDescription || taskDescription.trim() === "") {
        return res.status(400).json({
          error: "Task description is required",
          code: "MISSING_TASK_DESCRIPTION",
        });
      }

      const result = db
        .prepare(
          `INSERT INTO pm_tasks (checklist_id, task_description) VALUES (?, ?)`,
        )
        .run(id, taskDescription);

      const newTask = db
        .prepare("SELECT * FROM pm_tasks WHERE id = ?")
        .get(result.lastInsertRowid);

      res.status(201).json({
        message: "Task created successfully",
        task: formatTaskResponse(newTask),
      });
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({
        error: "An error occurred while creating task",
        code: "SERVER_ERROR",
      });
    }
  },
);

// ============================================
// UPDATE task completion status and notes
// ============================================
router.put("/tasks/:taskId", authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const { isCompleted, notes } = req.body;

  try {
    const task = db.prepare("SELECT * FROM pm_tasks WHERE id = ?").get(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
      });
    }

    const user = req.user;

    db.prepare(
      `
      UPDATE pm_tasks
      SET is_completed = ?,
          notes = ?,
          completed_by = ?,
          completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      isCompleted ? 1 : 0,
      notes || null,
      isCompleted ? user.username : null,
      isCompleted ? 1 : 0,
      taskId,
    );

    const updatedTask = db
      .prepare("SELECT * FROM pm_tasks WHERE id = ?")
      .get(taskId);

    // Audit with before/after snapshot
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "UPDATE",
      entity: "pm_checklist_task",
      entityId: parseInt(taskId),
      oldValue: formatTaskResponse(task),
      newValue: formatTaskResponse(updatedTask),
      ip: req.ip,
    });

    res.json({
      message: "Task updated successfully",
      task: formatTaskResponse(updatedTask),
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({
      error: "An error occurred while updating task",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// UPDATE task description (admin only)
// ============================================
router.put(
  "/tasks/:taskId/description",
  authenticateToken,
  isAdmin,
  (req, res) => {
    const { taskId } = req.params;
    const { taskDescription } = req.body;

    try {
      const task = db
        .prepare("SELECT * FROM pm_tasks WHERE id = ?")
        .get(taskId);

      if (!task) {
        return res.status(404).json({
          error: "Task not found",
          code: "TASK_NOT_FOUND",
        });
      }

      if (!taskDescription || taskDescription.trim() === "") {
        return res.status(400).json({
          error: "Task description is required",
          code: "MISSING_TASK_DESCRIPTION",
        });
      }

      db.prepare(
        `
        UPDATE pm_tasks
        SET task_description = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(taskDescription, taskId);

      const updatedTask = db
        .prepare("SELECT * FROM pm_tasks WHERE id = ?")
        .get(taskId);

      // Audit with before/after snapshot
      logAudit({
        userId: req.user.id,
        username: req.user.username,
        action: "UPDATE",
        entity: "pm_checklist_task",
        entityId: parseInt(taskId),
        oldValue: formatTaskResponse(task),
        newValue: formatTaskResponse(updatedTask),
        ip: req.ip,
      });

      res.json({
        message: "Task description updated successfully",
        task: formatTaskResponse(updatedTask),
      });
    } catch (error) {
      console.error("Update task description error:", error);
      res.status(500).json({
        error: "An error occurred while updating task description",
        code: "SERVER_ERROR",
      });
    }
  },
);

// ============================================
// DELETE task (admin only)
// ============================================
router.delete("/tasks/:taskId", authenticateToken, isAdmin, (req, res) => {
  const { taskId } = req.params;

  try {
    const task = db.prepare("SELECT * FROM pm_tasks WHERE id = ?").get(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
      });
    }

    db.prepare("DELETE FROM pm_tasks WHERE id = ?").run(taskId);

    // Audit before deletion
    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "pm_checklist_task",
      entityId: parseInt(taskId),
      oldValue: formatTaskResponse(task),
      newValue: null,
      ip: req.ip,
    });

    res.json({
      message: "Task deleted successfully",
      task: formatTaskResponse(task),
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      error: "An error occurred while deleting task",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
