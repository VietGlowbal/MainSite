#!/usr/bin/env node

/**
 * Test script for course extraction
 * 
 * Usage:
 *   node --env-file=.env.local scripts/test-course-extraction.mjs
 * 
 * This script tests the AI course extraction without creating database records.
 * Useful for debugging and testing the AI prompt.
 */

import { extractCourseData } from '../src/lib/ai/course-extractor.ts';

const TEST_URLS = [
  {
    name: 'University of Manchester - Computer Science',
    url: 'https://www.manchester.ac.uk/study/undergraduate/courses/2027/00560/bsc-computer-science/',
  },
  {
    name: 'University of Oxford - Computer Science',
    url: 'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science',
  },
  {
    name: 'MIT - Admissions',
    url: 'https://mitadmissions.org/apply/',
  },
];

async function testExtraction(testCase) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing: ${testCase.name}`);
  console.log(`URL: ${testCase.url}`);
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment');
    console.error('   Make sure to run: node --env-file=.env.local scripts/test-course-extraction.mjs');
    process.exit(1);
  }

  console.log(`Using model: ${model}`);
  console.log('Fetching and analyzing course page...\n');

  const startTime = Date.now();

  try {
    const data = await extractCourseData(testCase.url, apiKey, model);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ Extraction successful!\n');
    console.log(`⏱️  Duration: ${duration}s\n`);

    // Display results
    console.log('📚 COURSE INFORMATION');
    console.log('─'.repeat(80));
    console.log(`University:        ${data.universityName}`);
    console.log(`Course:            ${data.courseName}`);
    console.log(`Degree Level:      ${data.degreeLevel || 'N/A'}`);
    console.log(`Subject:           ${data.subject || 'N/A'}`);
    console.log(`Study Mode:        ${data.studyMode || 'N/A'}`);
    console.log(`Intake:            ${data.intake || 'N/A'}`);
    console.log(`Country:           ${data.countryFlag || ''} ${data.country || 'N/A'}`);

    console.log('\n📝 APPLICATION DETAILS');
    console.log('─'.repeat(80));
    console.log(`Method:            ${data.applicationMethod || 'N/A'}`);
    console.log(`Code:              ${data.applicationCode || 'N/A'}`);
    console.log(`Deadline:          ${data.deadline || 'N/A'}`);
    console.log(`Tuition Fee:       ${data.tuitionFee || 'N/A'}`);
    console.log(`Entry Req:         ${data.entryRequirementsSummary || 'N/A'}`);
    console.log(`English Req:       ${data.englishRequirementsSummary || 'N/A'}`);
    console.log(`Confidence:        ${data.sourceConfidence.toUpperCase()}`);

    console.log('\n📋 STAGES & TASKS');
    console.log('─'.repeat(80));
    let totalTasks = 0;
    data.stages.forEach((stage) => {
      console.log(`\n${stage.order}. ${stage.name} ${stage.isRequired ? '(Required)' : '(Optional)'}`);
      console.log(`   ${stage.description}`);
      console.log(`   Tasks: ${stage.tasks.length}`);
      
      stage.tasks.forEach((task, idx) => {
        const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        const type = task.type === 'required' ? '[REQ]' : task.type === 'recommended' ? '[REC]' : '[OPT]';
        console.log(`   ${idx + 1}. ${priority} ${type} ${task.title}`);
        if (task.description) {
          console.log(`      ${task.description}`);
        }
      });
      
      totalTasks += stage.tasks.length;
    });

    console.log(`\n📊 Total Tasks: ${totalTasks}`);

    console.log('\n💰 SCHOLARSHIPS');
    console.log('─'.repeat(80));
    if (data.scholarships.length === 0) {
      console.log('No scholarships found on this page.');
    } else {
      data.scholarships.forEach((scholarship, idx) => {
        console.log(`\n${idx + 1}. ${scholarship.name}`);
        if (scholarship.amount) console.log(`   Amount: ${scholarship.amount}`);
        if (scholarship.eligibility) console.log(`   Eligibility: ${scholarship.eligibility}`);
        if (scholarship.deadline) console.log(`   Deadline: ${scholarship.deadline}`);
        if (scholarship.url) console.log(`   URL: ${scholarship.url}`);
        console.log(`   Confidence: ${scholarship.confidence}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80) + '\n');

    return true;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ Extraction failed after ${duration}s\n`);
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    return false;
  }
}

async function main() {
  console.log('\n🧪 Course Extraction Test Suite');
  console.log('='.repeat(80));
  console.log('This script tests the AI course extraction functionality.');
  console.log('No database records will be created.\n');

  // Check if specific URL provided as argument
  const customUrl = process.argv[2];
  
  if (customUrl) {
    console.log('Testing custom URL...\n');
    await testExtraction({
      name: 'Custom URL',
      url: customUrl,
    });
    return;
  }

  // Run all test cases
  console.log(`Running ${TEST_URLS.length} test cases...\n`);
  
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_URLS) {
    const success = await testExtraction(testCase);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Wait a bit between tests to avoid rate limits
    if (TEST_URLS.indexOf(testCase) < TEST_URLS.length - 1) {
      console.log('\nWaiting 5 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests:  ${TEST_URLS.length}`);
  console.log(`Passed:       ${passed} ✅`);
  console.log(`Failed:       ${failed} ❌`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
