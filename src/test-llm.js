const llm = require("./services/llm");
const logger = require("./config/logger");

async function testLLM() {
  try {
    console.log("\n🧪 Testing LLM Connection\n");

    const result = await llm.healthCheck();
    console.log("✅ LLM Health Check:", result);
  } catch (error) {
    console.error("❌ LLM Test Failed:", error.message);
    process.exit(1);
  }
}

testLLM();
