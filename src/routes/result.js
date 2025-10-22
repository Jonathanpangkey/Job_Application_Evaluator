// ===== FILE: src/routes/result.js =====

const express = require("express");
const db = require("../database/db");
const logger = require("../config/logger");

const router = express.Router();

// ===== GET /result/:id ENDPOINT =====
// Returns job status and result if completed
router.get("/:id", async (req, res) => {
  try {
    const {id} = req.params;

    // Validate job ID format (UUID)
    if (!id || id.length < 5) {
      return res.status(400).json({
        error: "Invalid job ID",
      });
    }

    // Fetch job from database
    const job = await db.getJobById(id);

    if (!job) {
      logger.warn(`Job not found: ${id}`);
      return res.status(404).json({
        error: "Job not found",
        message: `No evaluation job with ID: ${id}`,
      });
    }

    // Build response based on job status
    const response = {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };

    // ===== STATUS: QUEUED =====
    if (job.status === "queued") {
      response.data.message = "Job is queued. Please check again later.";
      return res.status(200).json(response);
    }

    // ===== STATUS: PROCESSING =====
    if (job.status === "processing") {
      response.data.message = "Job is being processed. Please check again soon.";
      return res.status(200).json(response);
    }

    // ===== STATUS: COMPLETED =====
    if (job.status === "completed") {
      // Parse result JSON
      const result = job.result ? JSON.parse(job.result) : null;
      response.data.result = result;
      return res.status(200).json(response);
    }

    // ===== STATUS: FAILED =====
    if (job.status === "failed") {
      response.data.error_message = job.error_message;
      response.success = false;
      return res.status(200).json(response);
    }

    // Fallback for unknown status
    res.status(200).json(response);
  } catch (error) {
    logger.error("Result endpoint error:", error);
    res.status(500).json({
      error: "Failed to retrieve job result",
      message: error.message,
    });
  }
});

module.exports = router;
