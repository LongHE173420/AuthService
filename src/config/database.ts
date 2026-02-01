import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

// MySQL connection config
const mysqlConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "auth_service",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Tạo connection pool
export const mysqlPool = mysql.createPool(mysqlConfig);

// Test connection
export async function testConnection() {
  try {
    const connection = await mysqlPool.getConnection();
    const rows = await connection.query("SELECT 1 as test");
    connection.release();
    console.log("[DB] MySQL connected successfully");
    return true;
  } catch (err) {
    console.error("[DB] MySQL connection failed:", err);
    return false;
  }
}
