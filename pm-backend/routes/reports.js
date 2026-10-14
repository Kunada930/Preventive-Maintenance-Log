import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Frequency -> interval rules used by the compliance report
const FREQUENCY_RULES = {
  Daily: { days: 1 },
  Weekly: { days: 7 },
  Monthly: { months: 1 },
  Quarterly: { months: 3 },
  Annually: { months: 12 },
};

const FREQUENCY_ORDER = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually"];

// Local (server) date as YYYY-MM-DD. Avoids the UTC off-by-one that
// toISOString() causes for servers running in UTC+8.
function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function validateDates(...dates) {
  for (const d of dates) {
    if (d && !DATE_RE.test(d)) {
      return "Dates must be in YYYY-MM-DD format";
    }
  }
  return null;
}

function parseDateUTC(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addInterval(dateStr, frequency) {
  const rule = FREQUENCY_RULES[frequency];
  const date = parseDateUTC(dateStr);
  if (rule.days) date.setUTCDate(date.getUTCDate() + rule.days);
  else date.setUTCMonth(date.getUTCMonth() + rule.months);
  return date.toISOString().slice(0, 10);
}

// Whole days from a -> b (positive when b is later than a)
function daysBetween(a, b) {
  return Math.round((parseDateUTC(b) - parseDateUTC(a)) / 86400000);
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function safeJsonParse(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Common header block so every report can render the same print header
function buildMeta(req, title, filters = {}) {
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return {
    title,
    generatedAt: new Date().toISOString(),
    generatedBy: req.user.username,
    filters: cleanFilters,
  };
}

// Builds the WHERE clause for queries on `pm_logs l JOIN devices d`
function buildLogFilters({
  startDate,
  endDate,
  deviceId,
  location,
  manufacturer,
  performedBy,
  fullyFunctional,
}) {
  let where = " WHERE 1=1";
  const params = [];

  if (startDate) {
    where += " AND l.date >= ?";
    params.push(startDate);
  }
  if (endDate) {
    where += " AND l.date <= ?";
    params.push(endDate);
  }
  if (deviceId) {
    where += " AND l.device_id = ?";
    params.push(deviceId);
  }
  if (location) {
    where += " AND d.location = ?";
    params.push(location);
  }
  if (manufacturer) {
    where += " AND l.manufacturer = ?";
    params.push(manufacturer);
  }
  if (performedBy) {
    where += " AND l.performed_by = ?";
    params.push(performedBy);
  }
  if (fullyFunctional) {
    where += " AND l.fully_functional = ?";
    params.push(fullyFunctional);
  }

  return { where, params };
}

function formatLogRow(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    location: row.location,
    date: row.date,
    fullyFunctional: row.fully_functional,
    recommendation: row.recommendation,
    findingsSolutions: row.findings_solutions,
    performedBy: row.performed_by,
    validatedBy: row.validated_by,
    acknowledgedBy: row.acknowledged_by,
  };
}

function serverError(res, label, error) {
  console.error(`${label} error:`, error);
  res.status(500).json({
    error: `An error occurred while generating the report`,
    code: "SERVER_ERROR",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PM Log Report (single record, printable form)
// GET /api/reports/pm-log/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/pm-log/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const log = db
      .prepare(
        `SELECT l.*, d.device_id AS device_code, d.location,
                d.responsible_person, d.date_purchased
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         WHERE l.id = ?`,
      )
      .get(id);

    if (!log) {
      return res.status(404).json({
        error: "PM log not found",
        code: "PM_LOG_NOT_FOUND",
      });
    }

    const tasks = db
      .prepare(
        `SELECT * FROM pm_log_tasks
         WHERE pm_log_id = ?
         ORDER BY maintenance_type, id ASC`,
      )
      .all(id);

    // Group by maintenance type with per-group counts
    const groups = {};
    for (const task of tasks) {
      const type = task.maintenance_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push({
        id: task.id,
        taskDescription: task.task_description,
        isChecked: Boolean(task.is_checked),
      });
    }

    const tasksByType = Object.entries(groups).map(
      ([maintenanceType, items]) => ({
        maintenanceType,
        total: items.length,
        checked: items.filter((t) => t.isChecked).length,
        tasks: items,
      }),
    );

    const checkedTasks = tasks.filter((t) => t.is_checked === 1).length;

    res.json({
      report: buildMeta(req, "Preventive Maintenance Log", { pmLogId: id }),
      device: {
        id: log.device_id,
        deviceName: log.device_name,
        serialNumber: log.serial_number,
        manufacturer: log.manufacturer,
        deviceCode: log.device_code,
        location: log.location,
        responsiblePerson: log.responsible_person,
        datePurchased: log.date_purchased,
      },
      log: {
        id: log.id,
        date: log.date,
        fullyFunctional: log.fully_functional,
        recommendation: log.recommendation,
        findingsSolutions: log.findings_solutions,
        performedBy: log.performed_by,
        validatedBy: log.validated_by,
        acknowledgedBy: log.acknowledged_by,
      },
      tasksByType,
      summary: {
        totalTasks: tasks.length,
        checkedTasks,
        uncheckedTasks: tasks.length - checkedTasks,
        completionRate: percent(checkedTasks, tasks.length),
      },
    });
  } catch (error) {
    serverError(res, "PM log report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Device History Report
// GET /api/reports/device-history/:deviceId?startDate=&endDate=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/device-history/:deviceId", authenticateToken, (req, res) => {
  const { deviceId } = req.params;
  const { startDate, endDate } = req.query;

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
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

    const { where, params } = buildLogFilters({
      startDate,
      endDate,
      deviceId,
    });

    const logs = db
      .prepare(
        `SELECT l.*, d.location,
                COALESCE(t.total_tasks, 0) AS total_tasks,
                COALESCE(t.checked_tasks, 0) AS checked_tasks
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         LEFT JOIN (
           SELECT pm_log_id,
                  COUNT(*) AS total_tasks,
                  SUM(is_checked) AS checked_tasks
           FROM pm_log_tasks
           GROUP BY pm_log_id
         ) t ON t.pm_log_id = l.id
         ${where}
         ORDER BY l.date DESC, l.created_at DESC`,
      )
      .all(...params);

    const functionalCount = logs.filter(
      (l) => l.fully_functional === "Yes",
    ).length;

    res.json({
      report: buildMeta(req, "Device History Report", {
        deviceId,
        startDate,
        endDate,
      }),
      device: {
        id: device.id,
        deviceName: device.device_name,
        serialNumber: device.serial_number,
        manufacturer: device.manufacturer,
        deviceCode: device.device_id,
        datePurchased: device.date_purchased,
        responsiblePerson: device.responsible_person,
        location: device.location,
      },
      summary: {
        totalPMs: logs.length,
        lastPMDate: logs.length > 0 ? logs[0].date : null,
        firstPMDate: logs.length > 0 ? logs[logs.length - 1].date : null,
        functionalCount,
        notFunctionalCount: logs.length - functionalCount,
        functionalRate: percent(functionalCount, logs.length),
      },
      logs: logs.map((l) => ({
        ...formatLogRow(l),
        totalTasks: l.total_tasks,
        checkedTasks: l.checked_tasks,
        completionRate: percent(l.checked_tasks, l.total_tasks),
      })),
    });
  } catch (error) {
    serverError(res, "Device history report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PM Compliance / Schedule Report
// GET /api/reports/compliance?location=&status=&asOf=&dueSoonDays=
//
// For every (device, task_frequency) pair defined in pm_checklists, the next
// due date = last PM log date + frequency interval.
// Status: Overdue | Due Soon | On Time | Never Performed
// ─────────────────────────────────────────────────────────────────────────────
router.get("/compliance", authenticateToken, (req, res) => {
  const { location, deviceId, status, asOf } = req.query;
  const dueSoonDays = parseInt(req.query.dueSoonDays ?? 7);

  const dateError = validateDates(asOf);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  const validStatuses = ["Overdue", "Due Soon", "On Time", "Never Performed"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${validStatuses.join(", ")}`,
      code: "INVALID_STATUS",
    });
  }

  if (Number.isNaN(dueSoonDays) || dueSoonDays < 0) {
    return res.status(400).json({
      error: "dueSoonDays must be a non-negative number",
      code: "INVALID_DUE_SOON_DAYS",
    });
  }

  try {
    const today = asOf || todayStr();

    let query = `
      SELECT d.id AS device_id, d.device_name, d.serial_number,
             d.device_id AS device_code, d.location, d.responsible_person,
             c.task_frequency,
             (SELECT MAX(date) FROM pm_logs WHERE device_id = d.id) AS last_pm_date
      FROM devices d
      JOIN (SELECT DISTINCT device_id, task_frequency FROM pm_checklists) c
        ON c.device_id = d.id
      WHERE 1=1`;
    const params = [];

    if (location) {
      query += " AND d.location = ?";
      params.push(location);
    }
    if (deviceId) {
      query += " AND d.id = ?";
      params.push(deviceId);
    }

    const rows = db.prepare(query).all(...params);

    let items = rows.map((row) => {
      let dueDate = null;
      let daysUntilDue = null;
      let itemStatus;

      if (!row.last_pm_date) {
        itemStatus = "Never Performed";
      } else {
        dueDate = addInterval(row.last_pm_date, row.task_frequency);
        daysUntilDue = daysBetween(today, dueDate);

        if (daysUntilDue < 0) itemStatus = "Overdue";
        else if (daysUntilDue <= dueSoonDays) itemStatus = "Due Soon";
        else itemStatus = "On Time";
      }

      return {
        deviceId: row.device_id,
        deviceName: row.device_name,
        serialNumber: row.serial_number,
        deviceCode: row.device_code,
        location: row.location,
        responsiblePerson: row.responsible_person,
        taskFrequency: row.task_frequency,
        lastPMDate: row.last_pm_date,
        dueDate,
        daysUntilDue,
        daysOverdue:
          daysUntilDue !== null && daysUntilDue < 0
            ? Math.abs(daysUntilDue)
            : 0,
        status: itemStatus,
      };
    });

    // Summary is computed before the status filter so the cards stay accurate
    const summary = {
      total: items.length,
      overdue: items.filter((i) => i.status === "Overdue").length,
      dueSoon: items.filter((i) => i.status === "Due Soon").length,
      onTime: items.filter((i) => i.status === "On Time").length,
      neverPerformed: items.filter((i) => i.status === "Never Performed")
        .length,
    };
    summary.complianceRate = percent(
      summary.onTime + summary.dueSoon,
      summary.total,
    );

    if (status) items = items.filter((i) => i.status === status);

    // Worst first: never performed, then most overdue, then soonest due
    const statusRank = {
      "Never Performed": 0,
      Overdue: 1,
      "Due Soon": 2,
      "On Time": 3,
    };
    items.sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        (a.daysUntilDue ?? -Infinity) - (b.daysUntilDue ?? -Infinity) ||
        FREQUENCY_ORDER.indexOf(a.taskFrequency) -
          FREQUENCY_ORDER.indexOf(b.taskFrequency),
    );

    res.json({
      report: buildMeta(req, "PM Compliance Report", {
        location,
        deviceId,
        status,
        asOf: today,
        dueSoonDays,
      }),
      summary,
      items,
    });
  } catch (error) {
    serverError(res, "Compliance report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Device Health / Failures Report
// GET /api/reports/failures?startDate=&endDate=&location=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/failures", authenticateToken, (req, res) => {
  const { startDate, endDate, location, manufacturer } = req.query;

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  try {
    const { where, params } = buildLogFilters({
      startDate,
      endDate,
      location,
      manufacturer,
      fullyFunctional: "No",
    });

    const failures = db
      .prepare(
        `SELECT l.*, d.location
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         ORDER BY l.date DESC, l.created_at DESC`,
      )
      .all(...params);

    const repeatOffenders = db
      .prepare(
        `SELECT l.device_id, l.device_name, l.serial_number, d.location,
                COUNT(*) AS failure_count,
                MAX(l.date) AS last_failure_date
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         GROUP BY l.device_id, l.device_name, l.serial_number, d.location
         HAVING COUNT(*) >= 2
         ORDER BY failure_count DESC, last_failure_date DESC
         LIMIT 10`,
      )
      .all(...params);

    res.json({
      report: buildMeta(req, "Device Health / Failures Report", {
        startDate,
        endDate,
        location,
        manufacturer,
      }),
      summary: {
        totalFailures: failures.length,
        devicesAffected: new Set(failures.map((f) => f.device_id)).size,
      },
      failures: failures.map(formatLogRow),
      repeatOffenders: repeatOffenders.map((r) => ({
        deviceId: r.device_id,
        deviceName: r.device_name,
        serialNumber: r.serial_number,
        location: r.location,
        failureCount: r.failure_count,
        lastFailureDate: r.last_failure_date,
      })),
    });
  } catch (error) {
    serverError(res, "Failures report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Summary Dashboard
// GET /api/reports/summary?startDate=&endDate=&location=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/summary", authenticateToken, (req, res) => {
  const { startDate, endDate, location } = req.query;

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  try {
    const { where, params } = buildLogFilters({ startDate, endDate, location });

    const totals = db
      .prepare(
        `SELECT COUNT(*) AS total_pms,
                COUNT(DISTINCT l.device_id) AS devices_covered,
                SUM(CASE WHEN l.fully_functional = 'Yes' THEN 1 ELSE 0 END) AS functional_count,
                SUM(CASE WHEN l.fully_functional = 'No' THEN 1 ELSE 0 END) AS not_functional_count
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}`,
      )
      .get(...params);

    const taskTotals = db
      .prepare(
        `SELECT COUNT(t.id) AS total_tasks,
                COALESCE(SUM(t.is_checked), 0) AS checked_tasks
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         JOIN pm_log_tasks t ON t.pm_log_id = l.id
         ${where}`,
      )
      .get(...params);

    const pmsPerMonth = db
      .prepare(
        `SELECT strftime('%Y-%m', l.date) AS month,
                COUNT(*) AS pm_count,
                SUM(CASE WHEN l.fully_functional = 'No' THEN 1 ELSE 0 END) AS issue_count
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         GROUP BY month
         ORDER BY month ASC`,
      )
      .all(...params);

    const byLocation = db
      .prepare(
        `SELECT d.location,
                COUNT(*) AS pm_count,
                SUM(CASE WHEN l.fully_functional = 'No' THEN 1 ELSE 0 END) AS issue_count
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         GROUP BY d.location
         ORDER BY issue_count DESC, pm_count DESC`,
      )
      .all(...params);

    const byManufacturer = db
      .prepare(
        `SELECT l.manufacturer,
                COUNT(*) AS pm_count,
                SUM(CASE WHEN l.fully_functional = 'No' THEN 1 ELSE 0 END) AS issue_count
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         GROUP BY l.manufacturer
         ORDER BY issue_count DESC, pm_count DESC`,
      )
      .all(...params);

    let deviceQuery = "SELECT COUNT(*) AS total FROM devices";
    const deviceParams = [];
    if (location) {
      deviceQuery += " WHERE location = ?";
      deviceParams.push(location);
    }
    const { total: totalDevices } = db
      .prepare(deviceQuery)
      .get(...deviceParams);

    res.json({
      report: buildMeta(req, "PM Summary", { startDate, endDate, location }),
      summary: {
        totalPMs: totals.total_pms,
        devicesCovered: totals.devices_covered,
        totalDevices,
        coverageRate: percent(totals.devices_covered, totalDevices),
        functionalCount: totals.functional_count || 0,
        notFunctionalCount: totals.not_functional_count || 0,
        functionalRate: percent(totals.functional_count || 0, totals.total_pms),
        totalTasks: taskTotals.total_tasks,
        checkedTasks: taskTotals.checked_tasks,
        taskCompletionRate: percent(
          taskTotals.checked_tasks,
          taskTotals.total_tasks,
        ),
      },
      pmsPerMonth: pmsPerMonth.map((m) => ({
        month: m.month,
        pmCount: m.pm_count,
        issueCount: m.issue_count,
      })),
      byLocation: byLocation.map((r) => ({
        location: r.location,
        pmCount: r.pm_count,
        issueCount: r.issue_count,
      })),
      byManufacturer: byManufacturer.map((r) => ({
        manufacturer: r.manufacturer,
        pmCount: r.pm_count,
        issueCount: r.issue_count,
      })),
    });
  } catch (error) {
    serverError(res, "Summary report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Technician Activity Report
// GET /api/reports/technicians?startDate=&endDate=&location=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/technicians", authenticateToken, (req, res) => {
  const { startDate, endDate, location } = req.query;

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  try {
    const { where, params } = buildLogFilters({ startDate, endDate, location });

    const rows = db
      .prepare(
        `SELECT l.performed_by,
                COUNT(*) AS pm_count,
                COUNT(DISTINCT l.device_id) AS devices_covered,
                SUM(CASE WHEN l.fully_functional = 'No' THEN 1 ELSE 0 END) AS issues_found,
                MIN(l.date) AS first_pm_date,
                MAX(l.date) AS last_pm_date
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         ${where}
         GROUP BY l.performed_by
         ORDER BY pm_count DESC`,
      )
      .all(...params);

    // Task totals are queried separately so the join doesn't inflate pm_count
    const taskRows = db
      .prepare(
        `SELECT l.performed_by,
                COUNT(t.id) AS total_tasks,
                COALESCE(SUM(t.is_checked), 0) AS checked_tasks
         FROM pm_logs l
         JOIN devices d ON d.id = l.device_id
         JOIN pm_log_tasks t ON t.pm_log_id = l.id
         ${where}
         GROUP BY l.performed_by`,
      )
      .all(...params);

    const taskMap = new Map(taskRows.map((t) => [t.performed_by, t]));

    const technicians = rows.map((r) => {
      const tasks = taskMap.get(r.performed_by) || {
        total_tasks: 0,
        checked_tasks: 0,
      };
      return {
        performedBy: r.performed_by,
        pmCount: r.pm_count,
        devicesCovered: r.devices_covered,
        issuesFound: r.issues_found,
        totalTasks: tasks.total_tasks,
        checkedTasks: tasks.checked_tasks,
        taskCompletionRate: percent(tasks.checked_tasks, tasks.total_tasks),
        firstPMDate: r.first_pm_date,
        lastPMDate: r.last_pm_date,
      };
    });

    res.json({
      report: buildMeta(req, "Technician Activity Report", {
        startDate,
        endDate,
        location,
      }),
      summary: {
        totalTechnicians: technicians.length,
        totalPMs: technicians.reduce((sum, t) => sum + t.pmCount, 0),
      },
      technicians,
    });
  } catch (error) {
    serverError(res, "Technician report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Task Completion Report
// GET /api/reports/task-completion?startDate=&endDate=&deviceId=&location=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/task-completion", authenticateToken, (req, res) => {
  const { startDate, endDate, deviceId, location } = req.query;

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  try {
    const { where, params } = buildLogFilters({
      startDate,
      endDate,
      deviceId,
      location,
    });

    const base = `
      FROM pm_log_tasks t
      JOIN pm_logs l ON l.id = t.pm_log_id
      JOIN devices d ON d.id = l.device_id
      ${where}`;

    const byMaintenanceType = db
      .prepare(
        `SELECT t.maintenance_type,
                COUNT(*) AS total_tasks,
                SUM(t.is_checked) AS checked_tasks
         ${base}
         GROUP BY t.maintenance_type
         ORDER BY t.maintenance_type`,
      )
      .all(...params);

    const byDevice = db
      .prepare(
        `SELECT l.device_id, l.device_name, l.serial_number,
                COUNT(*) AS total_tasks,
                SUM(t.is_checked) AS checked_tasks
         ${base}
         GROUP BY l.device_id, l.device_name, l.serial_number
         ORDER BY (CAST(SUM(t.is_checked) AS REAL) / COUNT(*)) ASC`,
      )
      .all(...params);

    // Tasks that are most often left unchecked
    const mostSkipped = db
      .prepare(
        `SELECT t.task_description, t.maintenance_type,
                COUNT(*) AS times_assigned,
                COUNT(*) - SUM(t.is_checked) AS times_skipped
         ${base}
         GROUP BY t.task_description, t.maintenance_type
         HAVING times_skipped > 0
         ORDER BY times_skipped DESC, times_assigned DESC
         LIMIT 15`,
      )
      .all(...params);

    const totalTasks = byMaintenanceType.reduce((s, r) => s + r.total_tasks, 0);
    const checkedTasks = byMaintenanceType.reduce(
      (s, r) => s + (r.checked_tasks || 0),
      0,
    );

    res.json({
      report: buildMeta(req, "Task Completion Report", {
        startDate,
        endDate,
        deviceId,
        location,
      }),
      summary: {
        totalTasks,
        checkedTasks,
        uncheckedTasks: totalTasks - checkedTasks,
        completionRate: percent(checkedTasks, totalTasks),
      },
      byMaintenanceType: byMaintenanceType.map((r) => ({
        maintenanceType: r.maintenance_type,
        totalTasks: r.total_tasks,
        checkedTasks: r.checked_tasks || 0,
        completionRate: percent(r.checked_tasks || 0, r.total_tasks),
      })),
      byDevice: byDevice.map((r) => ({
        deviceId: r.device_id,
        deviceName: r.device_name,
        serialNumber: r.serial_number,
        totalTasks: r.total_tasks,
        checkedTasks: r.checked_tasks || 0,
        completionRate: percent(r.checked_tasks || 0, r.total_tasks),
      })),
      mostSkippedTasks: mostSkipped.map((r) => ({
        taskDescription: r.task_description,
        maintenanceType: r.maintenance_type,
        timesAssigned: r.times_assigned,
        timesSkipped: r.times_skipped,
        skipRate: percent(r.times_skipped, r.times_assigned),
      })),
    });
  } catch (error) {
    serverError(res, "Task completion report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Inventory Report
// GET /api/reports/inventory?location=&manufacturer=&responsiblePerson=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/inventory", authenticateToken, (req, res) => {
  const { location, manufacturer, responsiblePerson } = req.query;

  try {
    let query = `
      SELECT d.*,
             (SELECT MAX(date) FROM pm_logs WHERE device_id = d.id) AS last_pm_date,
             (SELECT COUNT(*) FROM pm_logs WHERE device_id = d.id) AS pm_count
      FROM devices d
      WHERE 1=1`;
    const params = [];

    if (location) {
      query += " AND d.location = ?";
      params.push(location);
    }
    if (manufacturer) {
      query += " AND d.manufacturer = ?";
      params.push(manufacturer);
    }
    if (responsiblePerson) {
      query += " AND d.responsible_person = ?";
      params.push(responsiblePerson);
    }

    query += " ORDER BY d.location, d.device_name";

    const devices = db.prepare(query).all(...params);
    const today = todayStr();

    const items = devices.map((d) => {
      const ageDays = daysBetween(d.date_purchased, today);
      return {
        id: d.id,
        deviceName: d.device_name,
        serialNumber: d.serial_number,
        deviceCode: d.device_id,
        manufacturer: d.manufacturer,
        location: d.location,
        responsiblePerson: d.responsible_person,
        datePurchased: d.date_purchased,
        ageYears: Math.round((ageDays / 365.25) * 10) / 10,
        lastPMDate: d.last_pm_date,
        pmCount: d.pm_count,
      };
    });

    const countBy = (key) =>
      Object.entries(
        items.reduce((acc, item) => {
          acc[item[key]] = (acc[item[key]] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    res.json({
      report: buildMeta(req, "Device Inventory Report", {
        location,
        manufacturer,
        responsiblePerson,
      }),
      summary: {
        totalDevices: items.length,
        averageAgeYears:
          items.length > 0
            ? Math.round(
                (items.reduce((s, i) => s + i.ageYears, 0) / items.length) * 10,
              ) / 10
            : 0,
        neverMaintained: items.filter((i) => i.pmCount === 0).length,
      },
      byLocation: countBy("location"),
      byManufacturer: countBy("manufacturer"),
      items,
    });
  } catch (error) {
    serverError(res, "Inventory report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Audit Trail Report (admin only)
// GET /api/reports/audit?username=&action=&entity=&startDate=&endDate=&page=&limit=
// ─────────────────────────────────────────────────────────────────────────────
router.get("/audit", authenticateToken, isAdmin, (req, res) => {
  const { username, action, entity, startDate, endDate } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);

  const dateError = validateDates(startDate, endDate);
  if (dateError) {
    return res.status(400).json({ error: dateError, code: "INVALID_DATE" });
  }

  try {
    let where = " WHERE 1=1";
    const params = [];

    if (username) {
      where += " AND username = ?";
      params.push(username);
    }
    if (action) {
      where += " AND action = ?";
      params.push(action);
    }
    if (entity) {
      where += " AND entity = ?";
      params.push(entity);
    }
    if (startDate) {
      where += " AND date(created_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND date(created_at) <= ?";
      params.push(endDate);
    }

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM audit_logs ${where}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT * FROM audit_logs
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, (page - 1) * limit);

    const byAction = db
      .prepare(
        `SELECT action, COUNT(*) AS count FROM audit_logs
         ${where}
         GROUP BY action ORDER BY count DESC`,
      )
      .all(...params);

    res.json({
      report: buildMeta(req, "Audit Trail Report", {
        username,
        action,
        entity,
        startDate,
        endDate,
      }),
      summary: {
        totalEntries: total,
        byAction: byAction.map((a) => ({ action: a.action, count: a.count })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      entries: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        oldValue: safeJsonParse(r.old_value),
        newValue: safeJsonParse(r.new_value),
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    serverError(res, "Audit report", error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter options (populates the dropdowns on the reports filter form)
// GET /api/reports/filter-options
// ─────────────────────────────────────────────────────────────────────────────
router.get("/filter-options", authenticateToken, (req, res) => {
  try {
    const distinct = (sql) =>
      db
        .prepare(sql)
        .all()
        .map((r) => Object.values(r)[0]);

    res.json({
      locations: distinct(
        "SELECT DISTINCT location FROM devices ORDER BY location",
      ),
      manufacturers: distinct(
        "SELECT DISTINCT manufacturer FROM devices ORDER BY manufacturer",
      ),
      responsiblePersons: distinct(
        "SELECT DISTINCT responsible_person FROM devices ORDER BY responsible_person",
      ),
      performers: distinct(
        "SELECT DISTINCT performed_by FROM pm_logs ORDER BY performed_by",
      ),
      devices: db
        .prepare(
          "SELECT id, device_name, serial_number FROM devices ORDER BY device_name",
        )
        .all()
        .map((d) => ({
          id: d.id,
          deviceName: d.device_name,
          serialNumber: d.serial_number,
        })),
    });
  } catch (error) {
    serverError(res, "Filter options", error);
  }
});

export default router;
