import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../database.js";
import { isAdmin } from "../middleware/auth.js";
import { formatUserResponse } from "../utils/userFormatter.js";
import { addPasswordToHistory } from "../utils/passwordHistory.js";
import { logAudit, auditMiddleware } from "../middleware/audit.js";

const router = express.Router();

// ============================================
// Multer configuration for profile pictures
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/profiles";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "profile-" + uniqueSuffix + path.extname(file.originalname).toLowerCase(),
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
    }
  },
});

// ============================================
// USER SELF-SERVICE ROUTES (/api/users/me/*)
// ============================================

// Upload own profile picture
router.post(
  "/me/profile-picture",
  upload.single("profilePicture"),
  (req, res) => {
    try {
      const id = req.user.id;

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          code: "NO_FILE",
        });
      }

      const user = db
        .prepare("SELECT profile_picture FROM users WHERE id = ?")
        .get(id);

      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Delete old profile picture if exists
      if (user.profile_picture) {
        const oldPath = `./${user.profile_picture}`;
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const profilePicturePath = `uploads/profiles/${req.file.filename}`;
      db.prepare(
        "UPDATE users SET profile_picture = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(profilePicturePath, id);

      const updatedUser = db
        .prepare(
          `SELECT id, username, lastName, firstName, middleName,
            position, role, profile_picture, must_change_password,
            created_at, updated_at FROM users WHERE id = ?`,
        )
        .get(id);

      logAudit({
        userId: req.user.id,
        username: req.user.username,
        action: "UPDATE",
        entity: "user_profile_picture",
        entityId: id,
        oldValue: { profilePicture: user.profile_picture },
        newValue: { profilePicture: profilePicturePath },
        ip: req.ip,
      });

      res.json({
        message: "Profile picture updated successfully",
        user: formatUserResponse(updatedUser),
      });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error("Upload profile picture error:", error);
      res.status(500).json({
        error: error.message || "Failed to upload profile picture",
        code: "SERVER_ERROR",
      });
    }
  },
);

// Delete own profile picture
router.delete("/me/profile-picture", (req, res) => {
  try {
    const id = req.user.id;

    const user = db
      .prepare("SELECT profile_picture FROM users WHERE id = ?")
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.profile_picture) {
      return res.status(400).json({
        error: "User has no profile picture",
        code: "NO_PICTURE",
      });
    }

    const filePath = `./${user.profile_picture}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare(
      "UPDATE users SET profile_picture = NULL, updated_at = datetime('now') WHERE id = ?",
    ).run(id);

    const updatedUser = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(id);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "user_profile_picture",
      entityId: id,
      oldValue: { profilePicture: user.profile_picture },
      newValue: null,
      ip: req.ip,
    });

    res.json({
      message: "Profile picture deleted successfully",
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({
      error: "Failed to delete profile picture",
      code: "SERVER_ERROR",
    });
  }
});

// ============================================
// ADMIN-ONLY ROUTES (/api/users/*)
// ============================================

// Get all users
router.get("/", (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "" } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push(
        "(username LIKE ? OR firstName LIKE ? OR lastName LIKE ?)",
      );
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (role) {
      whereConditions.push("role = ?");
      params.push(role);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const { total } = db.prepare(countQuery).get(...params);

    const users = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          failed_login_attempts, locked_until,
          created_at, updated_at
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);

    res.json({
      users: users.map(formatUserResponse),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      code: "SERVER_ERROR",
    });
  }
});

// Get single user by ID
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const user = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          failed_login_attempts, locked_until,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({ user: formatUserResponse(user) });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to fetch user",
      code: "SERVER_ERROR",
    });
  }
});

// Create new user (admin only)
router.post("/", async (req, res) => {
  try {
    const {
      username,
      password,
      firstName,
      middleName,
      lastName,
      position,
      role = "user",
    } = req.body;

    if (
      !username ||
      !password ||
      !firstName ||
      !lastName ||
      !middleName ||
      !position
    ) {
      return res.status(400).json({
        error: "All fields are required",
        code: "MISSING_FIELDS",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Must be 'admin' or 'user'",
        code: "INVALID_ROLE",
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username);

    if (existingUser) {
      return res.status(409).json({
        error: "Username already exists",
        code: "USERNAME_EXISTS",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db
      .prepare(
        `INSERT INTO users (
          username, password, firstName, middleName, lastName,
          position, role, must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        username,
        hashedPassword,
        firstName,
        middleName,
        lastName,
        position,
        role,
      );

    addPasswordToHistory(result.lastInsertRowid, hashedPassword);

    const newUser = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(result.lastInsertRowid);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "CREATE",
      entity: "user",
      entityId: newUser.id,
      oldValue: null,
      newValue: formatUserResponse(newUser),
      ip: req.ip,
    });

    res.status(201).json({
      message: "User created successfully",
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      error: "Failed to create user",
      code: "SERVER_ERROR",
    });
  }
});

// Update user (admin only)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, middleName, lastName, position, role, password } =
      req.body;

    const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

    if (!existingUser) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (role && !["admin", "user"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Must be 'admin' or 'user'",
        code: "INVALID_ROLE",
      });
    }

    const updates = [];
    const params = [];

    if (firstName !== undefined) {
      updates.push("firstName = ?");
      params.push(firstName);
    }
    if (middleName !== undefined) {
      updates.push("middleName = ?");
      params.push(middleName);
    }
    if (lastName !== undefined) {
      updates.push("lastName = ?");
      params.push(lastName);
    }
    if (position !== undefined) {
      updates.push("position = ?");
      params.push(position);
    }
    if (role !== undefined) {
      updates.push("role = ?");
      params.push(role);
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long",
          code: "WEAK_PASSWORD",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      updates.push("must_change_password = 1");
      params.push(hashedPassword);

      // Save old password to history before overwriting
      addPasswordToHistory(id, existingUser.password);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "No fields to update",
        code: "NO_UPDATES",
      });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    const updatedUser = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(id);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "UPDATE",
      entity: "user",
      entityId: parseInt(id),
      oldValue: formatUserResponse(existingUser),
      newValue: formatUserResponse(updatedUser),
      ip: req.ip,
    });

    res.json({
      message: "User updated successfully",
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      error: "Failed to update user",
      code: "SERVER_ERROR",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/users/:id/unlock  (admin only)
// Manually unlock a locked-out account before the 1-hour window expires.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/unlock", isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const user = db
      .prepare(
        `SELECT id, username, locked_until, failed_login_attempts
         FROM users WHERE id = ?`,
      )
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Allow the call even if the account isn't currently locked —
    // it's a safe idempotent reset either way.
    const wasLocked = !!user.locked_until;

    db.prepare(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(id);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "ACCOUNT_UNLOCKED",
      entity: "users",
      entityId: parseInt(id),
      oldValue: {
        locked_until: user.locked_until,
        failed_login_attempts: user.failed_login_attempts,
      },
      newValue: {
        locked_until: null,
        failed_login_attempts: 0,
        unlockedBy: req.user.username,
      },
      ip: req.ip,
    });

    return res.json({
      message: wasLocked
        ? `Account for '${user.username}' has been unlocked successfully.`
        : `Account for '${user.username}' was not locked, but attempt counter has been reset.`,
    });
  } catch (error) {
    console.error("Unlock user error:", error);
    return res.status(500).json({
      error: "Failed to unlock user account",
      code: "SERVER_ERROR",
    });
  }
});

// Upload profile picture for any user (admin only)
router.post(
  "/:id/profile-picture",
  upload.single("profilePicture"),
  (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          code: "NO_FILE",
        });
      }

      const user = db
        .prepare("SELECT profile_picture FROM users WHERE id = ?")
        .get(id);

      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      if (user.profile_picture) {
        const oldPath = `./${user.profile_picture}`;
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const profilePicturePath = `uploads/profiles/${req.file.filename}`;
      db.prepare(
        "UPDATE users SET profile_picture = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(profilePicturePath, id);

      const updatedUser = db
        .prepare(
          `SELECT id, username, lastName, firstName, middleName,
            position, role, profile_picture, must_change_password,
            created_at, updated_at FROM users WHERE id = ?`,
        )
        .get(id);

      logAudit({
        userId: req.user.id,
        username: req.user.username,
        action: "UPDATE",
        entity: "user_profile_picture",
        entityId: parseInt(id),
        oldValue: { profilePicture: user.profile_picture },
        newValue: { profilePicture: profilePicturePath },
        ip: req.ip,
      });

      res.json({
        message: "Profile picture updated successfully",
        user: formatUserResponse(updatedUser),
      });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error("Upload profile picture error:", error);
      res.status(500).json({
        error: error.message || "Failed to upload profile picture",
        code: "SERVER_ERROR",
      });
    }
  },
);

// Delete profile picture for any user (admin only)
router.delete("/:id/profile-picture", (req, res) => {
  try {
    const { id } = req.params;

    const user = db
      .prepare("SELECT profile_picture FROM users WHERE id = ?")
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.profile_picture) {
      return res.status(400).json({
        error: "User has no profile picture",
        code: "NO_PICTURE",
      });
    }

    const filePath = `./${user.profile_picture}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare(
      "UPDATE users SET profile_picture = NULL, updated_at = datetime('now') WHERE id = ?",
    ).run(id);

    const updatedUser = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(id);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "user_profile_picture",
      entityId: parseInt(id),
      oldValue: { profilePicture: user.profile_picture },
      newValue: null,
      ip: req.ip,
    });

    res.json({
      message: "Profile picture deleted successfully",
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({
      error: "Failed to delete profile picture",
      code: "SERVER_ERROR",
    });
  }
});

// Delete user (admin only)
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        error: "You cannot delete your own account",
        code: "SELF_DELETE",
      });
    }

    const user = db
      .prepare(
        `SELECT id, username, lastName, firstName, middleName,
          position, role, profile_picture, must_change_password,
          created_at, updated_at FROM users WHERE id = ?`,
      )
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.profile_picture) {
      const filePath = `./${user.profile_picture}`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      action: "DELETE",
      entity: "user",
      entityId: parseInt(id),
      oldValue: formatUserResponse(user),
      newValue: null,
      ip: req.ip,
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      error: "Failed to delete user",
      code: "SERVER_ERROR",
    });
  }
});

// Get user statistics (admin only)
router.get("/stats/overview", (req, res) => {
  try {
    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count,
          SUM(CASE WHEN must_change_password = 1 THEN 1 ELSE 0 END) as pending_password_change,
          SUM(CASE WHEN profile_picture IS NOT NULL THEN 1 ELSE 0 END) as users_with_picture,
          SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > datetime('now') THEN 1 ELSE 0 END) as locked_accounts
         FROM users`,
      )
      .get();

    res.json({ statistics: stats });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      error: "Failed to fetch user statistics",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
