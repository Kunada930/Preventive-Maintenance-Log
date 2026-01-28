import express from "express";
import db from "../database.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Helper function to format device response to camelCase
function formatDeviceResponse(device) {
  return {
    id: device.id,
    deviceName: device.device_name,
    serialNumber: device.serial_number,
    manufacturer: device.manufacturer,
    deviceId: device.device_id,
    datePurchased: device.date_purchased,
    responsiblePerson: device.responsible_person,
    location: device.location,
    createdAt: device.created_at,
    updatedAt: device.updated_at,
  };
}

// Get all devices
router.get("/", authenticateToken, (req, res) => {
  try {
    const devices = db
      .prepare("SELECT * FROM devices ORDER BY created_at DESC")
      .all();

    res.json({
      devices: devices.map(formatDeviceResponse),
      total: devices.length,
    });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({
      error: "An error occurred while fetching devices",
      code: "SERVER_ERROR",
    });
  }
});

// Get single device by ID
router.get("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const device = db.prepare("SELECT * FROM devices WHERE id = ?").get(id);

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    res.json({
      device: formatDeviceResponse(device),
    });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({
      error: "An error occurred while fetching device",
      code: "SERVER_ERROR",
    });
  }
});

// Create new device (admin only)
router.post("/", authenticateToken, isAdmin, (req, res) => {
  const {
    deviceName,
    serialNumber,
    manufacturer,
    deviceId,
    datePurchased,
    responsiblePerson,
    location,
  } = req.body;

  // Validate required fields
  if (
    !deviceName ||
    !serialNumber ||
    !manufacturer ||
    !deviceId ||
    !datePurchased ||
    !responsiblePerson ||
    !location
  ) {
    return res.status(400).json({
      error: "All fields are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // Check if serial number already exists
    const existingSerial = db
      .prepare("SELECT id FROM devices WHERE serial_number = ?")
      .get(serialNumber);

    if (existingSerial) {
      return res.status(400).json({
        error: "Serial number already exists",
        code: "DUPLICATE_SERIAL_NUMBER",
      });
    }

    // Check if device ID already exists
    const existingDeviceId = db
      .prepare("SELECT id FROM devices WHERE device_id = ?")
      .get(deviceId);

    if (existingDeviceId) {
      return res.status(400).json({
        error: "Device ID already exists",
        code: "DUPLICATE_DEVICE_ID",
      });
    }

    // Insert new device
    const result = db
      .prepare(
        `INSERT INTO devices (device_name, serial_number, manufacturer, device_id, date_purchased, responsible_person, location)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        deviceName,
        serialNumber,
        manufacturer,
        deviceId,
        datePurchased,
        responsiblePerson,
        location,
      );

    // Get the newly created device
    const newDevice = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: "Device created successfully",
      device: formatDeviceResponse(newDevice),
    });
  } catch (error) {
    console.error("Create device error:", error);
    res.status(500).json({
      error: "An error occurred while creating device",
      code: "SERVER_ERROR",
    });
  }
});

// Update device (admin only)
router.put("/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const {
    deviceName,
    serialNumber,
    manufacturer,
    deviceId,
    datePurchased,
    responsiblePerson,
    location,
  } = req.body;

  // Validate required fields
  if (
    !deviceName ||
    !serialNumber ||
    !manufacturer ||
    !deviceId ||
    !datePurchased ||
    !responsiblePerson ||
    !location
  ) {
    return res.status(400).json({
      error: "All fields are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    // Check if device exists
    const existingDevice = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(id);

    if (!existingDevice) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Check if serial number is taken by another device
    const duplicateSerial = db
      .prepare("SELECT id FROM devices WHERE serial_number = ? AND id != ?")
      .get(serialNumber, id);

    if (duplicateSerial) {
      return res.status(400).json({
        error: "Serial number already exists",
        code: "DUPLICATE_SERIAL_NUMBER",
      });
    }

    // Check if device ID is taken by another device
    const duplicateDeviceId = db
      .prepare("SELECT id FROM devices WHERE device_id = ? AND id != ?")
      .get(deviceId, id);

    if (duplicateDeviceId) {
      return res.status(400).json({
        error: "Device ID already exists",
        code: "DUPLICATE_DEVICE_ID",
      });
    }

    // Update device
    db.prepare(
      `UPDATE devices 
       SET device_name = ?, 
           serial_number = ?, 
           manufacturer = ?, 
           device_id = ?, 
           date_purchased = ?, 
           responsible_person = ?, 
           location = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      deviceName,
      serialNumber,
      manufacturer,
      deviceId,
      datePurchased,
      responsiblePerson,
      location,
      id,
    );

    // Get updated device
    const updatedDevice = db
      .prepare("SELECT * FROM devices WHERE id = ?")
      .get(id);

    res.json({
      message: "Device updated successfully",
      device: formatDeviceResponse(updatedDevice),
    });
  } catch (error) {
    console.error("Update device error:", error);
    res.status(500).json({
      error: "An error occurred while updating device",
      code: "SERVER_ERROR",
    });
  }
});

// Delete device (admin only)
router.delete("/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  try {
    // Check if device exists
    const device = db.prepare("SELECT * FROM devices WHERE id = ?").get(id);

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
        code: "DEVICE_NOT_FOUND",
      });
    }

    // Delete device
    db.prepare("DELETE FROM devices WHERE id = ?").run(id);

    res.json({
      message: "Device deleted successfully",
      device: formatDeviceResponse(device),
    });
  } catch (error) {
    console.error("Delete device error:", error);
    res.status(500).json({
      error: "An error occurred while deleting device",
      code: "SERVER_ERROR",
    });
  }
});

// Search devices
router.get("/search/:query", authenticateToken, (req, res) => {
  const { query } = req.params;

  try {
    const searchPattern = `%${query}%`;
    const devices = db
      .prepare(
        `SELECT * FROM devices 
         WHERE device_name LIKE ? 
            OR serial_number LIKE ? 
            OR manufacturer LIKE ? 
            OR device_id LIKE ? 
            OR responsible_person LIKE ? 
            OR location LIKE ?
         ORDER BY created_at DESC`,
      )
      .all(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );

    res.json({
      devices: devices.map(formatDeviceResponse),
      total: devices.length,
      query: query,
    });
  } catch (error) {
    console.error("Search devices error:", error);
    res.status(500).json({
      error: "An error occurred while searching devices",
      code: "SERVER_ERROR",
    });
  }
});

export default router;
