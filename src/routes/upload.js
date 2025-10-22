// ===== FILE: src/routes/upload.js =====

const express = require("express");
const multer = require("multer");
const {v4: uuidv4} = require("uuid");
const path = require("path");
const db = require("../database/db");
const logger = require("../config/logger");

const router = express.Router();

// ===== MULTER CONFIGURATION =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || "./uploads/file");
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Only accept PDF files
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {fileSize: 5 * 1024 * 1024}, // 5MB limit
});

// ===== POST /upload ENDPOINT =====
router.post(
  "/",
  upload.fields([
    {name: "cv", maxCount: 1},
    {name: "report", maxCount: 1},
  ]),
  async (req, res) => {
    try {
      logger.info("Processing file upload");

      // Validate files exist
      if (!req.files || !req.files.cv || !req.files.report) {
        return res.status(400).json({
          error: "Both CV and Project Report files are required",
        });
      }

      const cvFile = req.files.cv[0];
      const reportFile = req.files.report[0];

      // Validate file sizes
      if (cvFile.size === 0 || reportFile.size === 0) {
        return res.status(400).json({
          error: "Files cannot be empty",
        });
      }

      // Generate unique IDs
      const cvId = uuidv4();
      const reportId = uuidv4();

      // Save CV metadata to database
      await db.saveFile({
        id: cvId,
        filename: cvFile.originalname,
        filepath: cvFile.path,
        file_type: "cv",
        file_size: cvFile.size,
      });

      logger.info(`CV saved with ID: ${cvId}`);

      // Save Report metadata to database
      await db.saveFile({
        id: reportId,
        filename: reportFile.originalname,
        filepath: reportFile.path,
        file_type: "report",
        file_size: reportFile.size,
      });

      logger.info(`Report saved with ID: ${reportId}`);

      // Return IDs for next steps
      res.status(200).json({
        success: true,
        data: {
          cv_id: cvId,
          report_id: reportId,
          cv_filename: cvFile.originalname,
          report_filename: reportFile.originalname,
          uploaded_at: new Date(),
        },
      });
    } catch (error) {
      logger.error("Upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        message: error.message,
      });
    }
  }
);

// ===== ERROR HANDLING MIDDLEWARE =====
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({
        error: "File too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files. Please upload max 2 files",
      });
    }
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({
      error: "Only PDF files are accepted",
    });
  }

  res.status(500).json({
    error: "Upload failed",
    message: err.message,
  });
});

module.exports = router;
