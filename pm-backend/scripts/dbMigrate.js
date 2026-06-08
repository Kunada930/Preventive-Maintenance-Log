import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Resolve the DB path relative to the project root (one level up from scripts/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dbPath = process.env.DB_PATH || path.join(projectRoot, "db", "pmlog.db");

const db = new Database(dbPath, {
  fileMustExist: true, // DB must already exist — this is a migration, not a seed
});

db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────────────────────────────────────
// Migration tracking table
// Each migration runs exactly once. Once recorded in this table it is never
// re-executed, even if the server restarts or the script is run again.
// ─────────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT UNIQUE NOT NULL,
    applied_at TEXT DEFAULT (datetime('now'))
  )
`);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run a migration by name only if it hasn't been applied yet
// ─────────────────────────────────────────────────────────────────────────────
function runMigration(name, fn) {
  const already = db
    .prepare("SELECT id FROM migrations WHERE name = ?")
    .get(name);

  if (already) {
    console.log(`  [skip]    ${name}`);
    return;
  }

  // Run the migration inside a transaction so it either fully succeeds
  // or fully rolls back — no half-applied state
  const apply = db.transaction(() => {
    fn(db);
    db.prepare("INSERT INTO migrations (name) VALUES (?)").run(name);
  });

  try {
    apply();
    console.log(`  [applied] ${name}`);
  } catch (err) {
    console.error(`  [FAILED]  ${name}:`, err.message);
    process.exit(1); // Stop immediately — don't run subsequent migrations
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrations — add new ones at the bottom, never edit existing ones
// ─────────────────────────────────────────────────────────────────────────────

runMigration("001_add_lockout_columns_to_users", (db) => {
  db.exec(`
    ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0
  `);
  db.exec(`
    ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL
  `);
});

runMigration("002_add_index_users_locked_until", (db) => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until)
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// Done
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nAll migrations complete.\n");
db.close();
