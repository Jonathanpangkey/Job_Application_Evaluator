require("dotenv").config();

console.log("\n📋 Environment Variables:");
console.log("USE_MOCK_LLM:", process.env.USE_MOCK_LLM);
console.log("LLM_PROVIDER:", process.env.LLM_PROVIDER);
console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "✅ SET" : "❌ NOT SET");

console.log("\n📋 Testing Mock LLM Logic:");

// Replicate exact logic from llm.js
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AUTO_MOCK_MODE = !OPENROUTER_API_KEY || process.env.USE_MOCK_LLM === "true";
const USE_MOCK_LLM = AUTO_MOCK_MODE;

console.log("OPENROUTER_API_KEY exists?", !!OPENROUTER_API_KEY);
console.log("AUTO_MOCK_MODE:", AUTO_MOCK_MODE);
console.log("USE_MOCK_LLM:", USE_MOCK_LLM);
console.log("\n✅ Should use Mock LLM:", USE_MOCK_LLM);

// Test mock function
async function testMockLLM() {
  console.log("\n🧪 Testing Mock LLM Function:");

  const messages = [
    {
      role: "user",
      content: "Evaluate this CV: backend developer with 5 years experience",
    },
  ];

  console.log("Input messages:", messages[0].content.substring(0, 50) + "...");

  // Simulate mock response
  const userMessage = messages[messages.length - 1].content.toLowerCase();

  if (userMessage.includes("cv") || userMessage.includes("resume")) {
    const mockResponse = JSON.stringify({
      cv_match_rate: 0.82,
      cv_feedback: "Strong backend experience with 5+ years. Good cloud and database skills.",
    });

    console.log("\n✅ Mock Response:", mockResponse);
    return mockResponse;
  }
}

testMockLLM().then(() => {
  console.log("\n✅ Debug complete - Mock LLM should work!");
});
