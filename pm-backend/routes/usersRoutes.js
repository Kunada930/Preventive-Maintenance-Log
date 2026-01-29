import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";
import { formatUserResponse } from "../utils/userFormatter.js";
import { addPasswordToHistory } from "../utils/passwordHistory.js";

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/profiles";
    // Create directory if it doesn't exist
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
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
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

// Get all users (admin only)
router.get("/", authenticateToken, isAdmin, (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "" } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
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

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const { total } = db.prepare(countQuery).get(...params);

    // Get paginated users
    const usersQuery = `
      SELECT 
        id, username, lastName, firstName, middleName, 
        position, role, profile_picture, must_change_password, 
        created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const users = db.prepare(usersQuery).all(...params, limit, offset);

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

// Get single user by ID (admin only)
router.get("/:id", authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const user = db
      .prepare(
        `
      SELECT 
        id, username, lastName, firstName, middleName, 
        position, role, profile_picture, must_change_password, 
        created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      )
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    res.json({
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to fetch user",
      code: "SERVER_ERROR",
    });
  }
});

// Create new user (admin only)
router.post("/", authenticateToken, isAdmin, async (req, res) => {
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

    // Validation
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

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    // Validate role
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Must be 'admin' or 'user'",
        code: "INVALID_ROLE",
      });
    }

    // Check if username already exists
    const existingUser = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username);

    if (existingUser) {
      return res.status(409).json({
        error: "Username already exists",
        code: "USERNAME_EXISTS",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = db
      .prepare(
        `
      INSERT INTO users (
        username, password, firstName, middleName, lastName, 
        position, role, must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `,
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

    // Add password to history
    addPasswordToHistory(result.lastInsertRowid, hashedPassword);

    // Get created user
    const newUser = db
      .prepare(
        `
      SELECT 
        id, username, lastName, firstName, middleName, 
        position, role, profile_picture, must_change_password, 
        created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      )
      .get(result.lastInsertRowid);

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
router.put("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, middleName, lastName, position, role, password } =
      req.body;

    // Check if user exists
    const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);

    if (!existingUser) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Validate role if provided
    if (role && !["admin", "user"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Must be 'admin' or 'user'",
        code: "INVALID_ROLE",
      });
    }

    // Build update query dynamically
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

    // Handle password update
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

      // Add old password to history
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

    // Update user
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    // Get updated user
    const updatedUser = db
      .prepare(
        `
      SELECT 
        id, username, lastName, firstName, middleName, 
        position, role, profile_picture, must_change_password, 
        created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      )
      .get(id);

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

// Upload/Update profile picture
router.post(
  "/:id/profile-picture",
  authenticateToken,
  upload.single("profilePicture"),
  (req, res) => {
    try {
      const { id } = req.params;

      // Allow users to update their own profile picture or admin to update any
      if (req.user.id !== parseInt(id) && req.user.role !== "admin") {
        // Delete uploaded file if unauthorized
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({
          error: "You can only update your own profile picture",
          code: "FORBIDDEN",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
          code: "NO_FILE",
        });
      }

      // Get existing user
      const user = db
        .prepare("SELECT profile_picture FROM users WHERE id = ?")
        .get(id);

      if (!user) {
        // Delete uploaded file if user not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Delete old profile picture if exists
      if (user.profile_picture) {
        const oldPath = `./${user.profile_picture}`;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Update profile picture path in database
      const profilePicturePath = `uploads/profiles/${req.file.filename}`;
      db.prepare(
        "UPDATE users SET profile_picture = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(profilePicturePath, id);

      // Get updated user
      const updatedUser = db
        .prepare(
          `
        SELECT 
          id, username, lastName, firstName, middleName, 
          position, role, profile_picture, must_change_password, 
          created_at, updated_at
        FROM users
        WHERE id = ?
      `,
        )
        .get(id);

      res.json({
        message: "Profile picture updated successfully",
        user: formatUserResponse(updatedUser),
      });
    } catch (error) {
      // Delete uploaded file on error
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Upload profile picture error:", error);
      res.status(500).json({
        error: error.message || "Failed to upload profile picture",
        code: "SERVER_ERROR",
      });
    }
  },
);

// Delete profile picture
router.delete("/:id/profile-picture", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Allow users to delete their own profile picture or admin to delete any
    if (req.user.id !== parseInt(id) && req.user.role !== "admin") {
      return res.status(403).json({
        error: "You can only delete your own profile picture",
        code: "FORBIDDEN",
      });
    }

    // Get existing user
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

    // Delete file from filesystem
    const filePath = `./${user.profile_picture}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove profile picture path from database
    db.prepare(
      "UPDATE users SET profile_picture = NULL, updated_at = datetime('now') WHERE id = ?",
    ).run(id);

    // Get updated user
    const updatedUser = db
      .prepare(
        `
        SELECT 
          id, username, lastName, firstName, middleName, 
          position, role, profile_picture, must_change_password, 
          created_at, updated_at
        FROM users
        WHERE id = ?
      `,
      )
      .get(id);

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
router.delete("/:id", authenticateToken, isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({
        error: "You cannot delete your own account",
        code: "SELF_DELETE",
      });
    }

    // Check if user exists
    const user = db
      .prepare("SELECT profile_picture FROM users WHERE id = ?")
      .get(id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Delete profile picture if exists
    if (user.profile_picture) {
      const filePath = `./${user.profile_picture}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete user (cascade will delete password history and refresh tokens)
    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      error: "Failed to delete user",
      code: "SERVER_ERROR",
    });
  }
});

// Get user statistics (admin only)
router.get("/stats/overview", authenticateToken, isAdmin, (req, res) => {
  try {
    const stats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count,
        SUM(CASE WHEN must_change_password = 1 THEN 1 ELSE 0 END) as pending_password_change,
        SUM(CASE WHEN profile_picture IS NOT NULL THEN 1 ELSE 0 END) as users_with_picture
      FROM users
    `,
      )
      .get();

    res.json({
      statistics: stats,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      error: "Failed to fetch user statistics",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
