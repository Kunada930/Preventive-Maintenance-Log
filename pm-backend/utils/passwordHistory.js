import bcrypt from "bcrypt";
import db from "../database.js";

// Number of previous passwords to check (you can adjust this)
const PASSWORD_HISTORY_LIMIT = 100;

/**
 * Check if the new password matches any of the user's previous passwords
 * @param {number} userId - The user's ID
 * @param {string} newPassword - The plain text new password
 * @returns {Promise<boolean>} - Returns true if password was used before, false otherwise
 */
export async function isPasswordReused(userId, newPassword) {
  try {
    // Get the user's password history (limited to last N passwords)
    const passwordHistory = db
      .prepare(
        `
        SELECT password_hash 
        FROM password_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
      )
      .all(userId, PASSWORD_HISTORY_LIMIT);

    // Check if new password matches any historical password
    for (const record of passwordHistory) {
      const isMatch = await bcrypt.compare(newPassword, record.password_hash);
      if (isMatch) {
        return true; // Password was used before
      }
    }

    return false; // Password is new
  } catch (error) {
    console.error("Error checking password history:", error);
    throw error;
  }
}

/**
 * Add a password to the user's password history
 * @param {number} userId - The user's ID
 * @param {string} hashedPassword - The hashed password
 */
export function addPasswordToHistory(userId, hashedPassword) {
  try {
    db.prepare(
      `
      INSERT INTO password_history (user_id, password_hash)
      VALUES (?, ?)
    `,
    ).run(userId, hashedPassword);

    // Optional: Clean up old password history beyond the limit
    cleanupOldPasswordHistory(userId);
  } catch (error) {
    console.error("Error adding password to history:", error);
    throw error;
  }
}

/**
 * Remove old password history entries beyond the limit
 * @param {number} userId - The user's ID
 */
function cleanupOldPasswordHistory(userId) {
  try {
    db.prepare(
      `
      DELETE FROM password_history 
      WHERE user_id = ? 
      AND id NOT IN (
        SELECT id FROM password_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
    `,
    ).run(userId, userId, PASSWORD_HISTORY_LIMIT);
  } catch (error) {
    console.error("Error cleaning up password history:", error);
  }
}

// /**
//  * Initialize password history for existing users (run once during migration)
//  * This adds their current password to the history
//  */
// export function migrateExistingPasswords() {
//   try {
//     const users = db.prepare("SELECT id, password FROM users").all();

//     for (const user of users) {
//       // Check if user already has password history
//       const existingHistory = db
//         .prepare(
//           "SELECT COUNT(*) as count FROM password_history WHERE user_id = ?"
//         )
//         .get(user.id);

//       if (existingHistory.count === 0) {
//         // Add current password to history
//         addPasswordToHistory(user.id, user.password);
//         console.log(`Migrated password history for user ID: ${user.id}`);
//       }
//     }

//     console.log("Password history migration completed");
//   } catch (error) {
//     console.error("Error migrating password history:", error);
//   }
// }
