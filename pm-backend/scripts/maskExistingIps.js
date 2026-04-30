// scripts/maskExistingIps.js
import "dotenv/config";
import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH || "./db/pmlog.db");

function maskIp(ip) {
  if (!ip) return null;
  const raw = ip.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    return raw.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.xxx.xxx");
  }
  if (raw.includes(":")) {
    const parts = raw.split(":");
    parts[parts.length - 1] = "xxx";
    parts[parts.length - 3] = "xxx";
    return parts.join(":");
  }
  return "xxx.xxx.xxx.xxx";
}

const rows = db.prepare("SELECT id, ip_address FROM audit_logs WHERE ip_address IS NOT NULL").all();

const update = db.prepare("UPDATE audit_logs SET ip_address = ? WHERE id = ?");

const runAll = db.transaction(() => {
  let count = 0;
  for (const row of rows) {
    // Skip already-masked entries
    if (row.ip_address.includes("xxx")) continue;
    update.run(maskIp(row.ip_address), row.id);
    count++;
  }
  return count;
});

const updated = runAll();
console.log(`Done — ${updated} records updated.`);