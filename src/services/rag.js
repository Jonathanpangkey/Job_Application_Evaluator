const {ChromaClient} = require("chromadb");
const logger = require("../config/logger");

let client;
let collection;
let initialized = false;

const REFERENCE_DOCS = {
  jobDescription: `
    JOB DESCRIPTION - Product Engineer (Backend)
    
    About the Job:
    You'll be building new product features alongside a frontend engineer and product manager using Agile methodology.
    
    Key Responsibilities:
    - Collaborating with frontend engineers and 3rd parties to build robust backend solutions
    - Developing and maintaining server-side logic for central database, ensuring high performance throughput
    - Designing and fine-tuning AI prompts that align with product requirements
    - Building LLM chaining flows, where output from one model is reliably passed to another
    - Implementing Retrieval-Augmented Generation (RAG) by embedding and retrieving context from vector databases
    - Handling long-running AI processes gracefully with job orchestration and async background workers
    - Designing safeguards for uncontrolled scenarios: managing failure cases from 3rd party APIs
    - Writing reusable, testable, and efficient code
    - Implementing automated testing with strong test coverage
    - Conducting full product lifecycles from idea to deployment and maintenance
    
    Required Skills:
    - Strong backend technologies experience (Node.js, Django, Rails)
    - Database management (MySQL, PostgreSQL, MongoDB)
    - RESTful APIs
    - Cloud technologies (AWS, Google Cloud, Azure)
    - Server-side languages (Java, Python, Ruby, JavaScript)
    - Understanding of frontend technologies
    - User authentication and authorization
    - Scalable application design principles
    - Creating database schemas
    - Implementing automated testing and unit tests
    - Familiarity with LLM APIs, embeddings, vector databases
    - Prompt design best practices
    
    Preferred Qualifications:
    - 3-5+ years of backend development experience
    - Experience with AI/LLM integration
    - Exposure to prompt engineering and RAG systems
    - Experience with async job processing
  `,

  caseStudyBrief: `
    CASE STUDY BRIEF - Backend AI Integration Project
    
    Objective:
    Build a backend service that automates initial screening of job applications.
    
    Requirements:
    1. API Endpoints:
       - POST /upload: Accept multipart/form-data with CV and Project Report (PDF)
       - POST /evaluate: Trigger async AI evaluation, return job ID
       - GET /result/:id: Retrieve evaluation status and results
    
    2. Evaluation Pipeline:
       - RAG Context Retrieval: Ingest job description and scoring rubrics into vector DB
       - CV Evaluation: Parse CV, retrieve job requirements, score match rate (0-1)
       - Project Report Evaluation: Parse report, retrieve case study requirements, score (1-5)
       - Final Analysis: Synthesize into summary (3-5 sentences)
    
    3. Long-Running Process Handling:
       - POST /evaluate must not block (return immediately with job ID)
       - Use job queue (Bull, Celery) for background processing
       - Implement retries with exponential backoff
    
    4. Error Handling:
       - Handle LLM API timeouts
       - Manage rate limiting
       - Control randomness (low temperature)
       - Validate all responses
    
    5. Scoring Parameters:
       CV Evaluation:
       - Technical Skills Match (40%)
       - Experience Level (25%)
       - Relevant Achievements (20%)
       - Cultural Fit (15%)
       
       Project Evaluation:
       - Correctness (30%)
       - Code Quality (25%)
       - Resilience (20%)
       - Documentation (15%)
       - Creativity (10%)
  `,

  cvScoringRubric: `
    CV SCORING RUBRIC
    
    Technical Skills Match (Weight: 40%)
    - Alignment with job requirements: backend, databases, APIs, cloud, AI/LLM
    - 1 = Irrelevant skills, completely wrong background
    - 2 = Few overlaps, mostly different tech stack
    - 3 = Partial match, some relevant experience
    - 4 = Strong match, most required skills present
    - 5 = Excellent match with AI/LLM exposure
    
    Experience Level (Weight: 25%)
    - Years of experience and project complexity
    - 1 = Less than 1 year or only trivial projects
    - 2 = 1-2 years of experience
    - 3 = 2-3 years with mid-scale projects
    - 4 = 3-4 years solid track record
    - 5 = 5+ years or high-impact projects
    
    Relevant Achievements (Weight: 20%)
    - Impact of past work: scaling, performance, adoption
    - 1 = No clear achievements mentioned
    - 2 = Minimal improvements or contributions
    - 3 = Some measurable outcomes
    - 4 = Significant contributions, clear impact
    - 5 = Major measurable impact, scaled systems
    
    Cultural/Collaboration Fit (Weight: 15%)
    - Communication, learning mindset, teamwork/leadership
    - 1 = Not demonstrated in CV
    - 2 = Minimal evidence
    - 3 = Average, some evidence
    - 4 = Good teamwork and communication
    - 5 = Excellent demonstrated leadership and collaboration
  `,

  projectScoringRubric: `
    PROJECT DELIVERABLE EVALUATION RUBRIC
    
    Correctness - Prompt & Chaining (Weight: 30%)
    - Implements proper prompt design, LLM chaining, RAG context injection
    - 1 = Not implemented, missing core components
    - 2 = Minimal attempt, significant gaps
    - 3 = Works partially, some components missing
    - 4 = Works correctly, all requirements met
    - 5 = Fully correct with thoughtful optimizations
    
    Code Quality & Structure (Weight: 25%)
    - Clean, modular, reusable, tested code
    - 1 = Poor structure, hard to follow
    - 2 = Some structure, inconsistent patterns
    - 3 = Decent modularity, reasonable organization
    - 4 = Good structure with some tests
    - 5 = Excellent quality with comprehensive tests
    
    Resilience & Error Handling (Weight: 20%)
    - Handles long jobs, retries, randomness, API failures
    - 1 = Missing error handling
    - 2 = Minimal attempts
    - 3 = Partial handling implemented
    - 4 = Solid error handling and retries
    - 5 = Robust, production-ready resilience
    
    Documentation & Explanation (Weight: 15%)
    - README clarity, setup instructions, trade-off explanations
    - 1 = Missing or minimal documentation
    - 2 = Some documentation, unclear in places
    - 3 = Adequate documentation
    - 4 = Clear and helpful documentation
    - 5 = Excellent documentation with insights
    
    Creativity / Bonus (Weight: 10%)
    - Extra features beyond requirements
    - 1 = None
    - 2 = Very basic additions
    - 3 = Useful extra features
    - 4 = Strong enhancements
    - 5 = Outstanding creativity and polish
  `,
};

async function initializeChromaDB() {
  try {
    logger.info("Initializing ChromaDB client...");

    client = new ChromaClient({
      path: "http://localhost:8000",
    });

    const heartbeat = await client.heartbeat();
    logger.info("✅ ChromaDB connection successful:", heartbeat);

    try {
      collection = await client.getOrCreateCollection({
        name: "evaluation_documents",
      });
      logger.info("✅ ChromaDB collection ready");
    } catch (error) {
      logger.info("Getting existing collection...");
      collection = await client.getCollection({
        name: "evaluation_documents",
      });
      logger.info("✅ Using existing collection");
    }

    initialized = true;
    return true;
  } catch (error) {
    logger.error("❌ ChromaDB initialization error:", error.message);
    logger.error("Make sure ChromaDB server is running: docker run -p 8000:8000 chromadb/chroma");
    throw error;
  }
}

async function ingestReferenceDocuments() {
  try {
    if (!collection) {
      throw new Error("ChromaDB not initialized. Call initializeChromaDB() first");
    }

    logger.info("Ingesting reference documents into ChromaDB...");

    const existingCount = await collection.count();
    if (existingCount >= 4) {
      logger.info(`✅ Documents already ingested (${existingCount} documents)`);
      return true;
    }

    await collection.add({
      ids: ["job_description", "case_study_brief", "cv_scoring_rubric", "project_scoring_rubric"],
      documents: [REFERENCE_DOCS.jobDescription, REFERENCE_DOCS.caseStudyBrief, REFERENCE_DOCS.cvScoringRubric, REFERENCE_DOCS.projectScoringRubric],
      metadatas: [
        {type: "job_description", source: "job_posting"},
        {type: "case_study", source: "case_study"},
        {type: "rubric", rubric_type: "cv_evaluation"},
        {type: "rubric", rubric_type: "project_evaluation"},
      ],
    });

    const finalCount = await collection.count();
    logger.info(`✅ Ingested ${finalCount} documents into ChromaDB with vector embeddings`);
    return true;
  } catch (error) {
    logger.error("❌ Error ingesting documents:", error.message);
    throw error;
  }
}

async function retrieveContext(query, contextType = "all", topK = 3) {
  try {
    if (!collection) {
      throw new Error("ChromaDB not initialized");
    }

    let whereFilter = undefined;
    if (contextType !== "all") {
      whereFilter = {type: contextType};
    }

    const results = await collection.query({
      queryTexts: [query],
      nResults: topK,
      where: whereFilter,
    });

    const documents = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances[0] || [];

    logger.info(`✅ Retrieved ${documents.length} documents for query: "${query.substring(0, 50)}..."`);

    return {
      documents: documents,
      metadatas: metadatas,
      distances: distances,
      scores: distances.map((d) => 1 - d),
      query,
    };
  } catch (error) {
    logger.error("❌ Error retrieving context:", error.message);
    throw error;
  }
}

async function getCVEvaluationContext(cvText) {
  try {
    const cvSnippet = cvText.substring(0, 200);
    const jobRequirements = await retrieveContext(`backend skills experience: ${cvSnippet}`, "job_description", 1);

    const rubric = await retrieveContext("CV evaluation scoring criteria rubric", "rubric", 2);

    let cvRubric = rubric.documents[0];
    if (rubric.metadatas && rubric.metadatas.length > 0) {
      const cvRubricIdx = rubric.metadatas.findIndex((m) => m.rubric_type === "cv_evaluation");
      if (cvRubricIdx >= 0) {
        cvRubric = rubric.documents[cvRubricIdx];
      }
    }

    return {
      jobRequirements: jobRequirements.documents.join("\n---\n"),
      rubric: cvRubric,
      query: jobRequirements.query,
    };
  } catch (error) {
    logger.error("❌ Error getting CV evaluation context:", error.message);
    throw error;
  }
}

async function getProjectEvaluationContext(reportText) {
  try {
    const reportSnippet = reportText.substring(0, 200);
    const caseStudy = await retrieveContext(`project requirements implementation: ${reportSnippet}`, "case_study", 1);

    const rubric = await retrieveContext("Project deliverable evaluation scoring rubric", "rubric", 2);

    let projectRubric = rubric.documents[0];
    if (rubric.metadatas && rubric.metadatas.length > 0) {
      const projRubricIdx = rubric.metadatas.findIndex((m) => m.rubric_type === "project_evaluation");
      if (projRubricIdx >= 0) {
        projectRubric = rubric.documents[projRubricIdx];
      }
    }

    return {
      caseStudy: caseStudy.documents.join("\n---\n"),
      rubric: projectRubric,
      query: caseStudy.query,
    };
  } catch (error) {
    logger.error("❌ Error getting project evaluation context:", error.message);
    throw error;
  }
}

async function getAllRubrics() {
  try {
    if (!collection) {
      throw new Error("ChromaDB not initialized");
    }

    const results = await collection.get({
      where: {type: "rubric"},
    });

    const cvRubric = results.documents.find((_, i) => results.metadatas[i].rubric_type === "cv_evaluation") || "";
    const projectRubric = results.documents.find((_, i) => results.metadatas[i].rubric_type === "project_evaluation") || "";

    return {
      cvRubric,
      projectRubric,
      raw: results.documents,
    };
  } catch (error) {
    logger.error("❌ Error retrieving rubrics:", error.message);
    throw error;
  }
}

async function healthCheck() {
  try {
    if (!client || !collection) {
      return {status: "not_initialized"};
    }

    const count = await collection.count();

    return {
      status: "ok",
      mode: "in-memory",
      documents: count,
      collection: collection.name,
    };
  } catch (error) {
    logger.error("❌ ChromaDB health check failed:", error.message);
    return {
      status: "error",
      error: error.message,
    };
  }
}

module.exports = {
  initializeChromaDB,
  ingestReferenceDocuments,
  retrieveContext,
  getCVEvaluationContext,
  getProjectEvaluationContext,
  getAllRubrics,
  healthCheck,
  isInitialized: () => initialized,
};
