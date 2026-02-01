"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlPool = void 0;
exports.testConnection = testConnection;
const promise_1 = __importDefault(require("mysql2/promise"));
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
exports.mysqlPool = promise_1.default.createPool(mysqlConfig);
// Test connection
async function testConnection() {
    try {
        const connection = await exports.mysqlPool.getConnection();
        const rows = await connection.query("SELECT 1 as test");
        connection.release();
        console.log("[DB] MySQL connected successfully");
        return true;
    }
    catch (err) {
        console.error("[DB] MySQL connection failed:", err);
        return false;
    }
}
