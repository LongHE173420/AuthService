"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = require("./routes/auth.routes");
const me_routes_1 = require("./routes/me.routes");
const database_1 = require("./config/database");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/", (_req, res) => res.json({ ok: true, service: "auth-service" }));
console.log("typeof authRoutes =", typeof auth_routes_1.authRoutes);
console.log("typeof meRoutes   =", typeof me_routes_1.meRoutes);
app.use("/auth", auth_routes_1.authRoutes);
app.use("/", me_routes_1.meRoutes);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, async () => {
    console.log(`[auth-service] running at http://localhost:${PORT}`);
    // Test MySQL connection
    const dbConnected = await (0, database_1.testConnection)();
    if (!dbConnected) {
        console.error("[ERROR] Failed to connect to MySQL - ensure database is running");
    }
});
