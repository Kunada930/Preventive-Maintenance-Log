import "dotenv/config";
import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH || "./db/pmlog.db", {
  fileMustExist: false,
});

db.pragma("foreign_keys = ON");

// Create users table with profile picture
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    lastName TEXT NOT NULL,
    firstName TEXT NOT NULL,
    middleName TEXT NOT NULL,
    position TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    profile_picture TEXT,
    must_change_password INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Create password_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS password_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Create refresh_tokens table
db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Create devices table
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_name TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    manufacturer TEXT NOT NULL,
    device_id TEXT UNIQUE NOT NULL,
    date_purchased TEXT NOT NULL,
    responsible_person TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Create pm_checklists table
db.exec(`
  CREATE TABLE IF NOT EXISTS pm_checklists (
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

// Create pm_tasks table
db.exec(`
  CREATE TABLE IF NOT EXISTS pm_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checklist_id INTEGER NOT NULL,
    task_description TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    completed_by TEXT,
    completed_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (checklist_id) REFERENCES pm_checklists(id) ON DELETE CASCADE
  )
`);

// Create pm_logs table - main preventive maintenance log record
db.exec(`
  CREATE TABLE IF NOT EXISTS pm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    date TEXT NOT NULL,
    fully_functional TEXT NOT NULL CHECK(fully_functional IN ('Yes', 'No')),
    recommendation TEXT,
    performed_by TEXT NOT NULL,
    validated_by TEXT,
    acknowledged_by TEXT,
    findings_solutions TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  )
`);

// Create pm_log_tasks table - description of work (tasks checked during PM)
db.exec(`
  CREATE TABLE IF NOT EXISTS pm_log_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pm_log_id INTEGER NOT NULL,
    task_description TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    is_checked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pm_log_id) REFERENCES pm_logs(id) ON DELETE CASCADE
  )
`);

// ============================================
// NEW: QR Tokens Table for Device History Access
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    device_id INTEGER NOT NULL,
    generated_by INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Create index for faster password history queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);
`);

// Create index for faster refresh token queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
`);

// Create index for faster device queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);
  CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
  CREATE INDEX IF NOT EXISTS idx_devices_responsible_person ON devices(responsible_person);
`);

// Create index for faster PM checklist queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pm_checklists_device_id ON pm_checklists(device_id);
  CREATE INDEX IF NOT EXISTS idx_pm_checklists_maintenance_type ON pm_checklists(maintenance_type);
  CREATE INDEX IF NOT EXISTS idx_pm_checklists_task_frequency ON pm_checklists(task_frequency);
  CREATE INDEX IF NOT EXISTS idx_pm_checklists_created_at ON pm_checklists(created_at);
`);

// Create index for faster PM task queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pm_tasks_checklist_id ON pm_tasks(checklist_id);
  CREATE INDEX IF NOT EXISTS idx_pm_tasks_is_completed ON pm_tasks(is_completed);
`);

// Create index for faster PM log queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pm_logs_device_id ON pm_logs(device_id);
  CREATE INDEX IF NOT EXISTS idx_pm_logs_date ON pm_logs(date);
  CREATE INDEX IF NOT EXISTS idx_pm_logs_fully_functional ON pm_logs(fully_functional);
  CREATE INDEX IF NOT EXISTS idx_pm_logs_performed_by ON pm_logs(performed_by);
`);

// Create index for faster PM log task queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pm_log_tasks_pm_log_id ON pm_log_tasks(pm_log_id);
  CREATE INDEX IF NOT EXISTS idx_pm_log_tasks_is_checked ON pm_log_tasks(is_checked);
`);

// Create index for faster QR token queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_qr_tokens_device_id ON qr_tokens(device_id);
  CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at ON qr_tokens(expires_at);
`);

console.log("Connected to PM Log Database");

export default db;
