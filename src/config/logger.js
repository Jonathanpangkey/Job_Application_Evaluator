// ===== FILE: src/config/logger.js =====

const winston = require("winston");
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logDir = process.env.LOG_DIR || "./logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, {recursive: true});
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({format: "YYYY-MM-DD HH:mm:ss"}),
  winston.format.errors({stack: true}),
  winston.format.json()
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {service: "cv-evaluator"},
  transports: [
    // File transport - all logs
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport - errors only
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 5,
    }),

    // Console transport - development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({timestamp, level, message, ...meta}) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
