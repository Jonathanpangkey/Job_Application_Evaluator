const rag = require('./services/rag');
const logger = require('./config/logger');

async function runTests() {
  try {
    console.log('\n🧪 Testing RAG Functionality\n');

    // Initialize
    console.log('1️⃣  Initializing RAG...');
    await rag.initializeChromaDB();
    await rag.ingestReferenceDocuments();
    console.log('✅ RAG initialized and documents ingested\n');

    // Test 1: Simple retrieval
    console.log('2️⃣  Test: Simple Context Retrieval');
    console.log('Query: "What backend skills are required?"');
    const result1 = await rag.retrieveContext(
      'What backend skills are required?',
      'all',
      2
    );
    console.log(`Retrieved ${result1.documents.length} documents`);
    console.log('Score:', result1.scores);
    console.log('First 200 chars:', result1.documents[0].substring(0, 200) + '...\n');

    // Test 2: Job-specific retrieval
    console.log('3️⃣  Test: Job Description Retrieval');
    console.log('Query: "Node.js experience required"');
    const result2 = await rag.retrieveContext(
      'Node.js experience required',
      'job_description',
      1
    );
    console.log(`Retrieved ${result2.documents.length} documents`);
    console.log('First 200 chars:', result2.documents[0].substring(0, 200) + '...\n');

    // Test 3: Rubric retrieval
    console.log('4️⃣  Test: CV Rubric Retrieval');
    const result3 = await rag.retrieveContext(
      'CV evaluation scoring',
      'rubric',
      2
    );
    console.log(`Retrieved ${result3.documents.length} rubric documents`);
    console.log('Rubric types:', result3.metadatas);
    console.log('First 150 chars:', result3.documents[0].substring(0, 150) + '...\n');

    // Test 4: CV evaluation context
    console.log('5️⃣  Test: CV Evaluation Context');
    const cvText = 'Backend engineer with 5 years Node.js, Express, PostgreSQL, AWS experience';
    console.log(`Input CV: "${cvText}"`);
    const cvContext = await rag.getCVEvaluationContext(cvText);
    console.log('✅ Job requirements retrieved');
    console.log('First 200 chars:', cvContext.jobRequirements.substring(0, 200) + '...');
    console.log('✅ Rubric retrieved');
    console.log('Rubric first 150 chars:', cvContext.rubric.substring(0, 150) + '...\n');

    // Test 5: Project evaluation context
    console.log('6️⃣  Test: Project Evaluation Context');
    const projectText = 'Built async job queue with LLM chaining, error handling, and RAG integration';
    console.log(`Input Project: "${projectText}"`);
    const projContext = await rag.getProjectEvaluationContext(projectText);
    console.log('✅ Case study requirements retrieved');
    console.log('First 200 chars:', projContext.caseStudy.substring(0, 200) + '...');
    console.log('✅ Rubric retrieved');
    console.log('Rubric first 150 chars:', projContext.rubric.substring(0, 150) + '...\n');

    // Test 6: Rubric retrieval
    console.log('7️⃣  Test: Get All Rubrics');
    const rubrics = await rag.getAllRubrics();
    console.log('✅ Retrieved rubrics');
    console.log('CV Rubric length:', rubrics.cvRubric.length);
    console.log('Project Rubric length:', rubrics.projectRubric.length);
    console.log('Total rubrics:', rubrics.raw.length, '\n');

    console.log('✅ All RAG tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();