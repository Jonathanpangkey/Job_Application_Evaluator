const express = require("express");
const {v4: uuidv4} = require("uuid");
const Joi = require("joi");
const db = require("../database/db");
const logger = require("../config/logger");
const evaluationQueue = require("../services/queue");

const router = express.Router();

const evaluateSchema = Joi.object({
  cv_id: Joi.string().required(),
  report_id: Joi.string().required(),
  job_title: Joi.string().required(),
});

router.post("/", async (req, res) => {
  try {
    const {error, value} = evaluateSchema.validate(req.body);

    if (error) {
      logger.warn("Validation error:", error.details);
      return res.status(400).json({
        error: "Invalid input",
        details: error.details.map((d) => d.message),
      });
    }

    const {cv_id, report_id, job_title} = value;

    const cvFile = await db.getFileById(cv_id);
    const reportFile = await db.getFileById(report_id);

    if (!cvFile || !reportFile) {
      logger.warn(`Files not found - CV: ${cvFile ? "ok" : "missing"}, Report: ${reportFile ? "ok" : "missing"}`);
      return res.status(404).json({
        error: "One or both files not found",
        message: "Please upload files first using POST /upload",
      });
    }

    const jobId = uuidv4();

    await db.saveJob({
      id: jobId,
      cv_id,
      report_id,
      job_title,
    });

    logger.info(`Job created: ${jobId} with title: ${job_title}`);

    await evaluationQueue.addJob(jobId, {
      cv_id,
      report_id,
      job_title,
    });

    logger.info(`Job ${jobId} added to queue`);

    res.status(202).json({
      success: true,
      data: {
        id: jobId,
        status: "queued",
        message: "Evaluation job queued. Poll GET /result/{id} to check status",
      },
    });
  } catch (error) {
    logger.error("Evaluate endpoint error:", error);
    res.status(500).json({
      error: "Failed to create evaluation job",
      message: error.message,
    });
  }
});

module.exports = router;
