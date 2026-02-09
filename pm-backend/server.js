import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import devicesRoutes from "./routes/devices.js";
import pmChecklistRoutes from "./routes/pm-checklist.js";
import usersRoutes from "./routes/usersRoutes.js";
import pmLogsRoutes from "./routes/pm-logs.js";
import qrTokenRoutes from "./routes/qr-tokens.js";
import { authenticateToken, isAdmin } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Middleware (Cookie Parser, CORS, JSON Parsing)
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://172.16.21.12:3000",
    ],
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files for uploaded profile pictures
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//Routes
app.get("/", (req, res) => {
  res.send("PM Log Backend is running");
});

// Auth routes
app.use("/api/auth", authRoutes);

// User self-service routes (MUST come before admin routes - more specific paths first)
app.use("/api/users/me", authenticateToken, usersRoutes);

// Admin-only user management routes
app.use("/api/users", authenticateToken, isAdmin, usersRoutes);

// Devices routes
app.use("/api/devices", devicesRoutes);

// PM Checklist routes
app.use("/api/pm-checklists", pmChecklistRoutes);

// PM Logs routes
app.use("/api/pm-logs", pmLogsRoutes);

// QR Token routes
app.use("/api/qr-tokens", qrTokenRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle Multer errors (file upload errors)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File too large. Maximum size is 5MB",
    });
  }
  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({
      error: err.message,
    });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://172.16.21.12:${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});
