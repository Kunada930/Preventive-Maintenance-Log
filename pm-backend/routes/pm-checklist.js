import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Helper function to format checklist response
function formatChecklistResponse(checklist) {
  // Parse maintenance_type if it's a JSON string
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

// Get all checklists
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

// Get checklist by ID with tasks
router.get("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    // Get checklist
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    // Get all tasks for this checklist
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

// Create new checklist (ONE CHECKLIST WITH MULTIPLE MAINTENANCE TYPES)
router.post("/", authenticateToken, (req, res) => {
  const { deviceId, maintenanceTypes, taskFrequency, tasks } = req.body;

  // Validate required fields
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

    // Validate maintenance types
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

    // Validate task frequency
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

    // Convert maintenance types array to JSON string for storage
    const maintenanceTypesJson = JSON.stringify(maintenanceTypes);

    // Prepare statements
    const insertChecklist = db.prepare(`
      INSERT INTO pm_checklists (
        device_id, 
        device_name, 
        serial_number, 
        manufacturer, 
        device_id_number, 
        date_purchased, 
        responsible_person, 
        location,
        maintenance_type, 
        task_frequency
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTask = db.prepare(`
      INSERT INTO pm_tasks (checklist_id, task_description)
      VALUES (?, ?)
    `);

    // Create ONE checklist with all maintenance types
    const transaction = db.transaction(() => {
      // Insert single checklist with JSON array of maintenance types
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

      // Insert all tasks for this checklist
      for (const task of tasks) {
        if (!task.taskDescription || task.taskDescription.trim() === "") {
          throw new Error("Task description cannot be empty");
        }
        insertTask.run(checklistId, task.taskDescription);
      }

      return checklistId;
    });

    const checklistId = transaction();

    // Get the newly created checklist with tasks
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(checklistId);

    const checklistTasks = db
      .prepare("SELECT * FROM pm_tasks WHERE checklist_id = ? ORDER BY id ASC")
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
});

// Update checklist (basic info only)
router.put("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { maintenanceTypes, taskFrequency } = req.body;

  try {
    // Check if checklist exists
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    // Validate maintenance types if provided
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

    // Validate task frequency if provided
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

    // Convert maintenance types to JSON if provided
    const maintenanceTypesJson = maintenanceTypes
      ? JSON.stringify(maintenanceTypes)
      : null;

    // Update checklist
    db.prepare(
      `
      UPDATE pm_checklists 
      SET maintenance_type = COALESCE(?, maintenance_type),
          task_frequency = COALESCE(?, task_frequency),
          updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(maintenanceTypesJson, taskFrequency || null, id);

    // Get updated checklist
    const updatedChecklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

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

// Delete checklist
router.delete("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    // Check if checklist exists
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    // Delete checklist (tasks will be deleted automatically if you have CASCADE)
    // If not, delete tasks first
    db.prepare("DELETE FROM pm_tasks WHERE checklist_id = ?").run(id);
    db.prepare("DELETE FROM pm_checklists WHERE id = ?").run(id);

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

// Create new task for a checklist
router.post("/:id/tasks", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { taskDescription } = req.body;

  try {
    // Check if checklist exists
    const checklist = db
      .prepare("SELECT * FROM pm_checklists WHERE id = ?")
      .get(id);

    if (!checklist) {
      return res.status(404).json({
        error: "Checklist not found",
        code: "CHECKLIST_NOT_FOUND",
      });
    }

    // Validate task description
    if (!taskDescription || taskDescription.trim() === "") {
      return res.status(400).json({
        error: "Task description is required",
        code: "MISSING_TASK_DESCRIPTION",
      });
    }

    // Insert task
    const result = db
      .prepare(
        `
      INSERT INTO pm_tasks (checklist_id, task_description)
      VALUES (?, ?)
    `,
      )
      .run(id, taskDescription);

    // Get the newly created task
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
});

// Update task completion status and notes
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

    // Get current user info for completedBy
    const user = req.user; // This comes from authenticateToken middleware

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

// Update task description
router.put("/tasks/:taskId/description", authenticateToken, (req, res) => {
  const { taskId } = req.params;
  const { taskDescription } = req.body;

  try {
    const task = db.prepare("SELECT * FROM pm_tasks WHERE id = ?").get(taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        code: "TASK_NOT_FOUND",
      });
    }

    // Validate task description
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
});

// Delete task
router.delete("/tasks/:taskId", authenticateToken, (req, res) => {
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
