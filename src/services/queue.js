const Queue = require("bull");
const logger = require("../config/logger");
const db = require("../database/db");
const rag = require("./rag");
const llm = require("./llm");
const pdfUtils = require("./pdf-utils");

const evaluationQueue = new Queue("evaluations", {
  redis: {
    host: "localhost",
    port: 6379,
  },
});

evaluationQueue.on("active", (job) => {
  logger.info(`Job ${job.id} started processing`);
  db.updateJobStatus(job.id, "processing");
});

evaluationQueue.on("completed", (job, result) => {
  logger.info(`Job ${job.id} completed successfully`);
  db.updateJobStatus(job.id, "completed", result);
});

evaluationQueue.on("failed", (job, error) => {
  logger.error(`Job ${job.id} failed:`, error.message);
  db.updateJobStatus(job.id, "failed", null, error.message);
});

evaluationQueue.on("retry", (job) => {
  logger.warn(`Job ${job.id} retrying... (attempt ${job.attemptsMade + 1})`);
});

evaluationQueue.process(async (job) => {
  logger.info(`🚀 Processing job: ${job.id}`);

  const {cv_id, report_id, job_title} = job.data;

  try {
    logger.info("Step 1: Retrieving files from database");
    const cvFile = await db.getFileById(cv_id);
    const reportFile = await db.getFileById(report_id);

    if (!cvFile || !reportFile) {
      throw new Error("Files not found in database");
    }

    logger.info("Step 2: Extracting text from PDFs");
    const cvExtraction = await pdfUtils.extractAndCleanPDF(cvFile.filepath);
    const cvText = cvExtraction.text;
    logger.info(`Extracted CV: ${cvText.length} characters from ${cvExtraction.pages} pages`);

    const reportExtraction = await pdfUtils.extractAndCleanPDF(reportFile.filepath);
    const reportText = reportExtraction.text;
    logger.info(`Extracted Report: ${reportText.length} characters from ${reportExtraction.pages} pages`);

    logger.info("Step 3: Retrieving RAG context");
    const cvContext = await rag.getCVEvaluationContext(cvText);
    logger.info("✅ CV context retrieved from RAG");

    const projContext = await rag.getProjectEvaluationContext(reportText);
    logger.info("✅ Project context retrieved from RAG");

    logger.info("Step 4: Evaluating CV with LLM");
    const cvResult = await llm.evaluateCV(cvText, cvContext.jobRequirements, cvContext.rubric);
    logger.info("✅ CV Evaluation:", cvResult);

    logger.info("Step 5: Evaluating Project with LLM");
    const projectResult = await llm.evaluateProject(reportText, projContext.caseStudy, projContext.rubric);
    logger.info("✅ Project Evaluation:", projectResult);

    logger.info("Step 6: Generating overall summary");
    const summaryResult = await llm.generateSummary(cvResult, projectResult);
    logger.info("✅ Summary:", summaryResult);

    const finalResult = {
      cv_match_rate: cvResult.cv_match_rate,
      cv_feedback: cvResult.cv_feedback,
      project_score: projectResult.project_score,
      project_feedback: projectResult.project_feedback,
      overall_summary: summaryResult.overall_summary,
    };

    logger.info(`✅ Job ${job.id} completed with results:`, finalResult);

    return finalResult;
  } catch (error) {
    logger.error(`❌ Error processing job ${job.id}:`, error.message);
    logger.error("Full error:", error);
    throw error;
  }
});

async function addJob(jobId, data) {
  try {
    const job = await evaluationQueue.add(data, {
      jobId,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: false,
    });

    logger.info(`Job added to queue: ${job.id}`);
    return job;
  } catch (error) {
    logger.error("Error adding job to queue:", error);
    throw error;
  }
}

async function closeQueue() {
  await evaluationQueue.close();
  logger.info("Queue closed");
}

module.exports = {
  addJob,
  closeQueue,
  getQueue: () => evaluationQueue,
};
