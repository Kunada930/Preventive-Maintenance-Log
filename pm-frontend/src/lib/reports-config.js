import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarCheck,
  FileText,
  History,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";
// ─────────────────────────────────────────────────────────────────────────────
// Shared filter definitions
// ─────────────────────────────────────────────────────────────────────────────
const startDate = { key: "startDate", label: "From", type: "date" };
const endDate = { key: "endDate", label: "To", type: "date" };
const location = {
  key: "location",
  label: "Location",
  type: "select",
  options: "locations",
};
const manufacturer = {
  key: "manufacturer",
  label: "Manufacturer",
  type: "select",
  options: "manufacturers",
};
const COLORS = {
  blue: "#2563eb",
  red: "#dc2626",
  green: "#16a34a",
  amber: "#f59e0b",
  gray: "#9ca3af",
};
// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────
export const REPORTS = [
  // ── Operational ───────────────────────────────────────────────────────────
  {
    slug: "pm-logs",
    title: "PM Log Reports",
    description:
      "Find a PM log and open the official printable PM form with signature blocks.",
    group: "Operational",
    icon: FileText,
    // Uses your existing pm-logs endpoint
    path: () => "/api/pm-logs",
    filters: [
      {
        key: "deviceId",
        label: "Device",
        type: "select",
        options: "devices",
      },
      startDate,
      endDate,
      {
        key: "fullyFunctional",
        label: "Fully functional",
        type: "select",
        options: ["Yes", "No"],
      },
    ],
    summary: [{ key: "total", label: "Total logs", format: "number" }],
    tables: [
      {
        key: "logs",
        title: "PM Logs",
        rowHref: (row) => `/reports/pm-log/${row.id}`,
        columns: [
          { key: "date", header: "Date", format: "date" },
          { key: "deviceName", header: "Device" },
          { key: "serialNumber", header: "Serial No." },
          { key: "manufacturer", header: "Manufacturer" },
          { key: "fullyFunctional", header: "Functional", format: "badge" },
          { key: "performedBy", header: "Performed By" },
          { key: "validatedBy", header: "Validated By" },
        ],
      },
    ],
  },
  {
    slug: "device-history",
    title: "Device History",
    description:
      "Every PM performed on one device, with functional rate and last PM date.",
    group: "Operational",
    icon: History,
    path: (f) => `/api/reports/device-history/${f.deviceId}`,
    filters: [
      {
        key: "deviceId",
        label: "Device",
        type: "select",
        options: "devices",
        required: true,
      },
      startDate,
      endDate,
    ],
    summary: [
      { key: "totalPMs", label: "Total PMs", format: "number" },
      { key: "lastPMDate", label: "Last PM", format: "date" },
      {
        key: "functionalRate",
        label: "Functional rate",
        format: "percent",
        tone: "success",
      },
      {
        key: "notFunctionalCount",
        label: "Not functional",
        format: "number",
        tone: "danger",
      },
    ],
    tables: [
      {
        key: "logs",
        title: "PM History",
        rowHref: (row) => `/reports/pm-log/${row.id}`,
        columns: [
          { key: "date", header: "Date", format: "date" },
          { key: "performedBy", header: "Performed By" },
          { key: "fullyFunctional", header: "Functional", format: "badge" },
          { key: "completionRate", header: "Tasks Done", format: "percent" },
          { key: "validatedBy", header: "Validated By" },
          { key: "findingsSolutions", header: "Findings / Solutions" },
        ],
      },
    ],
  },
  {
    slug: "compliance",
    title: "PM Compliance",
    description:
      "Which devices are on time, due soon, overdue, or have never had a PM.",
    group: "Operational",
    icon: CalendarCheck,
    path: () => "/api/reports/compliance",
    filters: [
      location,
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["Overdue", "Due Soon", "On Time", "Never Performed"],
      },
      { key: "asOf", label: "As of", type: "date" },
    ],
    summary: [
      { key: "total", label: "Schedules tracked", format: "number" },
      { key: "overdue", label: "Overdue", format: "number", tone: "danger" },
      { key: "dueSoon", label: "Due soon", format: "number", tone: "warning" },
      { key: "onTime", label: "On time", format: "number", tone: "success" },
      { key: "neverPerformed", label: "Never performed", format: "number" },
      { key: "complianceRate", label: "Compliance rate", format: "percent" },
    ],
    charts: [
      {
        title: "Compliance status",
        type: "pie",
        colors: [COLORS.red, COLORS.amber, COLORS.green, COLORS.gray],
        getData: (d) => [
          { name: "Overdue", value: d.summary.overdue },
          { name: "Due Soon", value: d.summary.dueSoon },
          { name: "On Time", value: d.summary.onTime },
          { name: "Never Performed", value: d.summary.neverPerformed },
        ],
      },
    ],
    tables: [
      {
        key: "items",
        title: "Schedule Status",
        columns: [
          { key: "deviceName", header: "Device" },
          { key: "deviceCode", header: "Device ID" },
          { key: "location", header: "Location" },
          { key: "taskFrequency", header: "Frequency" },
          { key: "lastPMDate", header: "Last PM", format: "date" },
          { key: "dueDate", header: "Due Date", format: "date" },
          { key: "daysOverdue", header: "Days Overdue", format: "number" },
          { key: "status", header: "Status", format: "badge" },
        ],
      },
    ],
  },
  {
    slug: "failures",
    title: "Device Health / Failures",
    description:
      "PMs where the device was not fully functional, plus repeat offenders.",
    group: "Operational",
    icon: AlertTriangle,
    path: () => "/api/reports/failures",
    filters: [startDate, endDate, location, manufacturer],
    summary: [
      {
        key: "totalFailures",
        label: "Failed PMs",
        format: "number",
        tone: "danger",
      },
      { key: "devicesAffected", label: "Devices affected", format: "number" },
    ],
    tables: [
      {
        key: "repeatOffenders",
        title: "Repeat Offenders (2+ failures)",
        columns: [
          { key: "deviceName", header: "Device" },
          { key: "serialNumber", header: "Serial No." },
          { key: "location", header: "Location" },
          { key: "failureCount", header: "Failures", format: "number" },
          { key: "lastFailureDate", header: "Last Failure", format: "date" },
        ],
      },
      {
        key: "failures",
        title: "All Failures",
        rowHref: (row) => `/reports/pm-log/${row.id}`,
        columns: [
          { key: "date", header: "Date", format: "date" },
          { key: "deviceName", header: "Device" },
          { key: "location", header: "Location" },
          { key: "performedBy", header: "Performed By" },
          { key: "findingsSolutions", header: "Findings / Solutions" },
          { key: "recommendation", header: "Recommendation" },
        ],
      },
    ],
  },
  // ── Management ────────────────────────────────────────────────────────────
  {
    slug: "summary",
    title: "Summary Dashboard",
    description:
      "Totals, coverage, functional rate and trends for a selected period.",
    group: "Management",
    icon: BarChart3,
    path: () => "/api/reports/summary",
    filters: [startDate, endDate, location],
    summary: [
      { key: "totalPMs", label: "PMs performed", format: "number" },
      { key: "devicesCovered", label: "Devices covered", format: "number" },
      { key: "coverageRate", label: "Device coverage", format: "percent" },
      {
        key: "functionalRate",
        label: "Functional rate",
        format: "percent",
        tone: "success",
      },
      {
        key: "taskCompletionRate",
        label: "Task completion",
        format: "percent",
      },
      {
        key: "notFunctionalCount",
        label: "Not functional",
        format: "number",
        tone: "danger",
      },
    ],
    charts: [
      {
        title: "Fully functional vs not",
        type: "pie",
        colors: [COLORS.green, COLORS.red],
        getData: (d) => [
          { name: "Fully functional", value: d.summary.functionalCount },
          { name: "Not functional", value: d.summary.notFunctionalCount },
        ],
      },
      {
        title: "PMs per month",
        type: "bar",
        getData: (d) => d.pmsPerMonth,
        xKey: "month",
        series: [
          { key: "pmCount", label: "PMs performed", color: COLORS.blue },
          { key: "issueCount", label: "Issues found", color: COLORS.red },
        ],
      },
      {
        title: "PMs and issues by location",
        type: "bar",
        getData: (d) => d.byLocation,
        xKey: "location",
        series: [
          { key: "pmCount", label: "PMs performed", color: COLORS.blue },
          { key: "issueCount", label: "Issues found", color: COLORS.red },
        ],
      },
    ],
    tables: [
      {
        key: "byManufacturer",
        title: "By Manufacturer",
        columns: [
          { key: "manufacturer", header: "Manufacturer" },
          { key: "pmCount", header: "PMs", format: "number" },
          { key: "issueCount", header: "Issues", format: "number" },
        ],
      },
    ],
  },
  {
    slug: "technicians",
    title: "Technician Activity",
    description: "PMs, devices covered and task completion per technician.",
    group: "Management",
    icon: Users,
    path: () => "/api/reports/technicians",
    filters: [startDate, endDate, location],
    summary: [
      { key: "totalTechnicians", label: "Technicians", format: "number" },
      { key: "totalPMs", label: "Total PMs", format: "number" },
    ],
    charts: [
      {
        title: "PMs per technician",
        type: "bar",
        getData: (d) => d.technicians,
        xKey: "performedBy",
        series: [
          { key: "pmCount", label: "PMs performed", color: COLORS.blue },
        ],
      },
    ],
    tables: [
      {
        key: "technicians",
        title: "Technicians",
        columns: [
          { key: "performedBy", header: "Technician" },
          { key: "pmCount", header: "PMs", format: "number" },
          { key: "devicesCovered", header: "Devices", format: "number" },
          { key: "issuesFound", header: "Issues Found", format: "number" },
          {
            key: "taskCompletionRate",
            header: "Task Completion",
            format: "percent",
          },
          { key: "lastPMDate", header: "Last PM", format: "date" },
        ],
      },
    ],
  },
  {
    slug: "task-completion",
    title: "Task Completion",
    description:
      "How many checklist tasks get checked, and which ones are skipped most.",
    group: "Management",
    icon: ListChecks,
    path: () => "/api/reports/task-completion",
    filters: [
      startDate,
      endDate,
      { key: "deviceId", label: "Device", type: "select", options: "devices" },
      location,
    ],
    summary: [
      { key: "totalTasks", label: "Total tasks", format: "number" },
      {
        key: "checkedTasks",
        label: "Checked",
        format: "number",
        tone: "success",
      },
      {
        key: "uncheckedTasks",
        label: "Unchecked",
        format: "number",
        tone: "warning",
      },
      { key: "completionRate", label: "Completion rate", format: "percent" },
    ],
    charts: [
      {
        title: "Completion rate by maintenance type (%)",
        type: "bar",
        getData: (d) => d.byMaintenanceType,
        xKey: "maintenanceType",
        series: [
          { key: "completionRate", label: "Completion %", color: COLORS.green },
        ],
      },
    ],
    tables: [
      {
        key: "mostSkippedTasks",
        title: "Most Skipped Tasks",
        columns: [
          { key: "taskDescription", header: "Task" },
          { key: "maintenanceType", header: "Maintenance Type" },
          { key: "timesAssigned", header: "Assigned", format: "number" },
          { key: "timesSkipped", header: "Skipped", format: "number" },
          { key: "skipRate", header: "Skip Rate", format: "percent" },
        ],
      },
      {
        key: "byDevice",
        title: "By Device (lowest completion first)",
        columns: [
          { key: "deviceName", header: "Device" },
          { key: "serialNumber", header: "Serial No." },
          { key: "totalTasks", header: "Tasks", format: "number" },
          { key: "checkedTasks", header: "Checked", format: "number" },
          { key: "completionRate", header: "Completion", format: "percent" },
        ],
      },
    ],
  },
  {
    slug: "inventory",
    title: "Device Inventory",
    description:
      "All devices with age, last PM date and PM count, for replacement planning.",
    group: "Management",
    icon: Boxes,
    path: () => "/api/reports/inventory",
    filters: [
      location,
      manufacturer,
      {
        key: "responsiblePerson",
        label: "Responsible person",
        type: "select",
        options: "responsiblePersons",
      },
    ],
    summary: [
      { key: "totalDevices", label: "Devices", format: "number" },
      { key: "averageAgeYears", label: "Average age (yrs)", format: "number" },
      {
        key: "neverMaintained",
        label: "Never maintained",
        format: "number",
        tone: "warning",
      },
    ],
    charts: [
      {
        title: "Devices by location",
        type: "bar",
        getData: (d) => d.byLocation,
        xKey: "name",
        series: [{ key: "count", label: "Devices", color: COLORS.blue }],
      },
      {
        title: "Devices by manufacturer",
        type: "bar",
        getData: (d) => d.byManufacturer,
        xKey: "name",
        series: [{ key: "count", label: "Devices", color: COLORS.amber }],
      },
    ],
    tables: [
      {
        key: "items",
        title: "Devices",
        columns: [
          { key: "deviceName", header: "Device" },
          { key: "deviceCode", header: "Device ID" },
          { key: "serialNumber", header: "Serial No." },
          { key: "manufacturer", header: "Manufacturer" },
          { key: "location", header: "Location" },
          { key: "responsiblePerson", header: "Responsible" },
          { key: "datePurchased", header: "Purchased", format: "date" },
          { key: "ageYears", header: "Age (yrs)", format: "number" },
          { key: "lastPMDate", header: "Last PM", format: "date" },
          { key: "pmCount", header: "PMs", format: "number" },
        ],
      },
    ],
  },
  // ── Administration ────────────────────────────────────────────────────────
  {
    slug: "audit",
    title: "Audit Trail",
    description: "Who changed what and when, with old and new values.",
    group: "Administration",
    icon: ShieldCheck,
    adminOnly: true,
    paginated: true,
    path: () => "/api/reports/audit",
    filters: [
      {
        key: "username",
        label: "Username",
        type: "text",
        placeholder: "Exact username",
      },
      {
        key: "action",
        label: "Action",
        type: "select",
        options: ["CREATE", "UPDATE", "DELETE"],
      },
      {
        key: "entity",
        label: "Entity",
        type: "text",
        placeholder: "e.g. pm_log",
      },
      startDate,
      endDate,
    ],
    summary: [
      { key: "totalEntries", label: "Matching entries", format: "number" },
    ],
    tables: [
      {
        key: "entries",
        title: "Audit Entries",
        columns: [
          { key: "createdAt", header: "When", format: "datetime" },
          { key: "username", header: "User" },
          { key: "action", header: "Action", format: "badge" },
          { key: "entity", header: "Entity" },
          { key: "entityId", header: "ID" },
          { key: "oldValue", header: "Old Value", format: "json" },
          { key: "newValue", header: "New Value", format: "json" },
          { key: "ipAddress", header: "IP" },
        ],
      },
    ],
  },
];
export const REPORT_GROUPS = ["Operational", "Management", "Administration"];
export function getReport(slug) {
  return REPORTS.find((r) => r.slug === slug);
}
