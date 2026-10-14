export function formatValue(value, format = "text") {
  if (value === null || value === undefined || value === "") return "—";
  switch (format) {
    case "percent":
      return `${value}%`;
    case "number":
      return Number(value).toLocaleString();
    case "date": {
      const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
      return isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    }
    case "datetime": {
      // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC; ISO strings already have a Z
      const s = String(value).replace(" ", "T");
      const d = new Date(/Z$|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
      return isNaN(d.getTime())
        ? String(value)
        : d.toLocaleString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
    }
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return String(value);
  }
}
const BADGE_STYLES = {
  // Compliance
  Overdue:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  "Due Soon":
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "On Time":
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  "Never Performed":
    "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  // Fully functional
  Yes: "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  No: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  // Audit actions
  CREATE:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  UPDATE:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  DELETE:
    "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};
export function badgeClass(value) {
  return BADGE_STYLES[String(value)] ?? "";
}
export function todayLocal() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}
function csvCell(value) {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function downloadCsv(filename, columns, rows) {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")),
  ];
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
