const db = require("./database/db");
const rag = require("./services/rag");
const pdfUtils = require("./services/pdf-utils");
const fs = require("fs");

async function testFullPipeline() {
  try {
    console.log("\n🔗 Testing Full Evaluation Pipeline\n");

    // Initialize systems
    console.log("1️⃣  Initializing systems...");
    await db.init();
    await rag.initializeChromaDB();
    await rag.ingestReferenceDocuments();
    console.log("✅ Systems ready\n");

    // Create dummy files for testing
    console.log("2️⃣  Creating test PDF files...");
    const testCvContent = "Resume: Backend Developer with 5 years Node.js, PostgreSQL, AWS";
    const testReportContent = "Project Report: Built async job system with LLM chaining";

    fs.writeFileSync("./test-cv.txt", testCvContent);
    fs.writeFileSync("./test-report.txt", testReportContent);
    console.log("✅ Test files created\n");

    // Simulate file upload
    console.log("3️⃣  Simulating file storage...");
    const cvId = "test-cv-123";
    const reportId = "test-report-123";

    await db.saveFile({
      id: cvId,
      filename: "test-cv.pdf",
      filepath: "./test-cv.txt",
      file_type: "cv",
      file_size: testCvContent.length,
    });

    await db.saveFile({
      id: reportId,
      filename: "test-report.pdf",
      filepath: "./test-report.txt",
      file_type: "report",
      file_size: testReportContent.length,
    });
    console.log("✅ Files stored in database\n");

    // Create evaluation job
    console.log("4️⃣  Creating evaluation job...");
    const jobId = "test-job-123";
    await db.saveJob({
      id: jobId,
      cv_id: cvId,
      report_id: reportId,
      job_title: "Product Engineer (Backend)",
    });
    console.log("✅ Job created\n");

    // Get CV evaluation context
    console.log("5️⃣  Getting CV evaluation context...");
    const cvContext = await rag.getCVEvaluationContext(testCvContent);
    console.log("Job requirements length:", cvContext.jobRequirements.length);
    console.log("Rubric length:", cvContext.rubric.length);
    console.log("✅ Context retrieved\n");

    // Get project evaluation context
    console.log("6️⃣  Getting project evaluation context...");
    const projContext = await rag.getProjectEvaluationContext(testReportContent);
    console.log("Case study length:", projContext.caseStudy.length);
    console.log("Rubric length:", projContext.rubric.length);
    console.log("✅ Context retrieved\n");

    // Verify job in database
    console.log("7️⃣  Verifying job in database...");
    const savedJob = await db.getJobById(jobId);
    console.log("Job status:", savedJob.status);
    console.log("Job created_at:", savedJob.created_at);
    console.log("✅ Job verified\n");

    // Cleanup
    console.log("8️⃣  Cleaning up...");
    fs.unlinkSync("./test-cv.txt");
    fs.unlinkSync("./test-report.txt");
    console.log("✅ Cleanup complete\n");

    console.log("✅ Full pipeline test completed successfully!\n");
  } catch (error) {
    console.error("❌ Pipeline test failed:", error.message);
    process.exit(1);
  }
}

testFullPipeline();
