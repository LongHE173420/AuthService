import winston from "winston";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta, null, 2)}`;
      }
      return log;
    })
  ),
  defaultMeta: { service: "auth-service" },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 1) {
            // Exclude 'service' from meta
            const filteredMeta = Object.keys(meta)
              .filter((k) => k !== "service")
              .reduce((obj, key) => {
                obj[key] = meta[key];
                return obj;
              }, {} as any);
            if (Object.keys(filteredMeta).length > 0) {
              log += ` ${JSON.stringify(filteredMeta)}`;
            }
          }
          return log;
        })
      ),
    }),

    // File output for all logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File output for errors only
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Create logs directory if it doesn't exist
import fs from "fs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;
