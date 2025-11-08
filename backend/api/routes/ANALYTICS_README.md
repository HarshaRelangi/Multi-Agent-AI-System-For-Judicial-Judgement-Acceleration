# Analytics & Validation Metrics

This module provides analytics endpoints for tracking and validating the Justice AI project's key performance metrics.

## Endpoints

### GET `/api/analytics/summary`
Returns aggregated summary metrics:
- `time_reduction_pct`: Percentage reduction in average processing time
- `avg_processing_time_seconds`: Average case processing time
- `extraction_accuracy_pct`: Average extraction accuracy (precision + recall / 2)
- `retrieval_speedup_x`: Speedup factor for precedent retrieval
- `encryption_success_pct`: Percentage of successful encryption round-trips
- `last_updated`: Timestamp of last update

### GET `/api/analytics/cases`
Returns list of case analytics with optional filtering.

**Query Parameters:**
- `limit`: Maximum number of cases (default: 50)
- `from`: Start date (ISO string)
- `to`: End date (ISO string)
- `min_accuracy`: Minimum extraction accuracy (0-1)
- `encryption_only`: Return only cases with successful encryption (true/false)

### POST `/api/analytics/run-benchmark`
Runs a benchmark test on sample files.

**Request Body:**
```json
{
  "sample_count": 5
}
```

**Response:**
```json
{
  "task_id": "benchmark_1234567890",
  "status": "started",
  "message": "Benchmark started with 5 sample files"
}
```

## Data Storage

Analytics data is stored in `backend/api/data/analytics.json` (PoC implementation).

For production, consider migrating to a database (PostgreSQL, MongoDB, etc.).

## Gold Standard Evaluation

The benchmark uses gold standard evaluation data from `eval/gold.jsonl` to calculate extraction accuracy.

Format:
```jsonl
{"filename": "test_case_01.txt", "entities": ["Entity1", "Entity2", ...]}
```

## Sample Files

Benchmark files should be placed in `sample_files/benchmark/` directory.

Supported formats: `.txt`, `.pdf`, `.docx`

## Running Benchmark Locally

```bash
# Using curl
curl -X POST http://localhost:4000/api/analytics/run-benchmark \
  -H "Content-Type: application/json" \
  -d '{"sample_count": 5}'

# Or use the frontend Analysis page
# Navigate to /analysis tab and click "Run Benchmark"
```

## Metrics Calculation

### Time Reduction
```
time_reduction_pct = ((BASELINE_PROCESSING_TIME - avg_processing_time) / BASELINE_PROCESSING_TIME) * 100
```
Baseline: 7200 seconds (2 hours)

### Extraction Accuracy
Average of precision and recall:
```
accuracy = (precision + recall) / 2
```

### Retrieval Speedup
```
speedup = BASELINE_RETRIEVAL_LATENCY / avg_retrieval_latency
```
Baseline: 2000ms (2 seconds)

### Encryption Success
Percentage of successful encryption/decryption round-trips.

## Environment Variables

- `ENCRYPTION_KEY`: 64-character hex string for encryption (should match server.js)
- `AGENT1_URL`: Agent 1 endpoint (default: http://localhost:8001)
- `AGENT3_URL`: Agent 3 endpoint (default: http://localhost:8003)

