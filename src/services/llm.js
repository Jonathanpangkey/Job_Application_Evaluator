require("dotenv").config();
const axios = require("axios");
const logger = require("../config/logger");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL;
const TEMPERATURE = 0.3;

logger.info("LLM Configuration loaded:", {
  provider: "groq",
  hasGroqKey: !!GROQ_API_KEY,
  model: GROQ_MODEL,
  temperature: TEMPERATURE,
});

async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error(`All ${maxAttempts} attempts failed`);
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function callGroq(messages) {
  try {
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not set in .env");
    }

    logger.info("Calling Groq API");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL,
        messages: messages,
        temperature: TEMPERATURE,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content;
    logger.info("Groq API call successful");
    return content;
  } catch (error) {
    logger.error("Groq API error:", {
      status: error.response?.status,
      message: error.message,
    });
    throw error;
  }
}

async function callLLM(messages) {
  try {
    logger.info("Calling LLM provider: groq");
    return await retryWithBackoff(() => callGroq(messages));
  } catch (error) {
    logger.error("LLM call failed:", error);
    throw error;
  }
}

function parseJSONResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn("No JSON found in response, attempting direct parse");
      return JSON.parse(text);
    }

    const json = JSON.parse(jsonMatch[0]);
    logger.info("Successfully parsed JSON response");
    return json;
  } catch (error) {
    logger.error("Error parsing JSON response:", error.message);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

async function evaluateCV(cvText, jobRequirements, rubric) {
  try {
    logger.info("Starting CV evaluation");

    const prompt = `You are an expert HR evaluator. Your task is to evaluate a candidate's CV against a job role.

JOB REQUIREMENTS:
${jobRequirements}

EVALUATION RUBRIC:
${rubric}

CANDIDATE CV:
${cvText}

Based on the job requirements and rubric provided, evaluate the candidate on these criteria:
1. Technical Skills Match (40% weight)
2. Experience Level (25% weight)
3. Relevant Achievements (20% weight)
4. Cultural Fit (15% weight)

Provide your evaluation in this EXACT JSON format (no markdown, no code blocks):
{
  "cv_match_rate": <number between 0 and 1, e.g., 0.82>,
  "cv_feedback": "<specific feedback mentioning strengths and gaps based on the rubric, 2-3 sentences>"
}

Only respond with the JSON object, no other text.`;

    const messages = [{role: "user", content: prompt}];
    const response = await callLLM(messages);
    const result = parseJSONResponse(response);

    // Validate response
    if (typeof result.cv_match_rate !== "number" || result.cv_match_rate < 0 || result.cv_match_rate > 1) {
      throw new Error("Invalid cv_match_rate in response");
    }

    if (typeof result.cv_feedback !== "string") {
      throw new Error("Invalid cv_feedback in response");
    }

    logger.info("CV evaluation completed", {
      matchRate: result.cv_match_rate,
      feedbackLength: result.cv_feedback.length,
    });

    return result;
  } catch (error) {
    logger.error("CV evaluation error:", error);
    throw error;
  }
}

async function evaluateProject(projectText, caseStudy, rubric) {
  try {
    logger.info("Starting project evaluation");

    const prompt = `You are a technical evaluator assessing project deliverables. Be objective and fair.

CASE STUDY REQUIREMENTS:
${caseStudy}

EVALUATION RUBRIC:
${rubric}

PROJECT REPORT:
${projectText}

Based on the case study requirements and rubric, evaluate the project on:
1. Correctness (30% weight)
2. Code Quality (25% weight)
3. Resilience & Error Handling (20% weight)
4. Documentation (15% weight)
5. Creativity (10% weight)

Provide your evaluation in this EXACT JSON format (no markdown, no code blocks):
{
  "project_score": <number between 1 and 5>,
  "project_feedback": "<specific feedback with details about what was done well and what needs improvement, 2-3 sentences>"
}

Only respond with the JSON object, no other text.`;

    const messages = [{role: "user", content: prompt}];
    const response = await callLLM(messages);
    const result = parseJSONResponse(response);

    // Validate response
    if (typeof result.project_score !== "number" || result.project_score < 1 || result.project_score > 5) {
      throw new Error("Invalid project_score in response");
    }

    if (typeof result.project_feedback !== "string") {
      throw new Error("Invalid project_feedback in response");
    }

    logger.info("Project evaluation completed", {
      score: result.project_score,
      feedbackLength: result.project_feedback.length,
    });

    return result;
  } catch (error) {
    logger.error("Project evaluation error:", error);
    throw error;
  }
}

async function generateSummary(cvResult, projectResult) {
  try {
    logger.info("Generating final summary");

    const prompt = `You are an expert HR analyst synthesizing evaluation results.

CV EVALUATION:
- Match Rate: ${cvResult.cv_match_rate}
- Feedback: ${cvResult.cv_feedback}

PROJECT EVALUATION:
- Score: ${projectResult.project_score}/5
- Feedback: ${projectResult.project_feedback}

Generate a concise overall summary in 3-5 sentences that:
1. Highlights key strengths
2. Notes any gaps
3. Provides a hiring recommendation

Respond with ONLY the summary text, no JSON, no additional formatting.`;

    const messages = [{role: "user", content: prompt}];
    const response = await callLLM(messages);
    const summary = response.trim();

    logger.info("Summary generated", {length: summary.length});

    return {overall_summary: summary};
  } catch (error) {
    logger.error("Summary generation error:", error);
    throw error;
  }
}

async function healthCheck() {
  try {
    logger.info("Testing LLM provider: groq");

    const messages = [{role: "user", content: 'Say "ok" and nothing else.'}];
    const response = await callLLM(messages);
    logger.info("LLM health check successful");
    return {status: "ok", provider: "groq"};
  } catch (error) {
    logger.error("LLM health check failed:", error);
    throw error;
  }
}

module.exports = {
  evaluateCV,
  evaluateProject,
  generateSummary,
  healthCheck,
  callLLM,
};
