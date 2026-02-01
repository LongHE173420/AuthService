import express from "express";
import { authRoutes } from "./routes/auth.routes";
import { meRoutes } from "./routes/me.routes";
import { testConnection } from "./config/database";
import logger from "./config/logger";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "auth-service" }));

app.use("/auth", authRoutes);
app.use("/", meRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server listening on port ${PORT}`);
  logger.info(`[auth-service] running at http://localhost:${PORT}`);
  
  // Test MySQL connection in background (don't block server startup)
  setImmediate(async () => {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error("[ERROR] Failed to connect to MySQL - ensure database is running");
    }
  });
});

// Prevent server from exiting
server.on("error", (err) => {
  logger.error("Server error:", { error: err.message });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", { error: err.message });
});
