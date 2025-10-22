import {info, error as _error} from "../config/logger";
import {initializeChromaDB, ingestReferenceDocuments, retrieveContext} from "../services/rag";

async function main() {
  try {
    console.log("\n🚀 Starting RAG Document Ingestion...\n");
    info("RAG ingestion started");

    console.log("📦 Initializing ChromaDB...");
    await initializeChromaDB();
    console.log("✅ ChromaDB initialized\n");

    console.log("📚 Ingesting reference documents...");
    await ingestReferenceDocuments();
    console.log("✅ Documents ingested successfully\n");

    console.log("🔍 Testing retrieval functionality...");

    const testQuery = "What backend skills are required?";
    console.log(`Query: "${testQuery}"`);

    const results = await retrieveContext(testQuery, "all", 2);
    console.log(`Retrieved ${results.documents.length} documents:`);
    results.documents.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1} (relevance: ${(1 - results.distances[i]).toFixed(3)}):`);
      console.log(doc.substring(0, 200) + "...");
    });

    console.log("\n✅ RAG Ingestion Complete!\n");
    info("RAG ingestion completed successfully");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Ingestion failed:", error.message);
    _error("RAG ingestion failed:", error);
    process.exit(1);
  }
}

main();
