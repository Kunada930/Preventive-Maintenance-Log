import "dotenv/config";
import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH || "./db/pmlog.db", {
  fileMustExist: true, // Database should already exist
});

db.pragma("foreign_keys = OFF"); // Temporarily disable foreign keys for migration

console.log(
  "Starting migration: Remove CHECK constraint from maintenance_type...",
);

try {
  // Begin transaction
  db.prepare("BEGIN TRANSACTION").run();

  // Step 1: Create new table without the CHECK constraint on maintenance_type
  console.log("Creating new pm_checklists table structure...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_checklists_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      device_id_number TEXT NOT NULL,
      date_purchased TEXT NOT NULL,
      responsible_person TEXT NOT NULL,
      location TEXT NOT NULL,
      maintenance_type TEXT NOT NULL,
      task_frequency TEXT NOT NULL CHECK(task_frequency IN ('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    )
  `);

  // Step 2: Copy existing data
  console.log("Copying existing checklist data...");
  db.exec(`
    INSERT INTO pm_checklists_new 
    SELECT * FROM pm_checklists
  `);

  const copiedRows = db
    .prepare("SELECT COUNT(*) as count FROM pm_checklists_new")
    .get();
  console.log(`Copied ${copiedRows.count} checklist(s)`);

  // Step 3: Drop old table
  console.log("Dropping old pm_checklists table...");
  db.exec("DROP TABLE pm_checklists");

  // Step 4: Rename new table
  console.log("Renaming new table to pm_checklists...");
  db.exec("ALTER TABLE pm_checklists_new RENAME TO pm_checklists");

  // Step 5: Recreate indexes
  console.log("🔍 Recreating indexes...");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pm_checklists_device_id ON pm_checklists(device_id);
    CREATE INDEX IF NOT EXISTS idx_pm_checklists_maintenance_type ON pm_checklists(maintenance_type);
    CREATE INDEX IF NOT EXISTS idx_pm_checklists_task_frequency ON pm_checklists(task_frequency);
    CREATE INDEX IF NOT EXISTS idx_pm_checklists_created_at ON pm_checklists(created_at);
  `);

  // Commit transaction
  db.prepare("COMMIT").run();

  console.log("Migration completed successfully!");
  console.log("The maintenance_type column can now store JSON arrays.");
  console.log(
    "💡 You can now create checklists with multiple maintenance types.",
  );
} catch (error) {
  // Rollback on error
  console.error("Migration failed:", error.message);
  try {
    db.prepare("ROLLBACK").run();
    console.log("Transaction rolled back");
  } catch (rollbackError) {
    console.error("Rollback failed:", rollbackError.message);
  }
  process.exit(1);
} finally {
  // Re-enable foreign keys
  db.pragma("foreign_keys = ON");
  db.close();
  console.log("Database connection closed");
}
