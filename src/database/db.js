// ===== FILE: src/database/db.js =====

const sqlite3 = require("sqlite3");
const {open} = require("sqlite");
const path = require("path");
const logger = require("../config/logger");

let db = null;

async function initDatabase() {
  try {
    db = await open({
      filename: process.env.DATABASE_PATH || "./database.db",
      driver: sqlite3.Database,
    });

    await db.exec("PRAGMA foreign_keys = ON");

    // Create tables
    await createTables();

    logger.info("Database connected and tables created");
    return db;
  } catch (error) {
    logger.error("Database connection error:", error);
    throw error;
  }
}

async function createTables() {
  // Files table - stores uploaded PDFs metadata
  await db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Jobs table - tracks evaluation jobs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      cv_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      job_title TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      result JSON,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cv_id) REFERENCES files(id),
      FOREIGN KEY (report_id) REFERENCES files(id)
    )
  `);

  logger.info("Tables created successfully");
}

// ===== DATABASE OPERATIONS =====

async function saveFile(fileData) {
  const {id, filename, filepath, file_type, file_size} = fileData;

  await db.run(
    `INSERT INTO files (id, filename, filepath, file_type, file_size) 
     VALUES (?, ?, ?, ?, ?)`,
    [id, filename, filepath, file_type, file_size]
  );

  return {id, filename, file_type};
}

async function getFileById(id) {
  return await db.get("SELECT * FROM files WHERE id = ?", [id]);
}

async function saveJob(jobData) {
  const {id, cv_id, report_id, job_title} = jobData;

  await db.run(
    `INSERT INTO jobs (id, cv_id, report_id, job_title, status) 
     VALUES (?, ?, ?, ?, 'queued')`,
    [id, cv_id, report_id, job_title]
  );

  return {id, status: "queued"};
}

async function getJobById(id) {
  return await db.get("SELECT * FROM jobs WHERE id = ?", [id]);
}

async function updateJobStatus(jobId, status, result = null, error = null) {
  const query = `
    UPDATE jobs 
    SET status = ?, result = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const resultJson = result ? JSON.stringify(result) : null;

  await db.run(query, [status, resultJson, error, jobId]);
}

async function getQueuedJobs() {
  return await db.all(`SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 10`);
}

// ===== EXPORTS =====

module.exports = {
  init: initDatabase,
  saveFile,
  getFileById,
  saveJob,
  getJobById,
  updateJobStatus,
  getQueuedJobs,
  getDb: () => db,
};
