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

console.log("Connected to PM Log Database");

export default db;
