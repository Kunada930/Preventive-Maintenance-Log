// backend/scripts/createAdmin.js
import "dotenv/config";
import bcrypt from "bcrypt";
import db from "../database.js";

async function createAdmin() {
  const adminData = {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    lastName: process.env.ADMIN_LAST_NAME,
    firstName: process.env.ADMIN_FIRST_NAME,
    middleName: process.env.ADMIN_MIDDLE_NAME,
    position: process.env.ADMIN_POSITION,
  };

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Prepare insert statement
    const insert = db.prepare(`
      INSERT INTO users (username, password, lastName, firstName, middleName, position, role, must_change_password) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert admin user with must_change_password = 1
    insert.run(
      adminData.username,
      hashedPassword,
      adminData.lastName,
      adminData.firstName,
      adminData.middleName,
      adminData.position,
      "admin",
      1, // Must change password on first login
    );

    console.log("Admin account created successfully!");
    console.log("User must change password on first login!");
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      console.log("Admin account already exists");
    } else {
      console.error("Error:", error.message);
    }
  } finally {
    db.close();
  }
}

createAdmin();
