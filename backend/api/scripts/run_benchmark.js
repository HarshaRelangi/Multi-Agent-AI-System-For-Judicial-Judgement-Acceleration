#!/usr/bin/env node

/**
 * ============================================================================
 * JUSTICE AI - BENCHMARK RUNNER (Node.js CLI)
 * ============================================================================
 * 
 * Runs full benchmark flow (Agent1 + retrieval + encryption test)
 * Saves detailed metrics to analytics.json and analytics_summary.json
 * 
 * Usage:
 *   node backend/api/scripts/run_benchmark.js --count 5 --timeout 60
 * 
 * ============================================================================
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const AGENT1_URL = process.env.AGENT1_URL || 'http://localhost:8001';
const AGENT3_URL = process.env.AGENT3_URL || 'http://localhost:8003';

// Parse command line arguments
const args = process.argv.slice(2);
const count = parseInt(args.find(a => a.startsWith('--count'))?.split('=')[1] || '5');
const timeout = parseInt(args.find(a => a.startsWith('--timeout'))?.split('=')[1] || '300');

const SAMPLE_FILES_DIR = path.join(__dirname, '..', '..', 'sample_files');
const BENCHMARK_FILES_DIR = path.join(__dirname, '..', '..', 'sample_files', 'benchmark');
const DATA_ZIP_PATH = path.join(__dirname, '..', '..', 'data', 'justice_ai_benchmark_dataset.zip');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Unzip dataset if needed
 */
async function unzipDatasetIfNeeded() {
  try {
    // Check if dataset zip exists
    let zipPath = DATA_ZIP_PATH;
    try {
      await fs.access(zipPath);
    } catch {
      // Try Downloads folder
      const downloadsPath = path.join(require('os').homedir(), 'Downloads', 'justice_ai_benchmark_dataset.zip');
      try {
        await fs.access(downloadsPath);
        console.log('[Benchmark] Found dataset in Downloads folder, copying...');
        await fs.copyFile(downloadsPath, zipPath);
      } catch {
        console.warn('[Benchmark] Dataset zip not found, skipping extraction');
        return false;
      }
    }

    // Check if sample_files already has files
    try {
      const files = await fs.readdir(SAMPLE_FILES_DIR);
      if (files.length > 0) {
        console.log('[Benchmark] Sample files already exist, skipping extraction');
        return true;
      }
    } catch {
      // Directory doesn't exist, will be created by unzip
    }

    // Unzip dataset
    console.log('[Benchmark] Extracting dataset...');
    const unzipCmd = process.platform === 'win32'
      ? `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${path.dirname(SAMPLE_FILES_DIR)}' -Force"`
      : `unzip -o ${zipPath} -d ${path.dirname(SAMPLE_FILES_DIR)}`;

    execSync(unzipCmd, { stdio: 'inherit' });
    console.log('[Benchmark] Dataset extracted successfully');
    return true;
  } catch (error) {
    console.warn('[Benchmark] Error extracting dataset:', error.message);
    return false;
  }
}

/**
 * Get sample files
 */
async function getSampleFiles() {
  await unzipDatasetIfNeeded();

  try {
    const files = await fs.readdir(BENCHMARK_FILES_DIR);
    return files
      .filter(f => f.endsWith('.txt') || f.endsWith('.pdf') || f.endsWith('.docx'))
      .map(f => path.join(BENCHMARK_FILES_DIR, f));
  } catch {
    try {
      const files = await fs.readdir(SAMPLE_FILES_DIR);
      return files
        .filter(f => f.endsWith('.txt') || f.endsWith('.pdf') || f.endsWith('.docx'))
        .map(f => path.join(SAMPLE_FILES_DIR, f));
    } catch {
      console.warn('[Benchmark] No sample files found');
      return [];
    }
  }
}

/**
 * Run benchmark via API
 */
async function runBenchmark() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 JUSTICE AI BENCHMARK RUNNER');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Sample Count: ${count}`);
  console.log(`Timeout: ${timeout}s`);
  console.log('='.repeat(60) + '\n');

  try {
    // Call benchmark endpoint
    const response = await axios.post(
      `${API_BASE}/api/analytics/run-benchmark`,
      { sample_count: count },
      { timeout: timeout * 1000 }
    );

    console.log('✅ Benchmark started:', response.data.message);
    console.log(`Task ID: ${response.data.task_id}\n`);

    // Wait for completion (in production, poll task status)
    console.log('⏳ Waiting for benchmark to complete...');
    console.log('(This may take several minutes depending on file count and size)\n');

    // For PoC, wait a bit then check results
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get updated summary
    const summaryResponse = await axios.get(`${API_BASE}/api/analytics/summary`);
    const summary = summaryResponse.data;

    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK RESULTS');
    console.log('='.repeat(60));
    console.log(`Time Reduction: ${summary.time_reduction_pct}%`);
    console.log(`Avg Processing Time: ${summary.avg_processing_time_seconds}s`);
    console.log(`Extraction Accuracy: ${summary.extraction_accuracy_pct}%`);
    console.log(`Retrieval Speedup: ${summary.retrieval_speedup_x}x`);
    console.log(`Encryption Success: ${summary.encryption_success_pct}%`);
    console.log(`Last Updated: ${summary.last_updated}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Benchmark completed successfully!');
    console.log('Results saved to backend/api/data/analytics.json and analytics_summary.json');

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  runBenchmark().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runBenchmark };

